import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── In-memory data stores ─────────────────────────────────────────────────────

type AppRecord = { id: string; name: string; slug: string; createdBy: string; createdAt: Date; updatedAt: Date }
type PageRecord = { id: string; appId: string; name: string; slug: string; order: number; createdAt: Date }
type AppMemberRecord = { id: string; appId: string; userId: string; role: string; addedBy: string; addedAt: Date }
type PageVersionRecord = { id: string; pageId: string; version: string; status: string; schema: object; changelog: string | null; createdBy: string; createdAt: Date }
type DeploymentRecord = { id: string; appId: string; environment: string; buildStatus: string; deployedBy: string; deployedAt: Date }
type DeploymentPageRecord = { deploymentId: string; pageVersionId: string }

const apps = new Map<string, AppRecord>()
const pages = new Map<string, PageRecord>()
const members = new Map<string, AppMemberRecord>()
const pageVersions = new Map<string, PageVersionRecord>()
const deployments = new Map<string, DeploymentRecord>()
const deploymentPages = new Map<string, DeploymentPageRecord>()

let idCounter = 0
function nextId() { return `id-${++idCounter}` }

function memberKey(appId: string, userId: string) { return `${appId}:${userId}` }
function pageSlugKey(appId: string, slug: string) { return `${appId}:${slug}` }

// ── Mock db ───────────────────────────────────────────────────────────────────

