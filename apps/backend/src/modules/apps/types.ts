import { z } from 'zod'

// ── App schemas ───────────────────────────────────────────────────────────────

export const CreateAppSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  metadata: z.record(z.unknown()).optional(),
})

export const UpdateAppSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
})

// ── Page schemas ──────────────────────────────────────────────────────────────

export const CreatePageSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9/-]+$/, 'Slug must be lowercase alphanumeric with hyphens and slashes'),
  order: z.number().int().min(0).optional().default(0),
})

export const UpdatePageSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).optional(),
  order: z.number().int().min(0).optional(),
})

// ── Member schemas ────────────────────────────────────────────────────────────

export const AddMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['OWNER', 'EDITOR', 'VIEWER']),
})

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(['OWNER', 'EDITOR', 'VIEWER']),
})

// ── Params schemas ────────────────────────────────────────────────────────────

export const AppIdParamsSchema = z.object({
  id: z.string().min(1),
})

export const AppSlugDeploymentParamsSchema = z.object({
  slug: z.string().min(1),
  env: z.enum(['STAGING', 'PRODUCTION']),
})

export const PageIdParamsSchema = z.object({
  id: z.string().min(1),
  pageId: z.string().min(1),
})

export const MemberParamsSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
})

// ── TypeScript types ──────────────────────────────────────────────────────────

export type CreateApp = z.infer<typeof CreateAppSchema>
export type UpdateApp = z.infer<typeof UpdateAppSchema>
export type CreatePage = z.infer<typeof CreatePageSchema>
export type UpdatePage = z.infer<typeof UpdatePageSchema>
export type AddMember = z.infer<typeof AddMemberSchema>
export type UpdateMemberRole = z.infer<typeof UpdateMemberRoleSchema>
