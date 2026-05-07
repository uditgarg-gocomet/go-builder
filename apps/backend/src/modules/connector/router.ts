import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { authService } from '../auth/service.js'
import { execute, type ConnectorExecuteParams } from './service.js'

const ExecuteRequestSchema = z.object({
  mode: z.enum(['REGISTERED', 'CUSTOM_CONNECTOR', 'CUSTOM_MANUAL']),
  endpointId: z.string().optional(),
  connectorId: z.string().optional(),
  url: z.string().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  customHeaders: z.record(z.string()).optional(),
  pathParams: z.record(z.string()).optional(),
  queryParams: z.record(z.unknown()).optional(),
  body: z.unknown().optional(),
  environment: z.enum(['staging', 'production']).default('staging'),
  appId: z.string().min(1),
  pageId: z.string().optional(),
  datasourceAlias: z.string().optional(),
  actionId: z.string().optional(),
  invalidateEndpoints: z.array(z.string()).optional(),
})

export async function connectorRouter(fastify: FastifyInstance): Promise<void> {
  // ── POST /connector/execute ───────────────────────────────────────────────────
  fastify.post('/execute', async (request, reply) => {
    // Validate service token or FDE session from Authorization header
    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Authorization required' })
    }
    const token = authHeader.slice(7)
    const validation = await authService.validateToken(token)
    if (!validation.valid || !validation.payload) {
      return reply.status(401).send({ error: 'Invalid or expired token' })
    }

    const userId = validation.payload.sub

    const body = ExecuteRequestSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    const correlationId = (request as { correlationId?: string }).correlationId

    try {
      const executeParams = Object.fromEntries(
        Object.entries({ ...body.data, userId, ...(correlationId !== undefined ? { correlationId } : {}) })
          .filter(([, v]) => v !== undefined)
      ) as unknown as ConnectorExecuteParams
      const result = await execute(executeParams)
      return reply.status(200).send(result)
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })
}
