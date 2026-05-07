import { Prisma } from '@prisma/client'
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
      header: app.headerConfig ?? null,
      nav: app.navConfig ?? null,
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

// ── Comments ──────────────────────────────────────────────────────────────────

export async function createComment(
  appId: string,
  pageId: string,
  data: { nodeId: string; body: string; createdBy: string }
) {
  const page = await db.page.findFirst({ where: { id: pageId, appId } })
  if (!page) throw Object.assign(new Error('Page not found'), { statusCode: 404 })

  // Use the current draft version id if available
  const draft = await db.pageVersion.findFirst({
    where: { pageId, status: 'DRAFT' },
    orderBy: { createdAt: 'desc' },
  })

  const comment = await db.nodeComment.create({
    data: {
      pageId,
      nodeId: data.nodeId,
      pageVersionId: draft?.id ?? '',
      body: data.body,
      createdBy: data.createdBy,
    },
    include: { replies: true },
  })
  return { comment }
}

export async function listComments(appId: string, pageId: string, nodeId?: string) {
  const page = await db.page.findFirst({ where: { id: pageId, appId } })
  if (!page) throw Object.assign(new Error('Page not found'), { statusCode: 404 })

  const where = nodeId ? { pageId, nodeId } : { pageId }
  const comments = await db.nodeComment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { replies: { orderBy: { createdAt: 'asc' } } },
  })
  return { comments }
}

export async function resolveComment(
  appId: string,
  pageId: string,
  commentId: string,
  resolvedBy: string
) {
  const comment = await db.nodeComment.findFirst({ where: { id: commentId, pageId } })
  if (!comment) throw Object.assign(new Error('Comment not found'), { statusCode: 404 })

  const page = await db.page.findFirst({ where: { id: pageId, appId } })
  if (!page) throw Object.assign(new Error('Page not found'), { statusCode: 404 })

  const updated = await db.nodeComment.update({
    where: { id: commentId },
    data: { resolved: true, resolvedBy, resolvedAt: new Date() },
    include: { replies: true },
  })
  return { comment: updated }
}

export async function createReply(
  appId: string,
  pageId: string,
  commentId: string,
  data: { body: string; createdBy: string }
) {
  const comment = await db.nodeComment.findFirst({ where: { id: commentId, pageId } })
  if (!comment) throw Object.assign(new Error('Comment not found'), { statusCode: 404 })

  const page = await db.page.findFirst({ where: { id: pageId, appId } })
  if (!page) throw Object.assign(new Error('Page not found'), { statusCode: 404 })

  const reply = await db.nodeCommentReply.create({
    data: { commentId, body: data.body, createdBy: data.createdBy },
  })
  return { reply }
}

// ── User groups ───────────────────────────────────────────────────────────────
// Per-app group registry used by page/node visibility rules and by the
// renderer's portal-session token (groups claim). In production an IdP
// provisions members; for the POC the FDE manages them manually via the
// Builder's App Settings → User Groups panel.

function serializeGroup(group: {
  id: string
  appId: string
  name: string
  description: string | null
  createdBy: string
  createdAt: Date
  members: { identifier: string }[]
}) {
  return {
    id: group.id,
    appId: group.appId,
    name: group.name,
    description: group.description,
    createdBy: group.createdBy,
    createdAt: group.createdAt,
    members: group.members.map(m => m.identifier),
  }
}

export async function listUserGroups(appId: string) {
  const app = await db.app.findUnique({ where: { id: appId } })
  if (!app) throw Object.assign(new Error('App not found'), { statusCode: 404 })

  const groups = await db.appUserGroup.findMany({
    where: { appId },
    orderBy: { name: 'asc' },
    include: { members: true },
  })
  return { groups: groups.map(serializeGroup) }
}

export async function createUserGroup(
  appId: string,
  data: { name: string; description?: string | undefined; members: string[] },
  createdBy: string,
) {
  const app = await db.app.findUnique({ where: { id: appId } })
  if (!app) throw Object.assign(new Error('App not found'), { statusCode: 404 })

  const existing = await db.appUserGroup.findUnique({
    where: { appId_name: { appId, name: data.name } },
  })
  if (existing) {
    throw Object.assign(new Error(`Group "${data.name}" already exists`), { statusCode: 409 })
  }

  const group = await db.appUserGroup.create({
    data: {
      appId,
      name: data.name,
      description: data.description ?? null,
      createdBy,
      members: {
        create: data.members.map(identifier => ({ identifier, addedBy: createdBy })),
      },
    },
    include: { members: true },
  })
  return { group: serializeGroup(group) }
}

