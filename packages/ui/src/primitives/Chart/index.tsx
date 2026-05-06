import React from 'react'
import { z } from 'zod'
import {
  LineChart, BarChart, AreaChart, PieChart,
  Line, Bar, Area, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { cn } from '../../lib/utils.js'

export const ChartPropsSchema = z.object({
  type: z.enum(['line', 'bar', 'area', 'pie']).default('line'),
  xKey: z.string().default('name'),
  yKeys: z.array(z.string()).default([]),
  colors: z.array(z.string()).default(['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6']),
  title: z.string().optional(),
  height: z.number().int().positive().default(300),
  showLegend: z.boolean().default(true),
  showGrid: z.boolean().default(true),
  className: z.string().optional(),
})

export type ChartProps = z.infer<typeof ChartPropsSchema> & {
  data: Record<string, unknown>[]
  style?: React.CSSProperties
}

export const chartManifest = {
  displayName: 'Chart',
  category: 'Data',
  description: 'Data visualization — line, bar, area, or pie chart via Recharts',
  icon: 'bar-chart',
  tags: ['chart', 'graph', 'visualization', 'recharts'],
}

const DEFAULT_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899']

export function Chart({ type = 'line', data, xKey = 'name', yKeys, colors = DEFAULT_COLORS, title, height = 300, showLegend = true, showGrid = true, className, style }: ChartProps): React.ReactElement {
  const effectiveColors = colors.length > 0 ? colors : DEFAULT_COLORS

  const commonProps = {
    data,
    margin: { top: 5, right: 20, left: 0, bottom: 5 },
  }

  const commonChildren = (
    <>
      {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
      <XAxis dataKey={xKey} tick={{ fontSize: 12 }} tickLine={false} />
      <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
      <Tooltip />
      {showLegend && <Legend />}
    </>
  )

  const renderSeries = (ChartLine: typeof Line | typeof Bar | typeof Area) =>
    yKeys.map((key, i) => (
      // @ts-expect-error recharts generic component
      <ChartLine key={key} dataKey={key} stroke={effectiveColors[i % effectiveColors.length]} fill={effectiveColors[i % effectiveColors.length]} />
    ))

  let chart: React.ReactNode
  if (type === 'bar') {
    chart = <BarChart {...commonProps}>{commonChildren}{renderSeries(Bar)}</BarChart>
  } else if (type === 'area') {
    chart = <AreaChart {...commonProps}>{commonChildren}{renderSeries(Area)}</AreaChart>
  } else if (type === 'pie') {
    const pieKey = yKeys[0] ?? 'value'
    chart = (
      <PieChart>
        <Pie data={data} dataKey={pieKey} nameKey={xKey} cx="50%" cy="50%" outerRadius="70%" label>
          {data.map((_, i) => <Cell key={i} fill={effectiveColors[i % effectiveColors.length]} />)}
        </Pie>
        <Tooltip />
        {showLegend && <Legend />}
      </PieChart>
    )
  } else {
    chart = <LineChart {...commonProps}>{commonChildren}{renderSeries(Line)}</LineChart>
  }

  return (
    <div style={style} className={cn('w-full', className)}>
      {title && <p className="mb-2 text-sm font-medium">{title}</p>}
      <ResponsiveContainer width="100%" height={height}>
        {chart as React.ReactElement}
      </ResponsiveContainer>
    </div>
  )
}
