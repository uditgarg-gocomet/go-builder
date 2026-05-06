import type { FastifyInstance } from 'fastify'

export async function assetsRouter(fastify: FastifyInstance): Promise<void> {
  fastify.log.info('assets module registered')
  // Routes implemented in Phase 3
}
