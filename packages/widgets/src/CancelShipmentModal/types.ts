// ── Public + internal types for CancelShipmentModal ──────────────────────────

export interface CancelReason {
  readonly label: string
  readonly value: string
}

// ── Public Props ─────────────────────────────────────────────────────────────
// Shape mirrors propsSchema.json (data props only). Action-binding callbacks
// (onSuccess/onError/onClose) are NOT part of propsSchema — the renderer
// pipes them in separately from `node.actions` and they bypass the prop
// allowlist. They are documented in `manifest.triggers`.

export interface CancelShipmentModalProps {
  open?: boolean
  workflowId?: string

  // `mock` runs locally; `real` calls the gocomet workflow endpoint via the
  // renderer's proxy route.
  apiMode?: 'mock' | 'real'

  // Mock controls (only used when apiMode='mock')
  mockMode?: 'success' | 'failure'
  mockDelayMs?: number

  // Event-name overrides — useful when two instances share a page
  successEventName?: string
  errorEventName?: string
  cancelEventName?: string

  // ── Action-binding triggers ────────────────────────────────────────────────
  // Page schemas wire these via:
  //   actions: [{ trigger: 'onSuccess', actionId: 'closeAndRefresh' }]
  // The first arg becomes `event.<field>` inside the action template.
  onSuccess?: (payload: CancelShipmentSuccessEventPayload) => void
  onError?: (payload: CancelShipmentErrorEventPayload) => void
  onClose?: (payload: CancelShipmentCloseEventPayload) => void
}

// ── Trigger payloads ────────────────────────────────────────────────────────
// Same shape as the eventBus payloads in events.ts; intentionally duplicated
// here so types.ts stays the single canonical place callers import from.

export interface CancelShipmentSuccessEventPayload {
  workflowId: string | undefined
  reason: string
  remarks: string | undefined
  message: string
}

export interface CancelShipmentErrorEventPayload {
  workflowId: string | undefined
  reason: string
  remarks: string | undefined
  error: string
}

export interface CancelShipmentCloseEventPayload {
  workflowId: string | undefined
  reason: 'user_dismissed' | 'after_success' | 'after_error'
}

// ── Service contract ─────────────────────────────────────────────────────────
// What the hook hands the service. Stays stable across mock → real swap.

export interface CancelShipmentPayload {
  workflowId: string | undefined
  reason: string
  remarks: string | undefined
}

export interface CancelShipmentResult {
  ok: boolean
  message: string
  error?: string
}

export interface SubmitOptions {
  apiMode?: 'mock' | 'real'
  mockMode?: 'success' | 'failure'
  mockDelayMs?: number
}
