import { createChildLogger } from '../../lib/logger.js'
import { checkRateLimit } from './rateLimiter.js'
import { acquireConcurrencySlot, releaseConcurrencySlot } from './concurrencyLimiter.js'
import { getCached, setCached, invalidateEndpointCache } from './cache.js'
import { auditLog } from './auditLogger.js'
import { executeRequest, type ExecuteParams, type ExecuteResult } from './executor.js'

const logger = createChildLogger('connector')

export interface ConnectorExecuteParams extends ExecuteParams {
  appId: string
  pageId?: string
  datasourceAlias?: string
  actionId?: string
  userId: string
  correlationId?: string
  invalidateEndpoints?: string[]
}

export async function execute(params: ConnectorExecuteParams): Promise<ExecuteResult> {
  const { appId, userId, correlationId, invalidateEndpoints } = params

  // Determine connectorId for rate/concurrency limiting
  const connectorId = params.connectorId ?? params.endpointId ?? 'unknown'

  // Rate limit check
  const withinRateLimit = await checkRateLimit(connectorId, appId)
  if (!withinRateLimit) {
    auditLog({
      correlationId,
      appId,
      pageId: params.pageId,
      datasourceAlias: params.datasourceAlias,
      userId,
      mode: params.mode,
      connectorId: params.connectorId,
      endpointId: params.endpointId,
      method: params.method ?? 'GET',
      urlPattern: params.url ?? params.endpointId ?? '',
      durationMs: 0,
      cacheHit: false,
      error: 'Rate limit exceeded',
    })
    throw Object.assign(new Error('Rate limit exceeded'), { statusCode: 429 })
  }

  // Concurrency acquire
  const acquired = await acquireConcurrencySlot(connectorId, appId)
  if (!acquired) {
    auditLog({
      correlationId, appId, pageId: params.pageId, datasourceAlias: params.datasourceAlias,
      userId, mode: params.mode, connectorId: params.connectorId, endpointId: params.endpointId,
      method: params.method ?? 'GET', urlPattern: params.url ?? params.endpointId ?? '',
      durationMs: 0, cacheHit: false, error: 'Concurrency limit exceeded',
    })
    throw Object.assign(new Error('Concurrency limit exceeded'), { statusCode: 429 })
  }

  try {
    // Cache check
    const cacheParams = {
      mode: params.mode,
      method: params.method ?? 'GET',
      endpointId: params.endpointId,
    }
    const cached = await getCached(cacheParams, params.queryParams ?? {})
    if (cached !== null) {
      auditLog({
        correlationId, appId, pageId: params.pageId, datasourceAlias: params.datasourceAlias,
        userId, mode: params.mode, connectorId: params.connectorId, endpointId: params.endpointId,
        method: params.method ?? 'GET', urlPattern: params.url ?? params.endpointId ?? '',
        durationMs: 0, cacheHit: true,
      })
      return cached as ExecuteResult
    }

    // Execute
    const result = await executeRequest(params)

    // Cache response
    await setCached(cacheParams, params.queryParams ?? {}, result)

    // Invalidate endpoints listed in request
    if (invalidateEndpoints?.length) {
      for (const epId of invalidateEndpoints) {
        invalidateEndpointCache(epId).catch(err =>
          logger.warn({ err, endpointId: epId }, 'Cache invalidation failed')
        )
      }
    }

    // Audit log
    auditLog({
      correlationId, appId, pageId: params.pageId, datasourceAlias: params.datasourceAlias,
      actionId: params.actionId, userId, mode: params.mode,
      connectorId: result.connectorId, endpointId: result.endpointId,
      method: result.method, urlPattern: result.urlPattern,
      statusCode: result.statusCode, durationMs: result.durationMs, cacheHit: false,
    })

    return result
  } finally {
    await releaseConcurrencySlot(connectorId, appId)
  }
}

export async function invalidateCache(endpointId: string): Promise<void> {
  await invalidateEndpointCache(endpointId)
}

export const connectorService = { execute, invalidateCache }
