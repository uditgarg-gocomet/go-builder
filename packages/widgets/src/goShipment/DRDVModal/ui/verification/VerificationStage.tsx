'use client'

import React, { useState } from 'react'
import { Spinner, Select, Textarea, Button } from '@portal/ui'
import { COPY } from '../../shared/constants.js'
import { titleCase } from '../../shared/textUtils.js'
import type {
  ExtractionDetailsResponse,
  VerificationDetailsResponse,
} from '../../shared/types.js'
import { FieldsTable } from '../shared/FieldsTable.js'

export interface VerificationStageProps {
  loading: boolean
  error: string | undefined
  data: VerificationDetailsResponse | undefined
  extraction: ExtractionDetailsResponse | undefined
  documentBucketId: string | undefined

  // Reject form
  isRejectFormVisible: boolean
  rejectReason: string | undefined
  rejectRemarks: string
  onRejectReasonChange: (v: string) => void
  onRejectRemarksChange: (v: string) => void
  onRejectSubmit: () => void

  // Confirm-before-verify dialog
  isConfirmDialogOpen: boolean
  onConfirmDialogToggle: () => void
  onConfirmVerify: () => void

  submitting: boolean
}

export function VerificationStage({
  loading,
  error,
  data,
  extraction,
  documentBucketId,
  isRejectFormVisible,
  rejectReason,
  rejectRemarks,
  onRejectReasonChange,
  onRejectRemarksChange,
  onRejectSubmit,
  isConfirmDialogOpen,
  onConfirmDialogToggle,
  onConfirmVerify,
  submitting,
}: VerificationStageProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<string>('details')

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Spinner size="md" /></div>
  }
  if (error) {
    return <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
  }
  if (!data) {
    return <div className="text-center text-xs text-muted-foreground py-12">{COPY.noData}</div>
  }

  const lineItemTabs = Object.keys(data.document_data?.line_items ?? {})
  const tabs = ['details', ...lineItemTabs]

  const docFields = data.document_data?.fields
  const srcFields = data.source_data?.fields

  const documentTitle = titleCase(documentBucketId ?? '') || 'Document'
  const updatedDate = new Date(data.updated_at).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  // Build a sourceMap for the document side using extraction's document_details
  const documents = Object.values(extraction?.document_details ?? {})
  const sourceMap: Record<string, { index: number; name: string; link?: string }> = {}
  documents.forEach((doc, i) => {
    const entry: { index: number; name: string; link?: string } = { index: i + 1, name: doc.name }
    if (doc.link) entry.link = doc.link
    sourceMap[doc.id] = entry
  })

  const reasonsOptions = (data.form_requisite?.allowed_reasons ?? []).map(r => ({
    label: r.label,
    value: r.value,
  }))

  // Build a set of error field keys to highlight matching rows in red
  const errorFieldKeys = new Set<string>()
  for (const r of data.error_fields?.document_data?.fields?.row_data ?? []) {
    errorFieldKeys.add(r.key)
  }

  // Decorate rows with a synthetic `error` so FieldsTable highlights them
  const decorate = <T extends { key: string }>(rows: ReadonlyArray<T>): ReadonlyArray<T & { error?: string }> =>
    rows.map(r => (errorFieldKeys.has(r.key) ? { ...r, error: 'mismatch' } : r))

  return (
    <div className="flex flex-col gap-3">
      {/* ── Status banners ─────────────────────────────────────────────── */}
      {data.comparison_data_status && (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {data.comparison_data_status}
        </div>
      )}
      {data.approval_status_description?.reason && (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <div className="font-semibold">{data.approval_status_description.reason}</div>
          {data.approval_status_description.remarks && (
            <div className="opacity-80 mt-0.5">{data.approval_status_description.remarks}</div>
          )}
        </div>
      )}

      {/* ── Two header cards side-by-side ─────────────────────────────── */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-blue-200 bg-blue-50/30 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">{documentTitle}</span>
            <span className="text-[11px] text-muted-foreground">{updatedDate}</span>
          </div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50/30 px-4 py-3 flex items-center">
          <span className="text-sm text-muted-foreground">
            Validated with: <span className="font-semibold text-foreground">Master Source</span>
          </span>
        </div>
      </div>

      {/* ── Tabs as pill buttons ──────────────────────────────────────── */}
      {tabs.length > 1 && (
        <div className="flex gap-1.5">
          {tabs.map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                tab === activeTab
                  ? 'border-blue-500 text-blue-700 bg-blue-50'
                  : 'border-border text-muted-foreground hover:bg-muted',
              ].join(' ')}
            >
              {tab === 'details' ? 'Fields' : tab}
            </button>
          ))}
        </div>
      )}

      {/* ── Side-by-side compare ──────────────────────────────────────── */}
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr] items-stretch">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <FieldsTable
            columns={docFields?.columns ?? []}
            rows={decorate(docFields?.row_data ?? [])}
            documentSourceMap={sourceMap}
            highlightErrors
          />
        </div>
        <div className="flex items-center text-muted-foreground text-xl select-none px-1" aria-hidden>
          ⇄
        </div>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <FieldsTable
            columns={srcFields?.columns ?? []}
            rows={decorate(srcFields?.row_data ?? [])}
            highlightErrors
          />
        </div>
      </div>

      {/* ── Reject form (inline) ──────────────────────────────────────── */}
      {isRejectFormVisible && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex flex-col gap-3">
          <div className="text-xs font-semibold text-amber-900">Reject this document</div>
          <Select
            label={COPY.rejectReasonLabel}
            required
            disabled={submitting}
            placeholder={COPY.rejectReasonPlaceholder}
            options={reasonsOptions}
            value={rejectReason}
            onChange={onRejectReasonChange}
          />
          <Textarea
            label={COPY.rejectRemarksLabel}
            required={false}
            disabled={submitting}
            readOnly={false}
            resize="vertical"
            showCount={false}
            placeholder={COPY.rejectRemarksPlaceholder}
            rows={3}
            value={rejectRemarks}
            onChange={onRejectRemarksChange}
          />
          <div className="flex justify-end">
            <Button
              label={COPY.rejectSubmit}
              variant="destructive"
              size="md"
              disabled={!rejectReason || submitting}
              loading={submitting}
              fullWidth={false}
              onClick={onRejectSubmit}
            />
          </div>
        </div>
      )}

      {/* ── Confirm-before-verify ─────────────────────────────────────── */}
      {isConfirmDialogOpen && (
        <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 flex flex-col gap-2">
          <div className="text-xs font-semibold text-amber-900">{COPY.confirmTitle}</div>
          <div className="text-xs text-amber-900/90">{COPY.confirmMessage}</div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              label={COPY.confirmCancel}
              variant="outline"
              size="sm"
              disabled={submitting}
              loading={false}
              fullWidth={false}
              onClick={onConfirmDialogToggle}
            />
            <Button
              label={COPY.confirmConfirm}
              variant="default"
              size="sm"
              disabled={submitting}
              loading={submitting}
              fullWidth={false}
              onClick={onConfirmVerify}
            />
          </div>
        </div>
      )}
    </div>
  )
}
