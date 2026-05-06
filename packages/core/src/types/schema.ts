import { z } from 'zod'

export const StyleOverrideSchema = z.record(z.string(), z.unknown())

export const ActionBindingSchema = z.object({
  event: z.string(),
  actionId: z.string(),
})

export const ComponentDataSourceSchema = z.object({
  alias: z.string(),
  endpointId: z.string().optional(),
  mode: z.enum(['REGISTERED', 'CUSTOM_CONNECTOR', 'CUSTOM_MANUAL']),
})

export const ComponentNodeSchema: z.ZodType<ComponentNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.string(),
    source: z.enum(['primitive', 'custom_widget', 'prebuilt_view']),
    props: z.record(z.string(), z.unknown()),
    bindings: z.record(z.string(), z.string()),
    actions: z.array(ActionBindingSchema),
    style: StyleOverrideSchema,
    responsive: z.object({
      tablet: z.record(z.string(), z.unknown()).optional(),
      mobile: z.record(z.string(), z.unknown()).optional(),
    }),
    children: z.array(z.lazy(() => ComponentNodeSchema)),
    dataSource: ComponentDataSourceSchema.optional(),
  })
)

export const PageParamDefSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean']),
  required: z.boolean(),
})

export const StateSlotDefSchema = z.object({
  name: z.string(),
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

export const PageSchemaSchema = z.object({
  pageId: z.string(),
  appId: z.string(),
  version: z.string(),
  meta: PageSchemaMetaSchema,
  layout: ComponentNodeSchema,
  dataSources: z.array(z.unknown()),
  actions: z.array(z.unknown()),
  forms: z.array(z.unknown()),
  state: z.array(StateSlotDefSchema),
  theme: ThemeOverrideSchema.optional(),
  params: z.array(PageParamDefSchema),
})

export type StyleOverride = z.infer<typeof StyleOverrideSchema>
export type ActionBinding = z.infer<typeof ActionBindingSchema>
export type ComponentDataSource = z.infer<typeof ComponentDataSourceSchema>
export type ComponentNode = {
  id: string
  type: string
  source: 'primitive' | 'custom_widget' | 'prebuilt_view'
  props: Record<string, unknown>
  bindings: Record<string, string>
  actions: ActionBinding[]
  style: StyleOverride
  responsive: {
    tablet?: Record<string, unknown>
    mobile?: Record<string, unknown>
  }
  children: ComponentNode[]
  dataSource?: ComponentDataSource
}
export type PageSchemaMeta = z.infer<typeof PageSchemaMetaSchema>
export type PageSchema = z.infer<typeof PageSchemaSchema>
export type StateSlotDef = z.infer<typeof StateSlotDefSchema>
export type ThemeOverride = z.infer<typeof ThemeOverrideSchema>
export type PageParamDef = z.infer<typeof PageParamDefSchema>
