// ── @portal/widgets/api ──────────────────────────────────────────────────────
// Server-only entry point. Each widget that needs a real-API path adds its
// handler(s) here as named exports; the consuming Next.js route file aliases
// to the framework-required `GET` / `POST` symbols.
//
//   // apps/renderer/src/app/api/widgets/cancel-shipment/route.ts
//   export { POST } from '@portal/widgets/api'
//
//   // apps/renderer/src/app/api/widgets/drdv/extraction/route.ts
//   export { drdvExtractionGET as GET } from '@portal/widgets/api'
//
//   // apps/renderer/src/app/api/widgets/add-document/options/route.ts
//   export { addDocumentOptionsGET as GET } from '@portal/widgets/api'
//   // apps/renderer/src/app/api/widgets/add-document/upload/route.ts
//   export { addDocumentUploadPOST as POST } from '@portal/widgets/api'
//   // apps/renderer/src/app/api/widgets/add-document/attach/route.ts
//   export { addDocumentAttachPOST as POST } from '@portal/widgets/api'

// ── CancelShipmentModal ─────────────────────────────────────────────────────
// ── CancelShipmentModal ─────────────────────────────────────────────────────
export { POST } from "./goShipment/CancelShipmentModal/api/route.js";

export {
  CANCEL_SHIPMENT_ENV,
  readCancelShipmentEnv,
  type CancelShipmentEnvConfig,
} from "./goShipment/CancelShipmentModal/api/env.js";

export {
  submitCancelShipmentToGocomet,
  CANCEL_SHIPMENT_PATH,
  type CancelShipmentSubmitRequest,
  type CancelShipmentSubmitResult,
} from "./goShipment/CancelShipmentModal/api/handler.js";

// ── AddDocumentModal — three handlers ───────────────────────────────────────
export { GET as addDocumentOptionsGET } from "./goShipment/AddDocumentModal/api/routes/options.js";
export { POST as addDocumentUploadPOST } from "./goShipment/AddDocumentModal/api/routes/upload.js";
export { POST as addDocumentAttachPOST } from "./goShipment/AddDocumentModal/api/routes/attach.js";

export {
  ADD_DOCUMENT_ENV,
  readAddDocumentEnv,
  authHeaders as addDocumentAuthHeaders,
  type AddDocumentEnvConfig,
} from "./goShipment/AddDocumentModal/api/env.js";

export {
  fetchDocumentOptionsFromGocomet,
  type FetchOptionsResult as AddDocumentFetchOptionsResult,
} from "./goShipment/AddDocumentModal/api/handlers/fetchOptions.js";

export {
  uploadFileToLibrary,
  type UploadFileResult as AddDocumentUploadFileResult,
} from "./goShipment/AddDocumentModal/api/handlers/uploadFile.js";

export {
  attachDocumentsToWorkflow,
  type AttachDocumentsRequest,
  type AttachDocumentsResult,
} from "./goShipment/AddDocumentModal/api/handlers/attachDocuments.js";

// ── DRDVModal — four handlers ───────────────────────────────────────────────
export { GET as drdvExtractionGET } from "./goShipment/DRDVModal/api/routes/extraction.js";
export { GET as drdvVerificationGET } from "./goShipment/DRDVModal/api/routes/verification.js";
export { POST as drdvApprovalPOST } from "./goShipment/DRDVModal/api/routes/approval.js";
export { POST as drdvRetryPOST } from "./goShipment/DRDVModal/api/routes/retry.js";

export {
  DRDV_ENV,
  readDRDVEnv,
  authHeaders as drdvAuthHeaders,
  buildWorkflowUrl as drdvBuildWorkflowUrl,
  type DRDVEnvConfig,
} from "./goShipment/DRDVModal/api/env.js";

export {
  fetchExtractionFromGocomet,
  type FetchExtractionResult,
} from "./goShipment/DRDVModal/api/handlers/fetchExtraction.js";

export {
  fetchVerificationFromGocomet,
  type FetchVerificationResult,
} from "./goShipment/DRDVModal/api/handlers/fetchVerification.js";

export {
  postApprovalToGocomet,
  type ApprovalRequest as DRDVApprovalRequest,
  type ApprovalResult,
} from "./goShipment/DRDVModal/api/handlers/postApproval.js";

export {
  postRetryToGocomet,
  type RetryRequest as DRDVRetryRequest,
  type RetryResult,
} from "./goShipment/DRDVModal/api/handlers/postRetry.js";
