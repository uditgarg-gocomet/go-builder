import React from 'react'
import { z } from 'zod'
import { cn } from '../../lib/utils.js'

export const EmptyStatePropsSchema = z.object({
  title: z.string().default('No results'),
  description: z.string().optional(),
  actionLabel: z.string().optional(),
  className: z.string().optional(),
})

export type EmptyStateProps = z.infer<typeof EmptyStatePropsSchema> & {
  icon?: React.ReactNode
  onAction?: () => void
  style?: React.CSSProperties
}

export const emptyStateManifest = {
  displayName: 'Empty State',
  category: 'Feedback',
  description: 'Placeholder displayed when there is no content to show',
  icon: 'inbox',
  tags: ['empty', 'placeholder', 'feedback'],
}

export function EmptyState({ title = 'No results', description, actionLabel, onAction, icon, className, style }: EmptyStateProps): React.ReactElement {
  return (
    <div style={style} className={cn('flex flex-col items-center justify-center gap-3 py-12 text-center', className)}>
      {icon ? (
        <div className="text-muted-foreground">{icon}</div>
      ) : (
        <svg className="h-12 w-12 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      )}
      <div>
        <p className="font-medium text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-2 text-sm font-medium text-primary hover:underline"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
