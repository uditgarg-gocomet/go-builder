import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Redis mock (hoisted so vi.mock factory can reference it) ──────────────────

const redisMock = vi.hoisted(() => {
  const store = new Map<string, string>()
  return {
    _store: store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, val: string) => { store.set(key, val); return 'OK' }),
    setex: vi.fn(async (key: string, _ttl: number, val: string) => { store.set(key, val); return 'OK' }),
    del: vi.fn(async (...keys: string[]) => { keys.forEach((k: string) => store.delete(k)); return keys.length }),
    incr: vi.fn(async (key: string) => {
      const val = parseInt(store.get(key) ?? '0') + 1
      store.set(key, String(val)); return val
    }),
    decr: vi.fn(async (key: string) => {
      const val = Math.max(0, parseInt(store.get(key) ?? '0') - 1)
      store.set(key, String(val)); return val
    }),
    expire: vi.fn(async () => 1),
    keys: vi.fn(async (pattern: string) => {
      const prefix = pattern.replace('*', '')
      return Array.from(store.keys()).filter((k: string) => k.startsWith(prefix))
    }),
    zremrangebyscore: vi.fn(async () => 0),
    zcard: vi.fn(async () => 0),
    zadd: vi.fn(async () => 1),
    pipeline: vi.fn(() => ({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn(async () => [[null, 0], [null, 0], [null, 1], [null, 1]]),
    })),
    eval: vi.fn(async (_script: string, _numKeys: number, key: string, max: string) => {
      const current = parseInt(store.get(key) ?? '0')
      if (current >= parseInt(max)) return 0
      const newVal = current + 1
      store.set(key, String(newVal))
      return newVal
    }),
  }
})

// ── In-memory stores ─────────────────────────────────────────────────────────

type ConnectorRecord = {
  id: string; name: string; baseUrl: object; authType: string; authConfig: string
  headers: object; isActive: boolean; createdBy: string; createdAt: Date; updatedAt: Date
  description?: string | null
}

type EndpointRecord = {
  id: string; connectorId: string; name: string; method: string; path: string
  pathParams: object; queryParams: object; headers: object
  responseSchema: object; bindingPaths: string[]; isActive: boolean
  createdBy: string; createdAt: Date; updatedAt: Date
  bodySchema?: object | null; category?: string; description?: string | null
  tags?: string[]; responseSample?: object | null
}

type CacheConfigRecord = { id: string; endpointId: string; ttlSeconds: number; varyBy: string[] }
type RateLimitRecord = { connectorId: string; requestsPerMin: number; requestsPerHour: number; requestsPerDay: number; maxConcurrent: number; maxResponseSizeKb: number }
type AuditLogRecord = { id: string; [key: string]: unknown }

const connectors = new Map<string, ConnectorRecord>()
const endpoints = new Map<string, EndpointRecord>()
const cacheConfigs = new Map<string, CacheConfigRecord>()
const rateLimits = new Map<string, RateLimitRecord>()
const auditLogs = new Map<string, AuditLogRecord>()

let counter = 0
function nextId() { return `id-${++counter}` }

vi.mock('../../../lib/redis.js', () => ({ redis: redisMock }))

vi.mock('../../../lib/db.js', () => ({
  db: {
    connector: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        connectors.get(where.id) ?? null
      ),
    },
    endpointDef: {
      findUnique: vi.fn(async ({ where, include }: { where: { id: string }; include?: { connector?: boolean } }) => {
        const ep = endpoints.get(where.id)
        if (!ep) return null
        if (include?.connector) {
          const conn = connectors.get(ep.connectorId)
          return { ...ep, connector: conn ?? null }
        }
        return ep
      }),
    },
    connectorRateLimit: {
      findUnique: vi.fn(async ({ where }: { where: { connectorId: string } }) =>
        rateLimits.get(where.connectorId) ?? null
      ),
    },
    endpointCacheConfig: {
      findUnique: vi.fn(async ({ where }: { where: { endpointId: string } }) =>
        cacheConfigs.get(where.endpointId) ?? null
      ),
    },
    connectorRequestLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const record = { id: nextId(), ...data }
        auditLogs.set(record.id, record)
        return record
      }),
    },
    customEndpointUsage: {
      create: vi.fn(async () => ({})),
    },
  },
}))

