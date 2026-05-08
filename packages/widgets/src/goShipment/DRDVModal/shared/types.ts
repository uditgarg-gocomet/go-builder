// ── Public + internal types for DRDVModal ───────────────────────────────────

// ── Server-driven UI flag attached to every action button ──────────────────
export interface ActionConfig {
  readonly enabled: boolean
  readonly visibility: boolean
  readonly display_name: string
  readonly tooltip_text: string
}

// ── Extraction stage types (response from GET extraction-details) ──────────

export type DocumentExtractionStatus =
  | 'uploaded'
  | 'processing'
  | 'extracted'
  | 'validation_pending'
  | 'validation_error'
  | 'extraction_error'
  | 'verified'
  | 'rejected'

export interface DRDVTableColumn {
  readonly key: string
  readonly display_name: string
  readonly type?: string
}

export interface DRDVFieldsTableRow {
  readonly key: string
  readonly display_name: string
  readonly value: string | number | null
  readonly type?: string
  readonly source?: string
  readonly required?: boolean
  readonly error?: string
  readonly ai_updated?: string
  readonly manual_update?: string
  readonly updated_at?: string | null
  readonly updated_by?: string
  readonly path?: string
  readonly current_value?: string | number | null
}

export interface FieldsTable {
  readonly key: string
  readonly display_name: string
  readonly columns: ReadonlyArray<DRDVTableColumn>
  readonly row_data: ReadonlyArray<DRDVFieldsTableRow>
  readonly has_error?: boolean
}

export interface LineItemsTable {
  readonly key: string
  readonly display_name: string
  readonly columns: ReadonlyArray<DRDVTableColumn>
  readonly has_error?: boolean
  readonly row_data: ReadonlyArray<{
    readonly details: Record<string, unknown>
    readonly expandable_row_data?: {
      readonly columns: ReadonlyArray<DRDVTableColumn>
      readonly row_data: ReadonlyArray<Record<string, unknown>>
    }
  }>
}

export interface DocumentInfo {
  readonly id: string
  readonly name: string
  readonly link: string
}

export interface ProgressDetails {
  readonly percentage: number
  readonly fields_not_fetched: number
  readonly total_fields: number
  readonly mandatory_fields_not_fetched: number
  readonly total_mandatory_fields?: number
}

export interface ExtractionDetailsResponse {
  readonly can_edit?: boolean
  readonly status: DocumentExtractionStatus
  readonly updated_at: string
  readonly remarks: string | null
  readonly verification_enabled?: boolean
  readonly dv_modal_label: string
  readonly tooltip_text: string
  readonly progress_details: ProgressDetails
  readonly document_details: Record<string, DocumentInfo>
  readonly combined_extracted_data: {
    readonly fields: FieldsTable
    readonly line_items: Record<string, LineItemsTable>
  }
  readonly action: {
    readonly next?: ActionConfig
    readonly retry?: ActionConfig
  }
}

// ── Verification stage types (response from GET verification) ──────────────

export type ApprovalStatus =
  | 'review_pending'
  | 'verified'
  | 'ready'
  | 'rejected'
  | 'validation_pending'
  | 'validation_error'

export interface SourceData {
  readonly fields: FieldsTable
  readonly line_items: Record<string, LineItemsTable>
}

export interface AllowedReason {
  readonly label: string
  readonly value: string
}

export interface VerificationActions {
  readonly reject: ActionConfig
  readonly verify: ActionConfig
  readonly submit_for_reverification: ActionConfig
}

export interface VerificationFormRequisite {
  readonly approval_status: Record<string, string>
  readonly allowed_reasons: ReadonlyArray<AllowedReason>
  readonly actions: VerificationActions
}

export interface ErrorFields {
  readonly document_data: SourceData
  readonly source_data: SourceData
}

export interface VerificationDetailsResponse {
  readonly approval_status: ApprovalStatus | null
  readonly workflow_document_comparison_id: string
  readonly document_data: SourceData
  readonly source_data: SourceData
  readonly updated_at: string
  readonly comparison_data_status: string
  readonly error_fields: ErrorFields
  readonly approval_status_description: {
    readonly reason: string
    readonly remarks: string
  }
  readonly form_requisite: VerificationFormRequisite
}

// ── Public widget Props ─────────────────────────────────────────────────────

export interface DRDVModalProps {
  open?: boolean

  // Identifies which document on which shipment to load
  swaId?: string
  documentBucketId?: string
  checklistTags?: ReadonlyArray<string>
  checklistId?: string

  apiMode?: 'mock' | 'real'
  mockDelayMs?: number

  // Top-of-house hide for all CTA buttons. Server-driven flags still apply
  // per-button when this is false.
  hideCtas?: boolean

  // Event-name overrides
  extractionApprovedEventName?: string
  verifySuccessEventName?: string
  rejectSuccessEventName?: string
  reverifySuccessEventName?: string
  retrySuccessEventName?: string
  errorEventName?: string
  cancelEventName?: string

  // Action-binding triggers
  onExtractionApproved?: (payload: DRDVNextEventPayload) => void
  onVerify?: (payload: DRDVApprovalEventPayload) => void
  onReject?: (payload: DRDVApprovalEventPayload) => void
  onReverify?: (payload: DRDVApprovalEventPayload) => void
  onRetry?: (payload: DRDVRetryEventPayload) => void
  onError?: (payload: DRDVErrorEventPayload) => void
  onClose?: (payload: DRDVCloseEventPayload) => void
}

// ── Service contract ───────────────────────────────────────────────────────

export interface FetchExtractionRequest {
  swaId: string
  documentBucketId: string
  checklistTags: ReadonlyArray<string>
  checklistId: string
}

export interface FetchVerificationRequest extends FetchExtractionRequest {}

export interface ApprovalRequest {
  swaId: string
  documentBucketId: string
  workflowDocumentComparisonId: string
  approvalStatus: ApprovalStatus
  reason?: string
  remarks?: string
}

export interface RetryRequest {
  swaId: string
  documentBucketId: string
}

export interface ServiceOptions {
  apiMode?: 'mock' | 'real'
  mockDelayMs?: number
}

// ── Trigger payloads ───────────────────────────────────────────────────────

export interface DRDVNextEventPayload {
  swaId: string | undefined
  documentBucketId: string | undefined
}

export interface DRDVApprovalEventPayload {
  swaId: string | undefined
  documentBucketId: string | undefined
  approvalStatus: ApprovalStatus
  reason?: string
  remarks?: string
}

export interface DRDVRetryEventPayload {
  swaId: string | undefined
  documentBucketId: string | undefined
  triggeredCount?: number
  message?: string
}

export interface DRDVErrorEventPayload {
  swaId: string | undefined
  documentBucketId: string | undefined
  step: 'fetch_extraction' | 'fetch_verification' | 'approval' | 'retry'
  error: string
}

export interface DRDVCloseEventPayload {
  swaId: string | undefined
  documentBucketId: string | undefined
  reason: 'user_dismissed' | 'after_verify' | 'after_reject' | 'after_reverify'
}
