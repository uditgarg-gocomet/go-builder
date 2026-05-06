import { z } from 'zod'

export const FDERoleSchema = z.enum(['ADMIN', 'FDE'])
export const AppRoleSchema = z.enum(['OWNER', 'EDITOR', 'VIEWER'])
export const EnvironmentSchema = z.enum(['STAGING', 'PRODUCTION'])
export const TokenContextSchema = z.enum(['BUILDER', 'PORTAL'])
export const IdPTypeSchema = z.enum([
  'GOOGLE',
  'OKTA',
  'SAML',
  'OIDC',
  'AUTH0',
  'MAGIC_LINK',
  'USERNAME_PASSWORD',
])

export const FDESessionTokenSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  context: z.literal('BUILDER'),
  role: FDERoleSchema,
  idpType: IdPTypeSchema,
  tokenFamily: z.string(),
  iat: z.number(),
  exp: z.number(),
})

export const PortalSessionTokenSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  context: z.literal('PORTAL'),
  appId: z.string(),
  environment: EnvironmentSchema,
  groups: z.array(z.string()),
  idpType: IdPTypeSchema,
  tokenFamily: z.string(),
  iat: z.number(),
  exp: z.number(),
})

export const SessionTokenSchema = z.discriminatedUnion('context', [
  FDESessionTokenSchema,
  PortalSessionTokenSchema,
])

export type FDERole = z.infer<typeof FDERoleSchema>
export type AppRole = z.infer<typeof AppRoleSchema>
export type Environment = z.infer<typeof EnvironmentSchema>
export type TokenContext = z.infer<typeof TokenContextSchema>
export type IdPType = z.infer<typeof IdPTypeSchema>
export type FDESessionToken = z.infer<typeof FDESessionTokenSchema>
export type PortalSessionToken = z.infer<typeof PortalSessionTokenSchema>
export type SessionToken = z.infer<typeof SessionTokenSchema>
