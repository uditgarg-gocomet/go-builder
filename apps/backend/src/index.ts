import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import { v4 as uuidv4 } from 'uuid'

import { initSentry, Sentry } from './lib/sentry.js'
import { logger } from './lib/logger.js'
import { db } from './lib/db.js'
import { redis } from './lib/redis.js'

import { appsRouter } from './modules/apps/router.js'
import { schemaRouter } from './modules/schema/router.js'
import { registryRouter } from './modules/registry/router.js'
import { endpointRegistryRouter } from './modules/endpoint-registry/router.js'
import { connectorRouter } from './modules/connector/router.js'
import { authRouter } from './modules/auth/router.js'
import { assetsRouter } from './modules/assets/router.js'
import { actionLogsRouter } from './modules/action-logs/router.js'
import { mockDataRouter } from './modules/mock-data/router.js'

initSentry()

const fastify = Fastify({
  logger: false,
  genReqId: () => uuidv4(),
  trustProxy: true,
})

// ── Plugins ────────────────────────────────────────────────────────────────────

await fastify.register(helmet, {
  contentSecurityPolicy: false,
  // The builder + renderer run on different origins than the backend. Helmet's
  // default CORP policy of 'same-origin' blocks asset fetches (e.g. <img src>
  // from the logo picker preview). Relaxing to 'cross-origin' is safe here —
  // asset keys are content-addressed hashes served with a long cache header,
  // and CORS already gates credentialed API calls.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
})

await fastify.register(cors, {
  origin: process.env['CORS_ORIGIN']?.split(',') ?? '*',
  credentials: true,
})

// Enables multipart/form-data parsing used by the assets upload route. Cap
// mirrors validateFile's 10MB guard so oversized bodies are rejected at
// parse time rather than after buffering into memory.
await fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
})

// ── correlationId middleware ───────────────────────────────────────────────────

fastify.addHook('onRequest', async (request) => {
  const correlationId =
    (request.headers['x-correlation-id'] as string | undefined) ?? request.id
  request.headers['x-correlation-id'] = correlationId
  request.log = logger.child({ correlationId, reqId: request.id })
})

fastify.addHook('onResponse', (request, reply, done) => {
  logger.info(
    {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs: reply.elapsedTime,
      correlationId: request.headers['x-correlation-id'],
    },
    'request completed'
  )
  done()
})

// ── Module routers ─────────────────────────────────────────────────────────────

await fastify.register(authRouter, { prefix: '/auth' })
await fastify.register(appsRouter, { prefix: '/apps' })
await fastify.register(schemaRouter, { prefix: '/schema' })
await fastify.register(registryRouter, { prefix: '/registry' })
await fastify.register(endpointRegistryRouter, { prefix: '/endpoints' })
await fastify.register(connectorRouter, { prefix: '/connector' })
await fastify.register(assetsRouter, { prefix: '/assets' })
await fastify.register(actionLogsRouter, { prefix: '/action-logs' })
await fastify.register(mockDataRouter, { prefix: '/mock' })

// ── Health check ───────────────────────────────────────────────────────────────

fastify.get('/health', async (_request, reply) => {
  let postgresStatus: 'ok' | 'error' = 'ok'
  let redisStatus: 'ok' | 'error' = 'ok'

  try {
    await db.$queryRaw`SELECT 1`
  } catch {
    postgresStatus = 'error'
  }

  try {
    await redis.ping()
  } catch {
    redisStatus = 'error'
  }

  const overallStatus =
    postgresStatus === 'ok' && redisStatus === 'ok'
      ? 'ok'
      : postgresStatus === 'error' && redisStatus === 'error'
        ? 'down'
        : 'degraded'

  const statusCode = overallStatus === 'ok' ? 200 : overallStatus === 'degraded' ? 200 : 503

  return reply.status(statusCode).send({
    status: overallStatus,
    postgres: postgresStatus,
    redis: redisStatus,
    timestamp: new Date().toISOString(),
    version: process.env['npm_package_version'] ?? 'unknown',
  })
})

// ── JWKS endpoint ──────────────────────────────────────────────────────────────

fastify.get('/.well-known/jwks.json', async (_request, reply) => {
  const { getJWKS } = await import('./modules/auth/lib/tokenSigner.js')
  try {
    const jwks = await getJWKS()
    return reply.status(200).header('Cache-Control', 'public, max-age=3600').send(jwks)
  } catch {
    return reply.status(503).send({ error: 'JWKS not configured' })
  }
})

// ── Global error handler ───────────────────────────────────────────────────────

fastify.setErrorHandler((error, request, reply) => {
  const correlationId = request.headers['x-correlation-id'] as string | undefined

  logger.error(
    { err: error, correlationId, url: request.url, method: request.method },
    'Unhandled request error'
  )

  Sentry.captureException(error, { extra: { correlationId, url: request.url } })

  const statusCode = error.statusCode ?? 500
  void reply.status(statusCode).send({
    error: error.name,
    message: statusCode < 500 ? error.message : 'Internal server error',
    statusCode,
    correlationId,
  })
})

// ── Start ──────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env['PORT'] ?? '3001', 10)
const HOST = process.env['HOST'] ?? '0.0.0.0'

try {
  await fastify.listen({ port: PORT, host: HOST })
  logger.info({ port: PORT, host: HOST }, 'Core Backend listening')
} catch (err) {
  logger.fatal({ err }, 'Failed to start Core Backend')
  Sentry.captureException(err)
  process.exit(1)
}

// Graceful shutdown
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, async () => {
    logger.info({ signal }, 'Shutting down gracefully')
    await fastify.close()
    await db.$disconnect()
    await redis.quit()
    process.exit(0)
  })
}
