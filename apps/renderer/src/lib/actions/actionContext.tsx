'use client'

import React, { createContext, useContext, type ReactNode } from 'react'
import type { PageSchema } from '@portal/core'

interface ActionContextValue {
  execute: (actionId: string, params?: Record<string, unknown>) => Promise<void>
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

// Full ActionExecutor wiring implemented in Session 6.4
// For Session 6.2 this provides a no-op execute stub
export function ActionProvider({ children }: ActionProviderProps): React.ReactElement {
  async function execute(_actionId: string, _params?: Record<string, unknown>): Promise<void> {
    // No-op stub — wired to ActionExecutor in Session 6.4
  }

  return (
    <ActionCtx.Provider value={{ execute }}>
      {children}
    </ActionCtx.Provider>
  )
}

export function useActionContext(): ActionContextValue {
  return useContext(ActionCtx)
}
