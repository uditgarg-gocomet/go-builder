import React from 'react'
import { z } from 'zod'
import * as RadixSelect from '@radix-ui/react-select'
import { cn } from '../../lib/utils.js'

export const SelectOptionSchema = z.object({ label: z.string(), value: z.string() })

export const SelectPropsSchema = z.object({
  label: z.string().optional(),
  placeholder: z.string().default('Select…'),
  options: z.array(SelectOptionSchema).default([]),
  value: z.string().optional(),
  error: z.string().optional(),
  disabled: z.boolean().default(false),
  required: z.boolean().default(false),
  className: z.string().optional(),
})

export type SelectOption = z.infer<typeof SelectOptionSchema>
export type SelectProps = z.infer<typeof SelectPropsSchema> & {
  onChange?: (value: string) => void
  style?: React.CSSProperties
}

export const selectManifest = {
  displayName: 'Select',
  category: 'Input',
  description: 'Single-value dropdown using Radix Select',
  icon: 'chevrons-up-down',
  tags: ['select', 'dropdown', 'input', 'form'],
}

export function Select({ label, placeholder = 'Select…', options, value, error, disabled = false, required = false, className, style, onChange }: SelectProps): React.ReactElement {
  return (
    <div style={style} className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label className="text-sm font-medium text-foreground">
          {label}{required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
      )}
      <RadixSelect.Root value={value} onValueChange={onChange} disabled={disabled}>
        <RadixSelect.Trigger
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-ring',
            error ? 'border-destructive' : 'border-input',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
        <RadixSelect.Portal>
          <RadixSelect.Content className="z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover shadow-md">
            <RadixSelect.Viewport className="p-1">
              {options.map(opt => (
                <RadixSelect.Item
                  key={opt.value}
                  value={opt.value}
                  className="flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[state=checked]:font-medium"
                >
                  <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
