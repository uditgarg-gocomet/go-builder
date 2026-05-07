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

// ── User group schemas ────────────────────────────────────────────────────────

export const CreateUserGroupSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/i, 'Group name must be alphanumeric with hyphens or underscores'),
  description: z.string().max(500).optional(),
  members: z.array(z.string().min(1)).default([]),
})

export const UpdateUserGroupSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/i).optional(),
  description: z.string().max(500).optional(),
  members: z.array(z.string().min(1)).optional(),
})

export const UserGroupParamsSchema = z.object({
  id: z.string().min(1),
  groupId: z.string().min(1),
})

// ── App chrome schemas ────────────────────────────────────────────────────────
// Duplicated from @portal/core HeaderConfigSchema / NavConfigSchema because
// the backend doesn't depend on @portal/core. Keep these in sync — both are
// parsed against the same data. Changes here should be mirrored in
// packages/core/src/types/chrome.ts and vice versa.

const NodeVisibilityShape = z.object({
  requireGroups: z.array(z.string()).optional(),
  hideForGroups: z.array(z.string()).optional(),
})

export const HeaderConfigShape = z.object({
  enabled: z.boolean().default(true),
  showAppTitle: z.boolean().default(true),
  showLogo: z.boolean().default(false),
  logoAssetId: z.string().optional(),
  title: z.string().optional(),
  globalSearch: z.object({
    enabled: z.boolean().default(false),
    placeholder: z.string().optional(),
  }).default({ enabled: false }),
  showUserMenu: z.boolean().default(true),
})

// NavItem is recursive (groups contain children). Define via z.lazy + union.
interface NavItemT {
  id: string
  label: string
  icon?: string | undefined
  visibility?: z.infer<typeof NodeVisibilityShape> | undefined
  hideOnMobile?: boolean | undefined
  hideOnDesktop?: boolean | undefined
  kind: 'page' | 'url' | 'custom' | 'group'
  pageSlug?: string
  url?: string
  external?: boolean
  customRoute?: string
  children?: NavItemT[]
}

const NavItemBase = {
  id: z.string(),
  label: z.string(),
  icon: z.string().optional(),
  visibility: NodeVisibilityShape.optional(),
  hideOnMobile: z.boolean().optional(),
  hideOnDesktop: z.boolean().optional(),
}

export const NavItemShape: z.ZodType<NavItemT> = z.lazy(() =>
  z.union([
    z.object({ ...NavItemBase, kind: z.literal('page'), pageSlug: z.string() }),
    z.object({ ...NavItemBase, kind: z.literal('url'), url: z.string(), external: z.boolean().default(false) }),
    z.object({ ...NavItemBase, kind: z.literal('custom'), customRoute: z.string() }),
    z.object({ ...NavItemBase, kind: z.literal('group'), children: z.array(NavItemShape) }),
  ]) as z.ZodType<NavItemT>
)

export const NavConfigShape = z.object({
  enabled: z.boolean().default(true),
  position: z.enum(['top', 'side']).default('side'),
  style: z.enum(['text-and-icon', 'text', 'icon']).default('text-and-icon'),
  collapsible: z.boolean().default(true),
  items: z.array(NavItemShape).default([]),
})

export const UpdateHeaderRequestSchema = z.object({
  header: HeaderConfigShape.nullable(),
})

export const UpdateNavRequestSchema = z.object({
  nav: NavConfigShape.nullable(),
})

// ── TypeScript types ──────────────────────────────────────────────────────────

export type CreateApp = z.infer<typeof CreateAppSchema>
export type UpdateApp = z.infer<typeof UpdateAppSchema>
export type CreatePage = z.infer<typeof CreatePageSchema>
export type UpdatePage = z.infer<typeof UpdatePageSchema>
export type AddMember = z.infer<typeof AddMemberSchema>
export type UpdateMemberRole = z.infer<typeof UpdateMemberRoleSchema>
export type CreateUserGroup = z.infer<typeof CreateUserGroupSchema>
export type UpdateUserGroup = z.infer<typeof UpdateUserGroupSchema>
