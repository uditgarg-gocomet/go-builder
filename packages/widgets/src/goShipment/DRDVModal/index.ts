// ── Public surface for DRDVModal ────────────────────────────────────────────

export { DRDVModal, default } from './ui/Container.js'

export {
  drdvModalManifest,
  drdvModalPropsSchema,
} from './manifest/manifest.js'

export {
  fetchExtraction,
  fetchVerification,
  submitApproval,
  submitRetry,
} from './logic/service.js'

export {
  DEFAULTS as DRDV_DEFAULTS,
  REAL_API_ROUTES as DRDV_ROUTES,
  STAGE as DRDV_STAGE,
  APPROVAL_STATUS as DRDV_APPROVAL_STATUS,
} from './shared/constants.js'

export { EVENTS as DRDV_EVENTS } from './shared/events.js'

export type {
  DRDVModalProps,
  ExtractionDetailsResponse,
  VerificationDetailsResponse,
  DocumentExtractionStatus,
  ApprovalStatus,
  ActionConfig,
  DRDVTableColumn,
  DRDVFieldsTableRow,
  FieldsTable,
  LineItemsTable,
  DocumentInfo,
  ProgressDetails,
  DRDVNextEventPayload,
  DRDVApprovalEventPayload,
  DRDVRetryEventPayload,
  DRDVErrorEventPayload,
  DRDVCloseEventPayload,
} from './shared/types.js'
