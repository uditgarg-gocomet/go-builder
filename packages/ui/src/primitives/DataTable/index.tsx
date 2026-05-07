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

export const DataTablePropsSchema = z.object({
  columns: z.array(DataTableColumnSchema).default([]),
  pageSize: z.number().int().min(1).max(100).default(10),
  striped: z.boolean().default(false),
  searchable: z.boolean().default(false),
  exportable: z.boolean().default(false),
  loading: z.boolean().default(false),
  error: z.string().optional(),
  className: z.string().optional(),
})

export type DataTableColumn = z.infer<typeof DataTableColumnSchema>

export type DataTableProps = z.infer<typeof DataTablePropsSchema> & {
  data: Record<string, unknown>[]
  onRowClick?: (row: Record<string, unknown>) => void
  style?: React.CSSProperties
}

export const dataTableManifest = {
  displayName: 'Data Table',
  category: 'Data',
  description: 'Tabular data display with sorting and pagination via TanStack Table',
  icon: 'table',
  tags: ['table', 'data', 'grid', 'list'],
}

export function DataTable({ columns = [], data = [], pageSize = 10, striped = false, searchable = false, loading = false, error, onRowClick, className, style }: DataTableProps): React.ReactElement {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [search, setSearch] = React.useState('')

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
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">No data</td>
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
