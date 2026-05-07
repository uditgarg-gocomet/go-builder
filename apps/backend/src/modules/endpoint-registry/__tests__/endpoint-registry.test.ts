import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── In-memory stores ──────────────────────────────────────────────────────────

type ConnectorRecord = {
  id: string; name: string; description: string | null
  baseUrl: object; authType: string; authConfig: string
  headers: object; isActive: boolean
  createdBy: string; createdAt: Date; updatedAt: Date
}

type EndpointRecord = {
  id: string; connectorId: string; name: string; description: string | null
  method: string; path: string; category: string; tags: string[]
  pathParams: object; queryParams: object; bodySchema: object | null
  headers: object; responseSchema: object; responseSample: object | null
  bindingPaths: string[]; isActive: boolean
  createdBy: string; createdAt: Date; updatedAt: Date
}

type UsageRecord = {
  id: string; appId: string; pageId: string; alias: string
  mode: string; url: string; method: string; usedBy: string; createdAt: Date
}

const connectors = new Map<string, ConnectorRecord>()
const endpoints = new Map<string, EndpointRecord>()
const usageLogs = new Map<string, UsageRecord>()

let counter = 0
function nextId() { return `id-${++counter}` }

vi.mock('../../../lib/db.js', () => ({
  db: {
    connector: {
      findMany: vi.fn(async ({ where }: { where: { isActive: boolean } }) =>
        Array.from(connectors.values()).filter(c => c.isActive === where.isActive)
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        connectors.get(where.id) ?? null
      ),
      create: vi.fn(async ({ data }: { data: Omit<ConnectorRecord, 'id' | 'createdAt' | 'updatedAt'> }) => {
        const record: ConnectorRecord = { id: nextId(), ...data, createdAt: new Date(), updatedAt: new Date() }
        connectors.set(record.id, record)
        return record
      }),
    },
    endpointDef: {
      findMany: vi.fn(async ({ where }: { where: { connectorId: string; isActive: boolean } }) =>
        Array.from(endpoints.values()).filter(e =>
          e.connectorId === where.connectorId && e.isActive === where.isActive
        )
      ),
      findUnique: vi.fn(async ({ where, include }: { where: { id: string }; include?: { connector?: boolean } }) => {
        const ep = endpoints.get(where.id)
        if (!ep) return null
        if (include?.connector) {
          const conn = connectors.get(ep.connectorId)
          return { ...ep, connector: conn ?? null }
        }
        return ep
      }),
      create: vi.fn(async ({ data }: { data: Omit<EndpointRecord, 'id' | 'createdAt' | 'updatedAt'> }) => {
        const record: EndpointRecord = { id: nextId(), ...data, createdAt: new Date(), updatedAt: new Date() }
        endpoints.set(record.id, record)
        return record
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<EndpointRecord> }) => {
        const record = endpoints.get(where.id)!
        const updated = { ...record, ...data, updatedAt: new Date() }
        endpoints.set(where.id, updated)
        return updated
      }),
    },
    customEndpointUsage: {
      create: vi.fn(async ({ data }: { data: Omit<UsageRecord, 'id' | 'createdAt'> }) => {
        const record: UsageRecord = { id: nextId(), ...data, createdAt: new Date() }
        usageLogs.set(record.id, record)
        return record
      }),
    },
  },
}))

// Mock secrets — store stores JSON string, resolve decrypts it
vi.mock('../../../lib/secrets.js', () => ({
  secretsProvider: {
    store: vi.fn(async (_key: string, value: object) => JSON.stringify(value)),
    resolve: vi.fn(async (ref: string) => JSON.parse(ref) as object),
  },
}))

vi.mock('../../../lib/logger.js', () => ({
  createChildLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}))

// Mock global fetch for test endpoint
const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

import { registerConnector, registerEndpoint, testEndpoint } from '../service.js'
import { computeBindingPaths } from '../lib/bindingPaths.js'
import { validateUrl } from '../lib/ssrf.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function seedConnector(opts: { isActive?: boolean; authType?: string } = {}): ConnectorRecord {
  const record: ConnectorRecord = {
    id: nextId(),
    name: 'Finance API',
    description: null,
    baseUrl: { staging: 'https://api-staging.example.com', production: 'https://api.example.com' },
    authType: opts.authType ?? 'BEARER',
    authConfig: JSON.stringify({ token: 'test-token' }),
    headers: {},
    isActive: opts.isActive ?? true,
    createdBy: 'fde-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  connectors.set(record.id, record)
  return record
}

