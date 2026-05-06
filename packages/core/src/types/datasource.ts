import { z } from 'zod'

export const DataSourceModeSchema = z.enum(['REGISTERED', 'CUSTOM_CONNECTOR', 'CUSTOM_MANUAL'])
export const ConnectorAuthTypeSchema = z.enum(['BEARER', 'API_KEY', 'OAUTH2', 'NONE'])
export const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])

export const DataSourceDefSchema = z.object({
  alias: z.string(),
  mode: DataSourceModeSchema,
  endpointId: z.string().optional(),
  connectorId: z.string().optional(),
  url: z.string().optional(),
  method: HttpMethodSchema.optional(),
  headers: z.record(z.string(), z.string()).optional(),
  queryParams: z.record(z.string(), z.string()).optional(),
  body: z.unknown().optional(),
  transform: z.string().optional(),
  errorHandling: z.enum(['show-error', 'show-empty']).default('show-error'),
  pollingIntervalMs: z.number().optional(),
  dependsOn: z.array(z.string()).optional(),
})

export const ConnectorConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  authType: ConnectorAuthTypeSchema,
  baseUrl: z.record(z.enum(['STAGING', 'PRODUCTION']), z.string()),
})

export type DataSourceMode = z.infer<typeof DataSourceModeSchema>
export type ConnectorAuthType = z.infer<typeof ConnectorAuthTypeSchema>
export type HttpMethod = z.infer<typeof HttpMethodSchema>
export type DataSourceDef = z.infer<typeof DataSourceDefSchema>
export type ConnectorConfig = z.infer<typeof ConnectorConfigSchema>
