'use client'

// ── useDRDVModal ─────────────────────────────────────────────────────────────
// Owns: stage, async loading state for extraction + verification, reject form,
// confirm-before-verify flow, eventBus emits + callback dispatch.

import { useCallback, useEffect, useRef, useState } from 'react'
import { eventBus } from '@portal/action-runtime'
import { APPROVAL_STATUS, DEFAULTS, STAGE } from '../shared/constants.js'
import {
  fetchExtraction,
  fetchVerification,
  submitApproval,
  submitRetry,
} from './service.js'
import type {
  ApprovalStatus,
  DRDVModalProps,
  ExtractionDetailsResponse,
  VerificationDetailsResponse,
} from '../shared/types.js'

export interface DRDVModalViewModel {
  // Stage
  currentStage: number  // 0 = extraction, 1 = verification

  // Async state
  extraction: ExtractionDetailsResponse | undefined
  extractionLoading: boolean
  extractionError: string | undefined

  verification: VerificationDetailsResponse | undefined
  verificationLoading: boolean
  verificationError: string | undefined

  // Reject form state
  isRejectFormVisible: boolean
  rejectReason: string | undefined
  rejectRemarks: string

  // Confirm-before-verify state
  isConfirmDialogOpen: boolean

  // Submit state
  submitting: boolean

  // Handlers
  onStageChange: (stage: number) => void
  onNextClick: () => void
  onRetryClick: () => void
  onVerifyClick: () => void
  onRejectClick: () => void
  onReverifyClick: () => void
  onRejectReasonChange: (value: string) => void
  onRejectRemarksChange: (value: string) => void
  onRejectSubmit: () => Promise<void>
  onConfirmDialogToggle: () => void
  onConfirmVerify: () => Promise<void>
  onOpenChange: (next: boolean) => void
}

