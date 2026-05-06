import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── In-memory stores ──────────────────────────────────────────────────────────

type EntryRecord = {
  id: string
  name: string
  type: string
  scope: string
  status: string
  currentVersion: string
  sourceType: string
  ownedBy: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

type VersionRecord = {
  id: string
  entryId: string
  version: string
  propsSchema: object
  defaultProps: object
  bundleUrl: string | null
  bundleHash: string | null
  viewSchema: object | null
  displayName: string
  description: string | null
  category: string
  icon: string | null
  thumbnail: string | null
  tags: string[]
  changelog: string | null
  publishedAt: Date
  publishedBy: string
}

const entries = new Map<string, EntryRecord>()
const versions = new Map<string, VersionRecord>()

let counter = 0
function nextId() { return `id-${++counter}` }

vi.mock('../../../lib/db.js', () => ({
  db: {
    registryEntry: {
      findMany: vi.fn(async ({ where, include }: {
        where: {
          status?: { in?: string[] } | string
          OR?: Array<{ scope: string; ownedBy?: string }>
          name?: { in?: string[] }
        }
        include?: { versions?: { orderBy?: object; take?: number; where?: { version?: string } } }
        orderBy?: object[]
      }) => {
        let results = Array.from(entries.values())

        // Filter by status
        if (where.status) {
          if (typeof where.status === 'string') {
            results = results.filter(e => e.status === where.status)
          } else if (where.status.in) {
            results = results.filter(e => where.status && typeof where.status === 'object' && 'in' in where.status && where.status.in!.includes(e.status))
          }
        }

        // Filter by OR conditions (scope + ownedBy)
        if (where.OR) {
          results = results.filter(e =>
            where.OR!.some(cond => {
              if (cond.scope !== e.scope) return false
              if (cond.ownedBy && cond.ownedBy !== e.ownedBy) return false
              return true
            })
          )
        }

        // Filter by name in
        if (where.name?.in) {
          results = results.filter(e => where.name!.in!.includes(e.name))
        }

        if (!include?.versions) return results

        return results.map(entry => {
          let entryVersions = Array.from(versions.values()).filter(v => v.entryId === entry.id)
          if (include.versions?.where?.version) {
            entryVersions = entryVersions.filter(v => v.version === include.versions!.where!.version)
          }
          entryVersions.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
          if (include.versions?.take) entryVersions = entryVersions.slice(0, include.versions.take)
          return { ...entry, versions: entryVersions }
        })
      }),
      findFirst: vi.fn(async ({ where, include }: {
        where: { name?: string; scope?: string; ownedBy?: string }
        include?: { versions?: { orderBy?: object; take?: number; where?: { version?: string } } }
      }) => {
        const result = Array.from(entries.values()).find(e => {
          if (where.name && e.name !== where.name) return false
          if (where.scope && e.scope !== where.scope) return false
          if (where.ownedBy && e.ownedBy !== where.ownedBy) return false
          return true
        })
        if (!result) return null
        if (!include?.versions) return result

        let entryVersions = Array.from(versions.values()).filter(v => v.entryId === result.id)
        if (include.versions?.where?.version) {
          entryVersions = entryVersions.filter(v => v.version === include.versions!.where!.version)
        }
        entryVersions.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
        if (include.versions?.take) entryVersions = entryVersions.slice(0, include.versions.take)
        return { ...result, versions: entryVersions }
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        entries.get(where.id) ?? null
      ),
      create: vi.fn(async ({ data }: { data: Omit<EntryRecord, 'id' | 'createdAt' | 'updatedAt'> }) => {
        const record: EntryRecord = { id: nextId(), ...data, createdAt: new Date(), updatedAt: new Date() }
        entries.set(record.id, record)
        return record
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<EntryRecord> }) => {
        const record = entries.get(where.id)!
        const updated = { ...record, ...data, updatedAt: new Date() }
        entries.set(where.id, updated)
        return updated
      }),
    },
    registryEntryVersion: {
      findMany: vi.fn(async ({ where, orderBy }: { where: { entryId: string }; orderBy?: { publishedAt: string } }) => {
        let results = Array.from(versions.values()).filter(v => v.entryId === where.entryId)
        results.sort((a, b) => {
          const dir = orderBy?.publishedAt === 'asc' ? 1 : -1
          return dir * (a.publishedAt.getTime() - b.publishedAt.getTime())
        })
        return results
      }),
      create: vi.fn(async ({ data }: { data: Omit<VersionRecord, 'id' | 'publishedAt'> }) => {
        const record: VersionRecord = { id: nextId(), publishedAt: new Date(), ...data }
        versions.set(record.id, record)
        return record
      }),
    },
  },
}))

vi.mock('../../../lib/logger.js', () => ({
  createChildLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}))

import { listForApp, getEntry, getPropsSchema, registerCustomWidget, savePrebuiltView, deprecate } from '../service.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function seedEntry(
  name: string,
  scope: 'COMMON' | 'TENANT_LOCAL',
  ownedBy: string,
  status: 'ACTIVE' | 'DEPRECATED' = 'ACTIVE'
): EntryRecord {
  const record: EntryRecord = {
    id: nextId(), name, type: 'PRIMITIVE', scope, status,
    currentVersion: '1.0.0', sourceType: 'INTERNAL',
    ownedBy, createdBy: 'seed',
    createdAt: new Date(), updatedAt: new Date(),
  }
  entries.set(record.id, record)
  return record
}