export async function updateUserGroup(
  appId: string,
  groupId: string,
  data: { name?: string | undefined; description?: string | undefined; members?: string[] | undefined },
) {
  const group = await db.appUserGroup.findFirst({ where: { id: groupId, appId } })
  if (!group) throw Object.assign(new Error('Group not found'), { statusCode: 404 })

  // Rename conflict check
  if (data.name && data.name !== group.name) {
    const clash = await db.appUserGroup.findUnique({
      where: { appId_name: { appId, name: data.name } },
    })
    if (clash) throw Object.assign(new Error(`Group "${data.name}" already exists`), { statusCode: 409 })
  }

  // Replace members when provided — diff against existing to avoid churn
  if (data.members !== undefined) {
    const existingMembers = await db.appUserGroupMember.findMany({ where: { groupId } })
    const existingIds = new Set(existingMembers.map(m => m.identifier))
    const nextIds = new Set(data.members)

    const toAdd = data.members.filter(id => !existingIds.has(id))
    const toRemove = existingMembers.filter(m => !nextIds.has(m.identifier))

    if (toRemove.length > 0) {
      await db.appUserGroupMember.deleteMany({
        where: { id: { in: toRemove.map(m => m.id) } },
      })
    }
    if (toAdd.length > 0) {
      await db.appUserGroupMember.createMany({
        data: toAdd.map(identifier => ({ groupId, identifier, addedBy: group.createdBy })),
      })
    }
  }

  const updated = await db.appUserGroup.update({
    where: { id: groupId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
    },
    include: { members: true },
  })
  return { group: serializeGroup(updated) }
}

export async function deleteUserGroup(appId: string, groupId: string): Promise<void> {
  const group = await db.appUserGroup.findFirst({ where: { id: groupId, appId } })
  if (!group) throw Object.assign(new Error('Group not found'), { statusCode: 404 })

  await db.appUserGroupMember.deleteMany({ where: { groupId } })
  await db.appUserGroup.delete({ where: { id: groupId } })
}

export async function listUserGroupsBySlug(slug: string) {
  const app = await db.app.findUnique({ where: { slug } })
  if (!app) throw Object.assign(new Error('App not found'), { statusCode: 404 })
  return listUserGroups(app.id)
}

// ── App chrome (header + nav config) ──────────────────────────────────────────
// Per-app form-driven configuration rendered by the Renderer around every
// page. Stored as JSONB columns on the App table — nullable, meaning null =
// nothing rendered. No separate versioning; always-latest is sufficient for
// the POC (same model as theme config).

export async function getAppChrome(appId: string) {
  const app = await db.app.findUnique({
    where: { id: appId },
    select: { id: true, headerConfig: true, navConfig: true },
  })
  if (!app) throw Object.assign(new Error('App not found'), { statusCode: 404 })
  return {
    header: app.headerConfig ?? null,
    nav: app.navConfig ?? null,
  }
}

export async function getAppChromeBySlug(slug: string) {
  const app = await db.app.findUnique({
    where: { slug },
    select: { id: true, headerConfig: true, navConfig: true },
  })
  if (!app) throw Object.assign(new Error('App not found'), { statusCode: 404 })
  return {
    header: app.headerConfig ?? null,
    nav: app.navConfig ?? null,
  }
}

export async function updateAppHeader(
  appId: string,
  header: unknown | null,
) {
  const app = await db.app.findUnique({ where: { id: appId } })
  if (!app) throw Object.assign(new Error('App not found'), { statusCode: 404 })

  await db.app.update({
    where: { id: appId },
    data: { headerConfig: header === null ? Prisma.JsonNull : (header as Prisma.InputJsonValue) },
  })
  return { header }
}

export async function updateAppNav(
  appId: string,
  nav: unknown | null,
) {
  const app = await db.app.findUnique({ where: { id: appId } })
  if (!app) throw Object.assign(new Error('App not found'), { statusCode: 404 })

  await db.app.update({
    where: { id: appId },
    data: { navConfig: nav === null ? Prisma.JsonNull : (nav as Prisma.InputJsonValue) },
  })
  return { nav }
}
