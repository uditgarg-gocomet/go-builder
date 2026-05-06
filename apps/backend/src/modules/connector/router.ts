import type { FastifyInstance } from 'fastify'

export async function connectorRouter(fastify: FastifyInstance): Promise<void> {
  fastify.log.info('connector module registered')
  // Routes implemented in Phase 3
}
