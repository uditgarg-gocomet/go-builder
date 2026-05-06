import React from 'react'
import { z } from 'zod'
import { cn } from '../../lib/utils.js'

export const BadgePropsSchema = z.object({
  text: z.string().default(''),
  variant: z.enum(['default', 'success', 'warning', 'error', 'info', 'outline']).default('default'),
  size: z.enum(['sm', 'md']).default('md'),
  className: z.string().optional(),
})

export type BadgeProps = z.infer<typeof BadgePropsSchema> & { style?: React.CSSProperties }

export const badgeManifest = {
  displayName: 'Badge',
  category: 'Data',
  description: 'Small status or label indicator',
  icon: 'tag',
  tags: ['badge', 'label', 'status', 'pill'],
}

const variantMap = {
  default: 'bg-secondary text-secondary-foreground',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  outline: 'border border-border text-foreground bg-transparent',
}

export function Badge({ text, variant = 'default', size = 'md', className, style }: BadgeProps): React.ReactElement {
  return (
    <span
      style={style}
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        variantMap[variant],
        className,
      )}
    >
      {text}
    </span>
  )
}
