import type { FastifyInstance } from 'fastify'

export async function actionLogsRouter(fastify: FastifyInstance): Promise<void> {
  fastify.log.info('action-logs module registered')
  // Routes implemented in Phase 3
}
