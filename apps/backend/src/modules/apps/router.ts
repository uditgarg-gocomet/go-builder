import type { FastifyInstance } from 'fastify'

export async function appsRouter(fastify: FastifyInstance): Promise<void> {
  fastify.log.info('apps module registered')
  // Routes implemented in Phase 2
}
