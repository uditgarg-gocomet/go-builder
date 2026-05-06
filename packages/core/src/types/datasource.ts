import { z } from 'zod'

// ── Enums ─────────────────────────────────────────────────────────────────────

export const DataSourceModeSchema = z.enum(['REGISTERED', 'CUSTOM_CONNECTOR', 'CUSTOM_MANUAL'])
export const ConnectorAuthTypeSchema = z.enum(['BEARER', 'API_KEY', 'OAUTH2', 'NONE'])
export const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])

export type DataSourceMode = z.infer<typeof DataSourceModeSchema>
export type ConnectorAuthType = z.infer<typeof ConnectorAuthTypeSchema>
export type HttpMethod = z.infer<typeof HttpMethodSchema>

// ── Sub-definition schemas ────────────────────────────────────────────────────

export const PollingDefSchema = z.object({
  intervalMs: z.number().int().positive(),
  pauseWhen: z.string().optional(),
})

export const ErrorHandlingDefSchema = z.object({
  strategy: z.enum(['show-error', 'show-empty', 'use-fallback']).default('show-error'),
  fallback: z.unknown().optional(),
  retries: z.number().int().nonnegative().optional(),
})

export const TransformDefSchema = z.object({
  expression: z.string(),
})

export const QueryDefSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
  sortField: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
})

// ── DataSourceDef (full definition) ──────────────────────────────────────────

export const DataSourceDefSchema = z.object({
  alias: z.string(),
  mode: DataSourceModeSchema,
  // REGISTERED mode
  endpointId: z.string().optional(),
  // CUSTOM_CONNECTOR mode
  connectorId: z.string().optional(),
  url: z.string().optional(),
  // CUSTOM_MANUAL mode (also used by CUSTOM_CONNECTOR for override)
  method: HttpMethodSchema.optional(),
  headers: z.record(z.string(), z.string()).optional(),
  pathParams: z.record(z.string(), z.string()).optional(),
  queryParams: z.record(z.string(), z.unknown()).optional(),
  body: z.unknown().optional(),
  // Shared options
  transform: z.string().optional(),
  polling: PollingDefSchema.optional(),
  errorHandling: ErrorHandlingDefSchema.optional(),
  dependencies: z.array(z.string()).optional(),
  mockData: z.unknown().optional(),
  useMock: z.boolean().default(false),
})

// ── ConnectorConfig ───────────────────────────────────────────────────────────

export const ConnectorConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  authType: ConnectorAuthTypeSchema,
  baseUrl: z.record(z.enum(['STAGING', 'PRODUCTION']), z.string()),
})

// ── ComponentDataSource (per-component data binding) ─────────────────────────

export const ComponentDataSourceSchema = z.object({
  alias: z.string(),
  pagination: z.object({
    enabled: z.boolean(),
    pageParam: z.string().optional(),
    pageSizeParam: z.string().optional(),
    defaultPageSize: z.number().int().positive().optional(),
  }).optional(),
  sorting: z.object({
    enabled: z.boolean(),
    fieldParam: z.string().optional(),
    directionParam: z.string().optional(),
  }).optional(),
  filtering: z.object({
    enabled: z.boolean(),
    params: z.record(z.string(), z.string()).optional(),
  }).optional(),
})

// ── BindingContext shape ──────────────────────────────────────────────────────

export const BindingContextSchema = z.object({
  datasource: z.record(z.string(), z.unknown()),
  params: z.record(z.string(), z.string()),
  user: z.object({
    id: z.string(),
    email: z.string(),
    groups: z.array(z.string()),
  }).optional(),
  env: z.enum(['STAGING', 'PRODUCTION']).optional(),
  state: z.record(z.string(), z.unknown()),
  form: z.record(z.string(), z.object({
    values: z.record(z.string(), z.unknown()),
    errors: z.record(z.string(), z.string()),
    isValid: z.boolean(),
    isDirty: z.boolean(),
    touched: z.record(z.string(), z.boolean()),
  })),
})

// ── TypeScript types ──────────────────────────────────────────────────────────

export type PollingDef = z.infer<typeof PollingDefSchema>
export type ErrorHandlingDef = z.infer<typeof ErrorHandlingDefSchema>
export type TransformDef = z.infer<typeof TransformDefSchema>
export type QueryDef = z.infer<typeof QueryDefSchema>
export type DataSourceDef = z.infer<typeof DataSourceDefSchema>
export type ConnectorConfig = z.infer<typeof ConnectorConfigSchema>
export type ComponentDataSource = z.infer<typeof ComponentDataSourceSchema>
export type BindingContext = z.infer<typeof BindingContextSchema>

