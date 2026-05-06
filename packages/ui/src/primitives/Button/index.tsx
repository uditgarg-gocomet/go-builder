import React from 'react'
import { z } from 'zod'

export const ButtonPropsSchema = z.object({
  label: z.string().default('Button'),
  variant: z.enum(['primary', 'secondary', 'destructive', 'ghost', 'link']).default('primary'),
  size: z.enum(['sm', 'md', 'lg']).default('md'),
  disabled: z.boolean().default(false),
  loading: z.boolean().default(false),
  fullWidth: z.boolean().default(false),
})

export type ButtonProps = z.infer<typeof ButtonPropsSchema>

export const manifest = {
  displayName: 'Button',
  category: 'Actions',
  description: 'A clickable button that triggers an action',
  icon: 'mouse-pointer-click',
  tags: ['button', 'action', 'click'],
}

export function Button({ label, variant = 'primary', size = 'md', disabled = false, loading = false, fullWidth = false }: ButtonProps): React.ReactElement {
  return (
    <button
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
        variant === 'secondary' && 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        variant === 'destructive' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        variant === 'ghost' && 'hover:bg-accent hover:text-accent-foreground',
        variant === 'link' && 'text-primary underline-offset-4 hover:underline',
        size === 'sm' && 'h-9 px-3 text-sm',
        size === 'md' && 'h-10 px-4 py-2',
        size === 'lg' && 'h-11 px-8 text-base',
        fullWidth && 'w-full',
      ].filter(Boolean).join(' ')}
    >
      {loading ? '...' : label}
    </button>
  )
}
