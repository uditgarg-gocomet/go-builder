import { redis } from '../../lib/redis.js'
import { db } from '../../lib/db.js'
import { createChildLogger } from '../../lib/logger.js'

const logger = createChildLogger('connector:rate-limiter')

interface WindowConfig {
  windowSec: number
  limit: number
  label: string
}

// Config cached in Redis for 5 minutes
const CONFIG_TTL_SECONDS = 300

async function getConnectorRateLimit(connectorId: string) {
  const cacheKey = `rl:config:${connectorId}`
  const cached = await redis.get(cacheKey)
  if (cached) {
    return JSON.parse(cached) as {
      requestsPerMin: number
      requestsPerHour: number
      requestsPerDay: number
    }
  }

  const config = await db.connectorRateLimit.findUnique({ where: { connectorId } })
  const result = config
    ? { requestsPerMin: config.requestsPerMin, requestsPerHour: config.requestsPerHour, requestsPerDay: config.requestsPerDay }
    : { requestsPerMin: 60, requestsPerHour: 1000, requestsPerDay: 10000 }

  await redis.setex(cacheKey, CONFIG_TTL_SECONDS, JSON.stringify(result))
  return result
}

export async function checkRateLimit(connectorId: string, appId: string): Promise<boolean> {
  const config = await getConnectorRateLimit(connectorId)

  const windows: WindowConfig[] = [
    { windowSec: 60, limit: config.requestsPerMin, label: 'min' },
    { windowSec: 3600, limit: config.requestsPerHour, label: 'hour' },
    { windowSec: 86400, limit: config.requestsPerDay, label: 'day' },
  ]

  const now = Date.now()

  for (const { windowSec, limit, label } of windows) {
    const key = `rl:${connectorId}:${appId}:${label}`
    const cutoff = now - windowSec * 1000

    const pipeline = redis.pipeline()
    pipeline.zremrangebyscore(key, '-inf', cutoff)
    pipeline.zcard(key)
    pipeline.zadd(key, now, `${now}-${Math.random()}`)
    pipeline.expire(key, windowSec)
    const results = await pipeline.exec()

    if (!results) continue
    const count = results[1]?.[1] as number ?? 0

    if (count >= limit) {
      logger.warn({ connectorId, appId, window: label, count, limit }, 'Rate limit exceeded')
      return false
    }
  }

  return true
}
