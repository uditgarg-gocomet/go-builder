import fs from 'node:fs/promises'
import type { FastifyInstance } from 'fastify'
import mime from 'mime-types'
import { requireAuth } from '../../middleware/auth.js'
import { handleUpload, listAssets, deleteAsset } from './service.js'
import { storageProvider } from './storage.js'

export async function assetsRouter(fastify: FastifyInstance): Promise<void> {
  // ── POST /assets/upload ───────────────────────────────────────────────────────
  fastify.post('/upload', { preHandler: [requireAuth] }, async (request, reply) => {
    const appId = (request.headers['x-app-id'] as string) ?? ''
    if (!appId) {
      return reply.status(400).send({ error: 'x-app-id header is required' })
    }

    const session = request.fdeSession
    if (!session) return reply.status(401).send({ error: 'Unauthorized' })

    try {
      const data = await request.file()
      if (!data) {
        return reply.status(400).send({ error: 'No file provided' })
      }

      const buffer = await data.toBuffer()
      const mimeType = data.mimetype || (mime.lookup(data.filename) || 'application/octet-stream')

      const asset = await handleUpload(
        appId,
        buffer,
        data.filename,
        mimeType,
        session.sub
      )

      return reply.status(200).send({ asset })
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // ── GET /assets?appId=&mimeType=&search= ──────────────────────────────────────
  fastify.get<{
    Querystring: { appId?: string; mimeType?: string; search?: string }
  }>('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const { appId, mimeType, search } = request.query
    if (!appId) {
      return reply.status(400).send({ error: 'appId query parameter is required' })
    }

    try {
      const assets = await listAssets(appId, { mimeType, search })
      return reply.status(200).send({ assets })
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // ── DELETE /assets/:id ────────────────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const session = request.fdeSession
      if (!session) return reply.status(401).send({ error: 'Unauthorized' })

      try {
        await deleteAsset(request.params.id, session.sub)
        return reply.status(204).send()
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // ── GET /assets/:key* — serve file (local storage only) ───────────────────────
  fastify.get<{ Params: { '*': string } }>('/*', async (request, reply) => {
    const key = request.params['*']
    const filePath = storageProvider.getFilePath(key)
    if (!filePath) {
      return reply.status(501).send({ error: 'File serving not available for this storage provider' })
    }

    try {
      const buffer = await fs.readFile(filePath)
      const mimeType = mime.lookup(key) || 'application/octet-stream'

      return reply
        .status(200)
        .header('Content-Type', mimeType)
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .send(buffer)
    } catch (err: unknown) {
      const e = err as { code?: string }
      if (e.code === 'ENOENT') {
        return reply.status(404).send({ error: 'File not found' })
      }
      return reply.status(500).send({ error: 'Failed to read file' })
    }
  })
}
