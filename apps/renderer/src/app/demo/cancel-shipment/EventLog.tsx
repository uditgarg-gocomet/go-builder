'use client'

// ── Event log for the demo route ─────────────────────────────────────────────
// Subscribes to the three eventBus events the widget emits and renders them
// in a small panel so the demo viewer can see exactly what fires when.

import React, { useState, useCallback } from 'react'
import { useSubscribe } from '@/lib/events/eventBridge'

interface LogEntry {
  id: string
  timestamp: string
  event: string
  payload: unknown
}

const EVENT_NAMES = [
  'cancel-shipment:success',
  'cancel-shipment:error',
  'cancel-shipment:cancel',
] as const

export function EventLog(): React.ReactElement {
  const [entries, setEntries] = useState<LogEntry[]>([])

  const append = useCallback((event: string, payload: unknown): void => {
    setEntries(prev =>
      [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date().toLocaleTimeString(),
          event,
          payload,
        },
        ...prev,
      ].slice(0, 20),
    )
  }, [])

  // One useSubscribe per event — the hook's deps array intentionally excludes
  // the handler reference, so each subscription stays stable for its lifetime.
  useSubscribe(EVENT_NAMES[0], payload => append(EVENT_NAMES[0], payload))
  useSubscribe(EVENT_NAMES[1], payload => append(EVENT_NAMES[1], payload))
  useSubscribe(EVENT_NAMES[2], payload => append(EVENT_NAMES[2], payload))

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <p className="text-sm font-semibold text-foreground">Event Bus Log</p>
          <p className="text-[11px] text-muted-foreground">
            Live tap on cancel-shipment:success / :error / :cancel
          </p>
        </div>
        {entries.length > 0 && (
          <button
            type="button"
            onClick={() => setEntries([])}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
      {entries.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">
          No events yet — open the modal and submit, dismiss, or fail to see entries.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {entries.map(entry => (
            <li key={entry.id} className="px-4 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <code
                  className={[
                    'font-mono text-[11px] font-semibold rounded px-1.5 py-0.5',
                    entry.event === 'cancel-shipment:success'
                      ? 'bg-green-100 text-green-800'
                      : entry.event === 'cancel-shipment:error'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800',
                  ].join(' ')}
                >
                  {entry.event}
                </code>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {entry.timestamp}
                </span>
              </div>
              <pre className="mt-1.5 overflow-x-auto rounded bg-muted/50 px-2 py-1 font-mono text-[11px] text-foreground/80">
                {JSON.stringify(entry.payload, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
