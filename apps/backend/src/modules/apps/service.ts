import { db } from '../../lib/db.js'
import type { CreateApp, UpdateApp, CreatePage, UpdatePage, AddMember, UpdateMemberRole } from './types.js'

// ── App CRUD ──────────────────────────────────────────────────────────────────

export async function createApp(data: CreateApp, createdBy: string) {
  const existing = await db.app.findUnique({ where: { slug: data.slug } })
  if (existing) {
    throw Object.assign(new Error(`Slug "${data.slug}" is already taken`), { statusCode: 409 })
  }

  const app = await db.app.create({
    data: {
      name: data.name,
      slug: data.slug,
      createdBy,
    },
  })

  // Creator is automatically the first OWNER
  await db.appMember.create({
    data: {
      appId: app.id,
      userId: createdBy,
      role: 'OWNER',
      addedBy: createdBy,
    },
  })

  return app
}

export async function listApps(userId: string, isAdmin: boolean) {
  if (isAdmin) {
    return db.app.findMany({ orderBy: { createdAt: 'desc' } })
  }

  // FDE only sees apps where they are a member
  const memberships = await db.appMember.findMany({
    where: { userId },
    select: { appId: true },
  })
  const appIds = memberships.map(m => m.appId)

  return db.app.findMany({
    where: { id: { in: appIds } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getApp(id: string) {
  const app = await db.app.findUnique({ where: { id } })
  if (!app) throw Object.assign(new Error('App not found'), { statusCode: 404 })
  return app
}

export async function updateApp(id: string, data: UpdateApp) {
  const app = await db.app.findUnique({ where: { id } })
  if (!app) throw Object.assign(new Error('App not found'), { statusCode: 404 })

  return db.app.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
    },
  })
}

// ── Page CRUD ─────────────────────────────────────────────────────────────────

export async function createPage(appId: string, data: CreatePage, createdBy: string) {
  const app = await db.app.findUnique({ where: { id: appId } })
  if (!app) throw Object.assign(new Error('App not found'), { statusCode: 404 })

  const existing = await db.page.findUnique({ where: { appId_slug: { appId, slug: data.slug } } })
  if (existing) {
    throw Object.assign(new Error(`Page slug "${data.slug}" already exists in this app`), { statusCode: 409 })
  }

  return db.page.create({
    data: {
      appId,
      name: data.name,
      slug: data.slug,
      order: data.order ?? 0,
    },
  })
}

export async function listPages(appId: string) {
  const app = await db.app.findUnique({ where: { id: appId } })
  if (!app) throw Object.assign(new Error('App not found'), { statusCode: 404 })

  return db.page.findMany({
    where: { appId },
    orderBy: { order: 'asc' },
  })
}

export async function updatePage(appId: string, pageId: string, data: UpdatePage) {
  const page = await db.page.findFirst({ where: { id: pageId, appId } })
  if (!page) throw Object.assign(new Error('Page not found'), { statusCode: 404 })

  return db.page.update({
    where: { id: pageId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.order !== undefined && { order: data.order }),
    },
  })
}

export async function deletePage(appId: string, pageId: string) {
  const page = await db.page.findFirst({ where: { id: pageId, appId } })
  if (!page) throw Object.assign(new Error('Page not found'), { statusCode: 404 })

  // Block delete if page is referenced in any active deployment
  const deploymentRef = await db.deploymentPage.findFirst({
    where: {
      pageVersion: {
        pageId,
        status: { in: ['STAGED', 'PUBLISHED'] },
      },
    },
    include: { deployment: true },
  })

  if (deploymentRef) {
    throw Object.assign(
      new Error(`Page is referenced in deployment "${deploymentRef.deploymentId}" — cannot delete`),
      { statusCode: 409, deploymentId: deploymentRef.deploymentId }
    )
  }

  // Delete all page versions first (no cascade in schema)
  await db.pageVersion.deleteMany({ where: { pageId } })
  await db.page.delete({ where: { id: pageId } })
}

// ── App Member CRUD ───────────────────────────────────────────────────────────

export async function listMembers(appId: string) {
  const app = await db.app.findUnique({ where: { id: appId } })
  if (!app) throw Object.assign(new Error('App not found'), { statusCode: 404 })

  return db.appMember.findMany({
    where: { appId },
    orderBy: { addedAt: 'asc' },
  })
}

export async function addMember(appId: string, data: AddMember, addedBy: string) {
  const app = await db.app.findUnique({ where: { id: appId } })
  if (!app) throw Object.assign(new Error('App not found'), { statusCode: 404 })

  const existing = await db.appMember.findUnique({ where: { appId_userId: { appId, userId: data.userId } } })
  if (existing) {
    throw Object.assign(new Error('User is already a member of this app'), { statusCode: 409 })
  }

  return db.appMember.create({
    data: {
      appId,
      userId: data.userId,
      role: data.role,
      addedBy,
    },
  })
}

export async function updateMemberRole(appId: string, userId: string, data: UpdateMemberRole) {
  const member = await db.appMember.findUnique({ where: { appId_userId: { appId, userId } } })
  if (!member) throw Object.assign(new Error('Member not found'), { statusCode: 404 })

  return db.appMember.update({
    where: { appId_userId: { appId, userId } },
    data: { role: data.role },
  })
}

export async function removeMember(appId: string, userId: string) {
  const member = await db.appMember.findUnique({ where: { appId_userId: { appId, userId } } })
  if (!member) throw Object.assign(new Error('Member not found'), { statusCode: 404 })

  // Block if this is the last OWNER
  if (member.role === 'OWNER') {
    const ownerCount = await db.appMember.count({ where: { appId, role: 'OWNER' } })
    if (ownerCount <= 1) {
      throw Object.assign(
        new Error('Cannot remove the last OWNER — promote another member to OWNER first'),
        { statusCode: 409 }
      )
    }
  }

  await db.appMember.delete({ where: { appId_userId: { appId, userId } } })
}

// ── Deployment fetch (Renderer build-time) ────────────────────────────────────

export async function getDeployment(slug: string, env: 'STAGING' | 'PRODUCTION') {
  const app = await db.app.findUnique({ where: { slug } })
  if (!app) throw Object.assign(new Error('App not found'), { statusCode: 404 })

  // Find the most recent successful deployment for this environment
  const deployment = await db.deployment.findFirst({
    where: { appId: app.id, environment: env, buildStatus: 'SUCCESS' },
    orderBy: { deployedAt: 'desc' },
    include: {
      pages: {
        include: {
          pageVersion: {
            include: { page: true },
          },
        },
      },
    },
  })

  if (!deployment) {
    throw Object.assign(new Error(`No successful deployment found for ${slug}/${env}`), { statusCode: 404 })
  }

  return {
    deployment: {
      id: deployment.id,
      appId: deployment.appId,
      appSlug: app.slug,
      environment: deployment.environment,
      buildStatus: deployment.buildStatus,
      deployedAt: deployment.deployedAt,
      pages: deployment.pages.map(dp => ({
        pageVersionId: dp.pageVersionId,
        version: dp.pageVersion.version,
        status: dp.pageVersion.status,
        schema: dp.pageVersion.schema,
        page: {
          id: dp.pageVersion.page.id,
          name: dp.pageVersion.page.name,
          slug: dp.pageVersion.page.slug,
          order: dp.pageVersion.page.order,
        },
      })),
    },
  }
}

// ── Role resolution helper ────────────────────────────────────────────────────

export async function getMemberRole(appId: string, userId: string): Promise<string | null> {
  const member = await db.appMember.findUnique({ where: { appId_userId: { appId, userId } } })
  return member?.role ?? null
}
