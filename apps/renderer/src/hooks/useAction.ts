'use client'

import { useCallback } from 'react'
import type { ActionBinding } from '@portal/core'
import { useActionContext } from '../lib/actions/actionContext.js'

export function useAction(
  binding: ActionBinding | undefined,
): (() => void) | undefined {
  const { execute } = useActionContext()

  return useCallback(() => {
    if (!binding) return
    void execute(
      binding.actionId,
      binding.params as Record<string, unknown> | undefined,
    )
  }, [binding, execute])
}
