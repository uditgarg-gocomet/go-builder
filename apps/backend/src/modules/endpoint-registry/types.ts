import { z } from 'zod'

const ParamDefSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  required: z.boolean().default(false),
  description: z.string().optional(),
  defaultValue: z.unknown().optional(),
})

export const RegisterConnectorSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  baseUrl: z.object({
    staging: z.string().url(),
    production: z.string().url(),
  }),
  authType: z.enum(['BEARER', 'API_KEY', 'OAUTH2', 'NONE']),
  authConfig: z.record(z.unknown()).default({}),
  headers: z.record(z.string()).default({}),
  createdBy: z.string().min(1),
})

export const RegisterEndpointSchema = z.object({
  connectorId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string().min(1).startsWith('/'),
  category: z.string().min(1),
  tags: z.array(z.string()).default([]),
  pathParams: z.array(ParamDefSchema).default([]),
  queryParams: z.array(ParamDefSchema).default([]),
  bodySchema: z.record(z.unknown()).optional(),
  headers: z.record(z.string()).default({}),
  responseSchema: z.record(z.unknown()),
  responseSample: z.record(z.unknown()).optional(),
  createdBy: z.string().min(1),
})

export const UpdateEndpointSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  queryParams: z.array(ParamDefSchema).optional(),
  bodySchema: z.record(z.unknown()).optional(),
  headers: z.record(z.string()).optional(),
  responseSchema: z.record(z.unknown()).optional(),
  responseSample: z.record(z.unknown()).optional(),
})

export const TestEndpointSchema = z.object({
  mode: z.enum(['REGISTERED', 'CUSTOM_CONNECTOR', 'CUSTOM_MANUAL']),
  // For REGISTERED mode
  endpointId: z.string().optional(),
  // For CUSTOM_CONNECTOR mode
  connectorId: z.string().optional(),
  url: z.string().optional(),
  // For CUSTOM_MANUAL mode
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  headers: z.record(z.string()).optional(),
  // Common
  pathParams: z.record(z.string()).optional(),
  queryParams: z.record(z.unknown()).optional(),
  body: z.unknown().optional(),
  // Context for usage logging
  appId: z.string().optional(),
  pageId: z.string().optional(),
  alias: z.string().optional(),
  environment: z.enum(['staging', 'production']).default('staging'),
  testedBy: z.string().min(1),
})

export type RegisterConnectorRequest = z.infer<typeof RegisterConnectorSchema>
export type RegisterEndpointRequest = z.infer<typeof RegisterEndpointSchema>
export type UpdateEndpointRequest = z.infer<typeof UpdateEndpointSchema>
export type TestEndpointRequest = z.infer<typeof TestEndpointSchema>
