import React from 'react'
import { z } from 'zod'
import { cn } from '../../lib/utils.js'

export const TextInputPropsSchema = z.object({
  label: z.string().optional(),
  placeholder: z.string().default(''),
  value: z.string().default(''),
  error: z.string().optional(),
  helperText: z.string().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  disabled: z.boolean().default(false),
  readOnly: z.boolean().default(false),
  required: z.boolean().default(false),
  className: z.string().optional(),
})

export type TextInputProps = z.infer<typeof TextInputPropsSchema> & {
  onChange?: (value: string) => void
  onBlur?: () => void
  style?: React.CSSProperties
  name?: string
  id?: string
}

export const textInputManifest = {
  displayName: 'Text Input',
  category: 'Input',
  description: 'Single-line text field with label, error, and helper text',
  icon: 'input',
  tags: ['input', 'text', 'form', 'field'],
}

export function TextInput({ label, placeholder, value, error, helperText, prefix, suffix, disabled = false, readOnly = false, required = false, className, style, onChange, onBlur, name, id }: TextInputProps): React.ReactElement {
  const inputId = id ?? name ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div style={style} className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}{required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
      )}
      <div className={cn('flex items-center rounded-md border bg-background transition-colors', error ? 'border-destructive' : 'border-input', disabled && 'opacity-50 cursor-not-allowed')}>
        {prefix && <span className="px-3 py-2 text-sm text-muted-foreground border-r border-input">{prefix}</span>}
        <input
          id={inputId}
          name={name}
          type="text"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          onChange={e => onChange?.(e.target.value)}
          onBlur={onBlur}
          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        {suffix && <span className="px-3 py-2 text-sm text-muted-foreground border-l border-input">{suffix}</span>}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!error && helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
    </div>
  )
}
