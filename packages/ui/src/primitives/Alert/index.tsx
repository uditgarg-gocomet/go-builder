import React from 'react'
import { z } from 'zod'
import { cn } from '../../lib/utils.js'

export const AlertPropsSchema = z.object({
  variant: z.enum(['info', 'success', 'warning', 'error']).default('info'),
  title: z.string().optional(),
  description: z.string().default(''),
  dismissible: z.boolean().default(false),
  className: z.string().optional(),
})

export type AlertProps = z.infer<typeof AlertPropsSchema> & {
  onDismiss?: () => void
  style?: React.CSSProperties
}

export const alertManifest = {
  displayName: 'Alert',
  category: 'Feedback',
  description: 'Contextual message banner with variant styles',
  icon: 'alert-circle',
  tags: ['alert', 'notification', 'feedback', 'message'],
}

const variantMap = {
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  success: 'bg-green-50 border-green-200 text-green-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  error: 'bg-red-50 border-red-200 text-red-800',
}

const icons = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
}

export function Alert({ variant = 'info', title, description, dismissible = false, onDismiss, className, style }: AlertProps): React.ReactElement {
  return (
    <div role="alert" style={style} className={cn('flex items-start gap-3 rounded-md border p-4', variantMap[variant], className)}>
      <span className="mt-0.5 shrink-0">{icons[variant]}</span>
      <div className="flex-1 min-w-0">
        {title && <p className="font-medium text-sm">{title}</p>}
        {description && <p className="text-sm mt-0.5">{description}</p>}
      </div>
      {dismissible && (
        <button onClick={onDismiss} className="shrink-0 rounded hover:opacity-70" aria-label="Dismiss">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
