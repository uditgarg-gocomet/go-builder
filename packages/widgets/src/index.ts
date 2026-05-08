// ── @portal/widgets ──────────────────────────────────────────────────────────
// Wired widgets — self-contained React components with their own internal
// state, mocked or live API contracts, and a typed event surface for action
// binding. Each widget exports a component + a manifest. The renderer pulls
// in the WIDGET_MAP / MANIFEST_MAP barrels from `@portal/widgets/registry`
// and registers them via the existing custom_widget source type.
//
// Add new widgets by:
//   1. Creating src/<WidgetName>/index.tsx that exports `<WidgetName>` + `<widgetName>Manifest`
//   2. Re-exporting from this file
//   3. Adding the entry to src/registry.ts

export {
  CancelShipmentModal,
  cancelShipmentModalManifest,
  cancelShipmentModalPropsSchema,
  CANCEL_SHIPMENT_ENDPOINT,
  CANCEL_REASONS,
  CANCEL_SHIPMENT_DEFAULTS,
  CANCEL_SHIPMENT_EVENTS,
  submitCancellation,
  type CancelShipmentModalProps,
  type CancelShipmentPayload,
  type CancelShipmentResult,
  type CancelReason,
  type CancelShipmentSuccessPayload,
  type CancelShipmentErrorPayload,
  type CancelShipmentCancelPayload,
  type CancelShipmentSuccessEventPayload,
  type CancelShipmentErrorEventPayload,
  type CancelShipmentCloseEventPayload,
} from './CancelShipmentModal/index.js'
