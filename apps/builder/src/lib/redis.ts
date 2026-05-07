import Redis from 'ioredis'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'

// Singleton for serverless / Next.js route handlers
const globalForRedis = globalThis as unknown as { _builderRedis?: Redis }

export const redis: Redis =
  globalForRedis._builderRedis ??
  (globalForRedis._builderRedis = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 }))

export const PREVIEW_TTL_SECONDS = 3600 // 1 hour
