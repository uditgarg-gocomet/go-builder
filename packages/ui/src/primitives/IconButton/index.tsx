import React from 'react'
import { z } from 'zod'
import { cn } from '../../lib/utils.js'

export const IconButtonPropsSchema = z.object({
  icon: z.string().default('circle'),
  ariaLabel: z.string().default(''),
  variant: z.enum(['default', 'outline', 'ghost', 'destructive']).default('default'),
  size: z.enum(['sm', 'md', 'lg']).default('md'),
  disabled: z.boolean().default(false),
  loading: z.boolean().default(false),
  className: z.string().optional(),
})

export type IconButtonProps = z.infer<typeof IconButtonPropsSchema> & {
  onClick?: () => void
  style?: React.CSSProperties
  children?: React.ReactNode
}

export const iconButtonManifest = {
  displayName: 'Icon Button',
  category: 'Action',
  description: 'A square button containing only an icon',
  icon: 'circle-dot',
  tags: ['button', 'icon', 'action'],
}

export function IconButton({ ariaLabel, variant = 'default', size = 'md', disabled = false, loading = false, className, style, onClick, children }: IconButtonProps): React.ReactElement {
  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled || loading}
      style={style}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        variant === 'default' && 'bg-primary text-primary-foreground hover:bg-primary/90',
        variant === 'outline' && 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        variant === 'ghost' && 'hover:bg-accent hover:text-accent-foreground',
        variant === 'destructive' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        size === 'sm' && 'h-8 w-8',
        size === 'md' && 'h-10 w-10',
        size === 'lg' && 'h-12 w-12',
        className,
      )}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (children ?? <span className="h-4 w-4" />)}
    </button>
  )
}
