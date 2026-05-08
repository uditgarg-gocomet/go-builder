import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'

process.env['BUILD_WEBHOOK_SECRET'] = 'test-secret-key'
process.env['RENDERER_BUILD_WEBHOOK'] = 'http://renderer.test/api/build/webhook'

// ── In-memory stores ──────────────────────────────────────────────────────────

type PageRecord = { id: string; appId: string; name: string; slug: string; order: number; createdAt: Date }
type PageVersionRecord = {
  id: string; pageId: string; version: string; status: string; schema: object;
  changelog: string | null; diffFromPrev: object | null;
  createdBy: string; createdAt: Date; promotedAt: Date | null; promotedBy: string | null
}
type DeploymentRecord = { id: string; appId: string; environment: string; buildStatus: string; deployedBy: string; deployedAt: Date }
type DeploymentPageRecord = { deploymentId: string; pageVersionId: string }
type RegistryEntryRecord = { id: string; name: string; status: string }

const pages = new Map<string, PageRecord>()
const pageVersions = new Map<string, PageVersionRecord>()
const deployments = new Map<string, DeploymentRecord>()
const deploymentPages = new Map<string, DeploymentPageRecord>()
const registryEntries = new Map<string, RegistryEntryRecord>()

let counter = 0
function nextId() { return `id-${++counter}` }

vi.mock('../../../lib/db.js', () => ({
  db: {
    page: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => pages.get(where.id) ?? null),
      findMany: vi.fn(async ({ where }: {
        where: { appId: string; id?: { not?: string; notIn?: string[] } }
      }) => {
        return Array.from(pages.values()).filter(p => {
          if (p.appId !== where.appId) return false
          if (where.id?.not && p.id === where.id.not) return false
          if (where.id?.notIn && where.id.notIn.includes(p.id)) return false
          return true
        }).map(p => ({ id: p.id }))
      }),
    },
    pageVersion: {
      findFirst: vi.fn(async ({ where, orderBy }: {
        where: { pageId: string; status?: string | { in?: string[] }; createdAt?: { gte: Date }; createdBy?: { not: string } };
        orderBy?: { createdAt: 'desc' | 'asc' }
      }) => {
        let results = Array.from(pageVersions.values()).filter(pv => {
          if (pv.pageId !== where.pageId) return false
          if (typeof where.status === 'string' && pv.status !== where.status) return false
          if (typeof where.status === 'object' && where.status.in && !where.status.in.includes(pv.status)) return false
          if (where.createdAt?.gte && pv.createdAt < where.createdAt.gte) return false
          if (where.createdBy?.not && pv.createdBy === where.createdBy.not) return false
          return true
        })
        results = results.sort((a, b) => {
          const dir = orderBy?.createdAt === 'asc' ? 1 : -1
          return dir * (a.createdAt.getTime() - b.createdAt.getTime())
        })
        return results[results.length - 1] ?? results[0] ?? null
      }),
      findMany: vi.fn(async ({ where, orderBy }: { where: { pageId: string }; orderBy?: { createdAt: string } }) => {
        const results = Array.from(pageVersions.values()).filter(pv => pv.pageId === where.pageId)
        return results.sort((a, b) => {
          const dir = orderBy?.createdAt === 'asc' ? 1 : -1
          return dir * (a.createdAt.getTime() - b.createdAt.getTime())
        })
      }),
      findUnique: vi.fn(async ({ where, include }: { where: { id: string }; include?: { page?: boolean } }) => {
        const pv = pageVersions.get(where.id)
        if (!pv) return null
        if (include?.page) {
          const page = pages.get(pv.pageId)
          return { ...pv, page }
        }
        return pv
      }),
      create: vi.fn(async ({ data }: { data: Omit<PageVersionRecord, 'id'> }) => {
        const record: PageVersionRecord = { id: nextId(), ...data }
        pageVersions.set(record.id, record)
        return record
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<PageVersionRecord> }) => {
        const record = pageVersions.get(where.id)!
        const updated = { ...record, ...data }
        pageVersions.set(where.id, updated)
        return updated
      }),
      upsert: vi.fn(async ({ where, update, create }: {
        where: { pageId_version: { pageId: string; version: string } }
        update: Partial<PageVersionRecord>
        create: Omit<PageVersionRecord, 'id'>
      }) => {
        const { pageId, version } = where.pageId_version
        const existing = Array.from(pageVersions.values()).find(pv => pv.pageId === pageId && pv.version === version)
        if (existing) {
          const updated = { ...existing, ...update }
          pageVersions.set(existing.id, updated)
          return updated
        }
        const record: PageVersionRecord = { id: nextId(), ...create }
        pageVersions.set(record.id, record)
        return record
      }),
    },
    deployment: {
      create: vi.fn(async ({ data }: { data: Omit<DeploymentRecord, 'id' | 'deployedAt'> }) => {
        const record: DeploymentRecord = { id: nextId(), deployedAt: new Date(), ...data }
        deployments.set(record.id, record)
        return record
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<DeploymentRecord> }) => {
        const record = deployments.get(where.id)
        if (!record) return null
        const updated = { ...record, ...data }
        deployments.set(where.id, updated)
        return updated
      }),
    },
    deploymentPage: {
      create: vi.fn(async ({ data }: { data: DeploymentPageRecord }) => {
        deploymentPages.set(`${data.deploymentId}:${data.pageVersionId}`, data)
        return data
      }),
    },
    registryEntry: {
      findMany: vi.fn(async ({ where }: { where: { name: { in: string[] }; status: string } }) =>
        Array.from(registryEntries.values()).filter(e =>
          where.name.in.includes(e.name) && e.status === where.status
        )
      ),
    },
  },
}))

