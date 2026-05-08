'use client'

import React, { useState } from 'react'
import { ThemePanel } from './ThemePanel'
import { IdPPanel } from './IdPPanel'
import { UserGroupPanel } from './UserGroupPanel'
import { AssetPanel } from './AssetPanel'
import { MembersPanel } from './MembersPanel'
import { useAppStore } from '@/stores/appStore'
import { usePageStore } from '@/stores/pageStore'
import { JsonViewer } from '@/components/debug/JsonViewer'

import { clientFetch } from '@/lib/clientFetch'

type Tab = 'general' | 'theme' | 'auth' | 'groups' | 'assets' | 'members' | 'json'

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'theme', label: 'Theme' },
  { id: 'auth', label: 'Authentication' },
  { id: 'groups', label: 'User Groups' },
  { id: 'assets', label: 'Assets' },
  { id: 'members', label: 'Members' },
  { id: 'json', label: 'JSON' },
]

interface AppSettingsModalProps {
  appId: string
  onClose: () => void
}

function GeneralPanel({ appId }: { appId: string }): React.ReactElement {
  const currentApp = useAppStore(s => s.app)
  const [name, setName] = useState(currentApp?.name ?? '')
  const [slug, setSlug] = useState(currentApp?.slug ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      await clientFetch(`/apps/${appId}`, { method: 'PATCH', body: JSON.stringify({ name, slug }) })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-foreground">General</h3>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">App Name</span>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className="rounded border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Slug</span>
        <input
          value={slug}
          onChange={e => setSlug(e.target.value)}
          className="rounded border border-input bg-background px-3 py-1.5 font-mono text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      </label>
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="self-start rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
      </button>
    </div>
  )
}

/**
 * Read-only inspector for the app's client-side state. Renders whatever is
 * currently in the app + page stores — useful for sanity-checking what gets
 * persisted and for grabbing config snapshots when filing bugs.
 *
 * Note: this is intentionally local store state only. It does not refetch
 * from the backend, so values reflect what the builder is about to save, not
 * necessarily what's on disk.
 */
function JsonPanel({ appId }: { appId: string }): React.ReactElement {
  const app = useAppStore(s => s.app)
  const pages = usePageStore(s => s.pages)
  const activePageId = usePageStore(s => s.activePageId)

  const value = {
    appId,
    app,
    pages,
    activePageId,
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div>
        <h3 className="text-sm font-semibold text-foreground">App Configuration</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Live snapshot of the app + page stores. Read-only.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border">
        <JsonViewer value={value} />
      </div>
    </div>
  )
}

export function AppSettingsModal({ appId, onClose }: AppSettingsModalProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('general')

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleBackdropClick}
    >
      <div className="flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold text-foreground">App Settings</h2>
          <button type="button" onClick={onClose} className="text-xl text-muted-foreground hover:text-foreground">×</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Tab sidebar */}
          <nav className="flex w-40 shrink-0 flex-col gap-1 border-r border-border p-3">
            {TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded px-3 py-2 text-left text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === 'general' && <GeneralPanel appId={appId} />}
            {activeTab === 'theme' && <ThemePanel appId={appId} />}
            {activeTab === 'auth' && <IdPPanel appId={appId} />}
            {activeTab === 'groups' && <UserGroupPanel appId={appId} />}
            {activeTab === 'assets' && <AssetPanel appId={appId} />}
            {activeTab === 'members' && <MembersPanel appId={appId} />}
            {activeTab === 'json' && <JsonPanel appId={appId} />}
          </div>
        </div>
      </div>
    </div>
  )
}
