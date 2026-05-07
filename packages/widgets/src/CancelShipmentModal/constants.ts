// ── Defaults + copy strings ──────────────────────────────────────────────────
// Centralised so localisation, telemetry, and prop defaults all read from
// one place.

import cancelReasonsFixture from './fixtures/cancelReasons.json'
import type { CancelReason } from './types.js'

export const CANCEL_REASONS: ReadonlyArray<CancelReason> = cancelReasonsFixture

export const DEFAULTS = {
  mockMode: 'success' as const,
  mockDelayMs: 800,
  successEventName: 'cancel-shipment:success',
  errorEventName: 'cancel-shipment:error',
  cancelEventName: 'cancel-shipment:cancel',
} as const

// Reason values that demand free-form remarks. Keep in sync with
// fixtures/cancelReasons.json.
export const REASONS_REQUIRING_REMARKS: ReadonlySet<string> = new Set(['others'])

export const COPY = {
  title: 'Cancel Shipment',
  reasonLabel: 'Reason',
  reasonPlaceholder: 'Select a reason',
  remarksLabel: 'Remarks',
  remarksPlaceholder: 'Enter remarks',
  confirm: 'Confirm',
  cancel: 'Cancel',
  workflowLabel: 'Workflow',
  failureBadge: 'mock failure mode',
} as const

export const MOCK_MESSAGES = {
  success: 'Shipment cancelled successfully',
  failure: 'Mock failure: workflow could not be cancelled',
} as const