vi.mock('../../../lib/db.js', () => ({
  db: {
    app: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; slug?: string } }) => {
        if (where.id) return apps.get(where.id) ?? null
        if (where.slug) return Array.from(apps.values()).find(a => a.slug === where.slug) ?? null
        return null
      }),
      findMany: vi.fn(async ({ where }: { where?: { id?: { in: string[] } } } = {}) => {
        const all = Array.from(apps.values())
        if (where?.id?.in) return all.filter(a => where.id!.in.includes(a.id))
        return all
      }),
      create: vi.fn(async ({ data }: { data: Omit<AppRecord, 'id' | 'createdAt' | 'updatedAt'> }) => {
        const record: AppRecord = { id: nextId(), createdAt: new Date(), updatedAt: new Date(), ...data }
        apps.set(record.id, record)
        return record
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<AppRecord> }) => {
        const record = apps.get(where.id)!
        const updated = { ...record, ...data, updatedAt: new Date() }
        apps.set(where.id, updated)
        return updated
      }),
    },
    page: {
      findUnique: vi.fn(async ({ where }: { where: { appId_slug?: { appId: string; slug: string }; id?: string } }) => {
        if (where.appId_slug) return Array.from(pages.values()).find(p => p.appId === where.appId_slug!.appId && p.slug === where.appId_slug!.slug) ?? null
        if (where.id) return pages.get(where.id) ?? null
        return null
      }),
      findFirst: vi.fn(async ({ where }: { where: { id?: string; appId?: string } }) => {
        return Array.from(pages.values()).find(p =>
          (where.id == null || p.id === where.id) &&
          (where.appId == null || p.appId === where.appId)
        ) ?? null
      }),
      findMany: vi.fn(async ({ where }: { where: { appId: string } }) =>
        Array.from(pages.values()).filter(p => p.appId === where.appId).sort((a, b) => a.order - b.order)
      ),
      create: vi.fn(async ({ data }: { data: Omit<PageRecord, 'id' | 'createdAt'> }) => {
        const record: PageRecord = { id: nextId(), createdAt: new Date(), ...data }
        pages.set(record.id, record)
        return record
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<PageRecord> }) => {
        const record = pages.get(where.id)!
        const updated = { ...record, ...data }
        pages.set(where.id, updated)
        return updated
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const record = pages.get(where.id)
        pages.delete(where.id)
        return record
      }),
    },
    pageVersion: {
      deleteMany: vi.fn(async ({ where }: { where: { pageId: string } }) => {
        for (const [id, pv] of pageVersions.entries()) {
          if (pv.pageId === where.pageId) pageVersions.delete(id)
        }
        return { count: 0 }
      }),
    },
    appMember: {
      findUnique: vi.fn(async ({ where }: { where: { appId_userId: { appId: string; userId: string } } }) =>
        members.get(memberKey(where.appId_userId.appId, where.appId_userId.userId)) ?? null
      ),
      findMany: vi.fn(async ({ where }: { where: { appId?: string; userId?: string } }) =>
        Array.from(members.values()).filter(m =>
          (where.appId == null || m.appId === where.appId) &&
          (where.userId == null || m.userId === where.userId)
        )
      ),
      count: vi.fn(async ({ where }: { where: { appId: string; role: string } }) =>
        Array.from(members.values()).filter(m => m.appId === where.appId && m.role === where.role).length
      ),
      create: vi.fn(async ({ data }: { data: Omit<AppMemberRecord, 'id' | 'addedAt'> }) => {
        const record: AppMemberRecord = { id: nextId(), addedAt: new Date(), ...data }
        members.set(memberKey(data.appId, data.userId), record)
        return record
      }),
      update: vi.fn(async ({ where, data }: { where: { appId_userId: { appId: string; userId: string } }; data: Partial<AppMemberRecord> }) => {
        const key = memberKey(where.appId_userId.appId, where.appId_userId.userId)
        const record = members.get(key)!
        const updated = { ...record, ...data }
        members.set(key, updated)
        return updated
      }),
      delete: vi.fn(async ({ where }: { where: { appId_userId: { appId: string; userId: string } } }) => {
        const key = memberKey(where.appId_userId.appId, where.appId_userId.userId)
        const record = members.get(key)
        members.delete(key)
        return record
      }),
    },
    deploymentPage: {
      findFirst: vi.fn(async ({ where }: { where: { pageVersion: { pageId: string; status: { in: string[] } } } }) => {
        const dp = Array.from(deploymentPages.values()).find(dp => {
          const pv = pageVersions.get(dp.pageVersionId)
          return pv?.pageId === where.pageVersion.pageId && where.pageVersion.status.in.includes(pv.status)
        })
        if (!dp) return null
        const deployment = deployments.get(dp.deploymentId)
        return dp ? { ...dp, deployment } : null
      }),
    },
    deployment: {
      findFirst: vi.fn(async ({ where, include }: { where: { appId: string; environment: string; buildStatus: string }; include?: object }) => {
        const dep = Array.from(deployments.values()).find(d =>
          d.appId === where.appId && d.environment === where.environment && d.buildStatus === where.buildStatus
        )
        if (!dep || !include) return dep ?? null
        // Enrich with pages
        const depPages = Array.from(deploymentPages.values())
          .filter(dp => dp.deploymentId === dep.id)
          .map(dp => {
            const pv = pageVersions.get(dp.pageVersionId)!
            const page = pages.get(pv.pageId)!
            return { ...dp, pageVersion: { ...pv, page } }
          })
        return { ...dep, pages: depPages }
      }),
    },
  },
}))

// ── Import service under test ─────────────────────────────────────────────────

import {
  createApp,
  createPage,
  deletePage,
  addMember,
  removeMember,
  updateMemberRole,
  getMemberRole,
} from '../service.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function seedApp(slug = 'test-app', name = 'Test App', createdBy = 'fde-1'): AppRecord {
  const record: AppRecord = { id: nextId(), name, slug, createdBy, createdAt: new Date(), updatedAt: new Date() }
  apps.set(record.id, record)
  return record
}

function seedPage(appId: string, slug = 'dashboard', order = 0): PageRecord {
  const record: PageRecord = { id: nextId(), appId, name: 'Dashboard', slug, order, createdAt: new Date() }
  pages.set(record.id, record)
  return record
}

function seedMember(appId: string, userId: string, role: 'OWNER' | 'EDITOR' | 'VIEWER'): AppMemberRecord {
  const record: AppMemberRecord = { id: nextId(), appId, userId, role, addedBy: 'system', addedAt: new Date() }
  members.set(memberKey(appId, userId), record)
  return record
}

