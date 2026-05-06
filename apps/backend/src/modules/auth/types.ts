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
