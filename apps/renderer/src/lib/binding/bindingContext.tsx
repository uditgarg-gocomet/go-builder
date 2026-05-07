'use client'

import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { BindingContext, PageSchema } from '@portal/core'
import { DataSourceResolver } from '../data/dataSourceResolver.js'
import { PollingManager } from '../data/pollingManager.js'

interface BindingContextValue {
  context: BindingContext
  resolver: DataSourceResolver | null
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
  resolver: null,
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

export function BindingProvider({
  schema,
  urlParams,
  sessionToken,
  userId,
  userEmail,
  userGroups,
  appId: _appId,
  children,
}: BindingProviderProps): React.ReactElement {
  // State slots initialised from schema defaults
  const [stateSlots, setStateSlots] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {}
    for (const slot of schema.state) {
      initial[slot.name] = slot.defaultValue
    }
    return initial
  })

  const [formState, setFormState] = useState<BindingContext['form']>({})
  const [datasource, setDatasource] = useState<Record<string, unknown>>({})

  const resolverRef = useRef<DataSourceResolver | null>(null)
  const pollingRef = useRef<PollingManager | null>(null)

  // Build full BindingContext (used in render + passed to polling)
  const context: BindingContext = {
    datasource,
    params: urlParams,
    user: userId
      ? { id: userId, email: userEmail ?? '', groups: userGroups ?? [] }
      : undefined,
    env: (process.env['NEXT_PUBLIC_APP_ENVIRONMENT'] as 'STAGING' | 'PRODUCTION' | undefined) ?? 'STAGING',
    state: stateSlots,
    form: formState,
  }

  // Keep a ref to context so polling closures see fresh state
  const contextRef = useRef(context)
  contextRef.current = context

  function updateState(key: string, value: unknown): void {
    setStateSlots(prev => ({ ...prev, [key]: value }))
  }

  function updateForm(formId: string, formStateUpdate: BindingContext['form'][string]): void {
    setFormState(prev => ({ ...prev, [formId]: formStateUpdate }))
  }

  // Initialise resolver + polling on mount; re-initialise when schema/token change
  useEffect(() => {
    if (!sessionToken || schema.dataSources.length === 0) return

    const token = sessionToken

    const resolver = new DataSourceResolver(token, (alias, data) => {
      setDatasource(prev => ({ ...prev, [alias]: data }))
    })
    resolverRef.current = resolver

    // Initial fetch — resolve all data sources in dependency order
    void resolver.resolvePageDataSources(schema.dataSources, urlParams)

    // Start polling for sources with polling config
    const polling = new PollingManager()
    pollingRef.current = polling
    polling.start(
      schema.dataSources,
      resolver,
      urlParams,
      () => contextRef.current,
    )

    return () => {
      polling.stop()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken, schema.pageId])

  return (
    <BindingCtx.Provider
      value={{ context, resolver: resolverRef.current, updateState, updateForm }}
    >
      {children}
    </BindingCtx.Provider>
  )
}

export function useBindingContext(): BindingContextValue {
  return useContext(BindingCtx)
}
