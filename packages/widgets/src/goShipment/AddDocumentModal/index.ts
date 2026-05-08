// ── Public surface for AddDocumentModal ─────────────────────────────────────

export { AddDocumentModal, default } from './ui/Container.js'

export {
  addDocumentModalManifest,
  addDocumentModalPropsSchema,
} from './manifest/manifest.js'

export {
  fetchOptions,
  submitAddDocument,
} from './logic/service.js'

export {
  DEFAULT_TENANT_SLUG,
  MOCK_DOCUMENT_OPTIONS,
  DEFAULTS as ADD_DOCUMENT_DEFAULTS,
  REAL_API_ROUTES as ADD_DOCUMENT_ROUTES,
} from './shared/constants.js'

export {
  EVENTS as ADD_DOCUMENT_EVENTS,
  type AddDocumentSuccessPayload,
  type AddDocumentErrorPayload,
  type AddDocumentCancelPayload,
} from './shared/events.js'

export type {
  AddDocumentModalProps,
  AddDocumentSubmitPayload,
  AddDocumentSubmitResult,
  DocumentOption,
  AddDocumentSuccessEventPayload,
  AddDocumentErrorEventPayload,
  AddDocumentCloseEventPayload,
} from './shared/types.js'
