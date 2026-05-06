import { useCallback } from 'react'
import type { ActionBinding } from '@portal/core'

export type ActionExecutor = (actionId: string, params?: Record<string, unknown>) => Promise<void>

export function useActionBinding(
  binding: ActionBinding | undefined,
  executor: ActionExecutor | undefined,
): (() => void) | undefined {
  return useCallback(() => {
    if (!binding || !executor) return
    void executor(binding.actionId, binding.params)
  }, [binding, executor])
}
