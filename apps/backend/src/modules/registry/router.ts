import type { FastifyInstance } from 'fastify'

export async function registryRouter(fastify: FastifyInstance): Promise<void> {
  fastify.log.info('registry module registered')
  // Routes implemented in Phase 2
}
