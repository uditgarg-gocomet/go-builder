import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../middleware/auth.js'
import {
  saveDraft,
  getDraft,
  promoteToStaging,
  promoteToProduction,
  promoteApp,
  rollback,
  getHistory,
  getDiff,
  listDraftSnapshots,
  restoreDraftSnapshot,
} from './service.js'
import {
  SaveDraftRequestSchema,
  PromoteRequestSchema,
  RollbackRequestSchema,
  DiffQuerySchema,
  RestoreDraftSnapshotSchema,
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

  // ── GET /schema/:pageId/draft ─────────────────────────────────────────────────
  fastify.get<{ Params: { pageId: string } }>(
    '/:pageId/draft',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      try {
        const result = await getDraft(request.params.pageId)
        if (!result) return reply.status(200).send({ schema: null })
        return reply.status(200).send(result)
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

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

  // ── POST /schema/apps/:appId/promote/:env ─────────────────────────────────────
  // App-level "publish all pages" — promotes every eligible page in one shot
  // and creates a single Deployment listing all of them (plus carry-forward
  // for any page that didn't have a candidate version).
  fastify.post<{ Params: { appId: string; env: string } }>(
    '/apps/:appId/promote/:env',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const env = request.params.env
      if (env !== 'staging' && env !== 'production') {
        return reply.status(400).send({ error: 'Environment must be "staging" or "production"' })
      }
      const body = PromoteRequestSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
      }

      try {
        const result = await promoteApp(
          request.params.appId,
          env === 'staging' ? 'STAGING' : 'PRODUCTION',
          body.data,
        )
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

  // ── GET /schema/:pageId/draft/history ─────────────────────────────────────────
  // Returns last-N draft snapshots (rolling cap ~50). Each save of the draft
  // captures the *previous* state, so this is the audit trail of overwrites.
  fastify.get<{ Params: { pageId: string } }>(
    '/:pageId/draft/history',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      try {
        const snapshots = await listDraftSnapshots(request.params.pageId)
        return reply.status(200).send({ snapshots })
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // ── POST /schema/:pageId/draft/restore ────────────────────────────────────────
  // Restores a snapshot into the current DRAFT. The pre-restore state is itself
  // captured as a snapshot, so a restore is always reversible.
  fastify.post<{ Params: { pageId: string } }>(
    '/:pageId/draft/restore',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = RestoreDraftSnapshotSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
      }

      try {
        const result = await restoreDraftSnapshot(
          request.params.pageId,
          body.data.snapshotId,
          body.data.restoredBy,
        )
        return reply.status(200).send(result)
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )
}
