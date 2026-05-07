import type { FastifyInstance } from 'fastify'
import { getJWKS, verifyToken, signToken } from './lib/tokenSigner.js'
import {
  rotateRefreshToken,
  revokeTokenFamily,
  revokeAllSessions,
  isRevoked,
  issueSessionTokens,
} from './lib/sessionManager.js'
import { initiateOIDCFlow, handleOIDCCallback } from './lib/oidcClient.js'
import { initiateSAMLFlow, handleSAMLCallback } from './lib/samlClient.js'
import { syncUserGroups } from './lib/openFGASync.js'
import { db } from '../../lib/db.js'
import {
  RefreshRequestSchema,
  LogoutRequestSchema,
  ValidateRequestSchema,
  PortalIdPsQuerySchema,
  InitiateFlowQuerySchema,
  OIDCCallbackQuerySchema,
  ServiceTokenRequestSchema,
  CreateBuilderIdPSchema,
  UpdateBuilderIdPSchema,
  CreateAppIdPSchema,
  UpdateAppIdPSchema,
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

  // ── GET /auth/jwks ───────────────────────────────────────────────────────────
  fastify.get('/jwks', async (_request, reply) => {
    try {
      const jwks = await getJWKS()
      return reply.status(200).header('Cache-Control', 'public, max-age=3600').send(jwks)
    } catch {
      return reply.status(503).send({ error: 'JWKS not configured' })
    }
  })

  // ── GET /auth/builder/idps ───────────────────────────────────────────────────
  fastify.get('/builder/idps', async (_request, reply) => {
    const idps = await db.builderIdentityProvider.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true, label: true },
    })
    return reply.status(200).send({ idps })
  })

  // ── GET /auth/portal/idps?appId=&env= ────────────────────────────────────────
  fastify.get('/portal/idps', async (request, reply) => {
    const query = PortalIdPsQuerySchema.safeParse(request.query)
    if (!query.success) {
      return reply.status(400).send({ error: 'Validation error', issues: query.error.issues })
    }

    const { appId, env } = query.data

    const idps = await db.appIdentityProvider.findMany({
      where: { appId, environment: env, isEnabled: true },
      orderBy: { order: 'asc' },
      select: { id: true, type: true, label: true, order: true },
    })

    return reply.status(200).send({ idps })
  })

  // ── GET /auth/init/:idpId ────────────────────────────────────────────────────
  fastify.get<{ Params: { idpId: string } }>('/init/:idpId', async (request, reply) => {
    const query = InitiateFlowQuerySchema.safeParse(request.query)
    if (!query.success) {
      return reply.status(400).send({ error: 'Validation error', issues: query.error.issues })
    }

    const { idpId } = request.params
    const { context, appId, env, redirectTo } = query.data

    // Try builder IdP first, then app IdP
    let idpType: string
    let rawConfig: Record<string, unknown>

    if (context === 'BUILDER') {
      const idp = await db.builderIdentityProvider.findUnique({ where: { id: idpId } })
      if (!idp || !idp.isActive) {
        return reply.status(404).send({ error: 'Builder IdP not found or disabled' })
      }
      idpType = idp.type
      rawConfig = JSON.parse(idp.config) as Record<string, unknown>
    } else {
      if (!appId || !env) {
        return reply.status(400).send({ error: 'appId and env are required for PORTAL context' })
      }
      const idp = await db.appIdentityProvider.findUnique({ where: { id: idpId } })
      if (!idp || !idp.isEnabled) {
        return reply.status(404).send({ error: 'App IdP not found or disabled' })
      }
      idpType = idp.type
      const { secretsProvider } = await import('../../lib/secrets.js')
      rawConfig = await secretsProvider.resolve(idp.configSecretRef) as Record<string, unknown>
    }

    try {
      if (idpType === 'SAML') {
        const samlConfig = {
          entityId: (rawConfig['entityId'] as string) ?? '',
          metadata: rawConfig['metadata'] as string | undefined,
          entryPoint: rawConfig['entryPoint'] as string | undefined,
          certificate: rawConfig['certificate'] as string | undefined,
        }
        const { redirectUrl } = await initiateSAMLFlow(
          idpId, samlConfig, context,
          appId, env as 'STAGING' | 'PRODUCTION' | undefined, redirectTo
        )
        return reply.redirect(redirectUrl)
      } else {
        // OIDC-based (GOOGLE, OKTA, OIDC, AUTH0)
        const oidcConfig = {
          issuerUrl: (rawConfig['issuerUrl'] as string) ?? '',
          clientId: (rawConfig['clientId'] as string) ?? '',
          clientSecret: (rawConfig['clientSecret'] as string) ?? '',
          scopes: rawConfig['scopes'] as string[] | undefined,
        }
        const { authUrl } = await initiateOIDCFlow(
          idpId, oidcConfig, context,
          appId, env as 'STAGING' | 'PRODUCTION' | undefined, redirectTo
        )
        return reply.redirect(authUrl)
      }
    } catch (err: unknown) {
      const e = err as { message?: string }
      return reply.status(502).send({ error: 'Failed to initiate auth flow', details: e.message })
    }
  })

  // ── GET /auth/callback/oidc/:idpId ──────────────────────────────────────────
  fastify.get<{ Params: { idpId: string } }>('/callback/oidc/:idpId', async (request, reply) => {
    const query = OIDCCallbackQuerySchema.safeParse(request.query)
    if (!query.success) {
      return reply.status(400).send({ error: 'Validation error', issues: query.error.issues })
    }

    const { idpId } = request.params
    const { code, state } = query.data

    // Find OAuth state to determine context
    const oauthState = await db.oAuthState.findUnique({ where: { state } })
    if (!oauthState) {
      return reply.status(400).send({ error: 'Invalid or expired OAuth state' })
    }

    // Look up the IdP config
    let rawConfig: Record<string, unknown>
    let idpType: string

    if (oauthState.context === 'BUILDER') {
      const idp = await db.builderIdentityProvider.findUnique({ where: { id: idpId } })
      if (!idp) return reply.status(404).send({ error: 'IdP not found' })
      idpType = idp.type
      rawConfig = JSON.parse(idp.config) as Record<string, unknown>
    } else {
      const idp = await db.appIdentityProvider.findUnique({ where: { id: idpId } })
      if (!idp) return reply.status(404).send({ error: 'IdP not found' })
      idpType = idp.type
      const { secretsProvider } = await import('../../lib/secrets.js')
      rawConfig = await secretsProvider.resolve(idp.configSecretRef) as Record<string, unknown>
    }

    const oidcConfig = {
      issuerUrl: (rawConfig['issuerUrl'] as string) ?? '',
      clientId: (rawConfig['clientId'] as string) ?? '',
      clientSecret: (rawConfig['clientSecret'] as string) ?? '',
      scopes: rawConfig['scopes'] as string[] | undefined,
    }

    try {
      const { userId, email } = await handleOIDCCallback(idpId, oidcConfig, code, state)

      let tokens: { accessToken: string; refreshToken: string; tokenFamily: string }

      if (oauthState.context === 'BUILDER') {
        // Look up FDE user
        const fdeUser = await db.fDEUser.findUnique({ where: { email } })
        if (!fdeUser) {
          return reply.status(403).send({ error: 'FDE user not found — contact your administrator' })
        }
        tokens = await issueSessionTokens({
          userId: fdeUser.id,
          email: fdeUser.email,
          context: 'BUILDER',
          role: fdeUser.role as 'ADMIN' | 'FDE',
          idpType,
        })
      } else {
        const env = (oauthState.environment ?? 'STAGING') as 'STAGING' | 'PRODUCTION'
        tokens = await issueSessionTokens({
          userId,
          email,
          context: 'PORTAL',
          appId: oauthState.appId ?? '',
          environment: env,
          groups: [],
          idpType,
        })
        // Sync OpenFGA groups non-blocking
        if (oauthState.appId) {
          syncUserGroups(userId, oauthState.appId).catch(() => null)
        }
      }

      const redirectTo = oauthState.redirectTo
      const redirectUrl = `${redirectTo}?token=${encodeURIComponent(tokens.accessToken)}&tokenFamily=${encodeURIComponent(tokens.tokenFamily)}&refreshToken=${encodeURIComponent(tokens.refreshToken)}`
      return reply.redirect(redirectUrl)
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message ?? 'Auth callback failed' })
    }
  })

  // ── POST /auth/callback/saml/:idpId ─────────────────────────────────────────
  fastify.post<{ Params: { idpId: string } }>('/callback/saml/:idpId', async (request, reply) => {
    const { idpId } = request.params
    const body = request.body as Record<string, string>
    const samlResponse = body['SAMLResponse']
    const inResponseTo = body['RelayState']

    if (!samlResponse) {
      return reply.status(400).send({ error: 'SAMLResponse is required' })
    }

    // Look up SAML state via requestId (stored in RelayState)
    const samlState = inResponseTo
      ? await db.sAMLState.findFirst({ where: { requestId: inResponseTo } })
      : null

    if (!samlState) {
      return reply.status(400).send({ error: 'Invalid or expired SAML state' })
    }

    if (samlState.expiresAt < new Date()) {
      await db.sAMLState.delete({ where: { requestId: inResponseTo! } }).catch(() => null)
      return reply.status(400).send({ error: 'SAML state expired — restart the login flow' })
    }

    // Look up the IdP
    let rawConfig: Record<string, unknown>
    let idpType: string

    if (samlState.context === 'BUILDER') {
      const idp = await db.builderIdentityProvider.findUnique({ where: { id: idpId } })
      if (!idp) return reply.status(404).send({ error: 'IdP not found' })
      idpType = idp.type
      rawConfig = JSON.parse(idp.config) as Record<string, unknown>
    } else {
      const idp = await db.appIdentityProvider.findUnique({ where: { id: idpId } })
      if (!idp) return reply.status(404).send({ error: 'IdP not found' })
      idpType = idp.type
      const { secretsProvider } = await import('../../lib/secrets.js')
      rawConfig = await secretsProvider.resolve(idp.configSecretRef) as Record<string, unknown>
    }

    const samlConfig = {
      entityId: (rawConfig['entityId'] as string) ?? '',
      metadata: rawConfig['metadata'] as string | undefined,
      entryPoint: rawConfig['entryPoint'] as string | undefined,
      certificate: rawConfig['certificate'] as string | undefined,
    }

    try {
      const { userId, email } = await handleSAMLCallback(idpId, samlConfig, samlResponse)

      await db.sAMLState.delete({ where: { requestId: samlState.requestId } }).catch(() => null)

      let tokens: { accessToken: string; refreshToken: string; tokenFamily: string }

      if (samlState.context === 'BUILDER') {
        const fdeUser = await db.fDEUser.findUnique({ where: { email } })
        if (!fdeUser) {
          return reply.status(403).send({ error: 'FDE user not found — contact your administrator' })
        }
        tokens = await issueSessionTokens({
          userId: fdeUser.id,
          email: fdeUser.email,
          context: 'BUILDER',
          role: fdeUser.role as 'ADMIN' | 'FDE',
          idpType,
        })
      } else {
        const env = (samlState.environment ?? 'STAGING') as 'STAGING' | 'PRODUCTION'
        tokens = await issueSessionTokens({
          userId,
          email,
          context: 'PORTAL',
          appId: samlState.appId ?? '',
          environment: env,
          groups: [],
          idpType,
        })
        if (samlState.appId) {
          syncUserGroups(userId, samlState.appId).catch(() => null)
        }
      }

      const redirectTo = samlState.redirectTo
      const redirectUrl = `${redirectTo}?token=${encodeURIComponent(tokens.accessToken)}&tokenFamily=${encodeURIComponent(tokens.tokenFamily)}&refreshToken=${encodeURIComponent(tokens.refreshToken)}`
      return reply.redirect(redirectUrl)
    } catch (err: unknown) {
      const e = err as { message?: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message ?? 'SAML callback failed' })
    }
  })

  // ── POST /auth/service-token ─────────────────────────────────────────────────
  fastify.post('/service-token', async (request, reply) => {
    const body = ServiceTokenRequestSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    const { serviceId, serviceSecret } = body.data

    const expectedId = process.env['SERVICE_ID']
    const expectedSecret = process.env['SERVICE_SECRET']

    if (!expectedId || !expectedSecret) {
      return reply.status(503).send({ error: 'Service token not configured' })
    }

    if (serviceId !== expectedId || serviceSecret !== expectedSecret) {
      return reply.status(401).send({ error: 'Invalid service credentials' })
    }

    // Issue a long-lived service JWT (7 days) for Renderer → Backend calls
    const token = await signToken({
      sub: serviceId,
      email: `${serviceId}@service`,
      context: 'BUILDER',
      role: 'ADMIN',
      idpType: 'SERVICE',
      tokenFamily: `service:${serviceId}`,
    })

    return reply.status(200).send({ token })
  })

  // ── Builder IdP management (CRUD for internal use) ───────────────────────────
  fastify.post('/builder/idps', async (request, reply) => {
    const body = CreateBuilderIdPSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }
    const idp = await db.builderIdentityProvider.create({
      data: {
        name: body.data.name,
        type: body.data.type,
        label: body.data.label,
        config: JSON.stringify(body.data.config),
        isActive: body.data.isActive ?? true,
      },
    })
    return reply.status(201).send(idp)
  })

  fastify.patch<{ Params: { idpId: string } }>('/builder/idps/:idpId', async (request, reply) => {
    const body = UpdateBuilderIdPSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }
    const { idpId } = request.params
    try {
      const idp = await db.builderIdentityProvider.update({
        where: { id: idpId },
        data: {
          ...(body.data.name !== undefined && { name: body.data.name }),
          ...(body.data.label !== undefined && { label: body.data.label }),
          ...(body.data.config !== undefined && { config: JSON.stringify(body.data.config) }),
          ...(body.data.isActive !== undefined && { isActive: body.data.isActive }),
        },
      })
      return reply.status(200).send(idp)
    } catch {
      return reply.status(404).send({ error: 'Builder IdP not found' })
    }
  })

  // ── App IdP management ───────────────────────────────────────────────────────
  fastify.post('/portal/idps', async (request, reply) => {
    const body = CreateAppIdPSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }
    const { secretsProvider } = await import('../../lib/secrets.js')
    const configSecretRef = await secretsProvider.store(`app-idp-${body.data.appId}`, body.data.config)
    const idp = await db.appIdentityProvider.create({
      data: {
        appId: body.data.appId,
        environment: body.data.environment,
        type: body.data.type,
        label: body.data.label,
        configSecretRef,
        isEnabled: body.data.isEnabled ?? true,
        order: body.data.order ?? 0,
        createdBy: body.data.createdBy,
        updatedBy: body.data.createdBy,
      },
    })
    return reply.status(201).send(idp)
  })

  // ── POST /auth/dev-login (development only) ──────────────────────────────────
  // Mints a dev session token without going through an IdP. Supports both
  // BUILDER context (FDE login into the App Builder) and PORTAL context
  // (end-user login into a rendered app). For PORTAL, accepts `appId`,
  // `environment`, and `groups` so the POC role fixture (ops_admin /
  // ops_viewer) can drive the renderer's visibility hooks and widget
  // permission hooks.
  if (process.env['NODE_ENV'] !== 'production') {
    fastify.post('/dev-login', async (request, reply) => {
      const body = request.body as {
        email?: string
        role?: string
        context?: 'BUILDER' | 'PORTAL'
        appId?: string
        environment?: 'STAGING' | 'PRODUCTION'
        groups?: string[]
      } | undefined
      const email = body?.email ?? 'dev@portal.local'
      const context = body?.context === 'PORTAL' ? 'PORTAL' : 'BUILDER'
      const userId = `dev-${email.replace(/[^a-z0-9]/gi, '-')}`
      const tokenFamily = `dev-${Date.now()}`

      if (context === 'PORTAL') {
        const environment = body?.environment === 'PRODUCTION' ? 'PRODUCTION' : 'STAGING'
        const appId = body?.appId ?? ''
        const groups = Array.isArray(body?.groups) ? body.groups.map(String) : []

        const token = await signToken({
          sub: userId,
          email,
          context: 'PORTAL' as const,
          appId,
          environment,
          groups,
          idpType: 'DEV',
          tokenFamily,
        })

        return reply.status(200).send({ token, userId, email, context, appId, environment, groups })
      }

      // BUILDER (default, backwards compatible)
      const role = (body?.role === 'ADMIN' ? 'ADMIN' : 'FDE') as 'ADMIN' | 'FDE'

      const token = await signToken({
        sub: userId,
        email,
        context: 'BUILDER' as const,
        role,
        idpType: 'DEV',
        tokenFamily,
      })

      return reply.status(200).send({ token, userId, email, context, role })
    })
  }

  fastify.patch<{ Params: { idpId: string } }>('/portal/idps/:idpId', async (request, reply) => {
    const body = UpdateAppIdPSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }
    const { idpId } = request.params
    const existing = await db.appIdentityProvider.findUnique({ where: { id: idpId } })
    if (!existing) return reply.status(404).send({ error: 'App IdP not found' })

    let configSecretRef: string | undefined
    if (body.data.config !== undefined) {
      const { secretsProvider } = await import('../../lib/secrets.js')
      configSecretRef = await secretsProvider.store(`app-idp-${existing.appId}`, body.data.config)
    }

    const idp = await db.appIdentityProvider.update({
      where: { id: idpId },
      data: {
        ...(body.data.label !== undefined && { label: body.data.label }),
        ...(configSecretRef !== undefined && { configSecretRef }),
        ...(body.data.isEnabled !== undefined && { isEnabled: body.data.isEnabled }),
        ...(body.data.order !== undefined && { order: body.data.order }),
        updatedBy: 'system',
      },
    })
    return reply.status(200).send(idp)
  })
}
