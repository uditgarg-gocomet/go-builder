// ── Public + internal types for AddDocumentModal ────────────────────────────

export interface DocumentOption {
  readonly document_name: string
  readonly document_key: string
}

// ── Public Props ─────────────────────────────────────────────────────────────
// Callbacks (onSuccess/onError/onClose) are not in propsSchema.json — they
// flow through the renderer's actions array, same as CancelShipmentModal.

export interface AddDocumentModalProps {
  open?: boolean

  // Required for the real attach call. In the schema, bind to the active
  // shipment's swaId (e.g. {{datasource.shipment.swa_id}}).
  swaId?: string

  // Already-uploaded document keys for this shipment — used to filter the
  // dropdown so the user can't pick a type twice.
  existingDocumentKeys?: ReadonlyArray<string>

  // ── API mode + mock controls ─────────────────────────────────────────────
  apiMode?: 'mock' | 'real'
  mockDelayMs?: number

  // ── Tunables (configurable per page; defaults match legacy behaviour) ────
  milestoneId?: string                 // default 'Non CSI Documents'
  checklistId?: string                 // default '32'
  source?: string                      // default 'table'
  acceptedFileTypes?: string           // default '.pdf,.png,.jpg,.jpeg,.zip,.eml,.xls,.xlsx,.doc,.docx'
  maxFileSizeMb?: number               // default 10
  allowMultiple?: boolean              // default true

  // ── Event-name overrides ─────────────────────────────────────────────────
  successEventName?: string
  errorEventName?: string
  cancelEventName?: string

  // ── Action-binding triggers ──────────────────────────────────────────────
  onSuccess?: (payload: AddDocumentSuccessEventPayload) => void
  onError?: (payload: AddDocumentErrorEventPayload) => void
  onClose?: (payload: AddDocumentCloseEventPayload) => void
}

// ── Service contract ────────────────────────────────────────────────────────

export interface AddDocumentSubmitPayload {
  swaId: string | undefined
  documentType: DocumentOption
  files: File[]
  milestoneId: string
  checklistId: string
  source: string
}

export interface AddDocumentSubmitResult {
  ok: boolean
  message?: string
  error?: string
  uploadedDocumentIds?: ReadonlyArray<string>
}

export interface SubmitOptions {
  apiMode?: 'mock' | 'real'
  mockDelayMs?: number
}

// ── Trigger payloads ────────────────────────────────────────────────────────

export interface AddDocumentSuccessEventPayload {
  swaId: string | undefined
  documentKey: string
  documentName: string
  documentIds: ReadonlyArray<string>
  fileCount: number
  message: string
}

export interface AddDocumentErrorEventPayload {
  swaId: string | undefined
  documentKey: string | undefined
  fileCount: number
  error: string
}

export interface AddDocumentCloseEventPayload {
  swaId: string | undefined
  reason: 'after_success' | 'user_dismissed'
}
