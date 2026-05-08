'use client'

// Event log for the DRDVModal demo route — subscribes to all seven event
// channels and renders entries as they fire, colour-coded by category.

import React, { useState, useCallback } from 'react'
import { useSubscribe } from '@/lib/events/eventBridge'

interface LogEntry {
  id: string
  timestamp: string
  event: string
  payload: unknown
}

const SUCCESS_EVENTS = [
  'drdv:extraction-approved',
  'drdv:verify-success',
  'drdv:reject-success',
  'drdv:reverify-success',
  'drdv:retry-success',
] as const

const NEGATIVE_EVENTS = ['drdv:error', 'drdv:cancel'] as const

function eventColour(event: string): string {
  if (event === 'drdv:error') return 'bg-red-100 text-red-800'
  if (event === 'drdv:cancel') return 'bg-amber-100 text-amber-800'
  if (event === 'drdv:reject-success') return 'bg-orange-100 text-orange-800'
  return 'bg-green-100 text-green-800'
}

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
      ].slice(0, 30),
    )
  }, [])

  // One useSubscribe per event channel
  useSubscribe(SUCCESS_EVENTS[0], p => append(SUCCESS_EVENTS[0], p))
  useSubscribe(SUCCESS_EVENTS[1], p => append(SUCCESS_EVENTS[1], p))
  useSubscribe(SUCCESS_EVENTS[2], p => append(SUCCESS_EVENTS[2], p))
  useSubscribe(SUCCESS_EVENTS[3], p => append(SUCCESS_EVENTS[3], p))
  useSubscribe(SUCCESS_EVENTS[4], p => append(SUCCESS_EVENTS[4], p))
  useSubscribe(NEGATIVE_EVENTS[0], p => append(NEGATIVE_EVENTS[0], p))
  useSubscribe(NEGATIVE_EVENTS[1], p => append(NEGATIVE_EVENTS[1], p))

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <p className="text-sm font-semibold text-foreground">Event Bus Log</p>
          <p className="text-[11px] text-muted-foreground">
            7 channels: extraction-approved · verify · reject · reverify · retry · error · cancel
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
          No events yet — open a row's modal and step through it to see entries.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {entries.map(entry => (
            <li key={entry.id} className="px-4 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <code
                  className={`font-mono text-[11px] font-semibold rounded px-1.5 py-0.5 ${eventColour(entry.event)}`}
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
