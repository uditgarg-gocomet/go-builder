// ── Public surface for CancelShipmentModal ───────────────────────────────────
// Anything outside this folder imports from here. Keeping the barrel
// exhaustive lets us reorganise internals freely without breaking consumers.

export { CancelShipmentModal, default } from './ui/Container.js'

export {
  cancelShipmentModalManifest,
  cancelShipmentModalPropsSchema,
} from './manifest/manifest.js'

export {
  CANCEL_SHIPMENT_ENDPOINT,
  submitCancellation,
} from './logic/service.js'

export {
  CANCEL_REASONS,
  DEFAULTS as CANCEL_SHIPMENT_DEFAULTS,
} from './shared/constants.js'

export {
  EVENTS as CANCEL_SHIPMENT_EVENTS,
  type CancelShipmentSuccessPayload,
  type CancelShipmentErrorPayload,
  type CancelShipmentCancelPayload,
} from './shared/events.js'

export type {
  CancelShipmentModalProps,
  CancelShipmentPayload,
  CancelShipmentResult,
  CancelReason,
  CancelShipmentSuccessEventPayload,
  CancelShipmentErrorEventPayload,
  CancelShipmentCloseEventPayload,
} from './shared/types.js'
