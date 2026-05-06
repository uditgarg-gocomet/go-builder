import React from 'react'
import { z } from 'zod'
import * as RadixRadioGroup from '@radix-ui/react-radio-group'
import { cn } from '../../lib/utils.js'

export const RadioOptionSchema = z.object({ label: z.string(), value: z.string(), disabled: z.boolean().optional() })

export const RadioGroupPropsSchema = z.object({
  label: z.string().optional(),
  options: z.array(RadioOptionSchema).default([]),
  value: z.string().optional(),
  orientation: z.enum(['horizontal', 'vertical']).default('vertical'),
  disabled: z.boolean().default(false),
  required: z.boolean().default(false),
  error: z.string().optional(),
  className: z.string().optional(),
})

export type RadioOption = z.infer<typeof RadioOptionSchema>
export type RadioGroupProps = z.infer<typeof RadioGroupPropsSchema> & {
  onChange?: (value: string) => void
  style?: React.CSSProperties
  name?: string
}

export const radioGroupManifest = {
  displayName: 'Radio Group',
  category: 'Input',
  description: 'Radix RadioGroup with options array and orientation control',
  icon: 'circle-dot',
  tags: ['radio', 'radiogroup', 'input', 'form', 'select'],
}

export function RadioGroup({ label, options, value, orientation = 'vertical', disabled = false, required = false, error, className, style, onChange, name }: RadioGroupProps): React.ReactElement {
  return (
    <div style={style} className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label className="text-sm font-medium text-foreground">
          {label}{required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
      )}
      <RadixRadioGroup.Root
        name={name}
        value={value}
        disabled={disabled}
        required={required}
        onValueChange={onChange}
        className={cn('flex gap-3', orientation === 'horizontal' ? 'flex-row flex-wrap' : 'flex-col')}
      >
        {options.map(opt => (
          <div key={opt.value} className="flex items-center gap-2">
            <RadixRadioGroup.Item
              id={`${name ?? 'radio'}-${opt.value}`}
              value={opt.value}
              disabled={opt.disabled ?? false}
              className={cn(
                'h-4 w-4 rounded-full border border-input bg-background',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                'data-[state=checked]:border-primary',
                (disabled || opt.disabled) && 'opacity-50 cursor-not-allowed',
                error && 'border-destructive',
              )}
            >
              <RadixRadioGroup.Indicator className="flex items-center justify-center after:block after:h-2 after:w-2 after:rounded-full after:bg-primary" />
            </RadixRadioGroup.Item>
            <label
              htmlFor={`${name ?? 'radio'}-${opt.value}`}
              className={cn('text-sm text-foreground', (disabled || opt.disabled) && 'opacity-50 cursor-not-allowed')}
            >
              {opt.label}
            </label>
          </div>
        ))}
      </RadixRadioGroup.Root>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
