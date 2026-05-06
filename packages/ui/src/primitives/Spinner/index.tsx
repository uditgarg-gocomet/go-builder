import React from 'react'
import { z } from 'zod'
import { cn } from '../../lib/utils.js'

export const SpinnerPropsSchema = z.object({
  size: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).default('md'),
  className: z.string().optional(),
})

export type SpinnerProps = z.infer<typeof SpinnerPropsSchema> & { style?: React.CSSProperties }

export const spinnerManifest = {
  displayName: 'Spinner',
  category: 'Feedback',
  description: 'Animated loading indicator',
  icon: 'loader',
  tags: ['spinner', 'loading', 'indicator'],
}

const sizeMap = { xs: 'h-3 w-3', sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8', xl: 'h-12 w-12' }

export function Spinner({ size = 'md', className, style }: SpinnerProps): React.ReactElement {
  return (
    <svg
      role="status"
      aria-label="Loading"
      style={style}
      className={cn('animate-spin text-muted-foreground', sizeMap[size], className)}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
