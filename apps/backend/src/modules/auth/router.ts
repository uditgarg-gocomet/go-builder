import type { FastifyInstance } from 'fastify'

export async function authRouter(fastify: FastifyInstance): Promise<void> {
  fastify.log.info('auth module registered')
  // Routes implemented in Phase 2
}
