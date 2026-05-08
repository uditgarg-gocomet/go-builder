// ── Event names + payload contracts ──────────────────────────────────────────
// The widget communicates with the host page via @portal/action-runtime's
// eventBus. Page-schema actions subscribe to these names.

import { DEFAULTS } from './constants.js'

export const EVENTS = {
  SUCCESS: DEFAULTS.successEventName,
  ERROR: DEFAULTS.errorEventName,
  CANCEL: DEFAULTS.cancelEventName,
} as const

export interface CancelShipmentSuccessPayload {
  workflowId: string | undefined
  reason: string
  remarks: string | undefined
  message: string
}

export interface CancelShipmentErrorPayload {
  workflowId: string | undefined
  reason: string
  remarks: string | undefined
  error: string
}

export interface CancelShipmentCancelPayload {
  workflowId: string | undefined
}
