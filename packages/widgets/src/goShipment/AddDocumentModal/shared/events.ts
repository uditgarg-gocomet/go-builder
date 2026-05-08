// ── Event names + payload contracts ──────────────────────────────────────────
// The widget communicates with the host page via @portal/action-runtime's
// eventBus alongside the typed callback triggers (onSuccess/onError/onClose).

import { DEFAULTS } from './constants.js'

export const EVENTS = {
  SUCCESS: DEFAULTS.successEventName,
  ERROR: DEFAULTS.errorEventName,
  CANCEL: DEFAULTS.cancelEventName,
} as const

export interface AddDocumentSuccessPayload {
  swaId: string | undefined
  documentKey: string
  documentName: string
  documentIds: ReadonlyArray<string>
  fileCount: number
  message: string
}

export interface AddDocumentErrorPayload {
  swaId: string | undefined
  documentKey: string | undefined
  fileCount: number
  error: string
}

export interface AddDocumentCancelPayload {
  swaId: string | undefined
}
