import { signToken, verifyToken, getJWKS } from './lib/tokenSigner.js'
import {
  issueSessionTokens,
  rotateRefreshToken,
  revokeTokenFamily,
  revokeAllSessions,
  isRevoked,
} from './lib/sessionManager.js'
import { db } from '../../lib/db.js'
import { secretsProvider } from '../../lib/secrets.js'
import type {
  TokenIssuanceParams,
  ValidateResponse,
  CreateBuilderIdPSchema,
  UpdateBuilderIdPSchema,
  CreateAppIdPSchema,
  UpdateAppIdPSchema,
} from './types.js'
import type { z } from 'zod'

export const authService = {
  issueSessionTokens: (params: TokenIssuanceParams) => issueSessionTokens(params),

  rotateRefreshToken: (tokenFamily: string, rawRefreshToken: string) =>
    rotateRefreshToken(tokenFamily, rawRefreshToken),

  revokeTokenFamily: (tokenFamily: string) => revokeTokenFamily(tokenFamily),

  revokeAllSessions: (userId: string, appId?: string) => revokeAllSessions(userId, appId),

  async validateToken(token: string): Promise<ValidateResponse> {
    try {
      const payload = await verifyToken(token)
      const revoked = await isRevoked(payload.tokenFamily)
      if (revoked) return { valid: false, reason: 'Token family revoked' }
      return { valid: true, payload }
    } catch (err: unknown) {
      const e = err as { code?: string }
      return {
        valid: false,
        reason: e.code === 'ERR_JWT_EXPIRED' ? 'Token expired' : 'Invalid token',
      }
    }
  },

  getJWKS: () => getJWKS(),

  signToken: (payload: Parameters<typeof signToken>[0]) => signToken(payload),

  // ── Builder IdP CRUD ─────────────────────────────────────────────────────────

  async listBuilderIdPs() {
    return db.builderIdentityProvider.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    })
  },

  async createBuilderIdP(data: z.infer<typeof CreateBuilderIdPSchema>) {
    return db.builderIdentityProvider.create({
      data: {
        name: data.name,
        type: data.type,
        label: data.label,
        config: JSON.stringify(data.config),
        isActive: data.isActive ?? true,
      },
    })
  },

  async updateBuilderIdP(id: string, data: z.infer<typeof UpdateBuilderIdPSchema>) {
    const existing = await db.builderIdentityProvider.findUnique({ where: { id } })
    if (!existing) throw Object.assign(new Error('Builder IdP not found'), { statusCode: 404 })

    return db.builderIdentityProvider.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.label !== undefined && { label: data.label }),
        ...(data.config !== undefined && { config: JSON.stringify(data.config) }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    })
  },

  // ── App IdP CRUD ─────────────────────────────────────────────────────────────

  async listAppIdPs(appId: string, environment: 'STAGING' | 'PRODUCTION') {
    return db.appIdentityProvider.findMany({
      where: { appId, environment },
      orderBy: { order: 'asc' },
    })
  },

  async listEnabledAppIdPs(appId: string, environment: 'STAGING' | 'PRODUCTION') {
    return db.appIdentityProvider.findMany({
      where: { appId, environment, isEnabled: true },
      orderBy: { order: 'asc' },
    })
  },

  async createAppIdP(data: z.infer<typeof CreateAppIdPSchema>) {
    const configSecretRef = await secretsProvider.store(`app-idp-${data.appId}`, data.config)

    return db.appIdentityProvider.create({
      data: {
        appId: data.appId,
        environment: data.environment,
        type: data.type,
        label: data.label,
        configSecretRef,
        isEnabled: data.isEnabled ?? true,
        order: data.order ?? 0,
        createdBy: data.createdBy,
        updatedBy: data.createdBy,
      },
    })
  },

  async updateAppIdP(id: string, data: z.infer<typeof UpdateAppIdPSchema>, updatedBy: string) {
    const existing = await db.appIdentityProvider.findUnique({ where: { id } })
    if (!existing) throw Object.assign(new Error('App IdP not found'), { statusCode: 404 })

    let configSecretRef: string | undefined
    if (data.config !== undefined) {
      configSecretRef = await secretsProvider.store(`app-idp-${existing.appId}`, data.config)
    }

    return db.appIdentityProvider.update({
      where: { id },
      data: {
        ...(data.label !== undefined && { label: data.label }),
        ...(configSecretRef !== undefined && { configSecretRef }),
        ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
        ...(data.order !== undefined && { order: data.order }),
        updatedBy,
      },
    })
  },

  async toggleAppIdP(id: string, isEnabled: boolean, updatedBy: string) {
    const existing = await db.appIdentityProvider.findUnique({ where: { id } })
    if (!existing) throw Object.assign(new Error('App IdP not found'), { statusCode: 404 })

    return db.appIdentityProvider.update({
      where: { id },
      data: { isEnabled, updatedBy },
    })
  },

  async getAppIdPConfig(id: string): Promise<Record<string, unknown>> {
    const idp = await db.appIdentityProvider.findUnique({ where: { id } })
    if (!idp) throw Object.assign(new Error('App IdP not found'), { statusCode: 404 })
    return secretsProvider.resolve(idp.configSecretRef) as Promise<Record<string, unknown>>
  },

  async getBuilderIdPConfig(id: string): Promise<Record<string, unknown>> {
    const idp = await db.builderIdentityProvider.findUnique({ where: { id } })
    if (!idp) throw Object.assign(new Error('Builder IdP not found'), { statusCode: 404 })
    return JSON.parse(idp.config) as Record<string, unknown>
  },
}
