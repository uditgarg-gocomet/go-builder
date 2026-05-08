// ── @portal/widgets/api ──────────────────────────────────────────────────────
// Server-only entry point. Exposes the Next.js-compatible POST handler and
// the helpers that drive it. Consume from a Next.js App Router route file:
//
//   // apps/renderer/src/app/api/widgets/cancel-shipment/route.ts
//   export { POST } from '@portal/widgets/api'

export { POST } from './goShipment/CancelShipmentModal/api/route.js'

export {
  CANCEL_SHIPMENT_ENV,
  readCancelShipmentEnv,
  type CancelShipmentEnvConfig,
} from './goShipment/CancelShipmentModal/api/env.js'

export {
  submitCancelShipmentToGocomet,
  CANCEL_SHIPMENT_PATH,
  type CancelShipmentSubmitRequest,
  type CancelShipmentSubmitResult,
} from './goShipment/CancelShipmentModal/api/handler.js'
