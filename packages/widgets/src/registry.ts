// ── Widget registry barrel ──────────────────────────────────────────────────
// One entry per shipped widget. The renderer imports WIDGET_MAP +
// MANIFEST_MAP from here and wires them into the resolver / prop allowlist
// — so the renderer stays agnostic to which widgets exist.

import type { ComponentType } from "react";
import {
  CancelShipmentModal,
  cancelShipmentModalManifest,
  AddDocumentModal,
  addDocumentModalManifest,
  DRDVModal,
  drdvModalManifest,
} from "./goShipment/index.js";

export interface WidgetTrigger {
  name: string;
  description: string;
}

export interface WidgetManifest {
  name: string;
  version: string;
  displayName: string;
  category: string;
  description: string;
  icon: string;
  tags: string[];
  propsShape: Record<string, string>;
  events: string[];
  triggers: ReadonlyArray<WidgetTrigger>;
}

export const WIDGET_MAP: Record<
  string,
  ComponentType<Record<string, unknown>>
> = {
  CancelShipmentModal: CancelShipmentModal as unknown as ComponentType<
    Record<string, unknown>
  >,
  AddDocumentModal: AddDocumentModal as unknown as ComponentType<
    Record<string, unknown>
  >,
  DRDVModal: DRDVModal as unknown as ComponentType<Record<string, unknown>>,
};

export const MANIFEST_MAP: Record<string, WidgetManifest> = {
  CancelShipmentModal: cancelShipmentModalManifest,
  AddDocumentModal: addDocumentModalManifest,
  DRDVModal: drdvModalManifest,
};

export const WIDGET_NAMES: ReadonlyArray<string> = Object.keys(WIDGET_MAP);
