import React from 'react'
import { z } from 'zod'
import { cn } from '../../lib/utils.js'

export const CardPropsSchema = z.object({
  padding: z.enum(['none', 'sm', 'md', 'lg']).default('md'),
  shadow: z.enum(['none', 'sm', 'md', 'lg']).default('sm'),
  border: z.boolean().default(true),
  rounded: z.enum(['none', 'sm', 'md', 'lg', 'xl']).default('md'),
  className: z.string().optional(),
})

export type CardProps = z.infer<typeof CardPropsSchema> & {
  header?: React.ReactNode
  footer?: React.ReactNode
  children?: React.ReactNode
  style?: React.CSSProperties
}

export const cardManifest = {
  displayName: 'Card',
  category: 'Layout',
  description: 'Surface container with optional header and footer',
  icon: 'square',
  tags: ['layout', 'card', 'container', 'surface'],
}

const paddingMap = { none: 'p-0', sm: 'p-3', md: 'p-4', lg: 'p-6' }
const shadowMap = { none: '', sm: 'shadow-sm', md: 'shadow-md', lg: 'shadow-lg' }
const roundedMap = { none: 'rounded-none', sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg', xl: 'rounded-xl' }

export function Card({ padding = 'md', shadow = 'sm', border = true, rounded = 'md', className, style, header, footer, children }: CardProps): React.ReactElement {
  return (
    <div
      style={style}
      className={cn(
        'bg-card text-card-foreground',
        paddingMap[padding],
        shadowMap[shadow],
        roundedMap[rounded],
        border && 'border border-border',
        className,
      )}
    >
      {header && <div className="mb-4">{header}</div>}
      {children}
      {footer && <div className="mt-4 pt-4 border-t border-border">{footer}</div>}
    </div>
  )
}