function seedVersion(entryId: string, version = '1.0.0', propsSchema: object = {}): VersionRecord {
  const record: VersionRecord = {
    id: nextId(), entryId, version,
    propsSchema, defaultProps: {}, bundleUrl: null, bundleHash: null, viewSchema: null,
    displayName: 'Test', description: null, category: 'Test',
    icon: null, thumbnail: null, tags: [], changelog: null,
    publishedAt: new Date(), publishedBy: 'seed',
  }
  versions.set(record.id, record)
  return record
}

beforeEach(() => {
  entries.clear()
  versions.clear()
  counter = 0
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('listForApp', () => {
  it('returns COMMON entries and TENANT_LOCAL entries for this app', async () => {
    const common = seedEntry('Button', 'COMMON', 'platform')
    const local = seedEntry('MyWidget', 'TENANT_LOCAL', 'app-1')
    seedVersion(common.id)
    seedVersion(local.id)

    const result = await listForApp('app-1')
    const names = result.map(e => e.name)
    expect(names).toContain('Button')
    expect(names).toContain('MyWidget')
  })

  it('does not return TENANT_LOCAL entries from other apps', async () => {
    const other = seedEntry('OtherWidget', 'TENANT_LOCAL', 'app-2')
    seedVersion(other.id)

    const result = await listForApp('app-1')
    const names = result.map(e => e.name)
    expect(names).not.toContain('OtherWidget')
  })

  it('includes currentVersionDetails from the latest version', async () => {
    const entry = seedEntry('Stack', 'COMMON', 'platform')
    const schema = { type: 'object', properties: { direction: { type: 'string' } } }
    seedVersion(entry.id, '1.0.0', schema)

    const result = await listForApp('app-1')
    const found = result.find(e => e.name === 'Stack')
    expect(found).toBeDefined()
    expect(found!.currentVersionDetails).toBeDefined()
    expect(found!.currentVersionDetails?.propsSchema).toEqual(schema)
  })

  it('includes DEPRECATED entries in the results (Builder shows warning)', async () => {
    const deprecated = seedEntry('OldButton', 'COMMON', 'platform', 'DEPRECATED')
    seedVersion(deprecated.id)

    const result = await listForApp('app-1')
    const found = result.find(e => e.name === 'OldButton')
    expect(found).toBeDefined()
    expect(found!.status).toBe('DEPRECATED')
  })
})

describe('getPropsSchema', () => {
  it('returns correct props schema for each requested component', async () => {
    const btn = seedEntry('Button', 'COMMON', 'platform')
    const btnSchema = { type: 'object', properties: { label: { type: 'string' } } }
    seedVersion(btn.id, '1.0.0', btnSchema)

    const tbl = seedEntry('DataTable', 'COMMON', 'platform')
    const tblSchema = { type: 'object', properties: { pageSize: { type: 'number' } } }
    seedVersion(tbl.id, '1.0.0', tblSchema)

    const result = await getPropsSchema(['Button', 'DataTable'])
    expect(result['Button']).toEqual(btnSchema)
    expect(result['DataTable']).toEqual(tblSchema)
  })

  it('returns empty object for empty component list', async () => {
    const result = await getPropsSchema([])
    expect(result).toEqual({})
  })

  it('skips components not found in registry', async () => {
    const result = await getPropsSchema(['NonExistentWidget'])
    expect(result['NonExistentWidget']).toBeUndefined()
  })
})

describe('registerCustomWidget', () => {
  it('creates TENANT_LOCAL entry when appId provided', async () => {
    const result = await registerCustomWidget({
      name: 'FancyChart',
      displayName: 'Fancy Chart',
      category: 'Data',
      version: '2.1.0',
      bundleUrl: 'https://cdn.example.com/fancy-chart.js',
      propsSchema: { type: 'object' },
      defaultProps: {},
      tags: [],
      appId: 'app-1',
      registeredBy: 'fde-1',
    })

    expect(result.entry.scope).toBe('TENANT_LOCAL')
    expect(result.entry.ownedBy).toBe('app-1')
    expect(result.version.version).toBe('2.1.0')
  })

  it('rejects duplicate name in COMMON scope', async () => {
    seedEntry('Duplicate', 'COMMON', 'platform')

    await expect(registerCustomWidget({
      name: 'Duplicate',
      displayName: 'Duplicate',
      category: 'Data',
      version: '1.0.0',
      bundleUrl: 'https://cdn.example.com/dup.js',
      propsSchema: {},
      defaultProps: {},
      tags: [],
      registeredBy: 'fde-1',
    })).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('savePrebuiltView', () => {
  it('creates a PREBUILT_VIEW entry with version 1.0.0', async () => {
    const result = await savePrebuiltView({
      name: 'DashboardView',
      displayName: 'Dashboard View',
      category: 'Custom',
      viewSchema: { layout: {} },
      propsSchema: {},
      defaultProps: {},
      tags: [],
      appId: 'app-1',
      savedBy: 'fde-1',
    })

    expect(result.entry.type).toBe('PREBUILT_VIEW')
    expect(result.entry.scope).toBe('TENANT_LOCAL')
    expect(result.version.version).toBe('1.0.0')
  })
})

describe('deprecate', () => {
  it('marks entry as DEPRECATED', async () => {
    const entry = seedEntry('OldWidget', 'COMMON', 'platform')

    const result = await deprecate(entry.id, {
      reason: 'Replaced by NewWidget',
      replacedBy: 'NewWidget',
      deprecatedBy: 'admin',
    })

    expect(result.status).toBe('DEPRECATED')
  })

  it('throws 404 if entry not found', async () => {
    await expect(deprecate('non-existent-id', {
      reason: 'Test',
      deprecatedBy: 'admin',
    })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 409 if entry is already deprecated', async () => {
    const entry = seedEntry('AlreadyDeprecated', 'COMMON', 'platform', 'DEPRECATED')

    await expect(deprecate(entry.id, {
      reason: 'Already deprecated',
      deprecatedBy: 'admin',
    })).rejects.toMatchObject({ statusCode: 409 })
  })

  it('existing pages continue to work after deprecation (entry remains in DB)', async () => {
    const entry = seedEntry('Widget', 'COMMON', 'platform')

    await deprecate(entry.id, { reason: 'Deprecated', deprecatedBy: 'admin' })

    const stillExists = entries.get(entry.id)
    expect(stillExists).toBeDefined()
    expect(stillExists!.status).toBe('DEPRECATED')
  })
})
