import { redis } from '../../lib/redis.js'
import { db } from '../../lib/db.js'
import { createChildLogger } from '../../lib/logger.js'

const logger = createChildLogger('connector:concurrency')
const LOCK_EXPIRY_SECONDS = 60

async function getMaxConcurrent(connectorId: string): Promise<number> {
  const config = await db.connectorRateLimit.findUnique({ where: { connectorId } })
  return config?.maxConcurrent ?? 5
}

export async function acquireConcurrencySlot(connectorId: string, appId: string): Promise<boolean> {
  const key = `cc:${connectorId}:${appId}`
  const maxConcurrent = await getMaxConcurrent(connectorId)

  // Lua script: atomically check + increment
  const script = `
    local current = redis.call('GET', KEYS[1])
    local max = tonumber(ARGV[1])
    if current == false then
      redis.call('SET', KEYS[1], 1, 'EX', ARGV[2])
      return 1
    end
    if tonumber(current) >= max then
      return 0
    end
    local newVal = redis.call('INCR', KEYS[1])
    redis.call('EXPIRE', KEYS[1], ARGV[2])
    return newVal
  `

  const result = await redis.eval(script, 1, key, String(maxConcurrent), String(LOCK_EXPIRY_SECONDS))
  if (result === 0) {
    logger.warn({ connectorId, appId }, 'Concurrency limit exceeded')
    return false
  }
  return true
}

export async function releaseConcurrencySlot(connectorId: string, appId: string): Promise<void> {
  const key = `cc:${connectorId}:${appId}`
  const current = await redis.get(key)
  if (current && parseInt(current) > 0) {
    await redis.decr(key)
  }
}
