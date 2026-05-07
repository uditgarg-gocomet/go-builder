'use client'

import React, { useState } from 'react'
import type { HeaderConfig } from '@portal/core'
import { eventBus } from '@portal/action-runtime'
import { useAuth } from '@/lib/auth/authContext'

// Runtime app header. Reads its config at mount; doesn't change shape per
// page (consistent across the app). Search submits fire `header:search`
// events on the eventBus — consumers wire an action to handle them.

interface AppHeaderProps {
  config: HeaderConfig
  appSlug: string
  // Resolve a logo asset id to a URL via the assets endpoint (content-addressed).
  logoUrl?: string | undefined
}

export function AppHeader({ config, appSlug, logoUrl }: AppHeaderProps): React.ReactElement | null {
  const { user, logout } = useAuth()
  const [query, setQuery] = useState('')

  if (!config.enabled) return null

  const onSearchSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    eventBus.emit('header:search', { query })
  }

  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b bg-card">
      {config.showLogo && logoUrl && (
        <img src={logoUrl} alt="" className="h-8 w-auto shrink-0" />
      )}
      {config.showLogo && !logoUrl && (
        <div className="h-8 w-8 rounded bg-muted shrink-0" aria-hidden />
      )}
      {config.showAppTitle && (
        <span className="text-sm font-semibold text-foreground truncate">
          {config.title || appSlug}
        </span>
      )}

      {config.globalSearch.enabled && (
        <form onSubmit={onSearchSubmit} className="mx-4 max-w-md flex-1">
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={config.globalSearch.placeholder || 'Search…'}
            className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </form>
      )}

      <div className="flex-1" />

      {config.showUserMenu && user && (
        <UserMenu user={user} onLogout={() => void logout(appSlug)} />
      )}
    </header>
  )
}

// ── User menu ────────────────────────────────────────────────────────────────

function UserMenu({ user, onLogout }: { user: { email: string; id: string }; onLogout: () => void }): React.ReactElement {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded px-2 py-1 hover:bg-accent"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-medium">
          {(user.email || user.id).charAt(0).toUpperCase()}
        </div>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-56 rounded border border-border bg-card shadow-md z-50 py-1">
            <div className="px-3 py-2 text-xs text-muted-foreground truncate border-b border-border">
              {user.email || user.id}
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
            >
              Log out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
