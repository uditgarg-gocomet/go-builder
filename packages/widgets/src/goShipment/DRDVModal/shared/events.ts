// Event names + payload contracts for DRDVModal.

import { DEFAULTS } from './constants.js'

export const EVENTS = {
  EXTRACTION_APPROVED: DEFAULTS.extractionApprovedEventName,
  VERIFY_SUCCESS: DEFAULTS.verifySuccessEventName,
  REJECT_SUCCESS: DEFAULTS.rejectSuccessEventName,
  REVERIFY_SUCCESS: DEFAULTS.reverifySuccessEventName,
  RETRY_SUCCESS: DEFAULTS.retrySuccessEventName,
  ERROR: DEFAULTS.errorEventName,
  CANCEL: DEFAULTS.cancelEventName,
} as const

export type {
  DRDVNextEventPayload,
  DRDVApprovalEventPayload,
  DRDVRetryEventPayload,
  DRDVErrorEventPayload,
  DRDVCloseEventPayload,
} from './types.js'
