import React from 'react'
import { z } from 'zod'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { cn } from '../../lib/utils.js'

export const DataTableColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  sortable: z.boolean().default(false),
  width: z.string().optional(),
})

// Fixed catalog of inline row actions. Each renders as an icon button in the
// "Action" column at the end of the row. The page schema wires per-action
// triggers (onActionView, onActionUpload…) to ActionDef ids so admin-only
// gating stays a schema decision.
export const ROW_ACTION_IDS = ['upload', 'delete', 'view', 'refresh', 'block'] as const
export const RowActionIdSchema = z.enum(ROW_ACTION_IDS)
export type RowActionId = z.infer<typeof RowActionIdSchema>

export const RowActionConfigSchema = z.object({
  id: RowActionIdSchema,
  // Tooltip / aria label override. Defaults to the action id.
  label: z.string().optional(),
  // When set, the button renders only if the current user has at least one of
  // these group memberships. Reads from `userGroups` injected by the renderer
  // — falsy/empty groups mean unauthenticated, in which case admin-gated
  // actions are hidden.
  requireGroups: z.array(z.string()).optional(),
})
export type RowActionConfig = z.infer<typeof RowActionConfigSchema>

export const DataTablePropsSchema = z.object({
  columns: z.array(DataTableColumnSchema).default([]),
  pageSize: z.number().int().min(1).max(100).default(10),
  striped: z.boolean().default(false),
  searchable: z.boolean().default(false),
  exportable: z.boolean().default(false),
  loading: z.boolean().default(false),
  error: z.string().optional(),
  className: z.string().optional(),
  rowActions: z.array(RowActionConfigSchema).optional(),
})

export type DataTableColumn = z.infer<typeof DataTableColumnSchema>

export type DataTableProps = z.infer<typeof DataTablePropsSchema> & {
  data: Record<string, unknown>[]
  onRowClick?: (row: Record<string, unknown>) => void
  // Per-action triggers fired when the user clicks a row-action icon. Each
  // forwards the full row as the first argument so action configs can
  // interpolate `{{event.<field>}}` (the same convention DataTable's
  // existing onRowClick uses).
  onActionView?: (row: Record<string, unknown>) => void
  onActionUpload?: (row: Record<string, unknown>) => void
  onActionDelete?: (row: Record<string, unknown>) => void
  onActionRefresh?: (row: Record<string, unknown>) => void
  onActionBlock?: (row: Record<string, unknown>) => void
  // Roles for the current renderer session. Used to filter `rowActions` whose
  // `requireGroups` aren't satisfied. Schema-bound via NodeRenderer.
  userGroups?: string[]
  style?: React.CSSProperties
}

export const dataTableManifest = {
  displayName: 'Data Table',
  category: 'Data',
  description: 'Tabular data display with sorting and pagination via TanStack Table',
  icon: 'table',
  tags: ['table', 'data', 'grid', 'list'],
}

// SVG icon set for the row-action column. Inlined to keep the primitive
// dependency-free (no lucide / heroicons import in @portal/ui). Stroke width +
// size match the existing builder canvas iconography.
const ROW_ACTION_ICONS: Record<RowActionId, React.ReactElement> = {
  upload: (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  delete: (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
    </svg>
  ),
  view: (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  refresh: (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582M4 9a8 8 0 0114.32-4.32M20 20v-5h-.582M20 15a8 8 0 01-14.32 4.32" />
    </svg>
  ),
  block: (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M5.5 5.5l13 13" />
    </svg>
  ),
}

function isActionVisible(cfg: RowActionConfig, userGroups: string[]): boolean {
  if (!cfg.requireGroups || cfg.requireGroups.length === 0) return true
  return cfg.requireGroups.some(g => userGroups.includes(g))
}

export function DataTable({
  columns = [], data = [], pageSize = 10, striped = false, searchable = false,
  loading = false, error, onRowClick, className, style,
  rowActions, userGroups = [],
  onActionView, onActionUpload, onActionDelete, onActionRefresh, onActionBlock,
}: DataTableProps): React.ReactElement {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [search, setSearch] = React.useState('')

  const visibleRowActions = React.useMemo(
    () => (rowActions ?? []).filter(a => isActionVisible(a, userGroups)),
    [rowActions, userGroups],
  )
  const hasActionColumn = visibleRowActions.length > 0

  // Map action id → click handler. Centralised so the rendering loop can stay
  // a single switch.
  const actionHandlers: Record<RowActionId, ((row: Record<string, unknown>) => void) | undefined> = {
    upload: onActionUpload,
    delete: onActionDelete,
    view: onActionView,
    refresh: onActionRefresh,
    block: onActionBlock,
  }

  const filteredData = React.useMemo(() => {
    if (!search) return data
    return data.filter(row =>
      Object.values(row).some(v => String(v).toLowerCase().includes(search.toLowerCase()))
    )
  }, [data, search])

  const tableCols = React.useMemo<ColumnDef<Record<string, unknown>>[]>(() =>
    columns.map(col => ({
      id: col.key,
      accessorKey: col.key,
      header: col.label,
      enableSorting: col.sortable,
      size: col.width ? parseInt(col.width) : undefined,
    })),
    [columns]
  )

  const table = useReactTable({
    data: filteredData,
    columns: tableCols,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { sorting },
    onSortingChange: setSorting,
    initialState: { pagination: { pageSize } },
  })

  if (error) {
    return <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
  }

  return (
    <div style={style} className={cn('w-full', className)}>
      {searchable && (
        <div className="mb-3">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-xs rounded-md border border-input px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}
      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => (
                  <th
                    key={header.id}
                    className={cn('px-4 py-3 text-left font-medium text-muted-foreground', header.column.getCanSort() && 'cursor-pointer select-none hover:text-foreground')}
                    onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <span className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' && ' ↑'}
                      {header.column.getIsSorted() === 'desc' && ' ↓'}
                    </span>
                  </th>
                ))}
                {hasActionColumn && (
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">ACTION</th>
                )}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                  {hasActionColumn && (
                    <td className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-muted" /></td>
                  )}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (hasActionColumn ? 1 : 0)} className="px-4 py-8 text-center text-muted-foreground">No data</td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, idx) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={cn(
                    'border-t border-border transition-colors',
                    striped && idx % 2 === 1 && 'bg-muted/30',
                    onRowClick && 'cursor-pointer hover:bg-muted/50',
                  )}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                  {hasActionColumn && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {visibleRowActions.map(action => {
                          const handler = actionHandlers[action.id]
                          return (
                            <button
                              key={action.id}
                              type="button"
                              title={action.label ?? action.id}
                              aria-label={action.label ?? action.id}
                              onClick={e => { e.stopPropagation(); handler?.(row.original) }}
                              className={cn(
                                'inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors',
                                handler ? 'hover:bg-muted hover:text-foreground' : 'cursor-not-allowed opacity-40',
                              )}
                              disabled={!handler}
                            >
                              {ROW_ACTION_ICONS[action.id]}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {table.getPageCount() > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <div className="flex gap-1">
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="rounded border border-border px-3 py-1 disabled:opacity-50 hover:bg-muted">
              Previous
            </button>
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="rounded border border-border px-3 py-1 disabled:opacity-50 hover:bg-muted">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