export function useDRDVModal(props: DRDVModalProps): DRDVModalViewModel {
  const {
    open = false,
    swaId,
    documentBucketId,
    checklistTags = DEFAULTS.checklistTags,
    checklistId = '',
    apiMode = DEFAULTS.apiMode,
    mockDelayMs = DEFAULTS.mockDelayMs,
    extractionApprovedEventName = DEFAULTS.extractionApprovedEventName,
    verifySuccessEventName = DEFAULTS.verifySuccessEventName,
    rejectSuccessEventName = DEFAULTS.rejectSuccessEventName,
    reverifySuccessEventName = DEFAULTS.reverifySuccessEventName,
    retrySuccessEventName = DEFAULTS.retrySuccessEventName,
    errorEventName = DEFAULTS.errorEventName,
    cancelEventName = DEFAULTS.cancelEventName,
    onExtractionApproved,
    onVerify,
    onReject,
    onReverify,
    onRetry,
    onError,
    onClose,
  } = props

  const [currentStage, setCurrentStage] = useState<number>(STAGE.EXTRACTION)

  const [extraction, setExtraction] = useState<ExtractionDetailsResponse | undefined>()
  const [extractionLoading, setExtractionLoading] = useState(false)
  const [extractionError, setExtractionError] = useState<string | undefined>()

  const [verification, setVerification] = useState<VerificationDetailsResponse | undefined>()
  const [verificationLoading, setVerificationLoading] = useState(false)
  const [verificationError, setVerificationError] = useState<string | undefined>()

  const [isRejectFormVisible, setIsRejectFormVisible] = useState(false)
  const [rejectReason, setRejectReason] = useState<string | undefined>()
  const [rejectRemarks, setRejectRemarks] = useState<string>('')
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ── Lazy-load extraction on first open per session ─────────────────────
  const fetchedExtractionRef = useRef(false)
  useEffect(() => {
    if (!open || fetchedExtractionRef.current) return
    if (!swaId || !documentBucketId) return
    fetchedExtractionRef.current = true
    setExtractionLoading(true)
    setExtractionError(undefined)
    void fetchExtraction(
      { swaId, documentBucketId, checklistTags, checklistId },
      { apiMode, mockDelayMs },
    ).then(result => {
      if (result.ok && result.data) {
        setExtraction(result.data)
      } else {
        setExtractionError(result.error ?? 'Failed to load extraction')
        emitError('fetch_extraction', result.error ?? 'Failed to load extraction')
      }
      setExtractionLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, swaId, documentBucketId, apiMode])

  // ── Lazy-load verification on entering stage 2 ─────────────────────────
  const fetchedVerificationRef = useRef(false)
  useEffect(() => {
    if (currentStage !== STAGE.VERIFICATION) return
    if (fetchedVerificationRef.current) return
    if (!swaId || !documentBucketId) return
    fetchedVerificationRef.current = true
    setVerificationLoading(true)
    setVerificationError(undefined)
    void fetchVerification(
      { swaId, documentBucketId, checklistTags, checklistId },
      { apiMode, mockDelayMs },
    ).then(result => {
      if (result.ok && result.data) {
        setVerification(result.data)
      } else {
        setVerificationError(result.error ?? 'Failed to load verification')
        emitError('fetch_verification', result.error ?? 'Failed to load verification')
      }
      setVerificationLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStage, swaId, documentBucketId, apiMode])

  // Reset state when widget closes
  useEffect(() => {
    if (open) return
    fetchedExtractionRef.current = false
    fetchedVerificationRef.current = false
    setCurrentStage(STAGE.EXTRACTION)
    setExtraction(undefined)
    setVerification(undefined)
    setIsRejectFormVisible(false)
    setRejectReason(undefined)
    setRejectRemarks('')
    setIsConfirmDialogOpen(false)
  }, [open])

  // ── Helpers ────────────────────────────────────────────────────────────

  const emitError = (
    step: 'fetch_extraction' | 'fetch_verification' | 'approval' | 'retry',
    error: string,
  ): void => {
    const payload = { swaId, documentBucketId, step, error }
    eventBus.emit(errorEventName, payload)
    onError?.(payload)
  }

  const finishApproval = useCallback(
    (kind: 'verify' | 'reject' | 'reverify', approvalStatus: ApprovalStatus, reason?: string, remarks?: string): void => {
      const payload = { swaId, documentBucketId, approvalStatus, reason, remarks }
      const closeReason = kind === 'verify' ? 'after_verify' : kind === 'reject' ? 'after_reject' : 'after_reverify'
      const eventName =
        kind === 'verify' ? verifySuccessEventName
        : kind === 'reject' ? rejectSuccessEventName
        : reverifySuccessEventName
      const callback = kind === 'verify' ? onVerify : kind === 'reject' ? onReject : onReverify
      eventBus.emit(eventName, payload)
      callback?.(payload)
      onClose?.({ swaId, documentBucketId, reason: closeReason })
    },
    [
      swaId, documentBucketId,
      verifySuccessEventName, rejectSuccessEventName, reverifySuccessEventName,
      onVerify, onReject, onReverify, onClose,
    ],
  )

  // ── Stage navigation ───────────────────────────────────────────────────

  const onStageChange = useCallback((stage: number): void => {
    setCurrentStage(stage)
  }, [])

  const onNextClick = useCallback((): void => {
    eventBus.emit(extractionApprovedEventName, { swaId, documentBucketId })
    onExtractionApproved?.({ swaId, documentBucketId })
    setCurrentStage(STAGE.VERIFICATION)
  }, [swaId, documentBucketId, extractionApprovedEventName, onExtractionApproved])

  // ── Retry ──────────────────────────────────────────────────────────────

  const onRetryClick = useCallback(async (): Promise<void> => {
    if (!swaId || !documentBucketId) return
    setSubmitting(true)
    const result = await submitRetry({ swaId, documentBucketId }, { apiMode, mockDelayMs })
    setSubmitting(false)
    if (!result.ok) {
      emitError('retry', result.error ?? 'Retry failed')
      return
    }
    const payload = {
      swaId, documentBucketId,
      ...(result.triggeredCount !== undefined ? { triggeredCount: result.triggeredCount } : {}),
      ...(result.message ? { message: result.message } : {}),
    }
    eventBus.emit(retrySuccessEventName, payload)
    onRetry?.(payload)
    // Re-fetch extraction after retry triggers.
    fetchedExtractionRef.current = false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swaId, documentBucketId, apiMode, mockDelayMs, retrySuccessEventName, onRetry])

  // ── Reject ─────────────────────────────────────────────────────────────

  const onRejectClick = useCallback((): void => {
    setIsRejectFormVisible(prev => !prev)
  }, [])

  const onRejectReasonChange = useCallback((value: string): void => {
    setRejectReason(value)
  }, [])

  const onRejectRemarksChange = useCallback((value: string): void => {
    setRejectRemarks(value)
  }, [])

  const onRejectSubmit = useCallback(async (): Promise<void> => {
    if (!swaId || !documentBucketId) return
    if (!verification) return
    if (!rejectReason) return

    setSubmitting(true)
    const result = await submitApproval(
      {
        swaId,
        documentBucketId,
        workflowDocumentComparisonId: verification.workflow_document_comparison_id,
        approvalStatus: APPROVAL_STATUS.REJECTED,
        reason: rejectReason,
        remarks: rejectRemarks || undefined,
      },
      { apiMode, mockDelayMs },
    )
    setSubmitting(false)

    if (!result.ok) {
      emitError('approval', result.error ?? 'Reject failed')
      return
    }
    finishApproval('reject', APPROVAL_STATUS.REJECTED, rejectReason, rejectRemarks || undefined)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swaId, documentBucketId, verification, rejectReason, rejectRemarks, apiMode, mockDelayMs, finishApproval])

  // ── Confirm-before-verify ──────────────────────────────────────────────

  const onConfirmDialogToggle = useCallback((): void => {
    setIsConfirmDialogOpen(prev => !prev)
  }, [])

  const verifyImmediate = useCallback(async (): Promise<void> => {
    if (!swaId || !documentBucketId || !verification) return
    setSubmitting(true)
    const result = await submitApproval(
      {
        swaId,
        documentBucketId,
        workflowDocumentComparisonId: verification.workflow_document_comparison_id,
        approvalStatus: APPROVAL_STATUS.VERIFIED,
      },
      { apiMode, mockDelayMs },
    )
    setSubmitting(false)
    if (!result.ok) {
      emitError('approval', result.error ?? 'Verify failed')
      return
    }
    finishApproval('verify', APPROVAL_STATUS.VERIFIED)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swaId, documentBucketId, verification, apiMode, mockDelayMs, finishApproval])

  const onVerifyClick = useCallback((): void => {
    if (!verification) return
    const hasErrorFields =
      (verification.error_fields?.document_data?.fields?.row_data?.length ?? 0) > 0 ||
      Object.keys(verification.error_fields?.document_data?.line_items ?? {}).length > 0
    if (hasErrorFields) {
      setIsConfirmDialogOpen(true)
      return
    }
    void verifyImmediate()
  }, [verification, verifyImmediate])

  const onConfirmVerify = useCallback(async (): Promise<void> => {
    setIsConfirmDialogOpen(false)
    await verifyImmediate()
  }, [verifyImmediate])

  // ── Reverify ───────────────────────────────────────────────────────────

  const onReverifyClick = useCallback(async (): Promise<void> => {
    if (!swaId || !documentBucketId || !verification) return
    setSubmitting(true)
    const result = await submitApproval(
      {
        swaId,
        documentBucketId,
        workflowDocumentComparisonId: verification.workflow_document_comparison_id,
        approvalStatus: APPROVAL_STATUS.REVIEW_PENDING,
      },
      { apiMode, mockDelayMs },
    )
    setSubmitting(false)
    if (!result.ok) {
      emitError('approval', result.error ?? 'Reverify failed')
      return
    }
    finishApproval('reverify', APPROVAL_STATUS.REVIEW_PENDING)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swaId, documentBucketId, verification, apiMode, mockDelayMs, finishApproval])

  // ── Open / close ───────────────────────────────────────────────────────

  const onOpenChange = useCallback((next: boolean): void => {
    if (next || submitting) return
    eventBus.emit(cancelEventName, { swaId, documentBucketId })
    onClose?.({ swaId, documentBucketId, reason: 'user_dismissed' })
  }, [submitting, cancelEventName, swaId, documentBucketId, onClose])

  return {
    currentStage,
    extraction, extractionLoading, extractionError,
    verification, verificationLoading, verificationError,
    isRejectFormVisible, rejectReason, rejectRemarks,
    isConfirmDialogOpen,
    submitting,
    onStageChange,
    onNextClick,
    onRetryClick,
    onVerifyClick,
    onRejectClick,
    onReverifyClick,
    onRejectReasonChange,
    onRejectRemarksChange,
    onRejectSubmit,
    onConfirmDialogToggle,
    onConfirmVerify,
    onOpenChange,
  }
}
