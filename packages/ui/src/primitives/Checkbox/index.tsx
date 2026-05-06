import React from 'react'
import { z } from 'zod'
import * as RadixCheckbox from '@radix-ui/react-checkbox'
import { cn } from '../../lib/utils.js'

export const CheckboxPropsSchema = z.object({
  label: z.string().optional(),
  checked: z.boolean().default(false),
  indeterminate: z.boolean().default(false),
  disabled: z.boolean().default(false),
  required: z.boolean().default(false),
  error: z.string().optional(),
  className: z.string().optional(),
})

export type CheckboxProps = z.infer<typeof CheckboxPropsSchema> & {
  onChange?: (checked: boolean) => void
  style?: React.CSSProperties
  name?: string
  id?: string
}

export const checkboxManifest = {
  displayName: 'Checkbox',
  category: 'Input',
  description: 'Radix Checkbox with label and indeterminate state',
  icon: 'check-square',
  tags: ['checkbox', 'input', 'form', 'boolean'],
}

export function Checkbox({ label, checked = false, indeterminate = false, disabled = false, required = false, error, className, style, onChange, name, id }: CheckboxProps): React.ReactElement {
  const checkboxId = id ?? name ?? label?.toLowerCase().replace(/\s+/g, '-')
  const checkedState = indeterminate ? 'indeterminate' : checked

  return (
    <div style={style} className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-2">
        <RadixCheckbox.Root
          id={checkboxId}
          name={name}
          checked={checkedState}
          disabled={disabled}
          required={required}
          onCheckedChange={val => onChange?.(val === true)}
          className={cn(
            'h-4 w-4 rounded border border-input bg-background flex items-center justify-center',
            'focus:outline-none focus:ring-2 focus:ring-ring',
            (checked || indeterminate) && 'bg-primary border-primary',
            disabled && 'opacity-50 cursor-not-allowed',
            error && 'border-destructive',
          )}
        >
          <RadixCheckbox.Indicator>
            {indeterminate ? (
              <svg className="h-3 w-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 10h12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="h-3 w-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                <path d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" />
              </svg>
            )}
          </RadixCheckbox.Indicator>
        </RadixCheckbox.Root>
        {label && (
          <label htmlFor={checkboxId} className={cn('text-sm text-foreground', disabled && 'opacity-50 cursor-not-allowed')}>
            {label}{required && <span className="ml-0.5 text-destructive">*</span>}
          </label>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