vi.mock('../../../lib/secrets.js', () => ({
  secretsProvider: {
    store: vi.fn(async (_key: string, value: object) => JSON.stringify(value)),
    resolve: vi.fn(async (ref: string) => JSON.parse(ref) as object),
  },
}))

vi.mock('../../../lib/logger.js', () => ({
  createChildLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}))

vi.mock('@sentry/node', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

import { execute } from '../service.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function seedConnector(authType = 'BEARER', authConfig: object = { token: 'secret' }): ConnectorRecord {
  const record: ConnectorRecord = {
    id: nextId(), name: 'Test API',
    baseUrl: { staging: 'https://api-staging.test.com', production: 'https://api.test.com' },
    authType, authConfig: JSON.stringify(authConfig),
    headers: {}, isActive: true, createdBy: 'fde-1',
    createdAt: new Date(), updatedAt: new Date(),
  }
  connectors.set(record.id, record)
  return record
}

function seedEndpoint(connectorId: string): EndpointRecord {
  const record: EndpointRecord = {
    id: nextId(), connectorId, name: 'Get Orders',
    method: 'GET', path: '/orders', pathParams: [], queryParams: [],
    headers: {}, responseSchema: { type: 'object' }, bindingPaths: [],
    isActive: true, createdBy: 'fde-1', createdAt: new Date(), updatedAt: new Date(),
  }
  endpoints.set(record.id, record)
  return record
}

function mockFetchSuccess(data: unknown = { items: [] }, status = 200) {
  fetchMock.mockResolvedValueOnce({
    status,
    statusCode: status,
    headers: { get: () => null },
    text: async () => JSON.stringify(data),
    json: async () => data,
  })
}

beforeEach(() => {
  connectors.clear()
  endpoints.clear()
  cacheConfigs.clear()
  rateLimits.clear()
  auditLogs.clear()
  redisMock._store.clear()
  counter = 0
  fetchMock.mockReset()
  vi.clearAllMocks()
  // Re-init pipeline mock default after clearAllMocks
  redisMock.pipeline.mockReturnValue({
    zremrangebyscore: vi.fn().mockReturnThis(),
    zcard: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn(async () => [[null, 0], [null, 0], [null, 1], [null, 1]]),
  })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('execute — REGISTERED mode', () => {
  it('resolves connector auth and executes request', async () => {
    const connector = seedConnector('BEARER', { token: 'my-secret-token' })
    const endpoint = seedEndpoint(connector.id)
    mockFetchSuccess({ data: [] })

    const result = await execute({
      mode: 'REGISTERED',
      endpointId: endpoint.id,
      environment: 'staging',
      appId: 'app-1',
      userId: 'user-1',
    })

    expect(result.data).toEqual({ data: [] })
    expect(result.statusCode).toBe(200)

    // Verify Authorization header was set
    const [, options] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }]
    expect(options.headers['Authorization']).toBe('Bearer my-secret-token')
  })

  it('throws 410 when endpoint is deactivated', async () => {
    const connector = seedConnector()
    const endpoint = seedEndpoint(connector.id)
    endpoint.isActive = false
    endpoints.set(endpoint.id, endpoint)

    await expect(execute({
      mode: 'REGISTERED',
      endpointId: endpoint.id,
      environment: 'staging',
      appId: 'app-1',
      userId: 'user-1',
    })).rejects.toMatchObject({ statusCode: 410 })
  })
})

