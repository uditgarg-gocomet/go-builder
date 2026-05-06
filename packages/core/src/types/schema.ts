import { z } from 'zod'
import { DataSourceDefSchema, ComponentDataSourceSchema } from './datasource.js'
import { ActionDefSchema, ActionBindingSchema, FormDefSchema } from './actions.js'

// ── Style + Responsive ────────────────────────────────────────────────────────

export const StyleOverrideSchema = z.record(z.string(), z.unknown())

export const ResponsiveOverrideSchema = z.object({
  tablet: z.record(z.string(), z.unknown()).optional(),
  mobile: z.record(z.string(), z.unknown()).optional(),
})

// ── ComponentNode (recursive) ─────────────────────────────────────────────────

export const ComponentNodeSchema: z.ZodType<ComponentNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.string(),
    source: z.enum(['primitive', 'custom_widget', 'prebuilt_view']),
    props: z.record(z.string(), z.unknown()),
    bindings: z.record(z.string(), z.string()),
    actions: z.array(ActionBindingSchema),
    style: StyleOverrideSchema,
    responsive: ResponsiveOverrideSchema,
    children: z.array(z.lazy(() => ComponentNodeSchema)),
    dataSource: ComponentDataSourceSchema.optional(),
  })
)

export interface ComponentNode {
  id: string
  type: string
  source: 'primitive' | 'custom_widget' | 'prebuilt_view'
  props: Record<string, unknown>
  bindings: Record<string, string>
  actions: Array<{ trigger: string; actionId: string; params?: Record<string, unknown> | undefined }>
  style: Record<string, unknown>
  responsive: { tablet?: Record<string, unknown> | undefined; mobile?: Record<string, unknown> | undefined }
  children: ComponentNode[]
  dataSource?: {
    alias: string
    pagination?: { enabled: boolean; pageParam?: string | undefined; pageSizeParam?: string | undefined; defaultPageSize?: number | undefined } | undefined
    sorting?: { enabled: boolean; fieldParam?: string | undefined; directionParam?: string | undefined } | undefined
    filtering?: { enabled: boolean; params?: Record<string, string> | undefined } | undefined
  } | undefined
}

// ── Page metadata ─────────────────────────────────────────────────────────────

export const PageParamDefSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean']),
  required: z.boolean(),
  defaultValue: z.unknown().optional(),
})

export const StateSlotDefSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']).optional(),
  defaultValue: z.unknown(),
})

export const ThemeOverrideSchema = z.object({
  tokens: z.record(z.string(), z.string()).optional(),
  fonts: z.array(z.string()).optional(),
})

export const PageSchemaMetaSchema = z.object({
  title: z.string(),
  slug: z.string(),
  order: z.number(),
  auth: z.object({
    required: z.boolean(),
    groups: z.array(z.string()),
  }),
})

// ── PageSchema ────────────────────────────────────────────────────────────────

export const PageSchemaSchema = z.object({
  pageId: z.string(),
  appId: z.string(),
  version: z.string(),
  meta: PageSchemaMetaSchema,
  layout: ComponentNodeSchema,
  dataSources: z.array(DataSourceDefSchema).default([]),
  actions: z.array(ActionDefSchema).default([]),
  forms: z.array(FormDefSchema).default([]),
  state: z.array(StateSlotDefSchema).default([]),
  theme: ThemeOverrideSchema.optional(),
  params: z.array(PageParamDefSchema).default([]),
})

// ── TypeScript types ──────────────────────────────────────────────────────────

export type StyleOverride = z.infer<typeof StyleOverrideSchema>
export type ResponsiveOverride = z.infer<typeof ResponsiveOverrideSchema>
export type PageSchemaMeta = z.infer<typeof PageSchemaMetaSchema>
export type PageSchema = z.infer<typeof PageSchemaSchema>
export type StateSlotDef = z.infer<typeof StateSlotDefSchema>
export type ThemeOverride = z.infer<typeof ThemeOverrideSchema>
export type PageParamDef = z.infer<typeof PageParamDefSchema>

// Re-export ActionBinding from actions to avoid duplication
export type { ActionBinding } from './actions.js'
// Re-export ComponentDataSource from datasource to avoid duplication
export type { ComponentDataSource } from './datasource.js'

