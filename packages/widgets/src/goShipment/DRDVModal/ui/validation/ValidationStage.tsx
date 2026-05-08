'use client'

import React, { useMemo, useState } from 'react'
import { Spinner } from '@portal/ui'
import { COPY } from '../../shared/constants.js'
import { titleCase } from '../../shared/textUtils.js'
import type {
  DRDVFieldsTableRow,
  DocumentInfo,
  ExtractionDetailsResponse,
} from '../../shared/types.js'
import { FieldsTable } from '../shared/FieldsTable.js'
import { DocumentPreview } from '../shared/DocumentPreview.js'

export interface ValidationStageProps {
  loading: boolean
  error: string | undefined
  data: ExtractionDetailsResponse | undefined
  documentBucketId: string | undefined
}

function buildDocumentSourceMap(
  documents: ReadonlyArray<DocumentInfo>,
): Record<string, { index: number; name: string; link?: string }> {
  const map: Record<string, { index: number; name: string; link?: string }> = {}
  documents.forEach((doc, i) => {
    const entry: { index: number; name: string; link?: string } = {
      index: i + 1,
      name: doc.name,
    }
    if (doc.link) entry.link = doc.link
    map[doc.id] = entry
  })
  return map
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === ''
}

export function ValidationStage({
  loading,
  error,
  data,
  documentBucketId,
}: ValidationStageProps): React.ReactElement {
  const [showEmptyOnly, setShowEmptyOnly] = useState(false)
  const lineItemTabs = data ? Object.keys(data.combined_extracted_data?.line_items ?? {}) : []
  const tabs = ['details', ...lineItemTabs]
  const [activeTab, setActiveTab] = useState<string>('details')

  const documents = useMemo(
    () => Object.values(data?.document_details ?? {}),
    [data],
  )
  const sourceMap = useMemo(() => buildDocumentSourceMap(documents), [documents])

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Spinner size="md" /></div>
  }
  if (error) {
    return <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
  }
  if (!data) {
    return <div className="text-center text-xs text-muted-foreground py-12">{COPY.noData}</div>
  }

  const fields = data.combined_extracted_data?.fields
  const allRows: ReadonlyArray<DRDVFieldsTableRow> = fields?.row_data ?? []
  const visibleRows = showEmptyOnly
    ? allRows.filter(r => isEmpty(r.value))
    : allRows

  const documentTitle = titleCase(documentBucketId ?? '') || 'Document'
  const updatedDate = new Date(data.updated_at).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const status = data.status
  const isError =
    status === 'validation_error' ||
    status === 'extraction_error' ||
    status === 'rejected'

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ── LEFT side ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {/* Header card with progress bar */}
        <div className="rounded-lg border border-blue-200 bg-blue-50/30 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">{documentTitle}</span>
            <span className="text-[11px] text-muted-foreground">{updatedDate}</span>
          </div>
          {data.progress_details && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(100, Math.round(data.progress_details.percentage))}%` }}
              />
            </div>
          )}
          {data.progress_details && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs text-foreground">
                {data.progress_details.fields_not_fetched} Fields not Extracted
              </span>
              {isError && (
                <span className="rounded bg-rose-100 text-rose-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  Validation Error
                </span>
              )}
            </div>
          )}
        </div>

        {/* Remarks alert */}
        {data.remarks && (
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {data.remarks}
          </div>
        )}

        {/* Tabs as pill buttons + show-empty toggle */}
        <div className="flex items-center justify-between">
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
                {tab === 'details'
                  ? (fields?.display_name || 'Fields')
                  : (data.combined_extracted_data?.line_items?.[tab]?.display_name ?? tab)}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <span
              className={[
                'inline-flex h-4 w-7 items-center rounded-full p-0.5 transition-colors',
                showEmptyOnly ? 'bg-blue-600' : 'bg-slate-300',
              ].join(' ')}
            >
              <span
                className={[
                  'h-3 w-3 rounded-full bg-white shadow-sm transition-transform',
                  showEmptyOnly ? 'translate-x-3' : 'translate-x-0',
                ].join(' ')}
              />
            </span>
            <input
              type="checkbox"
              checked={showEmptyOnly}
              onChange={e => setShowEmptyOnly(e.target.checked)}
              className="sr-only"
            />
            Show empty only
          </label>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {activeTab === 'details' ? (
            <FieldsTable
              columns={fields?.columns ?? []}
              rows={visibleRows}
              documentSourceMap={sourceMap}
              emptyMessage={showEmptyOnly ? 'All fields are filled' : COPY.emptyExtraction}
            />
          ) : (
            <div className="text-center text-xs text-muted-foreground py-6">
              Line items table — read-only ({(data.combined_extracted_data?.line_items?.[activeTab]?.row_data?.length ?? 0)} rows). Detailed cell rendering deferred to v2.
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT side — document preview ─────────────────────────────── */}
      <div className="flex flex-col min-h-[480px]">
        <DocumentPreview documents={documents} />
      </div>
    </div>
  )
}
