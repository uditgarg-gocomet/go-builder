import React from 'react'
import { z } from 'zod'
import { cn } from '../../lib/utils.js'

export const LinkPropsSchema = z.object({
  label: z.string().default('Link'),
  href: z.string().default('#'),
  target: z.enum(['_self', '_blank', '_parent', '_top']).default('_self'),
  variant: z.enum(['default', 'muted', 'destructive']).default('default'),
  className: z.string().optional(),
})

export type LinkProps = z.infer<typeof LinkPropsSchema> & {
  onClick?: () => void
  style?: React.CSSProperties
  children?: React.ReactNode
}

export const linkManifest = {
  displayName: 'Link',
  category: 'Action',
  description: 'An anchor link with configurable target and variant',
  icon: 'link',
  tags: ['link', 'anchor', 'navigation'],
}

export function Link({ label, href = '#', target = '_self', variant = 'default', className, style, onClick, children }: LinkProps): React.ReactElement {
  return (
    <a
      href={href}
      target={target}
      rel={target === '_blank' ? 'noopener noreferrer' : undefined}
      onClick={onClick}
      style={style}
      className={cn(
        'inline-flex items-center text-sm underline-offset-4 hover:underline transition-colors',
        variant === 'default' && 'text-primary',
        variant === 'muted' && 'text-muted-foreground',
        variant === 'destructive' && 'text-destructive',
        className,
      )}
    >
      {children ?? label}
    </a>
  )
}
