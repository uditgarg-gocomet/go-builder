import React from 'react'
import { z } from 'zod'
import { cn } from '../../lib/utils.js'

export const HeadingPropsSchema = z.object({
  text: z.string().default('Heading'),
  level: z.enum(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']).default('h2'),
  size: z.enum(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl']).optional(),
  weight: z.enum(['normal', 'medium', 'semibold', 'bold']).default('bold'),
  align: z.enum(['left', 'center', 'right']).default('left'),
  className: z.string().optional(),
})

export type HeadingProps = z.infer<typeof HeadingPropsSchema> & { style?: React.CSSProperties }

export const headingManifest = {
  displayName: 'Heading',
  category: 'Typography',
  description: 'Section heading with configurable level, size, and weight',
  icon: 'heading',
  tags: ['heading', 'typography', 'title'],
}

const defaultSizeMap = {
  h1: 'text-4xl', h2: 'text-3xl', h3: 'text-2xl',
  h4: 'text-xl', h5: 'text-lg', h6: 'text-base',
}
const sizeMap = {
  xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg',
  xl: 'text-xl', '2xl': 'text-2xl', '3xl': 'text-3xl', '4xl': 'text-4xl',
}
const weightMap = { normal: 'font-normal', medium: 'font-medium', semibold: 'font-semibold', bold: 'font-bold' }
const alignMap = { left: 'text-left', center: 'text-center', right: 'text-right' }

const VALID_LEVELS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

// Coerce numeric or unexpected level values to a valid heading tag.
// The AI sometimes generates `level: 1` instead of `level: "h1"`.
function resolveTag(level: string): 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' {
  if (VALID_LEVELS.has(level)) return level as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  const n = parseInt(String(level), 10)
  if (n >= 1 && n <= 6) return `h${n}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  return 'h2'
}

export function Heading({ text = 'Heading', level = 'h2', size, weight = 'bold', align = 'left', className, style }: HeadingProps): React.ReactElement {
  const Tag = resolveTag(level)
  return (
    <Tag
      style={style}
      className={cn(
        'tracking-tight',
        size ? sizeMap[size] : defaultSizeMap[level],
        weightMap[weight],
        alignMap[align],
        className,
      )}
    >
      {text}
    </Tag>
  )
}
