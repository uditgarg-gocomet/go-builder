import { z } from 'zod'

export const RegisterCustomWidgetSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
  group: z.string().optional(),
  icon: z.string().optional(),
  tags: z.array(z.string()).default([]),
  version: z.string().min(1),
  // Optional: omit for built-in widgets that are bundled with the Renderer
  // (the Renderer's componentResolver pre-seeds them into the widget cache
  // so no CDN fetch is needed). Required for externally-delivered widgets.
  bundleUrl: z.string().url().optional(),
  bundleHash: z.string().optional(),
  propsSchema: z.record(z.unknown()),
  defaultProps: z.record(z.unknown()).default({}),
  releasedAt: z.coerce.date().optional(),
  appId: z.string().optional(),
  registeredBy: z.string().min(1),
})

export const SavePrebuiltViewSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  category: z.string().default('Custom'),
  group: z.string().optional(),
  icon: z.string().optional(),
  tags: z.array(z.string()).default([]),
  viewSchema: z.record(z.unknown()),
  propsSchema: z.record(z.unknown()).default({}),
  defaultProps: z.record(z.unknown()).default({}),
  releasedAt: z.coerce.date().optional(),
  appId: z.string().min(1),
  savedBy: z.string().min(1),
})

export const DeprecateEntrySchema = z.object({
  reason: z.string().min(1),
  replacedBy: z.string().optional(),
  deprecatedBy: z.string().min(1),
})

export const PropsSchemaQuerySchema = z.object({
  components: z.string().min(1),
})

export const GetEntriesQuerySchema = z.object({
  appId: z.string().min(1),
})

export type RegisterCustomWidgetRequest = z.infer<typeof RegisterCustomWidgetSchema>
export type SavePrebuiltViewRequest = z.infer<typeof SavePrebuiltViewSchema>
export type DeprecateEntryRequest = z.infer<typeof DeprecateEntrySchema>
