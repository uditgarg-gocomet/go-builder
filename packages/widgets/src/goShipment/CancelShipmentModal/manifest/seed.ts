// ── Backend registry seed entry ──────────────────────────────────────────────
// React-free. Imports propsSchema.json directly so the seed never drifts
// from the widget's actual prop surface.
//
// Backend imports this and inserts a RegistryEntry + RegistryEntryVersion
// row, which makes the widget appear in the builder palette.

import propsSchema from './propsSchema.json'

export interface WidgetSeedEntry {
  name: string
  displayName: string
  description: string
  category: string
  icon: string
  tags: ReadonlyArray<string>
  propsSchema: unknown
  defaultProps: Record<string, unknown>
}

export const cancelShipmentModalSeedEntry: WidgetSeedEntry = {
  name: 'CancelShipmentModal',
  displayName: 'Cancel Shipment Modal',
  description:
    'Modal that captures cancellation reason + optional remarks. ' +
    'Switchable between mock and real API via the apiMode prop. ' +
    'Emits cancel-shipment:success | :error | :cancel and exposes ' +
    'onSuccess / onError / onClose triggers for action binding.',
  category: 'Widget',
  icon: 'x-circle',
  tags: ['modal', 'cancel', 'shipment', 'wired', 'workflow'],
  propsSchema,
  defaultProps: {
    open: true,
    workflowId: 'WF-DEMO-1',
    apiMode: 'mock',
    mockMode: 'success',
    mockDelayMs: 800,
    successEventName: 'cancel-shipment:success',
    errorEventName: 'cancel-shipment:error',
    cancelEventName: 'cancel-shipment:cancel',
  },
}
