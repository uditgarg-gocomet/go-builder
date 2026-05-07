import React from 'react'
import { z } from 'zod'
import * as RadixAccordion from '@radix-ui/react-accordion'
import { cn } from '../../lib/utils.js'

export const AccordionPropsSchema = z.object({
  type: z.enum(['single', 'multiple']).default('single'),
  collapsible: z.boolean().default(true),
  items: z.array(z.object({
    title: z.string(),
    value: z.string(),
    disabled: z.boolean().optional(),
  })).default([]),
  className: z.string().optional(),
})

export type AccordionItem = { title: string; value: string; content?: React.ReactNode; disabled?: boolean }

export type AccordionProps = Omit<z.infer<typeof AccordionPropsSchema>, 'items'> & {
  items: AccordionItem[]
  style?: React.CSSProperties
}

export const accordionManifest = {
  displayName: 'Accordion',
  category: 'Layout',
  description: 'Collapsible content sections',
  icon: 'chevrons-up-down',
  tags: ['layout', 'accordion', 'collapse', 'expand'],
}

export function Accordion({ type = 'single', collapsible = true, items = [], className, style }: AccordionProps): React.ReactElement {
  const sharedProps = { className: cn('w-full divide-y divide-border border rounded-md', className), style }

  if (type === 'multiple') {
    return (
      <RadixAccordion.Root type="multiple" {...sharedProps}>
        {items.map((item) => (
          <AccordionItemComponent key={item.value} item={item} />
        ))}
      </RadixAccordion.Root>
    )
  }

  return (
    <RadixAccordion.Root type="single" collapsible={collapsible} {...sharedProps}>
      {items.map((item) => (
        <AccordionItemComponent key={item.value} item={item} />
      ))}
    </RadixAccordion.Root>
  )
}

function AccordionItemComponent({ item }: { item: AccordionItem }): React.ReactElement {
  return (
    <RadixAccordion.Item value={item.value} disabled={item.disabled}>
      <RadixAccordion.Trigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors [&[data-state=open]>svg]:rotate-180">
        {item.title}
        <svg className="h-4 w-4 shrink-0 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </RadixAccordion.Trigger>
      <RadixAccordion.Content className="overflow-hidden data-[state=closed]:animate-none data-[state=open]:animate-none">
        <div className="px-4 py-3 text-sm">{item.content}</div>
      </RadixAccordion.Content>
    </RadixAccordion.Item>
  )
}
