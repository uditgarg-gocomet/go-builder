import React from 'react'
import { z } from 'zod'
import { cn } from '../../lib/utils.js'

export const GridPropsSchema = z.object({
  columns: z.number().int().min(1).max(12).default(2),
  gap: z.enum(['none', 'xs', 'sm', 'md', 'lg', 'xl']).default('md'),
  align: z.enum(['start', 'center', 'end', 'stretch']).default('stretch'),
  className: z.string().optional(),
})

export type GridProps = z.infer<typeof GridPropsSchema> & { children?: React.ReactNode; style?: React.CSSProperties }

export const gridManifest = {
  displayName: 'Grid',
  category: 'Layout',
  description: 'CSS grid container with configurable columns and gap',
  icon: 'grid',
  tags: ['layout', 'grid', 'columns'],
}

const gapMap = { none: 'gap-0', xs: 'gap-1', sm: 'gap-2', md: 'gap-4', lg: 'gap-6', xl: 'gap-8' }
const alignMap = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' }
const colMap: Record<number, string> = {
  1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4',
  5: 'grid-cols-5', 6: 'grid-cols-6', 7: 'grid-cols-7', 8: 'grid-cols-8',
  9: 'grid-cols-9', 10: 'grid-cols-10', 11: 'grid-cols-11', 12: 'grid-cols-12',
}

export function Grid({ columns = 2, gap = 'md', align = 'stretch', className, style, children }: GridProps): React.ReactElement {
  return (
    <div
      style={style}
      className={cn('grid', colMap[columns] ?? 'grid-cols-2', gapMap[gap], alignMap[align], className)}
    >
      {children}
    </div>
  )
}
