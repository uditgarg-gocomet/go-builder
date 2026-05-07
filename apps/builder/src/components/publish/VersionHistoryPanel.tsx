'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { usePageStore } from '@/stores/pageStore'

const BACKEND_URL = typeof window !== 'undefined'
  ? (process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001')
  : 'http://localhost:3001'

interface PageVersion {
  id: string
  version: string
  status: string
  changelog: string | null
  createdBy: string
  createdAt: string
  promotedAt: string | null
  promotedBy: string | null
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-secondary text-secondary-foreground',
  STAGED: 'bg-blue-100 text-blue-700',
  PUBLISHED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-muted text-muted-foreground',
  ROLLED_BACK: 'bg-amber-100 text-amber-700',
}

interface VersionHistoryPanelProps {
  userId: string
}

export function VersionHistoryPanel({ userId }: VersionHistoryPanelProps): React.ReactElement {
  const activePageId = usePageStore(s => s.activePageId)
  const [versions, setVersions] = useState<PageVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [diffVersionId, setDiffVersionId] = useState<string | null>(null)
  const [diffData, setDiffData] = useState<unknown>(null)
  const [rollbackTarget, setRollbackTarget] = useState<PageVersion | null>(null)
  const [rollingBack, setRollingBack] = useState(false)

  const fetchHistory = useCallback(async (): Promise<void> => {
    if (!activePageId) return
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/schema/${activePageId}/history`, { credentials: 'include' })
      if (res.ok) {
        const data = (await res.json()) as { versions: PageVersion[] }
        setVersions(data.versions ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [activePageId])

  useEffect(() => { void fetchHistory() }, [fetchHistory])

  const handleDiff = async (version: PageVersion): Promise<void> => {
    if (!activePageId) return
    if (diffVersionId === version.id) { setDiffVersionId(null); setDiffData(null); return }

    const published = versions.find(v => v.status === 'PUBLISHED')
    if (!published || published.id === version.id) { setDiffVersionId(version.id); setDiffData(null); return }

    setDiffVersionId(version.id)
    const res = await fetch(
      `${BACKEND_URL}/schema/${activePageId}/diff?from=${published.id}&to=${version.id}`,
      { credentials: 'include' }
    )
    if (res.ok) {
      const data = (await res.json()) as unknown
      setDiffData(data)
    }
  }

  const handleRollback = async (): Promise<void> => {
    if (!rollbackTarget || !activePageId) return
    setRollingBack(true)
    try {
      const res = await fetch(`${BACKEND_URL}/schema/${activePageId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetVersionId: rollbackTarget.id, rolledBackBy: userId }),
      })
      if (res.ok) {
        setRollbackTarget(null)
        await fetchHistory()
      }
    } finally {
      setRollingBack(false)
    }
  }

  if (!activePageId) {
    return <p className="text-xs text-muted-foreground">No page selected.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Version History</h3>
        <button type="button" onClick={() => void fetchHistory()}
          className="text-xs text-muted-foreground hover:text-foreground">
          ↺ Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : versions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No versions yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {versions.map(v => (
            <div key={v.id} className="flex flex-col gap-1 rounded border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-foreground">v{v.version}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[v.status] ?? 'bg-muted text-muted-foreground'}`}>
                    {v.status}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDiff(v)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {diffVersionId === v.id ? 'Hide diff' : 'View diff'}
                  </button>
                  {v.status === 'ARCHIVED' && (
                    <button
                      type="button"
                      onClick={() => setRollbackTarget(v)}
                      className="text-xs text-primary hover:opacity-70"
                    >
                      Rollback
                    </button>
                  )}
                </div>
              </div>

              {v.changelog && (
                <p className="text-xs text-muted-foreground">{v.changelog}</p>
              )}

              <p className="text-[10px] text-muted-foreground/70">
                {new Date(v.createdAt).toLocaleString()}
                {v.promotedBy && ` · promoted by ${v.promotedBy}`}
              </p>

              {/* Diff viewer */}
              {diffVersionId === v.id && diffData !== null && (
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-[10px] text-foreground">
                  {JSON.stringify(diffData, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Rollback confirmation */}
      {rollbackTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-2xl">
            <h3 className="font-semibold text-foreground">Confirm Rollback</h3>
            <p className="text-sm text-muted-foreground">
              Roll back to <span className="font-mono font-medium">v{rollbackTarget.version}</span>?
              The current published version will be archived.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRollbackTarget(null)}
                className="rounded px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRollback()}
                disabled={rollingBack}
                className="rounded bg-destructive px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {rollingBack ? 'Rolling back…' : 'Confirm Rollback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
