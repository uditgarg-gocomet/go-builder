import React from 'react'
import { z } from 'zod'
import { cn } from '../../lib/utils.js'

export const TextPropsSchema = z.object({
  content: z.string().default(''),
  as: z.enum(['p', 'span', 'div', 'label']).default('p'),
  size: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).default('md'),
  muted: z.boolean().default(false),
  weight: z.enum(['normal', 'medium', 'semibold', 'bold']).default('normal'),
  align: z.enum(['left', 'center', 'right']).default('left'),
  truncate: z.boolean().default(false),
  className: z.string().optional(),
})

export type TextProps = z.infer<typeof TextPropsSchema> & {
  children?: React.ReactNode
  style?: React.CSSProperties
}

export const textManifest = {
  displayName: 'Text',
  category: 'Typography',
  description: 'Body text with configurable size, weight, and muted variant',
  icon: 'type',
  tags: ['text', 'typography', 'body', 'paragraph'],
}

const sizeMap = { xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl' }
const weightMap = { normal: 'font-normal', medium: 'font-medium', semibold: 'font-semibold', bold: 'font-bold' }
const alignMap = { left: 'text-left', center: 'text-center', right: 'text-right' }

export function Text({ content = '', as: Tag = 'p', size = 'md', muted = false, weight = 'normal', align = 'left', truncate = false, className, style, children }: TextProps): React.ReactElement {
  return (
    <Tag
      style={style}
      className={cn(
        sizeMap[size],
        weightMap[weight],
        alignMap[align],
        muted && 'text-muted-foreground',
        truncate && 'truncate',
        className,
      )}
    >
      {children ?? content}
    </Tag>
  )
}
