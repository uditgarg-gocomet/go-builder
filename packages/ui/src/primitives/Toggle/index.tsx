import React from 'react'
import { z } from 'zod'
import * as RadixSwitch from '@radix-ui/react-switch'
import { cn } from '../../lib/utils.js'

export const TogglePropsSchema = z.object({
  label: z.string().optional(),
  checked: z.boolean().default(false),
  disabled: z.boolean().default(false),
  size: z.enum(['sm', 'md', 'lg']).default('md'),
  labelPosition: z.enum(['left', 'right']).default('right'),
  error: z.string().optional(),
  className: z.string().optional(),
})

export type ToggleProps = z.infer<typeof TogglePropsSchema> & {
  onChange?: (checked: boolean) => void
  style?: React.CSSProperties
  name?: string
  id?: string
}

export const toggleManifest = {
  displayName: 'Toggle',
  category: 'Input',
  description: 'Radix Switch with label and size variants',
  icon: 'toggle-left',
  tags: ['toggle', 'switch', 'boolean', 'input', 'form'],
}

const sizeClasses = {
  sm: { root: 'h-4 w-8', thumb: 'h-3 w-3 data-[state=checked]:translate-x-4' },
  md: { root: 'h-6 w-11', thumb: 'h-5 w-5 data-[state=checked]:translate-x-5' },
  lg: { root: 'h-7 w-14', thumb: 'h-6 w-6 data-[state=checked]:translate-x-7' },
}

export function Toggle({ label, checked = false, disabled = false, size = 'md', labelPosition = 'right', error, className, style, onChange, name, id }: ToggleProps): React.ReactElement {
  const toggleId = id ?? name ?? label?.toLowerCase().replace(/\s+/g, '-')
  const { root, thumb } = sizeClasses[size]

  const switchEl = (
    <RadixSwitch.Root
      id={toggleId}
      name={name}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
        disabled && 'opacity-50 cursor-not-allowed',
        root,
      )}
    >
      <RadixSwitch.Thumb
        className={cn(
          'pointer-events-none block rounded-full bg-background shadow-lg ring-0 transition-transform translate-x-0',
          thumb,
        )}
      />
    </RadixSwitch.Root>
  )

  return (
    <div style={style} className={cn('flex flex-col gap-1', className)}>
      <div className={cn('flex items-center gap-2', labelPosition === 'left' && 'flex-row-reverse justify-end')}>
        {switchEl}
        {label && (
          <label htmlFor={toggleId} className={cn('text-sm text-foreground cursor-pointer', disabled && 'opacity-50 cursor-not-allowed')}>
            {label}
          </label>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
