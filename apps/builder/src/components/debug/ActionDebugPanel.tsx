'use client'

import React, { useState, useEffect, useCallback } from 'react'

import { clientFetch } from '@/lib/clientFetch'

const POLL_INTERVAL_MS = 3000

interface ActionLogEntry {
  id: string
  actionId: string
  actionName: string
  actionType: string
  status: 'SUCCESS' | 'ERROR'
  durationMs: number
  correlationId: string | null
  error: string | null
  executedAt: string
  metadata?: Record<string, unknown>
}

interface ActionDebugPanelProps {
  appId: string
  pageId: string | null
}

export function ActionDebugPanel({ appId, pageId }: ActionDebugPanelProps): React.ReactElement {
  const [logs, setLogs] = useState<ActionLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const fetchLogs = useCallback(async (): Promise<void> => {
    const params = new URLSearchParams({ appId, limit: '20' })
    if (pageId) params.set('pageId', pageId)

    try {
      const data = await clientFetch<{ logs: ActionLogEntry[] }>(`/action-logs?${params}`)
      setLogs(data.logs ?? [])
    } catch { /* non-critical polling */ }
  }, [appId, pageId])

  // Initial load
  useEffect(() => {
    setLoading(true)
    void fetchLogs().finally(() => setLoading(false))
  }, [fetchLogs])

  // Poll every 3s
  useEffect(() => {
    const id = setInterval(() => { void fetchLogs() }, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchLogs])

  const toggleExpand = (id: string): void => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Action Debug</h3>
        <button
          type="button"
          onClick={() => void fetchLogs()}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ↺
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-xs text-muted-foreground">No action logs yet.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {logs.map(log => (
            <div
              key={log.id}
              className={`rounded border text-xs ${
                log.status === 'ERROR'
                  ? 'border-destructive/30 bg-destructive/5'
                  : 'border-border bg-background'
              }`}
            >
              {/* Row header */}
              <button
                type="button"
                onClick={() => toggleExpand(log.id)}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
              >
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(log.executedAt).toLocaleTimeString()}
                </span>
                <span className={`font-medium ${log.status === 'ERROR' ? 'text-destructive' : 'text-foreground'}`}>
                  {log.actionName}
                </span>
                <span className="rounded bg-secondary px-1 py-0.5 text-[9px] text-secondary-foreground shrink-0">
                  {log.actionType}
                </span>
                <span className={`ml-auto shrink-0 ${log.status === 'ERROR' ? 'text-destructive' : 'text-green-600'}`}>
                  {log.status === 'ERROR' ? '✗' : '✓'}
                </span>
                <span className="shrink-0 text-muted-foreground">{log.durationMs}ms</span>
                <span className="shrink-0 text-muted-foreground/50">{expanded.has(log.id) ? '▾' : '▸'}</span>
              </button>

              {/* Expanded detail */}
              {expanded.has(log.id) && (
                <div className="border-t border-border px-2 py-2 space-y-1">
                  {log.correlationId && (
                    <p className="text-[10px] text-muted-foreground font-mono">
                      correlationId: {log.correlationId}
                    </p>
                  )}
                  {log.error && (
                    <p className="text-[10px] text-destructive">{log.error}</p>
                  )}
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <pre className="max-h-32 overflow-auto rounded bg-muted p-1.5 text-[10px] text-foreground">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
