import React from 'react'
import { z } from 'zod'
import { cn } from '../../lib/utils.js'

export const NumberInputPropsSchema = z.object({
  label: z.string().optional(),
  value: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().default(1),
  error: z.string().optional(),
  disabled: z.boolean().default(false),
  required: z.boolean().default(false),
  className: z.string().optional(),
})

export type NumberInputProps = z.infer<typeof NumberInputPropsSchema> & {
  onChange?: (value: number | undefined) => void
  onBlur?: () => void
  style?: React.CSSProperties
  name?: string
}

export const numberInputManifest = {
  displayName: 'Number Input',
  category: 'Input',
  description: 'Numeric field with optional min, max, and step constraints',
  icon: 'hash',
  tags: ['input', 'number', 'form', 'numeric'],
}

export function NumberInput({ label, value, min, max, step = 1, error, disabled = false, required = false, className, style, onChange, onBlur, name }: NumberInputProps): React.ReactElement {
  const id = name ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div style={style} className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}{required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
      )}
      <input
        id={id}
        name={name}
        type="number"
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        required={required}
        onChange={e => onChange?.(e.target.value === '' ? undefined : Number(e.target.value))}
        onBlur={onBlur}
        className={cn(
          'rounded-md border bg-background px-3 py-2 text-sm outline-none',
          'focus:ring-2 focus:ring-ring placeholder:text-muted-foreground',
          error ? 'border-destructive' : 'border-input',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
