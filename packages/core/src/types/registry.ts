import { z } from 'zod'

export const ComponentTypeSchema = z.enum(['PRIMITIVE', 'CUSTOM_WIDGET', 'PREBUILT_VIEW'])
export const RegistryScopeSchema = z.enum(['COMMON', 'TENANT_LOCAL'])
export const EntryStatusSchema = z.enum(['ACTIVE', 'DEPRECATED', 'PENDING_REVIEW', 'REJECTED'])
export const SourceTypeSchema = z.enum(['INTERNAL', 'EXTERNAL_PLATFORM', 'COMPOSED'])

export const ComponentManifestSchema = z.object({
  displayName: z.string(),
  category: z.string(),
  description: z.string(),
  icon: z.string().optional(),
  tags: z.array(z.string()),
})

export const RegistryEntryVersionSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  version: z.string(),
  propsSchema: z.unknown(),
  defaultProps: z.unknown(),
  bundleUrl: z.string().optional(),
  bundleHash: z.string().optional(),
  viewSchema: z.unknown().optional(),
  displayName: z.string(),
  description: z.string().optional(),
  category: z.string(),
  icon: z.string().optional(),
  thumbnail: z.string().optional(),
  tags: z.array(z.string()),
  changelog: z.string().optional(),
  publishedAt: z.coerce.date(),
  publishedBy: z.string(),
})

export const RegistryEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: ComponentTypeSchema,
  scope: RegistryScopeSchema,
  status: EntryStatusSchema,
  currentVersion: z.string(),
  sourceType: SourceTypeSchema,
  sourceRef: z.string().optional(),
  ownedBy: z.string(),
  createdBy: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  versions: z.array(RegistryEntryVersionSchema).optional(),
})

export type ComponentType = z.infer<typeof ComponentTypeSchema>
export type RegistryScope = z.infer<typeof RegistryScopeSchema>
export type EntryStatus = z.infer<typeof EntryStatusSchema>
export type SourceType = z.infer<typeof SourceTypeSchema>
export type ComponentManifest = z.infer<typeof ComponentManifestSchema>
export type RegistryEntryVersion = z.infer<typeof RegistryEntryVersionSchema>
export type RegistryEntry = z.infer<typeof RegistryEntrySchema>
