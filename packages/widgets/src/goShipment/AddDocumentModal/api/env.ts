// ── Env-var contract for AddDocumentModal's three real-API hops ─────────────
//
// In apps/renderer/.env.local:
//   WIDGET_MOCK_TOKEN=<raw JWT — gocomet `user` cookie value>
//   WIDGET_MOCK_USER_TYPE=customer
//   WIDGET_MOCK_SCHEMA=<schema_name>           # tenant routing (optional)
//   WIDGET_MOCK_WORKFLOW_API=https://workflow.delivery-uat.gocomet.com/api/
//   WIDGET_MOCK_LIBRARY_API=https://library.delivery-uat.gocomet.com/
//   WIDGET_MOCK_IMPLEMENTATION_HUB_API=https://implementation-hub.delivery-uat.gocomet.com/
//
// Tenant slug stays hardcoded in shared/constants.ts (DEFAULT_TENANT_SLUG)
// for now — promote to env var when multi-tenant matters.

import { DEFAULT_TENANT_SLUG } from '../shared/constants.js'

export const ADD_DOCUMENT_ENV = {
  TOKEN: 'WIDGET_MOCK_TOKEN',
  USER_TYPE: 'WIDGET_MOCK_USER_TYPE',
  SCHEMA: 'WIDGET_MOCK_SCHEMA',
  WORKFLOW_API: 'WIDGET_MOCK_WORKFLOW_API',
  LIBRARY_API: 'WIDGET_MOCK_LIBRARY_API',
  IMPLEMENTATION_HUB_API: 'WIDGET_MOCK_IMPLEMENTATION_HUB_API',
} as const

export interface AddDocumentEnvConfig {
  token: string
  userType: string
  schema?: string
  workflowApi: string
  libraryApi: string
  implementationHubApi: string
  tenantSlug: string
}

export function readAddDocumentEnv(): AddDocumentEnvConfig {
  const config: AddDocumentEnvConfig = {
    token: process.env[ADD_DOCUMENT_ENV.TOKEN] ?? '',
    userType: process.env[ADD_DOCUMENT_ENV.USER_TYPE] ?? 'public',
    workflowApi: process.env[ADD_DOCUMENT_ENV.WORKFLOW_API] ?? '',
    libraryApi: process.env[ADD_DOCUMENT_ENV.LIBRARY_API] ?? '',
    implementationHubApi: process.env[ADD_DOCUMENT_ENV.IMPLEMENTATION_HUB_API] ?? '',
    tenantSlug: DEFAULT_TENANT_SLUG,
  }
  const schema = process.env[ADD_DOCUMENT_ENV.SCHEMA]
  if (schema && schema.length > 0) {
    config.schema = schema
  }
  return config
}

export function authHeaders(config: AddDocumentEnvConfig): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.token}`,
  }
  if (config.schema) headers['Schema'] = config.schema
  return headers
}