vi.mock('../../../lib/logger.js', () => ({
  createChildLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn().mockReturnThis() },
}))

// Mock global fetch for webhook tests
const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }))
vi.stubGlobal('fetch', fetchMock)

// ── Import modules under test ─────────────────────────────────────────────────

import { saveDraft, promoteToStaging, promoteToProduction, promoteApp, rollback, triggerBuild } from '../service.js'
import type { PageSchema } from '../types.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSchema(pageId = 'page-1', appId = 'app-1'): PageSchema {
  return {
    pageId,
    appId,
    version: '0.1.0',
    meta: { title: 'Dashboard', slug: '/dashboard', order: 0, auth: { required: false, groups: [] } },
    layout: {
      id: 'root', type: 'Stack', source: 'primitive',
      props: {}, bindings: {}, actions: [], style: {}, responsive: {}, children: [],
    },
    dataSources: [], actions: [], forms: [], state: [], params: [],
  }
}

function seedPage(id = 'page-1', appId = 'app-1'): PageRecord {
  const record: PageRecord = { id, appId, name: 'Dashboard', slug: 'dashboard', order: 0, createdAt: new Date() }
  pages.set(id, record)
  return record
}

function seedRegistryEntry(name: string) {
  const record: RegistryEntryRecord = { id: nextId(), name, status: 'ACTIVE' }
  registryEntries.set(record.id, record)
  return record
}

function seedPageVersion(
  pageId: string,
  status: 'DRAFT' | 'STAGED' | 'PUBLISHED' | 'ARCHIVED' | 'ROLLED_BACK',
  version = '0.1.0'
): PageVersionRecord {
  const record: PageVersionRecord = {
    id: nextId(), pageId, version, status,
    schema: makeSchema(pageId) as unknown as object,
    changelog: null, diffFromPrev: null,
    createdBy: 'fde-1', createdAt: new Date(),
    promotedAt: null, promotedBy: null,
  }
  pageVersions.set(record.id, record)
  return record
}

