'use client'

import React, { useState, useEffect } from 'react'
import { usePageStore } from '@/stores/pageStore'

import { clientFetch } from '@/lib/clientFetch'

type BumpType = 'patch' | 'minor' | 'major'
type Environment = 'staging' | 'production'
type BuildStatus = 'idle' | 'PENDING' | 'BUILDING' | 'SUCCESS' | 'FAILED'

interface PageVersion {
  id: string
  version: string
  status: string
  changelog: string | null
  createdAt: string
}

interface PromoteDialogProps {
  appId: string
  userId: string
  onClose: () => void
}

function bumpVersion(version: string, bump: BumpType): string {
  const parts = version.split('.').map(Number)
  const [major = 0, minor = 0, patch = 0] = parts
  if (bump === 'major') return `${major + 1}.0.0`
  if (bump === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

export function PromoteDialog({ appId, userId, onClose }: PromoteDialogProps): React.ReactElement {
  const activePageId = usePageStore(s => s.activePageId)

  const [currentVersion, setCurrentVersion] = useState<PageVersion | null>(null)
  const [draftVersionId, setDraftVersionId] = useState<string | null>(null)
  const [bumpType, setBumpType] = useState<BumpType>('patch')
  const [env, setEnv] = useState<Environment>('staging')
  const [changelog, setChangelog] = useState('')
  const [buildStatus, setBuildStatus] = useState<BuildStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [promoting, setPromoting] = useState(false)

  // Load history to find current draft
  useEffect(() => {
    if (!activePageId) return
    void (async () => {
      try {
        const data = await clientFetch<{ versions: PageVersion[] }>(`/schema/${activePageId}/history`)
        const draft = data.versions.find(v => v.status === 'DRAFT')
        const published = data.versions.find(v => v.status === 'PUBLISHED' || v.status === 'STAGED')
        setDraftVersionId(draft?.id ?? null)
        setCurrentVersion(draft ?? published ?? data.versions[0] ?? null)
      } catch { /* non-critical */ }
    })()
  }, [activePageId])

  const newVersion = currentVersion ? bumpVersion(currentVersion.version, bumpType) : '0.1.0'

  const handlePromote = async (): Promise<void> => {
    if (!draftVersionId) { setError('No draft version to promote. Save the canvas first.'); return }
    if (!changelog.trim()) { setError('Changelog is required.'); return }

    setPromoting(true)
    setError(null)
    setBuildStatus('PENDING')

    try {
      const path = env === 'staging'
        ? `/schema/${draftVersionId}/promote/staging`
        : `/schema/${draftVersionId}/promote/production`

      const data = await clientFetch<{ deployment?: { id: string } }>(path, {
        method: 'POST',
        body: JSON.stringify({ bumpType, changelog: changelog.trim(), promotedBy: userId }),
      })

      setBuildStatus('BUILDING')

      const deploymentId = data.deployment?.id
      if (deploymentId) {
        const poll = setInterval(() => {
          void clientFetch<{ status?: string }>(`/apps/${appId}/deployment/${deploymentId}`)
            .then(dData => {
              const s = dData.status ?? ''
              if (s === 'SUCCESS' || s === 'FAILED') {
                setBuildStatus(s as BuildStatus)
                clearInterval(poll)
              }
            })
            .catch(() => undefined)
        }, 2000)
      } else {
        setBuildStatus('SUCCESS')
      }
    } catch {
      setError('Network error')
      setBuildStatus('idle')
    } finally {
      setPromoting(false)
    }
  }

  const done = buildStatus === 'SUCCESS' || buildStatus === 'FAILED'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Publish Version</h2>
          <button type="button" onClick={onClose} className="text-xl text-muted-foreground hover:text-foreground">×</button>
        </div>

        {/* Current version */}
        {currentVersion && (
          <div className="rounded border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Current: <span className="font-mono font-medium text-foreground">v{currentVersion.version}</span>
            <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px]">{currentVersion.status}</span>
          </div>
        )}

        {/* Bump selector */}
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Version bump</p>
          <div className="flex gap-2">
            {(['patch', 'minor', 'major'] as BumpType[]).map(b => (
              <button
                key={b}
                type="button"
                onClick={() => setBumpType(b)}
                className={`flex-1 rounded border px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                  bumpType === b
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            New version: <span className="font-mono font-medium text-foreground">v{newVersion}</span>
          </p>
        </div>

        {/* Environment */}
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Environment</p>
          <div className="flex gap-2">
            {(['staging', 'production'] as Environment[]).map(e => (
              <button
                key={e}
                type="button"
                onClick={() => setEnv(e)}
                className={`flex-1 rounded border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  env === e
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Changelog */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Changelog <span className="text-destructive">*</span>
          </label>
          <textarea
            value={changelog}
            onChange={e => setChangelog(e.target.value)}
            rows={3}
            placeholder="What changed in this version?"
            className="rounded border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>

        {/* Build status */}
        {buildStatus !== 'idle' && (
          <div className={`flex items-center gap-2 rounded border px-3 py-2 text-sm ${
            buildStatus === 'SUCCESS' ? 'border-green-500/30 bg-green-500/5 text-green-600'
            : buildStatus === 'FAILED' ? 'border-destructive/30 bg-destructive/5 text-destructive'
            : 'border-amber-500/30 bg-amber-500/5 text-amber-600'
          }`}>
            {(buildStatus === 'PENDING' || buildStatus === 'BUILDING') && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {buildStatus === 'SUCCESS' && <span>✓</span>}
            {buildStatus === 'FAILED' && <span>✗</span>}
            <span>
              {buildStatus === 'PENDING' ? 'Queued…'
                : buildStatus === 'BUILDING' ? 'Building…'
                : buildStatus === 'SUCCESS' ? 'Published successfully!'
                : 'Build failed'}
            </span>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
            {done ? 'Close' : 'Cancel'}
          </button>
          {!done && (
            <button
              type="button"
              onClick={() => void handlePromote()}
              disabled={promoting || !changelog.trim()}
              className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {promoting ? 'Publishing…' : `Publish to ${env}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
