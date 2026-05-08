'use client'

// ── useAddDocumentModal ──────────────────────────────────────────────────────
// Owns: option list (lazy-loaded on first open), selected document type,
// accumulated file list (across multiple drag-and-drop interactions),
// validation, submit orchestration, eventBus emits + callback dispatch.

import { useCallback, useEffect, useState } from 'react'
import { eventBus } from '@portal/action-runtime'
import { DEFAULTS } from '../shared/constants.js'
import { fetchOptions, submitAddDocument } from './service.js'
import type {
  AddDocumentModalProps,
  DocumentOption,
} from '../shared/types.js'

export interface AddDocumentModalViewModel {
  // Async state
  options: DocumentOption[]
  optionsLoading: boolean
  optionsError: string | undefined

  // Form state
  selectedType: DocumentOption | undefined
  files: File[]
  submitting: boolean
  error: string | undefined

  // Derived
  filteredOptions: DocumentOption[]
  submitDisabled: boolean

  // Handlers
  onTypeChange: (key: string) => void
  onFilesAdd: (newFiles: File[]) => void
  onFileRemove: (name: string) => void
  onConfirm: () => Promise<void>
  onOpenChange: (next: boolean) => void
}

export function useAddDocumentModal(
  props: AddDocumentModalProps,
): AddDocumentModalViewModel {
  const {
    open = false,
    swaId,
    existingDocumentKeys = [],
    apiMode = DEFAULTS.apiMode,
    mockDelayMs = DEFAULTS.mockDelayMs,
    milestoneId = DEFAULTS.milestoneId,
    checklistId = DEFAULTS.checklistId,
    source = DEFAULTS.source,
    maxFileSizeMb = DEFAULTS.maxFileSizeMb,
    successEventName = DEFAULTS.successEventName,
    errorEventName = DEFAULTS.errorEventName,
    cancelEventName = DEFAULTS.cancelEventName,
    onSuccess,
    onError,
    onClose,
  } = props

  const [options, setOptions] = useState<DocumentOption[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [optionsError, setOptionsError] = useState<string | undefined>(undefined)

  const [selectedType, setSelectedType] = useState<DocumentOption | undefined>(undefined)
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  // ── Lazy-load options on first open per session ─────────────────────────
  const [hasFetched, setHasFetched] = useState(false)
  useEffect(() => {
    if (!open || hasFetched) return
    setHasFetched(true)
    setOptionsLoading(true)
    setOptionsError(undefined)
    void fetchOptions({ apiMode, mockDelayMs }).then(result => {
      if (result.ok && result.options) {
        setOptions(result.options)
      } else {
        setOptionsError(result.error ?? 'Failed to load document types')
      }
      setOptionsLoading(false)
    })
  }, [open, hasFetched, apiMode, mockDelayMs])

  // ── Derived ─────────────────────────────────────────────────────────────
  const filteredOptions = options.filter(
    opt => !existingDocumentKeys.includes(opt.document_key),
  )
  const submitDisabled =
    !selectedType || files.length === 0 || submitting || !swaId && apiMode === 'real'

  // ── Handlers ────────────────────────────────────────────────────────────

  const reset = useCallback((): void => {
    setSelectedType(undefined)
    setFiles([])
    setError(undefined)
    setSubmitting(false)
  }, [])

  const onTypeChange = useCallback(
    (key: string): void => {
      const match = options.find(o => o.document_key === key)
      setSelectedType(match)
    },
    [options],
  )

  const onFilesAdd = useCallback(
    (newFiles: File[]): void => {
      const limitBytes = maxFileSizeMb * 1024 * 1024
      const accepted: File[] = []
      let oversized: File | undefined
      for (const f of newFiles) {
        if (f.size > limitBytes) {
          oversized = f
          break
        }
        accepted.push(f)
      }
      if (oversized) {
        setError(`File "${oversized.name}" exceeds ${maxFileSizeMb}MB limit`)
        return
      }
      setError(undefined)
      // Append + de-dupe by name
      setFiles(prev => {
        const seen = new Set(prev.map(f => f.name))
        const merged = [...prev]
        for (const f of accepted) {
          if (!seen.has(f.name)) merged.push(f)
        }
        return merged
      })
    },
    [maxFileSizeMb],
  )

  const onFileRemove = useCallback((name: string): void => {
    setFiles(prev => prev.filter(f => f.name !== name))
  }, [])

  const onConfirm = useCallback(async (): Promise<void> => {
    if (submitDisabled || !selectedType) return
    setSubmitting(true)
    setError(undefined)

    const result = await submitAddDocument(
      {
        swaId,
        documentType: selectedType,
        files,
        milestoneId,
        checklistId,
        source,
      },
      { apiMode, mockDelayMs },
    )

    if (!result.ok) {
      const errMsg = result.error ?? 'Submission failed'
      setError(errMsg)
      setSubmitting(false)
      eventBus.emit(errorEventName, {
        swaId,
        documentKey: selectedType.document_key,
        fileCount: files.length,
        error: errMsg,
      })
      onError?.({
        swaId,
        documentKey: selectedType.document_key,
        fileCount: files.length,
        error: errMsg,
      })
      return
    }

    setSubmitting(false)
    const payload = {
      swaId,
      documentKey: selectedType.document_key,
      documentName: selectedType.document_name,
      documentIds: result.uploadedDocumentIds ?? [],
      fileCount: files.length,
      message: result.message ?? 'Document uploaded successfully',
    }
    eventBus.emit(successEventName, payload)
    onSuccess?.(payload)
    onClose?.({ swaId, reason: 'after_success' })
    reset()
  }, [
    submitDisabled,
    selectedType,
    files,
    swaId,
    milestoneId,
    checklistId,
    source,
    apiMode,
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
      eventBus.emit(cancelEventName, { swaId })
      onClose?.({ swaId, reason: 'user_dismissed' })
    },
    [submitting, reset, cancelEventName, swaId, onClose],
  )

  return {
    options,
    optionsLoading,
    optionsError,
    selectedType,
    files,
    submitting,
    error,
    filteredOptions,
    submitDisabled,
    onTypeChange,
    onFilesAdd,
    onFileRemove,
    onConfirm,
    onOpenChange,
  }
}
