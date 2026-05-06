import React from 'react'
import { z } from 'zod'
import { cn } from '../../lib/utils.js'

export const SkeletonPropsSchema = z.object({
  width: z.string().default('100%'),
  height: z.string().default('1rem'),
  rounded: z.enum(['none', 'sm', 'md', 'lg', 'full']).default('md'),
  className: z.string().optional(),
})

export type SkeletonProps = z.infer<typeof SkeletonPropsSchema> & { style?: React.CSSProperties }

export const skeletonManifest = {
  displayName: 'Skeleton',
  category: 'Feedback',
  description: 'Placeholder loading state for content',
  icon: 'rectangle-horizontal',
  tags: ['skeleton', 'loading', 'placeholder'],
}

const roundedMap = { none: 'rounded-none', sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg', full: 'rounded-full' }

export function Skeleton({ width = '100%', height = '1rem', rounded = 'md', className, style }: SkeletonProps): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      style={{ width, height, ...style }}
      className={cn('animate-pulse bg-muted', roundedMap[rounded], className)}
    />
  )
}
