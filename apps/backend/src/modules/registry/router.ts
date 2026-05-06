import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../middleware/auth.js'
import {
  listForApp,
  getEntry,
  getPropsSchema,
  registerCustomWidget,
  savePrebuiltView,
  deprecate,
} from './service.js'
import {
  RegisterCustomWidgetSchema,
  SavePrebuiltViewSchema,
  DeprecateEntrySchema,
  PropsSchemaQuerySchema,
  GetEntriesQuerySchema,
} from './types.js'

export async function registryRouter(fastify: FastifyInstance): Promise<void> {
  // ── GET /registry/entries?appId= ──────────────────────────────────────────────
  fastify.get(
    '/entries',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = GetEntriesQuerySchema.safeParse(request.query)
      if (!query.success) {
        return reply.status(400).send({ error: 'Validation error', issues: query.error.issues })
      }

      try {
        const entries = await listForApp(query.data.appId)
        return reply.status(200).send({ entries })
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // ── GET /registry/entries/:name ───────────────────────────────────────────────
  fastify.get<{ Params: { name: string }; Querystring: { version?: string } }>(
    '/entries/:name',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      try {
        const entry = await getEntry(request.params.name, request.query.version)
        return reply.status(200).send({ entry })
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // ── GET /registry/props-schema?components= ────────────────────────────────────
  fastify.get(
    '/props-schema',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = PropsSchemaQuerySchema.safeParse(request.query)
      if (!query.success) {
        return reply.status(400).send({ error: 'Validation error', issues: query.error.issues })
      }

      try {
        const componentNames = query.data.components.split(',').map(c => c.trim()).filter(Boolean)
        const schemas = await getPropsSchema(componentNames)
        return reply.status(200).send({ schemas })
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // ── POST /registry/custom-widget ──────────────────────────────────────────────
  fastify.post(
    '/custom-widget',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = RegisterCustomWidgetSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
      }

      try {
        const result = await registerCustomWidget(body.data)
        return reply.status(201).send(result)
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // ── POST /registry/prebuilt-view ──────────────────────────────────────────────
  fastify.post(
    '/prebuilt-view',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = SavePrebuiltViewSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
      }

      try {
        const result = await savePrebuiltView(body.data)
        return reply.status(201).send(result)
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // ── POST /registry/entries/:id/deprecate ──────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/entries/:id/deprecate',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = DeprecateEntrySchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
      }

      try {
        const result = await deprecate(request.params.id, body.data)
        return reply.status(200).send({ entry: result })
      } catch (err: unknown) {
        const e = err as { message?: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )
}
