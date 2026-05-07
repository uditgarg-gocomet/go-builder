// App chrome — header + navigation config shared across all pages of an app.
// Data model is form-driven (not a free-form ComponentNode tree) because
// headers and navs have strong structural constraints and a form editor
// gives FDEs a cleaner UX than drag-drop. Both are nullable at the app level
// — when absent nothing renders.

import { z } from 'zod'
import { NodeVisibilitySchema } from './schema.js'

// ── Header ────────────────────────────────────────────────────────────────────

export const HeaderConfigSchema = z.object({
  enabled: z.boolean().default(true),
  showAppTitle: z.boolean().default(true),
  showLogo: z.boolean().default(false),
  // References an Asset id from the existing assets module. Resolved to a URL
  // at render time via the asset picker.
  logoAssetId: z.string().optional(),
  title: z.string().optional(),
  // Global search box in the header. For the POC, typing + submitting fires
  // a `header:search` event on the renderer's eventBus — consumers (pages)
  // wire actions to it as needed.
  globalSearch: z.object({
    enabled: z.boolean().default(false),
    placeholder: z.string().optional(),
  }).default({ enabled: false }),
  showUserMenu: z.boolean().default(true),
})

export type HeaderConfig = z.infer<typeof HeaderConfigSchema>

// ── Navigation ────────────────────────────────────────────────────────────────

// Four kinds of nav items. A `group` can contain other items (one level of
// nesting supported in the POC). Items inherit the app's visibility hook so
// role-gated nav entries work the same as role-gated page nodes.

export const NavItemBaseFields = {
  id: z.string(),
  label: z.string(),
  icon: z.string().optional(),
  visibility: NodeVisibilitySchema.optional(),
  // POC: always-shown. Kept for future use per page / breakpoint.
  hideOnMobile: z.boolean().optional(),
  hideOnDesktop: z.boolean().optional(),
}

export const PageNavItemSchema = z.object({
  ...NavItemBaseFields,
  kind: z.literal('page'),
  pageSlug: z.string(),
})

export const UrlNavItemSchema = z.object({
  ...NavItemBaseFields,
  kind: z.literal('url'),
  url: z.string(),
  external: z.boolean().default(false),
})

export const CustomNavItemSchema = z.object({
  ...NavItemBaseFields,
  kind: z.literal('custom'),
  customRoute: z.string(),
})

// `group` references itself recursively — declared via z.lazy below.
export const NavGroupItemSchema: z.ZodType<NavGroupItem> = z.lazy(() =>
  z.object({
    ...NavItemBaseFields,
    kind: z.literal('group'),
    children: z.array(NavItemSchema),
  })
)

export interface NavGroupItem {
  id: string
  label: string
  icon?: string | undefined
  visibility?: z.infer<typeof NodeVisibilitySchema> | undefined
  hideOnMobile?: boolean | undefined
  hideOnDesktop?: boolean | undefined
  kind: 'group'
  children: NavItem[]
}

export const NavItemSchema: z.ZodType<NavItem> = z.lazy(() =>
  z.union([
    PageNavItemSchema,
    UrlNavItemSchema,
    CustomNavItemSchema,
    NavGroupItemSchema,
  ]) as z.ZodType<NavItem>
)

export type PageNavItem = z.infer<typeof PageNavItemSchema>
export type UrlNavItem = z.infer<typeof UrlNavItemSchema>
export type CustomNavItem = z.infer<typeof CustomNavItemSchema>
export type NavItem = PageNavItem | UrlNavItem | CustomNavItem | NavGroupItem

export const NavConfigSchema = z.object({
  enabled: z.boolean().default(true),
  position: z.enum(['top', 'side']).default('side'),
  style: z.enum(['text-and-icon', 'text', 'icon']).default('text-and-icon'),
  collapsible: z.boolean().default(true),
  items: z.array(NavItemSchema).default([]),
})

export type NavConfig = z.infer<typeof NavConfigSchema>

// ── Combined chrome payload ───────────────────────────────────────────────────
// Convenient when the renderer wants both at once via the deployment endpoint.

export const AppChromeSchema = z.object({
  header: HeaderConfigSchema.nullable(),
  nav: NavConfigSchema.nullable(),
})

export type AppChrome = z.infer<typeof AppChromeSchema>
