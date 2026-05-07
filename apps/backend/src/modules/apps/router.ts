import type { FastifyInstance } from 'fastify'
import { requireAuth, requireAppRole } from '../../middleware/auth.js'
import {
  createApp,
  listApps,
  getApp,
  updateApp,
  createPage,
  listPages,
  updatePage,
  deletePage,
  listMembers,
  addMember,
  updateMemberRole,
  removeMember,
  getDeployment,
  createComment,
  listComments,
  resolveComment,
  createReply,
  listUserGroups,
  listUserGroupsBySlug,
  createUserGroup,
  updateUserGroup,
  deleteUserGroup,
  getAppChrome,
  getAppChromeBySlug,
  updateAppHeader,
  updateAppNav,
} from './service.js'
import {
  CreateAppSchema,
  UpdateAppSchema,
  CreatePageSchema,
  UpdatePageSchema,
  AddMemberSchema,
  UpdateMemberRoleSchema,
  AppSlugDeploymentParamsSchema,
  CreateUserGroupSchema,
  UpdateUserGroupSchema,
  UpdateHeaderRequestSchema,
  UpdateNavRequestSchema,
} from './types.js'

export async function appsRouter(fastify: FastifyInstance): Promise<void> {
  // ── POST /apps ────────────────────────────────────────────────────────────────
  fastify.post('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = CreateAppSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    const session = request.fdeSession!
    try {
      const app = await createApp(body.data, session.sub)
      return reply.status(201).send(app)
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // ── GET /apps ─────────────────────────────────────────────────────────────────
  fastify.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const session = request.fdeSession!
    const apps = await listApps(session.sub, session.role === 'ADMIN')
    return reply.status(200).send({ apps })
  })

  // ── GET /apps/:id ─────────────────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/:id', { preHandler: [requireAuth, requireAppRole('VIEWER')] }, async (request, reply) => {
    try {
      const app = await getApp(request.params.id)
      return reply.status(200).send(app)
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // ── PATCH /apps/:id ───────────────────────────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>('/:id', { preHandler: [requireAuth, requireAppRole('EDITOR')] }, async (request, reply) => {
    const body = UpdateAppSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    try {
      const app = await updateApp(request.params.id, body.data)
      return reply.status(200).send(app)
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // ── POST /apps/:id/pages ──────────────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>('/:id/pages', { preHandler: [requireAuth, requireAppRole('EDITOR')] }, async (request, reply) => {
    const body = CreatePageSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    const session = request.fdeSession!
    try {
      const page = await createPage(request.params.id, body.data, session.sub)
      return reply.status(201).send(page)
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // ── GET /apps/:id/pages ───────────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/:id/pages', { preHandler: [requireAuth, requireAppRole('VIEWER')] }, async (request, reply) => {
    try {
      const pages = await listPages(request.params.id)
      return reply.status(200).send({ pages })
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // ── PATCH /apps/:id/pages/:pageId ─────────────────────────────────────────────
  fastify.patch<{ Params: { id: string; pageId: string } }>('/:id/pages/:pageId', { preHandler: [requireAuth, requireAppRole('EDITOR')] }, async (request, reply) => {
    const body = UpdatePageSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    try {
      const page = await updatePage(request.params.id, request.params.pageId, body.data)
      return reply.status(200).send(page)
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // ── DELETE /apps/:id/pages/:pageId ────────────────────────────────────────────
  fastify.delete<{ Params: { id: string; pageId: string } }>('/:id/pages/:pageId', { preHandler: [requireAuth, requireAppRole('OWNER')] }, async (request, reply) => {
    try {
      await deletePage(request.params.id, request.params.pageId)
      return reply.status(204).send()
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // ── GET /apps/:slug/deployment/:env ───────────────────────────────────────────
  // Critical for Renderer build-time. Uses slug (not id). Separate route pattern.
  fastify.get<{ Params: { slug: string; env: string } }>('/slug/:slug/deployment/:env', async (request, reply) => {
    const params = AppSlugDeploymentParamsSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send({ error: 'Validation error', issues: params.error.issues })
    }

    try {
      const result = await getDeployment(params.data.slug, params.data.env)
      return reply.status(200).send(result)
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // ── GET /apps/:id/members ─────────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/:id/members', { preHandler: [requireAuth, requireAppRole('VIEWER')] }, async (request, reply) => {
    try {
      const members = await listMembers(request.params.id)
      return reply.status(200).send({ members })
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // ── POST /apps/:id/members ────────────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>('/:id/members', { preHandler: [requireAuth, requireAppRole('OWNER')] }, async (request, reply) => {
    const body = AddMemberSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    const session = request.fdeSession!
    try {
      const member = await addMember(request.params.id, body.data, session.sub)
      return reply.status(201).send(member)
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // ── PATCH /apps/:id/members/:userId ───────────────────────────────────────────
  fastify.patch<{ Params: { id: string; userId: string } }>('/:id/members/:userId', { preHandler: [requireAuth, requireAppRole('OWNER')] }, async (request, reply) => {
    const body = UpdateMemberRoleSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    try {
      const member = await updateMemberRole(request.params.id, request.params.userId, body.data)
      return reply.status(200).send(member)
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // ── DELETE /apps/:id/members/:userId ──────────────────────────────────────────
  fastify.delete<{ Params: { id: string; userId: string } }>('/:id/members/:userId', { preHandler: [requireAuth, requireAppRole('OWNER')] }, async (request, reply) => {
    try {
      await removeMember(request.params.id, request.params.userId)
      return reply.status(204).send()
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // ── POST /apps/:id/pages/:pageId/comments ─────────────────────────────────────
  fastify.post<{ Params: { id: string; pageId: string } }>(
    '/:id/pages/:pageId/comments',
    { preHandler: [requireAuth, requireAppRole('VIEWER')] },
    async (request, reply) => {
      const body = request.body as { nodeId?: string; body?: string; createdBy?: string }
      if (!body.nodeId || !body.body || !body.createdBy) {
        return reply.status(400).send({ error: 'nodeId, body, and createdBy are required' })
      }
      try {
        const result = await createComment(request.params.id, request.params.pageId, {
          nodeId: body.nodeId,
          body: body.body,
          createdBy: body.createdBy,
        })
        return reply.status(201).send(result)
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // ── GET /apps/:id/pages/:pageId/comments ──────────────────────────────────────
  fastify.get<{ Params: { id: string; pageId: string }; Querystring: { nodeId?: string } }>(
    '/:id/pages/:pageId/comments',
    { preHandler: [requireAuth, requireAppRole('VIEWER')] },
    async (request, reply) => {
      try {
        const result = await listComments(request.params.id, request.params.pageId, request.query.nodeId)
        return reply.status(200).send(result)
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // ── PATCH /apps/:id/pages/:pageId/comments/:commentId (resolve) ───────────────
  fastify.patch<{ Params: { id: string; pageId: string; commentId: string } }>(
    '/:id/pages/:pageId/comments/:commentId',
    { preHandler: [requireAuth, requireAppRole('VIEWER')] },
    async (request, reply) => {
      const body = request.body as { resolved?: boolean; resolvedBy?: string }
      if (!body.resolvedBy) {
        return reply.status(400).send({ error: 'resolvedBy is required' })
      }
      try {
        const result = await resolveComment(
          request.params.id,
          request.params.pageId,
          request.params.commentId,
          body.resolvedBy
        )
        return reply.status(200).send(result)
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // ── POST /apps/:id/pages/:pageId/comments/:commentId/replies ─────────────────
  fastify.post<{ Params: { id: string; pageId: string; commentId: string } }>(
    '/:id/pages/:pageId/comments/:commentId/replies',
    { preHandler: [requireAuth, requireAppRole('VIEWER')] },
    async (request, reply) => {
      const body = request.body as { body?: string; createdBy?: string }
      if (!body.body || !body.createdBy) {
        return reply.status(400).send({ error: 'body and createdBy are required' })
      }
      try {
        const result = await createReply(
          request.params.id,
          request.params.pageId,
          request.params.commentId,
          { body: body.body, createdBy: body.createdBy }
        )
        return reply.status(201).send(result)
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // ── User groups CRUD (authenticated) ──────────────────────────────────────────

  fastify.get<{ Params: { id: string } }>(
    '/:id/user-groups',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      try {
        const result = await listUserGroups(request.params.id)
        return reply.status(200).send(result)
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  fastify.post<{ Params: { id: string } }>(
    '/:id/user-groups',
    { preHandler: [requireAuth, requireAppRole('EDITOR')] },
    async (request, reply) => {
      const body = CreateUserGroupSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
      }
      const session = request.fdeSession!
      try {
        const result = await createUserGroup(request.params.id, body.data, session.sub)
        return reply.status(201).send(result)
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  fastify.patch<{ Params: { id: string; groupId: string } }>(
    '/:id/user-groups/:groupId',
    { preHandler: [requireAuth, requireAppRole('EDITOR')] },
    async (request, reply) => {
      const body = UpdateUserGroupSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
      }
      try {
        const result = await updateUserGroup(request.params.id, request.params.groupId, body.data)
        return reply.status(200).send(result)
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  fastify.delete<{ Params: { id: string; groupId: string } }>(
    '/:id/user-groups/:groupId',
    { preHandler: [requireAuth, requireAppRole('EDITOR')] },
    async (request, reply) => {
      try {
        await deleteUserGroup(request.params.id, request.params.groupId)
        return reply.status(204).send()
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // ── Public list-by-slug (no auth) ─────────────────────────────────────────────
  // Used by the Renderer's dev-login form to populate the role selector from
  // the app's configured groups before the user authenticates. Returns only
  // metadata (id, name, description) — no member identifiers — so no PII is
  // leaked in the unauthenticated response.
  fastify.get<{ Params: { slug: string } }>('/slug/:slug/user-groups', async (request, reply) => {
    try {
      const result = await listUserGroupsBySlug(request.params.slug)
      const safe = result.groups.map(g => ({
        id: g.id,
        name: g.name,
        description: g.description,
      }))
      return reply.status(200).send({ groups: safe })
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // ── App chrome (header + nav) ─────────────────────────────────────────────────

  fastify.get<{ Params: { id: string } }>(
    '/:id/chrome',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      try {
        const result = await getAppChrome(request.params.id)
        return reply.status(200).send(result)
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  fastify.patch<{ Params: { id: string } }>(
    '/:id/header',
    { preHandler: [requireAuth, requireAppRole('EDITOR')] },
    async (request, reply) => {
      const body = UpdateHeaderRequestSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
      }
      try {
        const result = await updateAppHeader(request.params.id, body.data.header)
        return reply.status(200).send(result)
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  fastify.patch<{ Params: { id: string } }>(
    '/:id/nav',
    { preHandler: [requireAuth, requireAppRole('EDITOR')] },
    async (request, reply) => {
      const body = UpdateNavRequestSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
      }
      try {
        const result = await updateAppNav(request.params.id, body.data.nav)
        return reply.status(200).send(result)
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // Public chrome lookup for the Renderer — no auth required (runtime read)
  fastify.get<{ Params: { slug: string } }>('/slug/:slug/chrome', async (request, reply) => {
    try {
      const result = await getAppChromeBySlug(request.params.slug)
      return reply.status(200).send(result)
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })
}
