// ── @portal/widgets/goShipment ───────────────────────────────────────────────
// Vertical barrel — re-exports every widget that belongs to the goShipment
// product surface (cancel/archive flows, tracking, document review, etc.).
//
// Add a new goShipment widget by:
//   1. Creating a folder alongside CancelShipmentModal/ following the same
//      structure (ui/ logic/ api/ manifest/ shared/)
//   2. Re-exporting its public symbols here.

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
} from "./CancelShipmentModal/index.js";

export {
  AddDocumentModal,
  addDocumentModalManifest,
  addDocumentModalPropsSchema,
  fetchOptions as fetchAddDocumentOptions,
  submitAddDocument,
  DEFAULT_TENANT_SLUG,
  MOCK_DOCUMENT_OPTIONS,
  ADD_DOCUMENT_DEFAULTS,
  ADD_DOCUMENT_ROUTES,
  ADD_DOCUMENT_EVENTS,
  type AddDocumentModalProps,
  type AddDocumentSubmitPayload,
  type AddDocumentSubmitResult,
  type DocumentOption,
  type AddDocumentSuccessPayload,
  type AddDocumentErrorPayload,
  type AddDocumentCancelPayload,
  type AddDocumentSuccessEventPayload,
  type AddDocumentErrorEventPayload,
  type AddDocumentCloseEventPayload,
} from "./AddDocumentModal/index.js";

export {
  DRDVModal,
  drdvModalManifest,
  drdvModalPropsSchema,
  fetchExtraction,
  fetchVerification,
  submitApproval,
  submitRetry,
  DRDV_DEFAULTS,
  DRDV_ROUTES,
  DRDV_STAGE,
  DRDV_APPROVAL_STATUS,
  DRDV_EVENTS,
  type DRDVModalProps,
  type ExtractionDetailsResponse,
  type VerificationDetailsResponse,
  type DocumentExtractionStatus,
  type ApprovalStatus,
  type ActionConfig,
  type DRDVTableColumn,
  type DRDVFieldsTableRow,
  type FieldsTable,
  type LineItemsTable,
  type DocumentInfo,
  type ProgressDetails,
  type DRDVNextEventPayload,
  type DRDVApprovalEventPayload,
  type DRDVRetryEventPayload,
  type DRDVErrorEventPayload,
  type DRDVCloseEventPayload,
} from "./DRDVModal/index.js";
