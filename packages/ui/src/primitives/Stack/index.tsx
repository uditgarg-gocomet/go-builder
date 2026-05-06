import React from 'react'
import { z } from 'zod'
import { cn } from '../../lib/utils.js'

export const StackPropsSchema = z.object({
  direction: z.enum(['vertical', 'horizontal']).default('vertical'),
  gap: z.enum(['none', 'xs', 'sm', 'md', 'lg', 'xl']).default('md'),
  align: z.enum(['start', 'center', 'end', 'stretch']).default('stretch'),
  justify: z.enum(['start', 'center', 'end', 'between', 'around']).default('start'),
  wrap: z.boolean().default(false),
  className: z.string().optional(),
})

export type StackProps = z.infer<typeof StackPropsSchema> & { children?: React.ReactNode; style?: React.CSSProperties }

export const stackManifest = {
  displayName: 'Stack',
  category: 'Layout',
  description: 'Flex container for stacking elements vertically or horizontally',
  icon: 'layers',
  tags: ['layout', 'flex', 'stack'],
}

const gapMap = { none: 'gap-0', xs: 'gap-1', sm: 'gap-2', md: 'gap-4', lg: 'gap-6', xl: 'gap-8' }
const alignMap = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' }
const justifyMap = { start: 'justify-start', center: 'justify-center', end: 'justify-end', between: 'justify-between', around: 'justify-around' }

export function Stack({ direction = 'vertical', gap = 'md', align = 'stretch', justify = 'start', wrap = false, className, style, children }: StackProps): React.ReactElement {
  return (
    <div
      style={style}
      className={cn(
        'flex',
        direction === 'horizontal' ? 'flex-row' : 'flex-col',
        gapMap[gap],
        alignMap[align],
        justifyMap[justify],
        wrap && 'flex-wrap',
        className,
      )}
    >
      {children}
    </div>
  )
}
