import React from 'react'
import { z } from 'zod'
import { cn } from '../../lib/utils.js'

export const DividerPropsSchema = z.object({
  orientation: z.enum(['horizontal', 'vertical']).default('horizontal'),
  className: z.string().optional(),
})

export type DividerProps = z.infer<typeof DividerPropsSchema> & { style?: React.CSSProperties }

export const dividerManifest = {
  displayName: 'Divider',
  category: 'Layout',
  description: 'A horizontal or vertical separator rule',
  icon: 'minus',
  tags: ['layout', 'divider', 'separator', 'rule'],
}

export function Divider({ orientation = 'horizontal', className, style }: DividerProps): React.ReactElement {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      style={style}
      className={cn(
        'bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'w-px self-stretch',
        className,
      )}
    />
  )
}
