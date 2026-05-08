// ── Manifest ─────────────────────────────────────────────────────────────────
// Registry contract. `propsShape` is auto-derived from propsSchema.json so
// renaming a prop in the JSON schema flows through to the renderer's
// allowlist without manual sync.

import propsSchema from './propsSchema.json'

const propsShape: Record<string, string> = Object.fromEntries(
  Object.entries(propsSchema.properties as Record<string, { type?: string }>).map(
    ([key, value]) => [key, value.type ?? 'unknown'],
  ),
)

export const cancelShipmentModalManifest = {
  name: 'CancelShipmentModal',
  version: '1.0.0',
  displayName: 'Cancel Shipment Modal',
  category: 'Widget',
  description:
    'Modal that captures cancellation reason + optional remarks. Phase A: mock-only with toggleable success / failure. Emits cancel-shipment:success | :error | :cancel and exposes onSuccess / onError / onClose triggers for action binding.',
  icon: 'x-circle',
  tags: ['modal', 'cancel', 'shipment', 'wired', 'workflow'],
  propsShape,
  // Global eventBus channels — anyone can subscribe (analytics, debug, etc.)
  events: [
    'cancel-shipment:success',
    'cancel-shipment:error',
    'cancel-shipment:cancel',
  ],
  // Action-binding triggers — page schemas wire these via
  // `actions: [{ trigger: 'onSuccess', actionId: '...' }]`. The builder
  // palette uses this list to populate the bindable-events panel.
  triggers: [
    { name: 'onSuccess', description: 'Fires after a successful cancellation. Payload: { workflowId, reason, remarks?, message }.' },
    { name: 'onError',   description: 'Fires after a failed cancellation. Payload: { workflowId, reason, remarks?, error }.' },
    { name: 'onClose',   description: 'Fires whenever the modal would close (after_success | user_dismissed). Payload: { workflowId, reason }.' },
  ],
} satisfies {
  name: string
  version: string
  displayName: string
  category: string
  description: string
  icon: string
  tags: string[]
  propsShape: Record<string, string>
  events: string[]
  triggers: ReadonlyArray<{ name: string; description: string }>
}

// Re-export the JSON schema so callers (e.g. backend seed) can read the
// authoritative schema without duplicating it.
export { propsSchema as cancelShipmentModalPropsSchema }
