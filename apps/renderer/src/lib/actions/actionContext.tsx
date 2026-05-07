'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  ActionExecutor,
  StateManager,
  FormManager,
  eventBus,
} from '@portal/action-runtime'
import type {
  ConfirmManager,
  DataResolver,
  ModalManager,
  ToastManager,
} from '@portal/action-runtime'
import type { PageSchema } from '@portal/core'
import { useBindingContext } from '../binding/bindingContext.js'

// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastItem {
  id: string
  title: string
  description?: string
  variant?: string
}

function useToastManager(): { manager: ToastManager; toasts: ToastItem[]; dismiss: (id: string) => void } {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const manager: ToastManager = {
    show({ title, description, variant, duration }) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setToasts(prev => [...prev, { id, title, description, variant }])
      const ttl = duration ?? 4000
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, ttl)
    },
  }

  function dismiss(id: string): void {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return { manager, toasts, dismiss }
}

// ── ActionContext ─────────────────────────────────────────────────────────────

interface ActionContextValue {
  // `triggerArgs` is the first argument the component passes to the trigger
  // callback (e.g. the `row` object in DataTable.onRowClick). It's exposed in
  // action-config templates as `{{event.<field>}}`.
  execute: (actionId: string, params?: Record<string, unknown>, triggerArgs?: unknown) => Promise<void>
}

const ActionCtx = createContext<ActionContextValue>({
  execute: async () => undefined,
})

export interface ActionProviderProps {
  schema: PageSchema
  sessionToken?: string
  appId?: string
  pageId?: string
  userId?: string
  children: ReactNode
}

export function ActionProvider({
  schema,
  sessionToken,
  appId,
  pageId,
  userId,
  children,
}: ActionProviderProps): React.ReactElement {
  const router = useRouter()
  const { context: bindingContext, resolver, updateState, updateForm } = useBindingContext()
  const { manager: toastManager, toasts, dismiss } = useToastManager()

  const executorRef = useRef<ActionExecutor | null>(null)

  // Re-initialise executor when token or schema changes
  useEffect(() => {
    const stateInitial: Record<string, unknown> = {}
    for (const slot of schema.state) {
      stateInitial[slot.name] = slot.defaultValue
    }

    const stateManager = new StateManager(stateInitial, updatedState => {
      for (const [key, val] of Object.entries(updatedState)) {
        updateState(key, val)
      }
    })

    const formManager = new FormManager()
    formManager.initialize(schema.forms, (formId, formState) => {
      // Sync FormState → BindingContext.form shape
      const values: Record<string, unknown> = {}
      const errors: Record<string, string> = {}
      const touched: Record<string, boolean> = {}
      for (const [fieldName, field] of Object.entries(formState.fields)) {
        values[fieldName] = field.value
        if (field.error) errors[fieldName] = field.error
        touched[fieldName] = field.touched
      }
      updateForm(formId, {
        values,
        errors,
        isValid: formState.isValid,
        isDirty: Object.values(formState.fields).some(f => f.dirty),
        touched,
      })
    })

    const modalManager: ModalManager = {
      show: (modalId: string) => eventBus.emit('modal:show', { modalId }),
      hide: (modalId: string) => eventBus.emit('modal:hide', { modalId }),
    }

    const confirmManager: ConfirmManager = {
      show: ({ title, message }) =>
        Promise.resolve(
          typeof window !== 'undefined'
            ? window.confirm(`${title}\n\n${message}`)
            : false,
        ),
    }

    const dataResolver: DataResolver = {
      resolveSourceByAlias: (alias: string) =>
        resolver?.resolveSourceByAlias(alias, schema.dataSources, {}) ??
        Promise.resolve(),
    }

    const routerAdapter = {
      push: (path: string) => router.push(path),
    }

    const executor = new ActionExecutor({
      context: {
        appId: appId ?? '',
        pageId: pageId ?? '',
        userId: userId ?? '',
        environment: (process.env['NEXT_PUBLIC_APP_ENVIRONMENT'] as 'STAGING' | 'PRODUCTION' | undefined) ?? 'STAGING',
        backendUrl: process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001',
        accessToken: sessionToken ?? '',
      },
      bindingContext: () => bindingContext,
      stateManager,
      formManager,
      modalManager,
      toastManager,
      confirmManager,
      dataResolver,
      router: routerAdapter,
      actions: schema.actions,
    })

    executorRef.current = executor
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken, schema.pageId, appId, pageId, userId])

  async function execute(
    actionId: string,
    _params?: Record<string, unknown>,
    triggerArgs?: unknown,
  ): Promise<void> {
    if (!executorRef.current) return
    await executorRef.current.execute(actionId, undefined, triggerArgs)
  }

  return (
    <ActionCtx.Provider value={{ execute }}>
      {children}
      {/* Toast overlay */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={[
                'rounded-md border px-4 py-3 shadow-md text-sm flex items-start gap-3',
                toast.variant === 'error'
                  ? 'bg-destructive text-destructive-foreground border-destructive'
                  : toast.variant === 'success'
                    ? 'bg-green-50 text-green-800 border-green-200'
                    : toast.variant === 'warning'
                      ? 'bg-yellow-50 text-yellow-800 border-yellow-200'
                      : 'bg-card text-card-foreground border-border',
              ].join(' ')}
            >
              <div className="flex-1">
                <div className="font-medium">{toast.title}</div>
                {toast.description && (
                  <div className="opacity-80 mt-0.5">{toast.description}</div>
                )}
              </div>
              <button
                onClick={() => dismiss(toast.id)}
                className="opacity-60 hover:opacity-100 transition-opacity shrink-0"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </ActionCtx.Provider>
  )
}

export function useActionContext(): ActionContextValue {
  return useContext(ActionCtx)
}
