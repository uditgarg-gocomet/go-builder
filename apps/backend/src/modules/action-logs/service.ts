import * as Sentry from '@sentry/node'
import { Prisma } from '@prisma/client'
import { db } from '../../lib/db.js'
import { createChildLogger } from '../../lib/logger.js'
import type { ActionLogEntry, QueryFilters } from './types.js'

const logger = createChildLogger('action-logs')

export function ingest(events: ActionLogEntry[]): void {
  // Non-blocking — fire and forget
  db.actionExecutionLog.createMany({
    data: events.map(e => ({
      correlationId: e.correlationId ?? null,
      appId: e.appId,
      pageId: e.pageId,
      userId: e.userId,
      actionId: e.actionId,
      actionName: e.actionName,
      actionType: e.actionType,
      status: e.status,
      durationMs: e.durationMs,
      error: e.error ?? null,
      metadata: e.metadata !== undefined ? (e.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      executedAt: e.executedAt ? new Date(e.executedAt) : new Date(),
    })),
  }).catch(err => {
    logger.warn({ err }, 'Failed to write action execution logs')
    Sentry.captureException(err, { level: 'warning' })
  })
}

export async function query(filters: QueryFilters): Promise<{
  logs: Array<{
    id: string
    correlationId: string | null
    appId: string
    pageId: string
    userId: string
    actionId: string
    actionName: string
    actionType: string
    status: string
    durationMs: number
    error: string | null
    metadata: unknown
    executedAt: Date
  }>
}> {
  const logs = await db.actionExecutionLog.findMany({
    where: {
      appId: filters.appId,
      ...(filters.pageId ? { pageId: filters.pageId } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    orderBy: { executedAt: 'desc' },
    take: filters.limit,
    select: {
      id: true,
      correlationId: true,
      appId: true,
      pageId: true,
      userId: true,
      actionId: true,
      actionName: true,
      actionType: true,
      status: true,
      durationMs: true,
      error: true,
      metadata: true,
      executedAt: true,
    },
  })

  return { logs }
}

export const actionLogsService = { ingest, query }