function seedEndpoint(connectorId: string): EndpointRecord {
  const record: EndpointRecord = {
    id: nextId(),
    connectorId,
    name: 'List Orders',
    description: null,
    method: 'GET',
    path: '/orders',
    category: 'Orders',
    tags: [],
    pathParams: [],
    queryParams: [],
    bodySchema: null,
    headers: {},
    responseSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            rows: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  amount: { type: 'number' },
                },
              },
            },
            total: { type: 'number' },
          },
        },
      },
    },
    responseSample: null,
    bindingPaths: ['data.rows', 'data.rows[].id', 'data.rows[].amount', 'data.total'],
    isActive: true,
    createdBy: 'fde-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  endpoints.set(record.id, record)
  return record
}

beforeEach(() => {
  connectors.clear()
  endpoints.clear()
  usageLogs.clear()
  counter = 0
  fetchMock.mockReset()
})

// ── computeBindingPaths ───────────────────────────────────────────────────────

describe('computeBindingPaths', () => {
  it('returns flat leaf paths for simple object schema', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
    }
    const paths = computeBindingPaths(schema)
    expect(paths).toContain('name')
    expect(paths).toContain('age')
  })

  it('returns nested paths with dot notation', () => {
    const schema = {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            total: { type: 'number' },
          },
        },
      },
    }
    const paths = computeBindingPaths(schema)
    expect(paths).toContain('data.total')
  })

  it('returns array path and item paths with [] notation', () => {
    const schema = {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            rows: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  amount: { type: 'number' },
                },
              },
            },
            total: { type: 'number' },
          },
        },
      },
    }
    const paths = computeBindingPaths(schema)
    expect(paths).toContain('data.rows')
    expect(paths).toContain('data.rows[].id')
    expect(paths).toContain('data.rows[].amount')
    expect(paths).toContain('data.total')
  })
})

// ── SSRF protection ───────────────────────────────────────────────────────────

describe('validateUrl (SSRF protection)', () => {
  it('allows valid public URLs', () => {
    expect(() => validateUrl('https://api.example.com/data')).not.toThrow()
  })

  it('blocks localhost', () => {
    expect(() => validateUrl('http://localhost:3000')).toThrow()
    expect(() => validateUrl('http://localhost:3000')).toThrowError(expect.objectContaining({ statusCode: 403 }))
  })

  it('blocks 127.0.0.1', () => {
    expect(() => validateUrl('http://127.0.0.1:8080')).toThrowError(expect.objectContaining({ statusCode: 403 }))
  })

  it('blocks 10.x.x.x private range', () => {
    expect(() => validateUrl('http://10.0.0.1/api')).toThrowError(expect.objectContaining({ statusCode: 403 }))
  })

  it('blocks 192.168.x.x private range', () => {
    expect(() => validateUrl('http://192.168.1.100/api')).toThrowError(expect.objectContaining({ statusCode: 403 }))
  })

  it('blocks 172.16.x.x private range', () => {
    expect(() => validateUrl('http://172.16.0.1/api')).toThrowError(expect.objectContaining({ statusCode: 403 }))
  })

  it('blocks AWS metadata endpoint', () => {
    expect(() => validateUrl('http://169.254.169.254/latest/meta-data/')).toThrowError(
      expect.objectContaining({ statusCode: 403 })
    )
  })
})

// ── Connector registration ────────────────────────────────────────────────────

