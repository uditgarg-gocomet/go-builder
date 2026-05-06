import React from 'react'
import { z } from 'zod'
import { cn } from '../../lib/utils.js'

export const TagPropsSchema = z.object({
  label: z.string().default(''),
  color: z.enum(['default', 'blue', 'green', 'yellow', 'red', 'purple']).default('default'),
  removable: z.boolean().default(false),
  className: z.string().optional(),
})

export type TagProps = z.infer<typeof TagPropsSchema> & {
  onRemove?: () => void
  style?: React.CSSProperties
}

export const tagManifest = {
  displayName: 'Tag',
  category: 'Data',
  description: 'Removable label chip with color variants',
  icon: 'tag',
  tags: ['tag', 'chip', 'label', 'filter'],
}

const colorMap = {
  default: 'bg-secondary text-secondary-foreground',
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red: 'bg-red-100 text-red-800',
  purple: 'bg-purple-100 text-purple-800',
}

export function Tag({ label, color = 'default', removable = false, onRemove, className, style }: TagProps): React.ReactElement {
  return (
    <span
      style={style}
      className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium', colorMap[color], className)}
    >
      {label}
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="ml-0.5 rounded-full hover:opacity-70 focus:outline-none"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  )
}
