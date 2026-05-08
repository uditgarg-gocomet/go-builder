'use client'

// ── useCancelShipmentModal ───────────────────────────────────────────────────
// Owns local state, validation, service invocation and eventBus emits.
// View.tsx receives the return shape and stays purely presentational.

import { useCallback, useState } from 'react'
import { eventBus } from '@portal/action-runtime'
import { DEFAULTS, REASONS_REQUIRING_REMARKS } from '../shared/constants.js'
import { submitCancellation } from './service.js'
import type { CancelShipmentModalProps } from '../shared/types.js'

export interface CancelShipmentModalViewModel {
  // Form state
  reason: string | undefined
  remarks: string
  submitting: boolean
  error: string | undefined

  // Derived flags
  needsRemarks: boolean
  submitDisabled: boolean

  // Handlers
  onReasonChange: (value: string) => void
  onRemarksChange: (value: string) => void
  onConfirm: () => Promise<void>
  onOpenChange: (next: boolean) => void
}

export function useCancelShipmentModal(
  props: CancelShipmentModalProps,
): CancelShipmentModalViewModel {
  const {
    workflowId,
    apiMode = DEFAULTS.apiMode,
    mockMode = DEFAULTS.mockMode,
    mockDelayMs = DEFAULTS.mockDelayMs,
    successEventName = DEFAULTS.successEventName,
    errorEventName = DEFAULTS.errorEventName,
    cancelEventName = DEFAULTS.cancelEventName,
    onSuccess,
    onError,
    onClose,
  } = props

  const [reason, setReason] = useState<string | undefined>(undefined)
  const [remarks, setRemarks] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const needsRemarks =
    reason !== undefined && REASONS_REQUIRING_REMARKS.has(reason)
  const submitDisabled =
    !reason || (needsRemarks && remarks.trim().length === 0) || submitting

  const reset = useCallback((): void => {
    setReason(undefined)
    setRemarks('')
    setError(undefined)
    setSubmitting(false)
  }, [])

  const onReasonChange = useCallback(
    (value: string): void => {
      setReason(value)
      if (!REASONS_REQUIRING_REMARKS.has(value)) setRemarks('')
    },
    [],
  )

  const onRemarksChange = useCallback((value: string): void => {
    setRemarks(value)
  }, [])

  const onConfirm = useCallback(async (): Promise<void> => {
    if (submitDisabled || !reason) return

    setSubmitting(true)
    setError(undefined)

    const payloadRemarks = needsRemarks ? remarks : undefined
    const result = await submitCancellation(
      { workflowId, reason, remarks: payloadRemarks },
      { apiMode, mockMode, mockDelayMs },
    )

    if (!result.ok) {
      const errMsg = result.error ?? 'Submission failed'
      setError(errMsg)
      setSubmitting(false)
      const errorPayload = {
        workflowId,
        reason,
        remarks: payloadRemarks,
        error: errMsg,
      }
      eventBus.emit(errorEventName, errorPayload)
      onError?.(errorPayload)
      // Intentionally NOT closing on error — let the user retry or the page
      // decide via onError binding.
      return
    }

    setSubmitting(false)
    const successPayload = {
      workflowId,
      reason,
      remarks: payloadRemarks,
      message: result.message,
    }
    eventBus.emit(successEventName, successPayload)
    onSuccess?.(successPayload)
    onClose?.({ workflowId, reason: 'after_success' })
    reset()
  }, [
    submitDisabled,
    reason,
    needsRemarks,
    remarks,
    workflowId,
    apiMode,
    mockMode,
    mockDelayMs,
    successEventName,
    errorEventName,
    onSuccess,
    onError,
    onClose,
    reset,
  ])

  const onOpenChange = useCallback(
    (next: boolean): void => {
      if (next || submitting) return
      reset()
      eventBus.emit(cancelEventName, { workflowId })
      onClose?.({ workflowId, reason: 'user_dismissed' })
    },
    [submitting, reset, cancelEventName, workflowId, onClose],
  )

  return {
    reason,
    remarks,
    submitting,
    error,
    needsRemarks,
    submitDisabled,
    onReasonChange,
    onRemarksChange,
    onConfirm,
    onOpenChange,
  }
}