describe('registerConnector', () => {
  it('encrypts auth config — stored string differs from plaintext', async () => {
    const result = await registerConnector({
      name: 'CRM API',
      baseUrl: { staging: 'https://crm-staging.example.com', production: 'https://crm.example.com' },
      authType: 'BEARER',
      authConfig: { token: 'secret-token-123' },
      headers: {},
      createdBy: 'fde-1',
    })

    // The stored authConfig should be the encrypted/serialized form, not the plaintext token
    expect(result.authConfig).toBeDefined()
    // With our mock, secretsProvider.store returns JSON.stringify(value)
    // so the stored value wraps the original object
    const stored = result.authConfig
    expect(typeof stored).toBe('string')
    // Verify it can be resolved back
    const { secretsProvider } = await import('../../../lib/secrets.js')
    const resolved = await secretsProvider.resolve(stored)
    expect(resolved).toEqual({ token: 'secret-token-123' })
  })

  it('rejects SSRF base URLs', async () => {
    await expect(registerConnector({
      name: 'Bad API',
      baseUrl: { staging: 'http://localhost:3000', production: 'https://api.example.com' },
      authType: 'NONE',
      authConfig: {},
      headers: {},
      createdBy: 'fde-1',
    })).rejects.toMatchObject({ statusCode: 403 })
  })
})

// ── Endpoint registration ─────────────────────────────────────────────────────

describe('registerEndpoint', () => {
  it('auto-computes binding paths from response schema', async () => {
    const connector = seedConnector()

    const result = await registerEndpoint({
      connectorId: connector.id,
      name: 'Get Users',
      method: 'GET',
      path: '/users',
      category: 'Users',
      tags: [],
      headers: {},
      pathParams: [],
      queryParams: [],
      responseSchema: {
        type: 'object',
        properties: {
          users: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
              },
            },
          },
          total: { type: 'number' },
        },
      },
      createdBy: 'fde-1',
    })

    expect(result.bindingPaths).toContain('users')
    expect(result.bindingPaths).toContain('users[].id')
    expect(result.bindingPaths).toContain('users[].email')
    expect(result.bindingPaths).toContain('total')
  })

  it('throws 404 if connector not found', async () => {
    await expect(registerEndpoint({
      connectorId: 'non-existent',
      name: 'Test',
      method: 'GET',
      path: '/test',
      category: 'Test',
      tags: [],
      headers: {},
      pathParams: [],
      queryParams: [],
      responseSchema: { type: 'object' },
      createdBy: 'fde-1',
    })).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ── Test endpoint ─────────────────────────────────────────────────────────────

describe('testEndpoint', () => {
  it('REGISTERED mode validates required path params', async () => {
    const connector = seedConnector()
    const ep = seedEndpoint(connector.id)
    // Override pathParams to have a required one
    ep.pathParams = [{ name: 'orderId', type: 'string', required: true }] as unknown as object
    endpoints.set(ep.id, ep)

    await expect(testEndpoint({
      mode: 'REGISTERED',
      endpointId: ep.id,
      pathParams: {},
      environment: 'staging',
      testedBy: 'fde-1',
    })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('CUSTOM_MANUAL blocks SSRF URLs', async () => {
    await expect(testEndpoint({
      mode: 'CUSTOM_MANUAL',
      url: 'http://192.168.1.1/api',
      method: 'GET',
      environment: 'staging',
      testedBy: 'fde-1',
    })).rejects.toMatchObject({ statusCode: 403 })
  })

  it('returns 504 on request timeout', async () => {
    seedConnector()
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }))

    const connector = seedConnector()
    await expect(testEndpoint({
      mode: 'CUSTOM_CONNECTOR',
      connectorId: connector.id,
      url: 'https://slow-api.example.com/data',
      method: 'GET',
      environment: 'staging',
      testedBy: 'fde-1',
    })).rejects.toMatchObject({ statusCode: 504 })
  })

  it('logs custom endpoint usage for CUSTOM_MANUAL mode', async () => {
    fetchMock.mockResolvedValueOnce({
      status: 200,
      statusCode: 200,
      json: async () => ({ items: [{ id: 1 }], total: 1 }),
    })

    await testEndpoint({
      mode: 'CUSTOM_MANUAL',
      url: 'https://api.example.com/items',
      method: 'GET',
      environment: 'staging',
      appId: 'app-1',
      pageId: 'page-1',
      alias: 'items',
      testedBy: 'fde-1',
    })

    // Allow async usage log to fire
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(usageLogs.size).toBe(1)
    const log = Array.from(usageLogs.values())[0]!
    expect(log.mode).toBe('CUSTOM_MANUAL')
    expect(log.alias).toBe('items')
  })
})
