import type { FastifyInstance } from 'fastify'

export async function schemaRouter(fastify: FastifyInstance): Promise<void> {
  fastify.log.info('schema module registered')
  // Routes implemented in Phase 2
}
