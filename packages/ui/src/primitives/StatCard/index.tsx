import React from 'react'
import { z } from 'zod'
import { cn } from '../../lib/utils.js'

export const StatCardPropsSchema = z.object({
  label: z.string().default(''),
  value: z.union([z.string(), z.number()]).default(0),
  previousValue: z.number().optional(),
  trend: z.enum(['up', 'down', 'neutral']).optional(),
  format: z.enum(['number', 'currency', 'percent']).default('number'),
  currencySymbol: z.string().default('$'),
  loading: z.boolean().default(false),
  className: z.string().optional(),
})

export type StatCardProps = z.infer<typeof StatCardPropsSchema> & { style?: React.CSSProperties }

export const statCardManifest = {
  displayName: 'Stat Card',
  category: 'Data',
  description: 'Single metric display with optional delta and trend indicator',
  icon: 'trending-up',
  tags: ['stat', 'metric', 'kpi', 'number'],
}

function formatValue(value: string | number, format: 'number' | 'currency' | 'percent', symbol: string): string {
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(n)) return String(value)
  if (format === 'currency') return `${symbol}${n.toLocaleString()}`
  if (format === 'percent') return `${n.toFixed(1)}%`
  return n.toLocaleString()
}

export function StatCard({ label, value, previousValue, trend, format = 'number', currencySymbol = '$', loading = false, className, style }: StatCardProps): React.ReactElement {
  const delta = previousValue !== undefined && typeof value === 'number'
    ? ((value - previousValue) / Math.abs(previousValue || 1)) * 100
    : null

  const effectiveTrend = trend ?? (delta !== null ? (delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral') : 'neutral')

  return (
    <div style={style} className={cn('rounded-lg border border-border bg-card p-4', className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded bg-muted" />
      ) : (
        <p className="mt-1 text-2xl font-bold tracking-tight">{formatValue(value, format, currencySymbol)}</p>
      )}
      {delta !== null && !loading && (
        <div className={cn('mt-1 flex items-center gap-1 text-xs font-medium', effectiveTrend === 'up' ? 'text-green-600' : effectiveTrend === 'down' ? 'text-red-600' : 'text-muted-foreground')}>
          {effectiveTrend === 'up' ? '↑' : effectiveTrend === 'down' ? '↓' : '→'}
          {Math.abs(delta).toFixed(1)}% vs previous
        </div>
      )}
    </div>
  )
}
