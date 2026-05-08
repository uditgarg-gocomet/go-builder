import React from 'react'
import { z } from 'zod'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '../../lib/utils.js'

export const ModalPropsSchema = z.object({
  title: z.string().default(''),
  description: z.string().optional(),
  size: z.enum(['sm', 'md', 'lg', 'xl', 'full']).default('md'),
  closeOnOverlayClick: z.boolean().default(true),
  className: z.string().optional(),
})

export type ModalProps = z.infer<typeof ModalPropsSchema> & {
  open: boolean
  onOpenChange: (open: boolean) => void
  children?: React.ReactNode
  footer?: React.ReactNode
  style?: React.CSSProperties
}

export const modalManifest = {
  displayName: 'Modal',
  category: 'Layout',
  description: 'Dialog overlay with title, description, and footer slot',
  icon: 'layout',
  tags: ['layout', 'modal', 'dialog', 'overlay'],
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full mx-4',
}

export function Modal({ open, onOpenChange, title, description, size = 'md', closeOnOverlayClick = true, className, style, children, footer }: ModalProps): React.ReactElement {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out"
          onClick={closeOnOverlayClick ? undefined : (e) => e.stopPropagation()}
        />
        <Dialog.Content
          style={style}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2',
            'bg-background rounded-lg shadow-lg p-6',
            'focus:outline-none',
            'flex flex-col',
            sizeMap[size],
            className,
          )}
        >
          {title && (
            <Dialog.Title className="text-lg font-semibold leading-none tracking-tight mb-2 shrink-0">
              {title}
            </Dialog.Title>
          )}
          {description && (
            <Dialog.Description className="text-sm text-muted-foreground mb-4 shrink-0">
              {description}
            </Dialog.Description>
          )}
          <div className="flex-1 min-h-0 overflow-auto -mx-6 px-6">{children}</div>
          {footer && <div className="mt-6 flex justify-end gap-2 shrink-0">{footer}</div>}
          <Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
