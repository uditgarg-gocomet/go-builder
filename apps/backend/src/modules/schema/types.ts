import { z } from 'zod'

// ── ComponentNode (recursive) ─────────────────────────────────────────────────

export const ComponentNodeZ: z.ZodType<ComponentNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.string(),
    source: z.enum(['primitive', 'custom_widget', 'prebuilt_view']),
    props: z.record(z.unknown()).default({}),
    bindings: z.record(z.string()).default({}),
    actions: z.array(z.object({
      trigger: z.string(),
      actionId: z.string(),
      params: z.record(z.unknown()).optional(),
    })).default([]),
    style: z.record(z.unknown()).default({}),
    responsive: z.object({
      tablet: z.record(z.unknown()).optional(),
      mobile: z.record(z.unknown()).optional(),
    }).default({}),
    children: z.array(ComponentNodeZ).default([]),
    dataSource: z.object({
      alias: z.string(),
      pagination: z.object({ enabled: z.boolean(), pageParam: z.string().optional() }).optional(),
      sorting: z.object({ enabled: z.boolean(), fieldParam: z.string().optional() }).optional(),
    }).optional(),
  })
)

export interface ComponentNode {
  id: string
  type: string
  source: 'primitive' | 'custom_widget' | 'prebuilt_view'
  props: Record<string, unknown>
  bindings: Record<string, string>
  actions: Array<{ trigger: string; actionId: string; params?: Record<string, unknown> }>
  style: Record<string, unknown>
  responsive: { tablet?: Record<string, unknown>; mobile?: Record<string, unknown> }
  children: ComponentNode[]
  dataSource?: { alias: string; pagination?: object; sorting?: object }
}

// ── PageSchema ────────────────────────────────────────────────────────────────

export const PageSchemaZ = z.object({
  pageId: z.string(),
  appId: z.string(),
  version: z.string(),
  meta: z.object({
    title: z.string(),
    slug: z.string(),
    order: z.number().int(),
    auth: z.object({
      required: z.boolean(),
      groups: z.array(z.string()),
    }),
  }),
  layout: ComponentNodeZ,
  dataSources: z.array(z.object({
    alias: z.string(),
    mode: z.enum(['REGISTERED', 'CUSTOM_CONNECTOR', 'CUSTOM_MANUAL']),
    endpointRef: z.string().optional(),
    connectorId: z.string().optional(),
    url: z.string().optional(),
    method: z.string().optional(),
    params: z.record(z.unknown()).optional(),
    transform: z.string().optional(),
    polling: z.object({ interval: z.number(), pauseWhen: z.string().optional() }).optional(),
    errorHandling: z.object({ fallback: z.unknown().optional(), retries: z.number().optional() }).optional(),
    dependencies: z.array(z.string()).optional(),
    mockData: z.unknown().optional(),
  })).default([]),
  actions: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    config: z.record(z.unknown()),
  })).default([]),
  forms: z.array(z.object({
    id: z.string(),
    fields: z.array(z.object({
      name: z.string(),
      type: z.string(),
      label: z.string(),
      required: z.boolean().optional(),
      defaultValue: z.unknown().optional(),
      validations: z.array(z.object({ type: z.string(), value: z.unknown().optional(), message: z.string().optional() })).optional(),
    })),
    submitActionId: z.string().optional(),
    resetOnSubmit: z.boolean().optional(),
  })).default([]),
  state: z.array(z.object({
    name: z.string(),
    type: z.string(),
    defaultValue: z.unknown(),
  })).default([]),
  theme: z.record(z.unknown()).optional(),
  params: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean().optional(),
    defaultValue: z.unknown().optional(),
  })).default([]),
})

export type PageSchema = z.infer<typeof PageSchemaZ>

// ── Request / query schemas ───────────────────────────────────────────────────

export const SaveDraftRequestSchema = z.object({
  pageId: z.string().min(1),
  schema: PageSchemaZ,
  savedBy: z.string().min(1),
})

export const PromoteRequestSchema = z.object({
  bumpType: z.enum(['major', 'minor', 'patch']),
  changelog: z.string().min(1, 'Changelog is required when promoting'),
  promotedBy: z.string().min(1),
})

export const RollbackRequestSchema = z.object({
  targetVersionId: z.string().min(1),
  rolledBackBy: z.string().min(1),
})

export const DiffQuerySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
})

export type SaveDraftRequest = z.infer<typeof SaveDraftRequestSchema>
export type PromoteRequest = z.infer<typeof PromoteRequestSchema>
export type RollbackRequest = z.infer<typeof RollbackRequestSchema>
