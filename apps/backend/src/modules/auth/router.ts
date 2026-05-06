import type { FastifyInstance } from 'fastify'
import { getJWKS, verifyToken } from './lib/tokenSigner.js'
import {
  rotateRefreshToken,
  revokeTokenFamily,
  revokeAllSessions,
  isRevoked,
} from './lib/sessionManager.js'
import {
  RefreshRequestSchema,
  LogoutRequestSchema,
  ValidateRequestSchema,
} from './types.js'
import type { ValidateResponse } from './types.js'

export async function authRouter(fastify: FastifyInstance): Promise<void> {
  // ── POST /auth/refresh ───────────────────────────────────────────────────────
  fastify.post('/refresh', async (request, reply) => {
    const body = RefreshRequestSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    const { refreshToken, tokenFamily } = body.data

    try {
      const tokens = await rotateRefreshToken(tokenFamily, refreshToken)
      return reply.status(200).send(tokens)
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 401).send({ error: e.message ?? 'Unauthorized' })
    }
  })

  // ── POST /auth/logout ────────────────────────────────────────────────────────
  fastify.post('/logout', async (request, reply) => {
    const body = LogoutRequestSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    const { tokenFamily, allSessions, userId, appId } = body.data

    if (allSessions && userId) {
      await revokeAllSessions(userId, appId)
    } else {
      await revokeTokenFamily(tokenFamily)
    }

    return reply.status(200).send({ success: true })
  })

  // ── POST /auth/validate ──────────────────────────────────────────────────────
  fastify.post('/validate', async (request, reply) => {
    const body = ValidateRequestSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    const { token } = body.data
    const response: ValidateResponse = { valid: false }

    try {
      const payload = await verifyToken(token)
      const revoked = await isRevoked(payload.tokenFamily)

      if (revoked) {
        response.reason = 'Token family revoked'
        return reply.status(200).send(response)
      }

      response.valid = true
      response.payload = payload
      return reply.status(200).send(response)
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string }
      response.reason = e.code === 'ERR_JWT_EXPIRED' ? 'Token expired' : 'Invalid token'
      return reply.status(200).send(response)
    }
  })

  // ── GET /.well-known/jwks.json ───────────────────────────────────────────────
  // Note: also registered at root in index.ts — this route handles /auth/.well-known/jwks.json
  // The canonical JWKS is at /.well-known/jwks.json (registered in index.ts)
  fastify.get('/jwks', async (_request, reply) => {
    try {
      const jwks = await getJWKS()
      return reply.status(200).header('Cache-Control', 'public, max-age=3600').send(jwks)
    } catch {
      return reply.status(503).send({ error: 'JWKS not configured' })
    }
  })
}
