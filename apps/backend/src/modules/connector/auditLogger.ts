import { db } from '../../lib/db.js'
import { createChildLogger } from '../../lib/logger.js'
import * as Sentry from '@sentry/node'

const logger = createChildLogger('connector:audit')

interface AuditLogParams {
  correlationId?: string
  appId: string
  pageId?: string
  datasourceAlias?: string
  actionId?: string
  userId: string
  mode: 'REGISTERED' | 'CUSTOM_CONNECTOR' | 'CUSTOM_MANUAL'
  connectorId?: string
  endpointId?: string
  method: string
  urlPattern: string
  statusCode?: number
  durationMs: number
  cacheHit: boolean
  error?: string
}

export function auditLog(params: AuditLogParams): void {
  // Non-blocking — fire and forget
  db.connectorRequestLog.create({
    data: {
      correlationId: params.correlationId ?? null,
      appId: params.appId,
      pageId: params.pageId ?? null,
      datasourceAlias: params.datasourceAlias ?? null,
      actionId: params.actionId ?? null,
      userId: params.userId,
      mode: params.mode,
      connectorId: params.connectorId ?? null,
      endpointId: params.endpointId ?? null,
      method: params.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      urlPattern: params.urlPattern,
      statusCode: params.statusCode ?? null,
      durationMs: params.durationMs,
      cacheHit: params.cacheHit,
      error: params.error ?? null,
    },
  }).then(() => {
    if (params.durationMs > 5000) {
      Sentry.captureMessage('Slow connector request', {
        level: 'warning',
        extra: { ...params },
      })
    }
    if (params.error) {
      Sentry.captureMessage('Connector request failed', {
        level: 'error',
        extra: { ...params },
      })
    }
  }).catch(err => {
    logger.warn({ err, ...params }, 'Failed to write connector audit log')
  })
}
