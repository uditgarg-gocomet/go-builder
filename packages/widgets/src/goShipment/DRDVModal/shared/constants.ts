export const DEFAULTS = {
  apiMode: 'mock' as const,
  mockDelayMs: 800,
  hideCtas: false,
  checklistTags: ['document_verification_step'] as ReadonlyArray<string>,

  // Event-name defaults
  extractionApprovedEventName: 'drdv:extraction-approved',
  verifySuccessEventName: 'drdv:verify-success',
  rejectSuccessEventName: 'drdv:reject-success',
  reverifySuccessEventName: 'drdv:reverify-success',
  retrySuccessEventName: 'drdv:retry-success',
  errorEventName: 'drdv:error',
  cancelEventName: 'drdv:cancel',
} as const

// Renderer routes the browser-side service POSTs / GETs to.
export const REAL_API_ROUTES = {
  extraction: '/api/widgets/drdv/extraction',
  verification: '/api/widgets/drdv/verification',
  approval: '/api/widgets/drdv/approval',
  retry: '/api/widgets/drdv/retry',
} as const

export const STAGE = {
  EXTRACTION: 0,
  VERIFICATION: 1,
} as const

export const APPROVAL_STATUS = {
  REVIEW_PENDING: 'review_pending',
  VERIFIED: 'verified',
  READY: 'ready',
  REJECTED: 'rejected',
  VALIDATION_PENDING: 'validation_pending',
  VALIDATION_ERROR: 'validation_error',
} as const

export const COPY = {
  modalTitleExtraction: 'Extraction',
  back: 'Back',
  cancel: 'Cancel',
  verifyDefault: 'Verify',
  rejectDefault: 'Reject',
  reverifyDefault: 'Submit to Validate',
  retryDefault: 'Retry',
  nextDefault: 'Next',
  rejectReasonLabel: 'Reason',
  rejectReasonPlaceholder: 'Select a reason',
  rejectRemarksLabel: 'Remarks',
  rejectRemarksPlaceholder: 'Add additional context',
  rejectSubmit: 'Submit Rejection',
  confirmTitle: 'Confirm verification',
  confirmMessage:
    'Some fields contain mismatches against the source. Are you sure you want to mark this document as verified?',
  confirmConfirm: 'Yes, verify',
  confirmCancel: 'Cancel',
  noData: 'No data available',
  loading: 'Loading…',
  emptyExtraction: 'No extracted fields yet',
  documentLink: 'Open document',
} as const

export const MOCK_MESSAGES = {
  approvalSuccess: 'Approval status updated',
  retrySuccess: 'Retry triggered successfully',
} as const
