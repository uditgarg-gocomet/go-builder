import type { FastifyInstance } from 'fastify'
import { authService } from '../auth/service.js'
import { requireAuth } from '../../middleware/auth.js'
import { ingest, query } from './service.js'
import { IngestRequestSchema, QueryFiltersSchema } from './types.js'

export async function actionLogsRouter(fastify: FastifyInstance): Promise<void> {
  // ── POST /action-logs — non-blocking batch ingest ─────────────────────────────
  fastify.post('/', async (request, reply) => {
    // Validate portal session token (or service token) from Authorization header
    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Authorization required' })
    }
    const token = authHeader.slice(7)
    const validation = await authService.validateToken(token)
    if (!validation.valid || !validation.payload) {
      return reply.status(401).send({ error: 'Invalid or expired token' })
    }

    const parsed = IngestRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      const batchError = parsed.error.issues.find(i => i.path[0] === 'events' && i.code === 'too_big')
      if (batchError) {
        return reply.status(400).send({ error: 'Batch exceeds maximum of 100 events' })
      }
      return reply.status(400).send({ error: 'Validation error', issues: parsed.error.issues })
    }

    // Return 202 immediately — do not await the insert
    ingest(parsed.data.events)
    return reply.status(202).send({ received: true })
  })

  // ── GET /action-logs — query logs ─────────────────────────────────────────────
  fastify.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = QueryFiltersSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation error', issues: parsed.error.issues })
    }

    try {
      const result = await query(parsed.data)
      return reply.status(200).send(result)
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })
}
