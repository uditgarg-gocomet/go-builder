// ── Env-var contract for the real-API path ──────────────────────────────────
// The package owns these names; deployments supply the values via .env files.
//
// In apps/renderer/.env.local:
//   WIDGET_MOCK_TOKEN=<raw JWT — gocomet `user` cookie value>
//   WIDGET_MOCK_USER_TYPE=customer
//   WIDGET_MOCK_WORKFLOW_API=https://workflow.delivery-uat.gocomet.com/api/
//   WIDGET_MOCK_SCHEMA=                        # optional — set if multi-tenant

export const CANCEL_SHIPMENT_ENV = {
  TOKEN: 'WIDGET_MOCK_TOKEN',
  USER_TYPE: 'WIDGET_MOCK_USER_TYPE',
  WORKFLOW_API: 'WIDGET_MOCK_WORKFLOW_API',
  SCHEMA: 'WIDGET_MOCK_SCHEMA',
} as const

export interface CancelShipmentEnvConfig {
  token: string
  userType: string
  workflowApi: string
  schema?: string
}

export function readCancelShipmentEnv(): CancelShipmentEnvConfig {
  const config: CancelShipmentEnvConfig = {
    token: process.env[CANCEL_SHIPMENT_ENV.TOKEN] ?? '',
    userType: process.env[CANCEL_SHIPMENT_ENV.USER_TYPE] ?? 'public',
    workflowApi: process.env[CANCEL_SHIPMENT_ENV.WORKFLOW_API] ?? '',
  }
  const schema = process.env[CANCEL_SHIPMENT_ENV.SCHEMA]
  if (schema && schema.length > 0) {
    config.schema = schema
  }
  return config
}
