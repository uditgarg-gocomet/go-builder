// ── @portal/widgets/seed ─────────────────────────────────────────────────────
// React-free entry point. The backend imports this to insert registry rows
// without dragging UI dependencies into its bundle.
//
// Add a new widget to `widgetSeedEntries` and the backend's seed loop picks
// it up automatically — no other backend change required.

import { cancelShipmentModalSeedEntry } from "./goShipment/CancelShipmentModal/manifest/seed.js";
import { addDocumentModalSeedEntry } from "./goShipment/AddDocumentModal/manifest/seed.js";
import { drdvModalSeedEntry } from "./goShipment/DRDVModal/manifest/seed.js";

export type { WidgetSeedEntry } from "./goShipment/CancelShipmentModal/manifest/seed.js";
export {
  cancelShipmentModalSeedEntry,
  addDocumentModalSeedEntry,
  drdvModalSeedEntry,
};

export const widgetSeedEntries = [
  cancelShipmentModalSeedEntry,
  addDocumentModalSeedEntry,
  drdvModalSeedEntry,
] as const;
