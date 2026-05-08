import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import {
  SHIPMENT,
  SHIPMENT_DETAILS,
  DRDV_DOCUMENTS,
  MANDATORY_DOCS,
  SHIPMENTS,
} from './fixtures.js'

/**
 * Mock REST endpoints for the GoComet V2 demo. These are intentionally
 * unauthenticated and return static fixture data — they exist so the renderer
 * can exercise the real DataSourceResolver path (loading state, transforms,
 * connector audit log) instead of inlining fixtures into page schemas.
 *
 * Routes:
 *   GET /mock/v2/shipments                  → list of shipments
 *   GET /mock/v2/shipments/:id              → header for a shipment
 *   GET /mock/v2/shipments/:id/details      → details tab fields
 *   GET /mock/v2/shipments/:id/drdv         → DRDV documents
 *   GET /mock/v2/shipments/:id/documents    → mandatory docs queue
 *
 * Latency is simulated (~250-450ms) so the loading state is visibly exercised
 * in the renderer. This is dev-only — production should use real endpoints
 * registered through the connector + endpoint-registry modules.
 */
export async function mockDataRouter(fastify: FastifyInstance): Promise<void> {
  fastify.get('/v2/shipments', async (_req, reply) => {
    await simulateLatency()
    return reply.send(SHIPMENTS)
  })

  fastify.get<{ Params: { id: string } }>(
    '/v2/shipments/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await simulateLatency()
      // Ignore the id — the demo data only carries one fully-populated record.
      // We log the requested id so devs can verify the param interpolation
      // pipeline is plumbed through end-to-end (URL → connector → fetch).
      void req.params.id
      return reply.send(SHIPMENT)
    },
  )

  fastify.get<{ Params: { id: string } }>(
    '/v2/shipments/:id/details',
    async (req, reply) => {
      await simulateLatency()
      void req.params.id
      return reply.send(SHIPMENT_DETAILS)
    },
  )

  fastify.get<{ Params: { id: string } }>(
    '/v2/shipments/:id/drdv',
    async (req, reply) => {
      await simulateLatency()
      void req.params.id
      return reply.send(DRDV_DOCUMENTS)
    },
  )

  fastify.get<{ Params: { id: string } }>(
    '/v2/shipments/:id/documents',
    async (req, reply) => {
      await simulateLatency()
      void req.params.id
      return reply.send(MANDATORY_DOCS)
    },
  )
}

async function simulateLatency(): Promise<void> {
  // Random 250-450ms — long enough that loading skeletons render, short enough
  // that the page is interactive quickly. Resist the urge to bump this for
  // "more dramatic" loading; the resolver already serialises dependent
  // sources, so total page load grows linearly with chained sources.
  const delay = 250 + Math.floor(Math.random() * 200)
  await new Promise(resolve => setTimeout(resolve, delay))
}
