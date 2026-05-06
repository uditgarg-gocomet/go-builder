import type { FastifyInstance } from 'fastify'

export async function endpointRegistryRouter(fastify: FastifyInstance): Promise<void> {
  fastify.log.info('endpoint-registry module registered')
  // Routes implemented in Phase 3
}
