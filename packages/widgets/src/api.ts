// ── @portal/widgets/api ──────────────────────────────────────────────────────
// Server-only entry point. Exposes Next.js-compatible HTTP handlers + the
// helpers that drive them. Each widget that needs a real-API path adds a
// named export here; the consuming Next.js route file aliases as needed.
//
//   // apps/renderer/src/app/api/widgets/cancel-shipment/route.ts
//   export { POST } from '@portal/widgets/api'
//
//   // apps/renderer/src/app/api/widgets/add-document/options/route.ts
//   export { addDocumentOptionsGET as GET } from '@portal/widgets/api'
//   // apps/renderer/src/app/api/widgets/add-document/upload/route.ts
//   export { addDocumentUploadPOST as POST } from '@portal/widgets/api'
//   // apps/renderer/src/app/api/widgets/add-document/attach/route.ts
//   export { addDocumentAttachPOST as POST } from '@portal/widgets/api'

// ── CancelShipmentModal ─────────────────────────────────────────────────────
export { POST } from './goShipment/CancelShipmentModal/api/route.js'

export {
  CANCEL_SHIPMENT_ENV,
  readCancelShipmentEnv,
  type CancelShipmentEnvConfig,
} from './goShipment/CancelShipmentModal/api/env.js'

export {
  submitCancelShipmentToGocomet,
  CANCEL_SHIPMENT_PATH,
  type CancelShipmentSubmitRequest,
  type CancelShipmentSubmitResult,
} from './goShipment/CancelShipmentModal/api/handler.js'

// ── AddDocumentModal — three handlers ───────────────────────────────────────
export { GET as addDocumentOptionsGET } from './goShipment/AddDocumentModal/api/routes/options.js'
export { POST as addDocumentUploadPOST } from './goShipment/AddDocumentModal/api/routes/upload.js'
export { POST as addDocumentAttachPOST } from './goShipment/AddDocumentModal/api/routes/attach.js'

export {
  ADD_DOCUMENT_ENV,
  readAddDocumentEnv,
  authHeaders as addDocumentAuthHeaders,
  type AddDocumentEnvConfig,
} from './goShipment/AddDocumentModal/api/env.js'

export {
  fetchDocumentOptionsFromGocomet,
  type FetchOptionsResult as AddDocumentFetchOptionsResult,
} from './goShipment/AddDocumentModal/api/handlers/fetchOptions.js'

export {
  uploadFileToLibrary,
  type UploadFileResult as AddDocumentUploadFileResult,
} from './goShipment/AddDocumentModal/api/handlers/uploadFile.js'

export {
  attachDocumentsToWorkflow,
  type AttachDocumentsRequest,
  type AttachDocumentsResult,
} from './goShipment/AddDocumentModal/api/handlers/attachDocuments.js'
