import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../middleware/auth.js'
import {
  saveDraft,
  promoteToStaging,
  promoteToProduction,
  rollback,
  getHistory,
  getDiff,
} from './service.js'
import {
  SaveDraftRequestSchema,
  PromoteRequestSchema,
  RollbackRequestSchema,
  DiffQuerySchema,
} from './types.js'

export async function schemaRouter(fastify: FastifyInstance): Promise<void> {
  // ── POST /schema/draft ────────────────────────────────────────────────────────
  fastify.post('/draft', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = SaveDraftRequestSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    try {
      const result = await saveDraft(body.data)
      return reply.status(200).send(result)
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // ── POST /schema/:versionId/promote/staging ───────────────────────────────────
  fastify.post<{ Params: { versionId: string } }>(
    '/:versionId/promote/staging',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = PromoteRequestSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
      }

      try {
        const result = await promoteToStaging(request.params.versionId, body.data)
        return reply.status(200).send(result)
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // ── POST /schema/:versionId/promote/production ────────────────────────────────
  fastify.post<{ Params: { versionId: string } }>(
    '/:versionId/promote/production',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = PromoteRequestSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
      }

      try {
        const result = await promoteToProduction(request.params.versionId, body.data)
        return reply.status(200).send(result)
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // ── POST /schema/:pageId/rollback ─────────────────────────────────────────────
  fastify.post<{ Params: { pageId: string } }>(
    '/:pageId/rollback',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = RollbackRequestSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
      }

      try {
        const result = await rollback(request.params.pageId, body.data)
        return reply.status(200).send(result)
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // ── GET /schema/:pageId/history ───────────────────────────────────────────────
  fastify.get<{ Params: { pageId: string } }>(
    '/:pageId/history',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      try {
        const versions = await getHistory(request.params.pageId)
        return reply.status(200).send({ versions })
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // ── GET /schema/:pageId/diff?from=&to= ────────────────────────────────────────
  fastify.get<{ Params: { pageId: string } }>(
    '/:pageId/diff',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = DiffQuerySchema.safeParse(request.query)
      if (!query.success) {
        return reply.status(400).send({ error: 'Validation error', issues: query.error.issues })
      }

      try {
        const result = await getDiff(request.params.pageId, query.data.from, query.data.to)
        return reply.status(200).send(result)
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )
}
