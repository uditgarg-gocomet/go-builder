import { z } from 'zod'

// ── Token payload types ────────────────────────────────────────────────────────

export interface FDESessionToken {
  sub: string
  email: string
  context: 'BUILDER'
  role: 'ADMIN' | 'FDE'
  idpType: string
  tokenFamily: string
  iat: number
  exp: number
}

export interface PortalSessionToken {
  sub: string
  email: string
  context: 'PORTAL'
  appId: string
  environment: 'STAGING' | 'PRODUCTION'
  groups: string[]
  idpType: string
  tokenFamily: string
  iat: number
  exp: number
}

// ── Zod request schemas ────────────────────────────────────────────────────────

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
  tokenFamily: z.string().min(1),
})

export const LogoutRequestSchema = z.object({
  tokenFamily: z.string().min(1),
  allSessions: z.boolean().optional().default(false),
  userId: z.string().optional(),
  appId: z.string().optional(),
})

export const ValidateRequestSchema = z.object({
  token: z.string().min(1),
})

// ── Token issuance params ─────────────────────────────────────────────────────

export interface TokenIssuanceParams {
  userId: string
  email: string
  context: 'BUILDER' | 'PORTAL'
  role?: 'ADMIN' | 'FDE'
  appId?: string
  environment?: 'STAGING' | 'PRODUCTION'
  groups?: string[]
  idpType: string
}

// ── Validate response ─────────────────────────────────────────────────────────

export interface ValidateResponse {
  valid: boolean
  payload?: FDESessionToken | PortalSessionToken
  reason?: string
}

// ── IdP management schemas ────────────────────────────────────────────────────

export const CreateBuilderIdPSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['GOOGLE', 'OKTA', 'SAML', 'OIDC', 'AUTH0', 'MAGIC_LINK', 'USERNAME_PASSWORD']),
  label: z.string().min(1),
  config: z.record(z.unknown()),
  isActive: z.boolean().optional().default(true),
})

export const UpdateBuilderIdPSchema = z.object({
  name: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  config: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
})

export const CreateAppIdPSchema = z.object({
  appId: z.string().min(1),
  environment: z.enum(['STAGING', 'PRODUCTION']),
  type: z.enum(['GOOGLE', 'OKTA', 'SAML', 'OIDC', 'AUTH0', 'MAGIC_LINK', 'USERNAME_PASSWORD']),
  label: z.string().min(1),
  config: z.record(z.unknown()),
  isEnabled: z.boolean().optional().default(true),
  order: z.number().int().min(0).optional().default(0),
  createdBy: z.string().min(1),
})

export const UpdateAppIdPSchema = z.object({
  label: z.string().min(1).optional(),
  config: z.record(z.unknown()).optional(),
  isEnabled: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
})

export const PortalIdPsQuerySchema = z.object({
  appId: z.string().min(1),
  env: z.enum(['STAGING', 'PRODUCTION']),
})

export const InitiateFlowQuerySchema = z.object({
  context: z.enum(['BUILDER', 'PORTAL']),
  appId: z.string().optional(),
  env: z.enum(['STAGING', 'PRODUCTION']).optional(),
  redirectTo: z.string().min(1).default('/'),
})

export const OIDCCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
})

export const ServiceTokenRequestSchema = z.object({
  serviceId: z.string().min(1),
  serviceSecret: z.string().min(1),
})
