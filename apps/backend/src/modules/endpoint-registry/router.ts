import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../middleware/auth.js'
import {
  listConnectors,
  registerConnector,
  listConnectorEndpoints,
  getEndpoint,
  registerEndpoint,
  updateEndpoint,
  deactivateEndpoint,
  testEndpoint,
} from './service.js'
import {
  RegisterConnectorSchema,
  RegisterEndpointSchema,
  UpdateEndpointSchema,
  TestEndpointSchema,
} from './types.js'

export async function endpointRegistryRouter(fastify: FastifyInstance): Promise<void> {
  // ── GET /endpoints/connectors ─────────────────────────────────────────────────
  fastify.get('/connectors', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const connectors = await listConnectors()
      return reply.status(200).send({ connectors })
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // ── POST /endpoints/connectors ────────────────────────────────────────────────
  fastify.post('/connectors', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = RegisterConnectorSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    try {
      const connector = await registerConnector(body.data)
      return reply.status(201).send({ connector })
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // ── GET /endpoints/connectors/:id/endpoints ───────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/connectors/:id/endpoints',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      try {
        const endpoints = await listConnectorEndpoints(request.params.id)
        return reply.status(200).send({ endpoints })
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // ── POST /endpoints/test ──────────────────────────────────────────────────────
  // Must be registered BEFORE /:id to avoid matching "test" as an id
  fastify.post('/test', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = TestEndpointSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    try {
      const result = await testEndpoint(body.data)
      return reply.status(200).send(result)
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // ── POST /endpoints ───────────────────────────────────────────────────────────
  fastify.post('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = RegisterEndpointSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    try {
      const endpoint = await registerEndpoint(body.data)
      return reply.status(201).send({ endpoint })
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // ── GET /endpoints/:id ────────────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      try {
        const endpoint = await getEndpoint(request.params.id)
        return reply.status(200).send({ endpoint })
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // ── PATCH /endpoints/:id ──────────────────────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = UpdateEndpointSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
      }

      try {
        const endpoint = await updateEndpoint(request.params.id, body.data)
        return reply.status(200).send({ endpoint })
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // ── DELETE /endpoints/:id (soft delete) ───────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      try {
        await deactivateEndpoint(request.params.id)
        return reply.status(204).send()
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )
}