beforeEach(() => {
  pages.clear()
  pageVersions.clear()
  deployments.clear()
  deploymentPages.clear()
  registryEntries.clear()
  counter = 0
  fetchMock.mockClear()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('saveDraft', () => {
  it('happy path — stores DRAFT version', async () => {
    seedPage()
    seedRegistryEntry('Stack') // register the component used in schema

    const result = await saveDraft({
      pageId: 'page-1',
      schema: makeSchema(),
      savedBy: 'fde-1',
    })

    expect(result.version.status).toBe('DRAFT')
    expect(result.version.version).toBe('0.1.0')
    expect(result.concurrentEditWarning).toBe(false)

    const stored = pageVersions.get(result.version.id)
    expect(stored).toBeDefined()
    expect(stored!.pageId).toBe('page-1')
  })

  it('registry validation failure returns 400', async () => {
    seedPage()
    // 'UnknownWidget' is NOT registered

    const schema = makeSchema()
    schema.layout.type = 'UnknownWidget'

    await expect(saveDraft({ pageId: 'page-1', schema, savedBy: 'fde-1' }))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('UnknownWidget') })
  })

  it('concurrent edit warning when another user saved within 30s', async () => {
    seedPage()
    seedRegistryEntry('Stack')

    // Seed a recent DRAFT by a different user
    const recent: PageVersionRecord = {
      id: nextId(), pageId: 'page-1', version: '0.1.0', status: 'DRAFT',
      schema: {}, changelog: null, diffFromPrev: null,
      createdBy: 'fde-2', // different user
      createdAt: new Date(Date.now() - 5000), // 5s ago — within 30s window
      promotedAt: null, promotedBy: null,
    }
    pageVersions.set(recent.id, recent)

    const result = await saveDraft({
      pageId: 'page-1',
      schema: makeSchema(),
      savedBy: 'fde-1', // different from fde-2
    })

    expect(result.concurrentEditWarning).toBe(true)
  })

  it('no concurrent warning when only own recent drafts exist', async () => {
    seedPage()
    seedRegistryEntry('Stack')

    const ownDraft: PageVersionRecord = {
      id: nextId(), pageId: 'page-1', version: '0.1.0', status: 'DRAFT',
      schema: {}, changelog: null, diffFromPrev: null,
      createdBy: 'fde-1', // same user
      createdAt: new Date(Date.now() - 5000),
      promotedAt: null, promotedBy: null,
    }
    pageVersions.set(ownDraft.id, ownDraft)

    const result = await saveDraft({ pageId: 'page-1', schema: makeSchema(), savedBy: 'fde-1' })
    expect(result.concurrentEditWarning).toBe(false)
  })
})

