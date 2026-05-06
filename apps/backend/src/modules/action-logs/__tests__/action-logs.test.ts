import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── In-memory store ───────────────────────────────────────────────────────────

type LogRecord = {
  id: string
  correlationId: string | null
  appId: string
  pageId: string
  userId: string
  actionId: string
  actionName: string
  actionType: string
  status: 'SUCCESS' | 'ERROR'
  durationMs: number
  error: string | null
  metadata: unknown
  executedAt: Date
}

const logs: LogRecord[] = []
let counter = 0
function nextId() { return `id-${++counter}` }

// Simulates a DB failure when this flag is set
let simulateDbFailure = false

vi.mock('../../../lib/db.js', () => ({
  db: {
    actionExecutionLog: {
      createMany: vi.fn(async ({ data }: { data: Omit<LogRecord, 'id'>[] }) => {
        if (simulateDbFailure) throw new Error('DB unavailable')
        for (const entry of data) {
          logs.push({ id: nextId(), ...entry })
        }
        return { count: data.length }
      }),
      findMany: vi.fn(async ({
        where,
        orderBy: _orderBy,
        take,
        select: _select,
      }: {
        where: Record<string, unknown>
        orderBy: unknown
        take: number
        select: unknown
      }) => {
        let result = logs.filter(l => l.appId === (where.appId as string))
        if (where.pageId) result = result.filter(l => l.pageId === where.pageId)
        if (where.userId) result = result.filter(l => l.userId === where.userId)
        if (where.status) result = result.filter(l => l.status === where.status)
        return result.slice(0, take)
      }),
    },
  },
}))

vi.mock('../../../lib/logger.js', () => ({
  createChildLogger: vi.fn(() => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  })),
}))

vi.mock('../../../modules/auth/service.js', () => ({
  authService: {
    validateToken: vi.fn(async (token: string) => {
      if (token === 'valid-portal-token') {
        return { valid: true, payload: { sub: 'user-1', context: 'PORTAL' } }
      }
      return { valid: false, payload: null }
    }),
  },
}))

// Sentry mock to avoid real captures
vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

import Fastify from 'fastify'
import { actionLogsRouter } from '../router.js'
import { ingest, query } from '../service.js'

function makeApp() {
  const app = Fastify()
  app.register(actionLogsRouter, { prefix: '/action-logs' })
  return app
}

function makeEvent(overrides: Partial<{
  correlationId: string
  appId: string
  pageId: string
  userId: string
  actionId: string
  actionName: string
  actionType: string
  status: 'SUCCESS' | 'ERROR'
  durationMs: number
}> = {}) {
  return {
    appId: 'app-1',
    pageId: 'page-1',
    userId: 'user-1',
    actionId: 'action-1',
    actionName: 'Submit Invoice',
    actionType: 'API_CALL',
    status: 'SUCCESS' as const,
    durationMs: 120,
    ...overrides,
  }
}

beforeEach(() => {
  logs.length = 0
  counter = 0
  simulateDbFailure = false
  vi.clearAllMocks()
})

// ── POST /action-logs ─────────────────────────────────────────────────────────

describe('POST /action-logs', () => {
  it('returns 202 immediately without waiting for DB write', async () => {
    const app = makeApp()
    const reply = await app.inject({
      method: 'POST',
      url: '/action-logs',
      headers: { authorization: 'Bearer valid-portal-token' },
      payload: { events: [makeEvent()] },
    })
    expect(reply.statusCode).toBe(202)
    expect(reply.json()).toEqual({ received: true })
  })

  it('returns 400 when batch exceeds 100 events', async () => {
    const app = makeApp()
    const events = Array.from({ length: 101 }, () => makeEvent())
    const reply = await app.inject({
      method: 'POST',
      url: '/action-logs',
      headers: { authorization: 'Bearer valid-portal-token' },
      payload: { events },
    })
    expect(reply.statusCode).toBe(400)
    expect(reply.json().error).toMatch(/100/)
  })

  it('returns 202 even when DB write fails — portal is unaffected', async () => {
    simulateDbFailure = true
    const app = makeApp()

    const reply = await app.inject({
      method: 'POST',
      url: '/action-logs',
      headers: { authorization: 'Bearer valid-portal-token' },
      payload: { events: [makeEvent()] },
    })

    // Response must be 202 regardless of DB state
    expect(reply.statusCode).toBe(202)

    // Give the non-blocking insert time to fail (but not affect response)
    await new Promise(r => setTimeout(r, 20))
  })

  it('returns 401 with no token', async () => {
    const app = makeApp()
    const reply = await app.inject({
      method: 'POST',
      url: '/action-logs',
      payload: { events: [makeEvent()] },
    })
    expect(reply.statusCode).toBe(401)
  })
})

// ── GET /action-logs ──────────────────────────────────────────────────────────

describe('GET /action-logs', () => {
  beforeEach(async () => {
    // Seed log data via service.ingest directly (not via HTTP)
    ingest([
      makeEvent({ appId: 'app-1', pageId: 'page-1', userId: 'user-1', status: 'SUCCESS', correlationId: 'corr-001' }),
      makeEvent({ appId: 'app-1', pageId: 'page-1', userId: 'user-2', status: 'ERROR' }),
      makeEvent({ appId: 'app-1', pageId: 'page-2', userId: 'user-1', status: 'SUCCESS' }),
      makeEvent({ appId: 'app-2', pageId: 'page-1', userId: 'user-1', status: 'SUCCESS' }),
    ])
    // Wait for non-blocking inserts
    await new Promise(r => setTimeout(r, 20))
  })

  it('returns filtered results by appId', async () => {
    const result = await query({ appId: 'app-1', limit: 50 })
    expect(result.logs).toHaveLength(3)
    expect(result.logs.every(l => l.appId === 'app-1')).toBe(true)
  })

  it('filters by pageId', async () => {
    const result = await query({ appId: 'app-1', pageId: 'page-1', limit: 50 })
    expect(result.logs).toHaveLength(2)
    expect(result.logs.every(l => l.pageId === 'page-1')).toBe(true)
  })

  it('filters by status', async () => {
    const result = await query({ appId: 'app-1', status: 'ERROR', limit: 50 })
    expect(result.logs).toHaveLength(1)
    expect(result.logs[0].status).toBe('ERROR')
  })

  it('includes correlationId in response', async () => {
    const result = await query({ appId: 'app-1', pageId: 'page-1', userId: 'user-1', limit: 50 })
    const withCorrelation = result.logs.find(l => l.correlationId === 'corr-001')
    expect(withCorrelation).toBeDefined()
    expect(withCorrelation?.correlationId).toBe('corr-001')
  })

  it('respects the limit parameter', async () => {
    const result = await query({ appId: 'app-1', limit: 1 })
    expect(result.logs).toHaveLength(1)
  })
})
