import React from 'react'
import { z } from 'zod'
import * as RadixTabs from '@radix-ui/react-tabs'
import { cn } from '../../lib/utils.js'

export const TabsPropsSchema = z.object({
  defaultValue: z.string().optional(),
  items: z.array(z.object({
    label: z.string(),
    value: z.string(),
    disabled: z.boolean().optional(),
  })).default([]),
  className: z.string().optional(),
})

export type TabsItem = { label: string; value: string; disabled?: boolean; content?: React.ReactNode }

export type TabsProps = Omit<z.infer<typeof TabsPropsSchema>, 'items'> & {
  items: TabsItem[]
  value?: string
  onValueChange?: (value: string) => void
  style?: React.CSSProperties
}

export const tabsManifest = {
  displayName: 'Tabs',
  category: 'Layout',
  description: 'Tabbed interface for switching between content panels',
  icon: 'panel-top',
  tags: ['layout', 'tabs', 'navigation'],
}

export function Tabs({ items, defaultValue, value, onValueChange, className, style }: TabsProps): React.ReactElement {
  return (
    <RadixTabs.Root
      defaultValue={defaultValue ?? items[0]?.value}
      value={value}
      onValueChange={onValueChange}
      style={style}
      className={cn('w-full', className)}
    >
      <RadixTabs.List className="flex border-b border-border">
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              'text-muted-foreground hover:text-foreground',
              'border-b-2 border-transparent -mb-px',
              'data-[state=active]:border-primary data-[state=active]:text-foreground',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          >
            {item.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map((item) => (
        <RadixTabs.Content key={item.value} value={item.value} className="pt-4">
          {item.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  )
}