describe('promoteToStaging', () => {
  it('bumps version correctly per bumpType', async () => {
    seedPage()
    const draft = seedPageVersion('page-1', 'DRAFT', '1.2.3')

    const result = await promoteToStaging(draft.id, {
      bumpType: 'minor',
      changelog: 'Added new feature',
      promotedBy: 'fde-1',
    })

    expect(result.version).toBe('1.3.0')

    // Check deployment was created
    const dep = deployments.get(result.deploymentId)
    expect(dep).toBeDefined()
    expect(dep!.environment).toBe('STAGING')
  })

  it('bumps patch correctly', async () => {
    seedPage()
    const draft = seedPageVersion('page-1', 'DRAFT', '2.0.0')

    const result = await promoteToStaging(draft.id, {
      bumpType: 'patch',
      changelog: 'Fix bug',
      promotedBy: 'fde-1',
    })

    expect(result.version).toBe('2.0.1')
  })

  it('rejects promotion of non-DRAFT version to staging', async () => {
    seedPage()
    const staged = seedPageVersion('page-1', 'STAGED', '1.0.0')

    await expect(promoteToStaging(staged.id, {
      bumpType: 'patch',
      changelog: 'changelog',
      promotedBy: 'fde-1',
    })).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('promoteToProduction', () => {
  it('only STAGED versions can be promoted to production', async () => {
    seedPage()
    const draft = seedPageVersion('page-1', 'DRAFT', '1.0.0')

    await expect(promoteToProduction(draft.id, {
      bumpType: 'patch',
      changelog: 'Go live',
      promotedBy: 'fde-1',
    })).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('STAGED'),
    })
  })

  it('promotes a STAGED version to production', async () => {
    seedPage()
    const staged = seedPageVersion('page-1', 'STAGED', '1.0.0')

    const result = await promoteToProduction(staged.id, {
      bumpType: 'patch',
      changelog: 'Go live',
      promotedBy: 'fde-1',
    })

    expect(result.version).toBe('1.0.1')
    const dep = deployments.get(result.deploymentId)
    expect(dep!.environment).toBe('PRODUCTION')
  })
})

describe('promote — carry-forward of other pages', () => {
  it('staging promote of one page links the other pages\' latest STAGED versions', async () => {
    seedPage('page-1', 'app-1')
    seedPage('page-2', 'app-1')

    // page-2 already has a STAGED version live on staging
    const otherStaged = seedPageVersion('page-2', 'STAGED', '1.0.0')
    // page-1 has a fresh draft we're about to promote
    const draft = seedPageVersion('page-1', 'DRAFT', '0.1.0')

    const result = await promoteToStaging(draft.id, {
      bumpType: 'patch',
      changelog: 'tweaks',
      promotedBy: 'fde-1',
    })

    const links = Array.from(deploymentPages.values()).filter(d => d.deploymentId === result.deploymentId)
    const linkedVersionIds = links.map(l => l.pageVersionId).sort()
    expect(linkedVersionIds).toEqual([draft.id, otherStaged.id].sort())
  })

  it('production promote does not pull in STAGED versions of other pages', async () => {
    seedPage('page-1', 'app-1')
    seedPage('page-2', 'app-1')

    // page-2 only has a STAGED version, no PUBLISHED yet — must not appear in
    // a PRODUCTION deployment.
    seedPageVersion('page-2', 'STAGED', '1.0.0')
    const staged = seedPageVersion('page-1', 'STAGED', '0.1.0')

    const result = await promoteToProduction(staged.id, {
      bumpType: 'patch',
      changelog: 'go live',
      promotedBy: 'fde-1',
    })

    const links = Array.from(deploymentPages.values()).filter(d => d.deploymentId === result.deploymentId)
    expect(links.map(l => l.pageVersionId)).toEqual([staged.id])
  })

  it('skips other pages with no live version in the target environment', async () => {
    seedPage('page-1', 'app-1')
    seedPage('page-2', 'app-1') // no versions at all
    const draft = seedPageVersion('page-1', 'DRAFT', '0.1.0')

    const result = await promoteToStaging(draft.id, {
      bumpType: 'patch',
      changelog: 'first publish',
      promotedBy: 'fde-1',
    })

    const links = Array.from(deploymentPages.values()).filter(d => d.deploymentId === result.deploymentId)
    expect(links).toHaveLength(1)
    expect(links[0]!.pageVersionId).toBe(draft.id)
  })
})

describe('promoteApp (publish all pages)', () => {
  it('promotes every DRAFT page to staging in one deployment', async () => {
    seedPage('page-1', 'app-1')
    seedPage('page-2', 'app-1')
    const d1 = seedPageVersion('page-1', 'DRAFT', '0.1.0')
    const d2 = seedPageVersion('page-2', 'DRAFT', '0.2.0')

    const result = await promoteApp('app-1', 'STAGING', {
      bumpType: 'minor',
      changelog: 'release',
      promotedBy: 'fde-1',
    })

    expect(result.promotedCount).toBe(2)

    expect(pageVersions.get(d1.id)!.status).toBe('STAGED')
    expect(pageVersions.get(d1.id)!.version).toBe('0.2.0')
    expect(pageVersions.get(d2.id)!.status).toBe('STAGED')
    expect(pageVersions.get(d2.id)!.version).toBe('0.3.0')

    const links = Array.from(deploymentPages.values()).filter(d => d.deploymentId === result.deploymentId)
    expect(links.map(l => l.pageVersionId).sort()).toEqual([d1.id, d2.id].sort())
  })

  it('carries forward pages without a draft when others are promoted', async () => {
    seedPage('page-1', 'app-1')
    seedPage('page-2', 'app-1')
    const otherStaged = seedPageVersion('page-2', 'STAGED', '1.0.0')
    const d1 = seedPageVersion('page-1', 'DRAFT', '0.1.0')

    const result = await promoteApp('app-1', 'STAGING', {
      bumpType: 'patch',
      changelog: 'release',
      promotedBy: 'fde-1',
    })

    expect(result.promotedCount).toBe(1)
    const links = Array.from(deploymentPages.values()).filter(d => d.deploymentId === result.deploymentId)
    expect(links.map(l => l.pageVersionId).sort()).toEqual([d1.id, otherStaged.id].sort())
  })

  it('rejects when no eligible candidates exist', async () => {
    seedPage('page-1', 'app-1')
    seedPageVersion('page-1', 'STAGED', '1.0.0') // no DRAFT

    await expect(promoteApp('app-1', 'STAGING', {
      bumpType: 'patch',
      changelog: 'release',
      promotedBy: 'fde-1',
    })).rejects.toMatchObject({ statusCode: 409 })
  })

  it('rejects when the app has no pages', async () => {
    await expect(promoteApp('app-1', 'STAGING', {
      bumpType: 'patch',
      changelog: 'release',
      promotedBy: 'fde-1',
    })).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('rollback', () => {
  it('marks current PUBLISHED as ROLLED_BACK and reinstates target as PUBLISHED', async () => {
    seedPage()
    const current = seedPageVersion('page-1', 'PUBLISHED', '1.2.0')
    const target = seedPageVersion('page-1', 'ARCHIVED', '1.1.0')

    await rollback('page-1', { targetVersionId: target.id, rolledBackBy: 'fde-1' })

    const updatedCurrent = pageVersions.get(current.id)!
    const updatedTarget = pageVersions.get(target.id)!

    expect(updatedCurrent.status).toBe('ROLLED_BACK')
    expect(updatedTarget.status).toBe('PUBLISHED')
  })

  it('fires build webhook for PRODUCTION after rollback', async () => {
    seedPage()
    seedPageVersion('page-1', 'PUBLISHED', '1.2.0')
    const target = seedPageVersion('page-1', 'ARCHIVED', '1.1.0')

    await rollback('page-1', { targetVersionId: target.id, rolledBackBy: 'fde-1' })

    // Allow async webhook to fire
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(fetchMock).toHaveBeenCalledWith(
      'http://renderer.test/api/build/webhook',
      expect.objectContaining({ method: 'POST' })
    )
  })
})

describe('triggerBuild (webhook signature)', () => {
  it('signs payload with HMAC-SHA256 using BUILD_WEBHOOK_SECRET', async () => {
    await triggerBuild('pv-1', 'STAGING', 'dep-1')

    expect(fetchMock).toHaveBeenCalledOnce()

    const [, options] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: string }]
    const signature = options.headers['x-build-signature']
    const body = options.body

    // Verify the signature
    const expected = crypto.createHmac('sha256', 'test-secret-key').update(body).digest('hex')
    expect(signature).toBe(expected)
  })

  it('includes deploymentId, pageVersionId, and environment in payload', async () => {
    await triggerBuild('pv-42', 'PRODUCTION', 'dep-99')

    const [, options] = fetchMock.mock.calls[0] as unknown as [string, { body: string }]
    const payload = JSON.parse(options.body)

    expect(payload).toEqual({
      deploymentId: 'dep-99',
      pageVersionId: 'pv-42',
      environment: 'PRODUCTION',
    })
  })
})
