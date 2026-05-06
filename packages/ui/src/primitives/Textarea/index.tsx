import React from 'react'
import { z } from 'zod'
import { cn } from '../../lib/utils.js'

export const TextareaPropsSchema = z.object({
  label: z.string().optional(),
  placeholder: z.string().default(''),
  value: z.string().default(''),
  rows: z.number().int().positive().default(4),
  maxLength: z.number().int().positive().optional(),
  resize: z.enum(['none', 'vertical', 'horizontal', 'both']).default('vertical'),
  error: z.string().optional(),
  helperText: z.string().optional(),
  disabled: z.boolean().default(false),
  readOnly: z.boolean().default(false),
  required: z.boolean().default(false),
  showCount: z.boolean().default(false),
  className: z.string().optional(),
})

export type TextareaProps = z.infer<typeof TextareaPropsSchema> & {
  onChange?: (value: string) => void
  onBlur?: () => void
  style?: React.CSSProperties
  name?: string
  id?: string
}

export const textareaManifest = {
  displayName: 'Textarea',
  category: 'Input',
  description: 'Multi-line text area with rows, resize, and character count',
  icon: 'align-left',
  tags: ['textarea', 'text', 'multiline', 'input', 'form'],
}

const resizeClass = {
  none: 'resize-none',
  vertical: 'resize-y',
  horizontal: 'resize-x',
  both: 'resize',
}

export function Textarea({ label, placeholder, value, rows = 4, maxLength, resize = 'vertical', error, helperText, disabled = false, readOnly = false, required = false, showCount = false, className, style, onChange, onBlur, name, id }: TextareaProps): React.ReactElement {
  const inputId = id ?? name ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div style={style} className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}{required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
      )}
      <textarea
        id={inputId}
        name={name}
        value={value}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        onChange={e => onChange?.(e.target.value)}
        onBlur={onBlur}
        className={cn(
          'w-full rounded-md border bg-background px-3 py-2 text-sm outline-none',
          'focus:ring-2 focus:ring-ring placeholder:text-muted-foreground',
          error ? 'border-destructive' : 'border-input',
          disabled && 'opacity-50 cursor-not-allowed',
          resizeClass[resize],
        )}
      />
      <div className="flex items-center justify-between">
        <div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {!error && helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
        </div>
        {showCount && maxLength && (
          <p className="text-xs text-muted-foreground">{value.length}/{maxLength}</p>
        )}
      </div>
    </div>
  )
}
