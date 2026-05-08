// ── Env-var contract for DRDVModal's four real-API hops ────────────────────
//
// In apps/renderer/.env.local:
//   WIDGET_DRDV_TOKEN=<raw JWT — gocomet `user` cookie value>
//   WIDGET_DRDV_USER_TYPE=client
//   WIDGET_DRDV_SCHEMA=unilever
//   WIDGET_DRDV_WORKFLOW_API=https://workflow.staging.gocomet.com/api/

export const DRDV_ENV = {
  TOKEN: 'WIDGET_DRDV_TOKEN',
  USER_TYPE: 'WIDGET_DRDV_USER_TYPE',
  SCHEMA: 'WIDGET_DRDV_SCHEMA',
  WORKFLOW_API: 'WIDGET_DRDV_WORKFLOW_API',
} as const

export interface DRDVEnvConfig {
  token: string
  userType: string
  schema?: string
  workflowApi: string
}

export function readDRDVEnv(): DRDVEnvConfig {
  const config: DRDVEnvConfig = {
    token: process.env[DRDV_ENV.TOKEN] ?? '',
    userType: process.env[DRDV_ENV.USER_TYPE] ?? 'client',
    workflowApi: process.env[DRDV_ENV.WORKFLOW_API] ?? '',
  }
  const schema = process.env[DRDV_ENV.SCHEMA]
  if (schema && schema.length > 0) {
    config.schema = schema
  }
  return config
}

export function authHeaders(config: DRDVEnvConfig): Record<string, string> {
  // Gocomet staging authenticates via the `user` cookie (the JWT) +
  // schema_name + user_type + CSRF cookies; NOT the Authorization header.
  // Send everything: cookies for the cookie-based middleware, plus
  // Authorization Bearer + Schema header for environments that prefer those.
  // The CSRF value just needs to match between header and cookie.
  const csrf = 'drdv-proxy-csrf'

  const cookieParts: string[] = [
    `user=${config.token}`,
    `user_type=${config.userType}`,
    `_csrf_token=${csrf}`,
  ]
  if (config.schema) cookieParts.push(`schema_name=${config.schema}`)

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.token}`,
    Cookie: cookieParts.join('; '),
    'x-csrf-token': csrf,
    'ops-client-schema': 'app',
  }
  if (config.schema) headers['Schema'] = config.schema
  return headers
}

// All DRDV endpoints live under /v1/{user_type}/ on the workflow API.
export function buildWorkflowUrl(config: DRDVEnvConfig, path: string): string {
  const base = config.workflowApi.replace(/\/$/, '')
  const userType = encodeURIComponent(config.userType)
  const cleanPath = path.replace(/^\//, '')
  return `${base}/v1/${userType}/${cleanPath}`
}