describe('execute — CUSTOM_CONNECTOR mode', () => {
  it('resolves auth from connector for custom URL', async () => {
    const connector = seedConnector('API_KEY', { key: 'myapikey', headerName: 'X-Api-Key' })
    mockFetchSuccess({ result: 'ok' })

    const result = await execute({
      mode: 'CUSTOM_CONNECTOR',
      connectorId: connector.id,
      url: 'https://api.example.com/custom',
      method: 'GET',
      environment: 'staging',
      appId: 'app-1',
      userId: 'user-1',
    })

    expect(result.statusCode).toBe(200)
    const [, options] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }]
    expect(options.headers['X-Api-Key']).toBe('myapikey')
  })
})

describe('rate limiting', () => {
  it('returns 429 when rate limit exceeded', async () => {
    const connector = seedConnector()
    const endpoint = seedEndpoint(connector.id)

    // Configure tight rate limit
    rateLimits.set(connector.id, {
      connectorId: connector.id,
      requestsPerMin: 0,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
      maxConcurrent: 5,
      maxResponseSizeKb: 5120,
    })

    // Make pipeline return count > limit
    redisMock.pipeline.mockReturnValueOnce({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn(async () => [[null, 0], [null, 100], [null, 1], [null, 1]]), // count=100 >= limit=0
    })

    await expect(execute({
      mode: 'REGISTERED',
      endpointId: endpoint.id,
      environment: 'staging',
      appId: 'app-1',
      userId: 'user-1',
    })).rejects.toMatchObject({ statusCode: 429 })
  })
})

describe('concurrency limiting', () => {
  it('returns 429 when concurrency limit exceeded', async () => {
    const connector = seedConnector()
    const endpoint = seedEndpoint(connector.id)

    rateLimits.set(connector.id, {
      connectorId: connector.id,
      requestsPerMin: 60,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
      maxConcurrent: 2,
      maxResponseSizeKb: 5120,
    })

    // Simulate concurrency limit already at max
    redisMock.eval.mockResolvedValueOnce(0)

    await expect(execute({
      mode: 'REGISTERED',
      endpointId: endpoint.id,
      environment: 'staging',
      appId: 'app-1',
      userId: 'user-1',
    })).rejects.toMatchObject({ statusCode: 429 })
  })
})

describe('caching', () => {
  it('returns cached response without calling fetch', async () => {
    const connector = seedConnector()
    const endpoint = seedEndpoint(connector.id)

    // Pre-populate the internal Redis store so getCached finds it
    const cachedResult = { data: { items: [] }, statusCode: 200, durationMs: 10, method: 'GET', urlPattern: '/orders' }
    redisMock._store.set(`cache:${endpoint.id}:`, JSON.stringify(cachedResult))

    const result = await execute({
      mode: 'REGISTERED',
      endpointId: endpoint.id,
      environment: 'staging',
      appId: 'app-1',
      userId: 'user-1',
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result).toBeDefined()
  })
})

describe('request timeout', () => {
  it('returns 504 when request times out', async () => {
    const connector = seedConnector()
    const endpoint = seedEndpoint(connector.id)

    fetchMock.mockRejectedValueOnce(Object.assign(new Error('Aborted'), { name: 'AbortError' }))

    await expect(execute({
      mode: 'REGISTERED',
      endpointId: endpoint.id,
      environment: 'staging',
      appId: 'app-1',
      userId: 'user-1',
    })).rejects.toMatchObject({ statusCode: 504 })
  })
})

describe('audit logging', () => {
  it('writes audit log for every request', async () => {
    const connector = seedConnector()
    const endpoint = seedEndpoint(connector.id)
    mockFetchSuccess({ ok: true })

    await execute({
      mode: 'REGISTERED',
      endpointId: endpoint.id,
      environment: 'staging',
      appId: 'app-1',
      userId: 'user-1',
      correlationId: 'corr-123',
    })

    // Allow async audit log to fire
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(auditLogs.size).toBe(1)
    const log = Array.from(auditLogs.values())[0]!
    expect(log['correlationId']).toBe('corr-123')
    expect(log['appId']).toBe('app-1')
  })
})
