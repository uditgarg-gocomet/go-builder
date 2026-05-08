'use client'

// ── Read-only fields table — matches the gocomet DRDV design ───────────────
// Features:
//  · "*" red asterisk on required rows (display_name column)
//  · Empty cells highlighted in cream/yellow
//  · Long values truncated with a clickable "more" expand toggle
//  · Source column maps row.source UUID → "📄 Document N" using
//    `documentSourceMap` (caller supplies index lookup)
//  · `highlightErrors` shades rows with errors in pink (used by verification
//    stage on mismatched rows)

import React, { useState } from 'react'
import type { DRDVFieldsTableRow, DRDVTableColumn } from '../../shared/types.js'
import { shouldTruncate, truncateValue } from '../../shared/textUtils.js'

export interface FieldsTableProps {
  columns: ReadonlyArray<DRDVTableColumn>
  rows: ReadonlyArray<DRDVFieldsTableRow>
  // Maps row.source UUID → display index (1-based) and document name
  documentSourceMap?: Record<string, { index: number; name: string; link?: string }>
  emptyMessage?: string
  highlightErrors?: boolean
  highlightMismatches?: boolean
}

function isEmptyValue(v: unknown): boolean {
  return v === null || v === undefined || v === '' || v === 'Value not found'
}

function ValueCell({ row, col }: { row: DRDVFieldsTableRow; col: DRDVTableColumn }): React.ReactElement {
  const [expanded, setExpanded] = useState(false)

  const raw = (row as unknown as Record<string, unknown>)[col.key]
  const empty = isEmptyValue(raw)
  let display: string
  if (empty) {
    display = '-'
  } else if (typeof raw === 'number') {
    display = raw.toLocaleString()
  } else {
    display = String(raw)
  }

  const truncated = shouldTruncate(display)

  return (
    <td
      className={[
        'px-3 py-2 align-top text-xs',
        empty ? 'bg-amber-50' : '',
      ].join(' ')}
    >
      {empty ? (
        <span className="text-muted-foreground">-</span>
      ) : (
        <span>
          {expanded || !truncated ? display : truncateValue(display)}
          {truncated && (
            <button
              type="button"
              onClick={() => setExpanded(prev => !prev)}
              className="ml-2 text-[11px] text-primary hover:underline"
            >
              {expanded ? 'less' : 'more'}
            </button>
          )}
        </span>
      )}
    </td>
  )
}

function SourceCell({
  row,
  documentSourceMap,
}: {
  row: DRDVFieldsTableRow
  documentSourceMap?: Record<string, { index: number; name: string; link?: string }>
}): React.ReactElement {
  if (!row.source) {
    return <td className="px-3 py-2 align-top text-xs text-muted-foreground">-</td>
  }
  const meta = documentSourceMap?.[row.source]
  const label = meta ? `Document ${meta.index}` : 'Document'
  const link = meta?.link
  return (
    <td className="px-3 py-2 align-top text-xs">
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <span aria-hidden>📄</span>
          {label}
        </a>
      ) : (
        <span className="inline-flex items-center gap-1 text-foreground">
          <span aria-hidden>📄</span>
          {label}
        </span>
      )}
    </td>
  )
}

function FieldNameCell({ row }: { row: DRDVFieldsTableRow }): React.ReactElement {
  return (
    <td className="px-3 py-2 align-top text-xs">
      <span className="font-medium">{row.display_name}</span>
      {row.required && <span className="ml-0.5 text-destructive">*</span>}
    </td>
  )
}

export function FieldsTable({
  columns,
  rows,
  documentSourceMap,
  emptyMessage = 'No fields',
  highlightErrors = false,
  highlightMismatches = false,
}: FieldsTableProps): React.ReactElement {
  if (rows.length === 0) {
    return (
      <div className="text-center text-xs text-muted-foreground py-6">{emptyMessage}</div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {columns.map(col => (
              <th
                key={col.key}
                className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-3 py-2.5"
              >
                {col.display_name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const hasError = highlightErrors && Boolean(row.error)
            const showMismatch = highlightMismatches
            const rowClass = [
              'border-b border-border/60',
              hasError || showMismatch ? 'bg-rose-50/70' : '',
            ].filter(Boolean).join(' ')

            return (
              <tr key={row.key} className={rowClass}>
                {columns.map(col => {
                  if (col.key === 'display_name') {
                    return <FieldNameCell key={col.key} row={row} />
                  }
                  if (col.key === 'source') {
                    return (
                      <SourceCell key={col.key} row={row} documentSourceMap={documentSourceMap} />
                    )
                  }
                  return <ValueCell key={col.key} row={row} col={col} />
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
