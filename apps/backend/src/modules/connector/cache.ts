import { redis } from '../../lib/redis.js'
import { db } from '../../lib/db.js'

interface CacheParams {
  mode: string
  method: string
  endpointId?: string
}

function buildCacheKey(endpointId: string, queryParams: Record<string, unknown>): string {
  const sortedParams = Object.keys(queryParams).sort()
    .map(k => `${k}=${JSON.stringify(queryParams[k])}`)
    .join('&')
  return `cache:${endpointId}:${sortedParams}`
}

export async function getCached(
  params: CacheParams,
  queryParams: Record<string, unknown>
): Promise<unknown | null> {
  if (params.mode !== 'REGISTERED' || params.method !== 'GET' || !params.endpointId) {
    return null
  }

  const key = buildCacheKey(params.endpointId, queryParams)
  const cached = await redis.get(key)
  if (!cached) return null

  return JSON.parse(cached) as unknown
}

export async function setCached(
  params: CacheParams,
  queryParams: Record<string, unknown>,
  data: unknown
): Promise<void> {
  if (params.mode !== 'REGISTERED' || params.method !== 'GET' || !params.endpointId) {
    return
  }

  const cacheConfig = await db.endpointCacheConfig.findUnique({
    where: { endpointId: params.endpointId },
  })

  if (!cacheConfig) return

  const key = buildCacheKey(params.endpointId, queryParams)
  await redis.setex(key, cacheConfig.ttlSeconds, JSON.stringify(data))
}

export async function invalidateEndpointCache(endpointId: string): Promise<void> {
  const pattern = `cache:${endpointId}:*`
  const keys = await redis.keys(pattern)
  if (keys.length > 0) {
    await redis.del(...keys)
  }
}
