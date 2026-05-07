'use client'

import React, { createContext, useContext, type ReactNode } from 'react'
import type { BindingContext, PageSchema } from '@portal/core'

interface BindingContextValue {
  context: BindingContext
  updateState: (key: string, value: unknown) => void
  updateForm: (formId: string, state: BindingContext['form'][string]) => void
}

const defaultBindingContext: BindingContext = {
  datasource: {},
  params: {},
  user: undefined,
  env: undefined,
  state: {},
  form: {},
}

const BindingCtx = createContext<BindingContextValue>({
  context: defaultBindingContext,
  updateState: () => undefined,
  updateForm: () => undefined,
})

export interface BindingProviderProps {
  schema: PageSchema
  urlParams: Record<string, string>
  sessionToken?: string
  userId?: string
  userEmail?: string
  userGroups?: string[]
  appId?: string
  children: ReactNode
}

// Full data fetching + polling implemented in Session 6.3
// For Session 6.2 this provides the context shape with static data only
export function BindingProvider({
  schema,
  urlParams,
  userId,
  userEmail,
  userGroups,
  appId: _appId,
  children,
}: BindingProviderProps): React.ReactElement {
  const [state, setState] = React.useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {}
    for (const slot of schema.state) {
      initial[slot.name] = slot.defaultValue
    }
    return initial
  })

  const [formState, setFormState] = React.useState<BindingContext['form']>({})

  const context: BindingContext = {
    datasource: {},
    params: urlParams,
    user: userId
      ? { id: userId, email: userEmail ?? '', groups: userGroups ?? [] }
      : undefined,
    env: (process.env['NEXT_PUBLIC_APP_ENVIRONMENT'] as 'STAGING' | 'PRODUCTION' | undefined) ?? 'STAGING',
    state,
    form: formState,
  }

  function updateState(key: string, value: unknown): void {
    setState(prev => ({ ...prev, [key]: value }))
  }

  function updateForm(formId: string, formStateUpdate: BindingContext['form'][string]): void {
    setFormState(prev => ({ ...prev, [formId]: formStateUpdate }))
  }

  return (
    <BindingCtx.Provider value={{ context, updateState, updateForm }}>
      {children}
    </BindingCtx.Provider>
  )
}

export function useBindingContext(): BindingContextValue {
  return useContext(BindingCtx)
}
