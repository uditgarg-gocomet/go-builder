'use client'

import React, { useEffect, useState } from 'react'
import type { SaveStatus } from '@/hooks/useAutoSave'

interface SaveStatusProps {
  status: SaveStatus
  warning: string | undefined
  lastSavedAt: Date | undefined
}

function useRelativeTime(date: Date | undefined): string {
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (!date) { setLabel(''); return }

    const update = (): void => {
      const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
      if (seconds < 5) setLabel('just now')
      else if (seconds < 60) setLabel(`${seconds}s ago`)
      else setLabel(`${Math.floor(seconds / 60)}m ago`)
    }

    update()
    const id = setInterval(update, 5000)
    return () => clearInterval(id)
  }, [date])

  return label
}

export function SaveStatusIndicator({ status, warning, lastSavedAt }: SaveStatusProps): React.ReactElement {
  const relativeTime = useRelativeTime(lastSavedAt)

  if (warning) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber-500" title={warning}>
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        Concurrent edit
      </span>
    )
  }

  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
        Saving…
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-destructive">
        <span className="h-2 w-2 rounded-full bg-destructive" />
        Save failed
      </span>
    )
  }

  if (status === 'saved' && lastSavedAt) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-green-500" />
        Saved {relativeTime}
      </span>
    )
  }

  return <span className="text-xs text-muted-foreground/50">Not saved</span>
}
