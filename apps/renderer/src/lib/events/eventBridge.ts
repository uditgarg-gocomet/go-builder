'use client'

import { useEffect } from 'react'
import { eventBus } from '@portal/action-runtime'

export { eventBus }

export function useEmit(eventName: string): (payload: unknown) => void {
  return (payload: unknown) => {
    eventBus.emit(eventName, payload)
  }
}

export function useSubscribe(
  eventName: string,
  handler: (payload: unknown) => void,
): void {
  useEffect(() => {
    const unsubscribe = eventBus.on(eventName, handler)
    return unsubscribe
    // handler intentionally excluded — callers should memoize if needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventName])
}
