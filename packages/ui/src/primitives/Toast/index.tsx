import React from 'react'
import { z } from 'zod'
import * as RadixToast from '@radix-ui/react-toast'
import { cn } from '../../lib/utils.js'

export const ToastPropsSchema = z.object({
  message: z.string().default(''),
  type: z.enum(['info', 'success', 'warning', 'error']).default('info'),
  durationMs: z.number().int().positive().default(4000),
  className: z.string().optional(),
})

export type ToastProps = z.infer<typeof ToastPropsSchema> & {
  open: boolean
  onOpenChange: (open: boolean) => void
  style?: React.CSSProperties
}

export const toastManifest = {
  displayName: 'Toast',
  category: 'Feedback',
  description: 'Brief auto-dismissing notification',
  icon: 'bell',
  tags: ['toast', 'notification', 'feedback'],
}

const variantMap = {
  info: 'border-blue-200 bg-blue-50 text-blue-900',
  success: 'border-green-200 bg-green-50 text-green-900',
  warning: 'border-yellow-200 bg-yellow-50 text-yellow-900',
  error: 'border-red-200 bg-red-50 text-red-900',
}

export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <RadixToast.Provider>
      {children}
      <RadixToast.Viewport className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80" />
    </RadixToast.Provider>
  )
}

export function Toast({ message, type = 'info', durationMs = 4000, open, onOpenChange, className, style }: ToastProps): React.ReactElement {
  return (
    <RadixToast.Root
      open={open}
      onOpenChange={onOpenChange}
      duration={durationMs}
      style={style}
      className={cn(
        'flex items-start gap-3 rounded-md border p-4 shadow-md',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        variantMap[type],
        className,
      )}
    >
      <RadixToast.Description className="text-sm">{message}</RadixToast.Description>
      <RadixToast.Close className="ml-auto shrink-0 rounded hover:opacity-70" aria-label="Close">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </RadixToast.Close>
    </RadixToast.Root>
  )
}
