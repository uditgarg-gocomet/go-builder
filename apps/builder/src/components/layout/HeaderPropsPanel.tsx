'use client'

import React, { useCallback, useEffect, useRef } from 'react'
import type { HeaderConfig } from '@portal/core'
import { useAppStore, DEFAULT_HEADER_CONFIG } from '@/stores/appStore'
import { useLayoutSelectionStore } from '@/stores/layoutSelectionStore'
import { clientFetch } from '@/lib/clientFetch'

const SAVE_DEBOUNCE_MS = 800

interface HeaderPropsPanelProps {
  appId: string
}

// Form-driven editor for the app-level header. Auto-saves on change via a
// debounced PATCH /apps/:id/header. No revert / undo for now — all edits are
// committed to the DRAFT draft state (latest-wins, like the existing theme
// editor).
export function HeaderPropsPanel({ appId }: HeaderPropsPanelProps): React.ReactElement {
  const header = useAppStore(s => s.headerConfig)
  const setHeader = useAppStore(s => s.setHeaderConfig)
  const updateHeader = useAppStore(s => s.updateHeaderConfig)
  const clearSelection = useLayoutSelectionStore(s => s.clear)

  const effective: HeaderConfig = header ?? DEFAULT_HEADER_CONFIG

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<string>(JSON.stringify(effective))

  const scheduleSave = useCallback((next: HeaderConfig | null) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const fingerprint = JSON.stringify(next)
    if (fingerprint === lastSavedRef.current) return
    timerRef.current = setTimeout(() => {
      void clientFetch(`/apps/${appId}/header`, {
        method: 'PATCH',
        body: JSON.stringify({ header: next }),
      }).then(() => {
        lastSavedRef.current = fingerprint
      }).catch(() => {
        /* non-critical — next save attempt will retry */
      })
    }, SAVE_DEBOUNCE_MS)
  }, [appId])

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const patch = (updates: Partial<HeaderConfig>): void => {
    const next: HeaderConfig = { ...effective, ...updates }
    updateHeader(updates)
    scheduleSave(next)
  }

  const toggleEnabled = (): void => {
    // Turning off the header saves null — the renderer treats that as "no
    // header". Turning on reinstates the default config.
    if (header?.enabled) {
      const next = { ...effective, enabled: false }
      setHeader(next)
      scheduleSave(next)
    } else {
      const next = { ...DEFAULT_HEADER_CONFIG, ...(header ?? {}), enabled: true }
      setHeader(next)
      scheduleSave(next)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 w-80 shrink-0 border-l border-border bg-card overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">App Header</h3>
        <button
          type="button"
          onClick={clearSelection}
          className="text-xs text-muted-foreground hover:text-foreground"
          title="Close"
        >
          ✕
        </button>
      </div>

      <Toggle label="Show app header" value={effective.enabled} onChange={toggleEnabled} />

      {effective.enabled && (
        <>
          <Divider label="App header" />

          <Toggle
            label="Show app title"
            value={effective.showAppTitle}
            onChange={() => patch({ showAppTitle: !effective.showAppTitle })}
          />

          <Toggle
            label="Show logo"
            value={effective.showLogo}
            onChange={() => patch({ showLogo: !effective.showLogo })}
          />

          <Field label="Title">
            <input
              type="text"
              value={effective.title ?? ''}
              onChange={e => patch({ title: e.target.value })}
              placeholder="My App"
              className="w-full rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>

          <Field label="Logo asset id">
            <input
              type="text"
              value={effective.logoAssetId ?? ''}
              onChange={e => patch({ logoAssetId: e.target.value || undefined })}
              placeholder="Asset id (use Assets panel to upload)"
              className="w-full rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>

          <Divider label="Global search" />

          <Toggle
            label="Show global search"
            value={effective.globalSearch.enabled}
            onChange={() => patch({
              globalSearch: { ...effective.globalSearch, enabled: !effective.globalSearch.enabled },
            })}
          />

          {effective.globalSearch.enabled && (
            <Field label="Search placeholder">
              <input
                type="text"
                value={effective.globalSearch.placeholder ?? ''}
                onChange={e => patch({
                  globalSearch: {
                    ...effective.globalSearch,
                    placeholder: e.target.value || undefined,
                  },
                })}
                placeholder="Search…"
                className="w-full rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
          )}

          <Divider label="User menu" />

          <Toggle
            label="Show user menu"
            value={effective.showUserMenu}
            onChange={() => patch({ showUserMenu: !effective.showUserMenu })}
          />
        </>
      )}

      <p className="mt-4 text-[10px] text-muted-foreground/70">
        Changes are saved automatically. The header renders across all pages of the app.
      </p>
    </div>
  )
}

// ── Small form primitives (local to keep the panel self-contained) ──────────

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }): React.ReactElement {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-foreground">{label}</span>
      <button
        type="button"
        onClick={onChange}
        role="switch"
        aria-checked={value}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
          value ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-background shadow-sm transition-transform mt-0.5 ${
            value ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function Divider({ label }: { label: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}
