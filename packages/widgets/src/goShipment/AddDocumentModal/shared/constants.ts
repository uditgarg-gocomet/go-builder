import mockOptionsFixture from './fixtures/mockDocumentOptions.json'
import type { DocumentOption } from './types.js'

export const MOCK_DOCUMENT_OPTIONS: ReadonlyArray<DocumentOption> = mockOptionsFixture

// Tenant slug hardcoded in the legacy frontend. When multi-tenant matters,
// expose this as a prop or env var; for now keep it in one place.
export const DEFAULT_TENANT_SLUG = 'unilever'

export const DEFAULTS = {
  apiMode: 'mock' as const,
  mockDelayMs: 800,
  milestoneId: 'Non CSI Documents',
  checklistId: '32',
  source: 'table',
  acceptedFileTypes: '.pdf,.png,.jpg,.jpeg,.zip,.eml,.xls,.xlsx,.doc,.docx',
  maxFileSizeMb: 10,
  allowMultiple: true,
  successEventName: 'add-document:success',
  errorEventName: 'add-document:error',
  cancelEventName: 'add-document:cancel',
} as const

// Renderer routes the browser-side service POSTs to. One per backend hop —
// the proxy adds the gocomet token + schema server-side.
export const REAL_API_ROUTES = {
  options: '/api/widgets/add-document/options',
  upload: '/api/widgets/add-document/upload',
  attach: '/api/widgets/add-document/attach',
} as const

export const COPY = {
  title: 'Add Document Type',
  documentTypeLabel: 'Document Type',
  documentTypePlaceholder: 'Select the document',
  uploadFileLabel: 'Upload File',
  uploadHint: 'Click to browse or drag files here',
  confirm: 'Upload',
  cancel: 'Cancel',
  emptyOptions: 'No document types available',
  loadingOptions: 'Loading document types…',
} as const

export const MOCK_MESSAGES = {
  success: 'Document uploaded successfully',
  uploadFailure: 'One or more files failed to upload',
  attachFailure: 'Failed to attach uploaded documents',
  noFiles: 'Please upload at least one file',
  noType: 'Please select a document type',
  oversizedFile: (limitMb: number) => `File must be smaller than ${limitMb}MB`,
} as const
