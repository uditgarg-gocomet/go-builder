import React from 'react'
import { z } from 'zod'
import * as RadixDropdown from '@radix-ui/react-dropdown-menu'
import { cn } from '../../lib/utils.js'

export const DropdownMenuPropsSchema = z.object({
  triggerLabel: z.string().default('Options'),
  items: z.array(z.object({
    label: z.string(),
    value: z.string(),
    disabled: z.boolean().optional(),
    destructive: z.boolean().optional(),
  })).default([]),
  className: z.string().optional(),
})

export type DropdownMenuItem = {
  label: string
  value: string
  disabled?: boolean
  destructive?: boolean
  icon?: React.ReactNode
  onClick?: () => void
}

export type DropdownMenuProps = Omit<z.infer<typeof DropdownMenuPropsSchema>, 'items'> & {
  items: DropdownMenuItem[]
  trigger?: React.ReactNode
  style?: React.CSSProperties
}

export const dropdownMenuManifest = {
  displayName: 'Dropdown Menu',
  category: 'Action',
  description: 'A button that opens a dropdown list of actions',
  icon: 'chevron-down',
  tags: ['dropdown', 'menu', 'action', 'select'],
}

export function DropdownMenu({ triggerLabel = 'Options', items = [], trigger, className, style }: DropdownMenuProps): React.ReactElement {
  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>
        {trigger ?? (
          <button
            className={cn(
              'inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md',
              'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring',
              className,
            )}
            style={style}
          >
            {triggerLabel}
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content
          className="z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md"
          sideOffset={4}
        >
          {items.map((item) => (
            <RadixDropdown.Item
              key={item.value}
              disabled={item.disabled}
              onSelect={item.onClick}
              className={cn(
                'flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                'outline-none transition-colors focus:bg-accent focus:text-accent-foreground',
                item.disabled && 'pointer-events-none opacity-50',
                item.destructive && 'text-destructive focus:text-destructive',
              )}
            >
              {item.icon && <span className="h-4 w-4">{item.icon}</span>}
              {item.label}
            </RadixDropdown.Item>
          ))}
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  )
}
