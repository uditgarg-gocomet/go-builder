'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { usePageStore } from '@/stores/pageStore'
import { useCanvasStore } from '@/stores/canvasStore'
import { deserializeSchemaToCanvas } from '@/lib/schema/deserialize'
import type { PageSchema } from '@portal/core'
import { clientFetch } from '@/lib/clientFetch'

// ── Types ────────────────────────────────────────────────────────────────────

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

interface DraftSnapshot {
  id: string
  nodeCount: number
  size: number
  label: string | null
  createdBy: string
  createdAt: string
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-secondary text-secondary-foreground',
  STAGED: 'bg-blue-100 text-blue-700',
  PUBLISHED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-muted text-muted-foreground',
  ROLLED_BACK: 'bg-amber-100 text-amber-700',
}

type Tab = 'published' | 'autosave'

interface VersionHistoryPanelProps {
  userId: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.max(0, now - then)
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ── Panel ────────────────────────────────────────────────────────────────────

export function VersionHistoryPanel({ userId }: VersionHistoryPanelProps): React.ReactElement {
  const activePageId = usePageStore(s => s.activePageId)
  const loadCanvas = useCanvasStore(s => s.loadCanvas)

  const [tab, setTab] = useState<Tab>('published')

  // Published versions
  const [versions, setVersions] = useState<PageVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [diffVersionId, setDiffVersionId] = useState<string | null>(null)
  const [diffData, setDiffData] = useState<unknown>(null)
  const [rollbackTarget, setRollbackTarget] = useState<PageVersion | null>(null)
  const [rollingBack, setRollingBack] = useState(false)

  // Auto-save snapshots
  const [snapshots, setSnapshots] = useState<DraftSnapshot[]>([])
  const [loadingSnapshots, setLoadingSnapshots] = useState(false)
  const [restoreTarget, setRestoreTarget] = useState<DraftSnapshot | null>(null)
  const [restoring, setRestoring] = useState(false)

  const fetchHistory = useCallback(async (): Promise<void> => {
    if (!activePageId) return
    setLoadingVersions(true)
    try {
      const data = await clientFetch<{ versions: PageVersion[] }>(`/schema/${activePageId}/history`)
      setVersions(data.versions ?? [])
    } finally {
      setLoadingVersions(false)
    }
  }, [activePageId])

  const fetchSnapshots = useCallback(async (): Promise<void> => {
    if (!activePageId) return
    setLoadingSnapshots(true)
    try {
      const data = await clientFetch<{ snapshots: DraftSnapshot[] }>(
        `/schema/${activePageId}/draft/history`,
      )
      setSnapshots(data.snapshots ?? [])
    } finally {
      setLoadingSnapshots(false)
    }
  }, [activePageId])

  // Fetch the active tab's data on mount + when the page changes
  useEffect(() => {
    if (tab === 'published') void fetchHistory()
    else void fetchSnapshots()
  }, [tab, fetchHistory, fetchSnapshots])

  // ── Published version handlers ─────────────────────────────────────────────

  const handleDiff = async (version: PageVersion): Promise<void> => {
    if (!activePageId) return
    if (diffVersionId === version.id) {
      setDiffVersionId(null)
      setDiffData(null)
      return
    }

    const published = versions.find(v => v.status === 'PUBLISHED')
    if (!published || published.id === version.id) {
      setDiffVersionId(version.id)
      setDiffData(null)
      return
    }

    setDiffVersionId(version.id)
    try {
      const data = await clientFetch<unknown>(
        `/schema/${activePageId}/diff?from=${published.id}&to=${version.id}`,
      )
      setDiffData(data)
    } catch {
      /* non-critical */
    }
  }

  const handleRollback = async (): Promise<void> => {
    if (!rollbackTarget || !activePageId) return
    setRollingBack(true)
    try {
      await clientFetch(`/schema/${activePageId}/rollback`, {
        method: 'POST',
        body: JSON.stringify({
          targetVersionId: rollbackTarget.id,
          rolledBackBy: userId,
        }),
      })
      setRollbackTarget(null)
      await fetchHistory()
    } finally {
      setRollingBack(false)
    }
  }

  // ── Auto-save snapshot handlers ────────────────────────────────────────────

  const handleRestore = async (): Promise<void> => {
    if (!restoreTarget || !activePageId) return
    setRestoring(true)
    try {
      // Restore on the backend — the server upserts the DRAFT and captures the
      // current state as a snapshot before overwriting (so this is reversible).
      await clientFetch(`/schema/${activePageId}/draft/restore`, {
        method: 'POST',
        body: JSON.stringify({
          snapshotId: restoreTarget.id,
          restoredBy: userId,
        }),
      })

      // Pull the new draft back down and reload the canvas so the user sees
      // the restored state immediately without a page refresh.
      const data = await clientFetch<{ schema?: PageSchema }>(
        `/schema/${activePageId}/draft`,
      )
      if (data.schema?.layout) {
        loadCanvas(deserializeSchemaToCanvas(data.schema))
      }

      setRestoreTarget(null)
      await fetchSnapshots()
    } finally {
      setRestoring(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!activePageId) {
    return <p className="text-xs text-muted-foreground p-3">No page selected.</p>
  }

  return (
    <div className="flex flex-col gap-3 p-3 w-80 shrink-0 border-l border-border bg-card overflow-y-auto">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border -mx-3 px-3 pb-2">
        <button
          type="button"
          onClick={() => setTab('published')}
          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            tab === 'published'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          Published
        </button>
        <button
          type="button"
          onClick={() => setTab('autosave')}
          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            tab === 'autosave'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          Auto-save
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => (tab === 'published' ? void fetchHistory() : void fetchSnapshots())}
          className="text-xs text-muted-foreground hover:text-foreground"
          title="Refresh"
        >
          ↺
        </button>
      </div>

      {tab === 'published' ? (
        // ── Published versions list ──────────────────────────────────────────
        loadingVersions ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : versions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No versions yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {versions.map(v => (
              <div
                key={v.id}
                className="flex flex-col gap-1 rounded border border-border bg-background p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-foreground">
                      v{v.version}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        STATUS_COLORS[v.status] ?? 'bg-muted text-muted-foreground'
                      }`}
                    >
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

                {diffVersionId === v.id && diffData !== null && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-[10px] text-foreground">
                    {JSON.stringify(diffData, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        // ── Auto-save snapshots list ─────────────────────────────────────────
        loadingSnapshots ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : snapshots.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            <p>No auto-save history yet.</p>
            <p className="mt-2 text-muted-foreground/70">
              Snapshots are captured before each save overwrites the draft. Each
              page keeps the last 50 edits.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {snapshots.map((s, idx) => (
              <div
                key={s.id}
                className="flex flex-col gap-1 rounded border border-border bg-background p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {idx === 0 ? 'Most recent' : `#${idx + 1}`}
                    </span>
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
                      {s.nodeCount} {s.nodeCount === 1 ? 'node' : 'nodes'}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">
                      {formatSize(s.size)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRestoreTarget(s)}
                    className="text-xs text-primary hover:opacity-70"
                  >
                    Restore
                  </button>
                </div>

                {s.label && (
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                )}

                <p className="text-[10px] text-muted-foreground/70">
                  {formatRelative(s.createdAt)} · {new Date(s.createdAt).toLocaleString()}
                  {s.createdBy && ` · by ${s.createdBy}`}
                </p>
              </div>
            ))}
          </div>
        )
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
              <button
                type="button"
                onClick={() => setRollbackTarget(null)}
                className="rounded px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
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

      {/* Restore confirmation */}
      {restoreTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-2xl">
            <h3 className="font-semibold text-foreground">Restore auto-save</h3>
            <p className="text-sm text-muted-foreground">
              Replace the current draft with this snapshot ({restoreTarget.nodeCount}{' '}
              nodes, {formatSize(restoreTarget.size)})?
            </p>
            <p className="text-xs text-muted-foreground/70">
              Your current draft will itself be captured as a new snapshot, so
              this is reversible.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                className="rounded px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRestore()}
                disabled={restoring}
                className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {restoring ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