function seedPageVersion(pageId: string, status: 'DRAFT' | 'STAGED' | 'PUBLISHED' | 'ARCHIVED' | 'ROLLED_BACK'): PageVersionRecord {
  const record: PageVersionRecord = { id: nextId(), pageId, version: '1.0.0', status, schema: {}, changelog: null, createdBy: 'fde-1', createdAt: new Date() }
  pageVersions.set(record.id, record)
  return record
}

function seedDeployment(appId: string): DeploymentRecord {
  const record: DeploymentRecord = { id: nextId(), appId, environment: 'STAGING', buildStatus: 'SUCCESS', deployedBy: 'fde-1', deployedAt: new Date() }
  deployments.set(record.id, record)
  return record
}

function seedDeploymentPage(deploymentId: string, pageVersionId: string): DeploymentPageRecord {
  const record: DeploymentPageRecord = { deploymentId, pageVersionId }
  deploymentPages.set(`${deploymentId}:${pageVersionId}`, record)
  return record
}

beforeEach(() => {
  apps.clear()
  pages.clear()
  members.clear()
  pageVersions.clear()
  deployments.clear()
  deploymentPages.clear()
  idCounter = 0
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createApp', () => {
  it('creates app and auto-assigns creator as OWNER', async () => {
    const app = await createApp({ name: 'My App', slug: 'my-app' }, 'fde-1')

    expect(app.slug).toBe('my-app')
    expect(app.createdBy).toBe('fde-1')

    const role = await getMemberRole(app.id, 'fde-1')
    expect(role).toBe('OWNER')
  })

  it('returns 409 on duplicate slug', async () => {
    seedApp('existing-slug')

    await expect(createApp({ name: 'Another App', slug: 'existing-slug' }, 'fde-2'))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('already taken') })
  })
})

describe('deletePage', () => {
  it('deletes a page with no deployment references', async () => {
    const app = seedApp()
    const page = seedPage(app.id)

    await expect(deletePage(app.id, page.id)).resolves.toBeUndefined()
  })

  it('returns 409 when page is referenced in a STAGED deployment', async () => {
    const app = seedApp()
    const page = seedPage(app.id)
    const pv = seedPageVersion(page.id, 'STAGED')
    const dep = seedDeployment(app.id)
    seedDeploymentPage(dep.id, pv.id)

    await expect(deletePage(app.id, page.id))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('deployment') })
  })

  it('returns 409 when page is referenced in a PUBLISHED deployment', async () => {
    const app = seedApp()
    const page = seedPage(app.id)
    const pv = seedPageVersion(page.id, 'PUBLISHED')
    const dep = seedDeployment(app.id)
    seedDeploymentPage(dep.id, pv.id)

    await expect(deletePage(app.id, page.id))
      .rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('removeMember', () => {
  it('returns 409 when trying to remove the last OWNER', async () => {
    const app = seedApp()
    seedMember(app.id, 'fde-1', 'OWNER')

    await expect(removeMember(app.id, 'fde-1'))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('last OWNER') })
  })

  it('removes a member when there are multiple OWNERs', async () => {
    const app = seedApp()
    seedMember(app.id, 'fde-1', 'OWNER')
    seedMember(app.id, 'fde-2', 'OWNER')

    await expect(removeMember(app.id, 'fde-2')).resolves.toBeUndefined()
    expect(members.has(memberKey(app.id, 'fde-2'))).toBe(false)
  })

  it('removes an EDITOR without restriction', async () => {
    const app = seedApp()
    seedMember(app.id, 'fde-1', 'OWNER')
    seedMember(app.id, 'fde-2', 'EDITOR')

    await expect(removeMember(app.id, 'fde-2')).resolves.toBeUndefined()
    expect(members.has(memberKey(app.id, 'fde-2'))).toBe(false)
  })
})

describe('requireAppRole (VIEWER access check)', () => {
  it('getMemberRole returns null for non-members', async () => {
    const app = seedApp()
    const role = await getMemberRole(app.id, 'non-member')
    expect(role).toBeNull()
  })

  it('getMemberRole returns correct role for a member', async () => {
    const app = seedApp()
    seedMember(app.id, 'fde-viewer', 'VIEWER')

    const role = await getMemberRole(app.id, 'fde-viewer')
    expect(role).toBe('VIEWER')
  })
})
