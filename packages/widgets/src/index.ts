// ── @portal/widgets ──────────────────────────────────────────────────────────
// Wired widgets — self-contained React components with internal state, a
// switchable mock-vs-real API path, and a typed event surface for action
// binding.
//
// Widgets are grouped by product vertical:
//   src/goShipment/      ← cancel, track, document-review, etc.
//   src/<nextVertical>/  ← future verticals follow the same shape
//
// Add a new widget by:
//   1. Creating <Vertical>/<WidgetName>/{ui,logic,api,manifest,shared}/...
//   2. Re-exporting from <Vertical>/index.ts
//   3. The vertical's exports are picked up here automatically.

export * from './goShipment/index.js'
