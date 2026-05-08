'use client'

import React, { useState, useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { useRegistryStore } from '@/stores/registryStore'
import type { RegistryEntry } from '@portal/core'

const CATEGORIES = ['Layout', 'Data', 'Input', 'Action', 'Feedback', 'Typography', 'Display', 'Wired']

// The /registry/entries API returns `currentVersionDetails` (single), but the
// shared RegistryEntry type still declares `versions?: []`. Read both so
// either runtime shape works.
function pickVersion(entry: RegistryEntry): { displayName?: string; category?: string } | null {
  const e = entry as RegistryEntry & {
    currentVersionDetails?: { displayName?: string; category?: string }
  }
  if (e.currentVersionDetails) return e.currentVersionDetails
  if (e.versions && e.versions.length > 0) {
    return e.versions.find(v => v.version === e.currentVersion) ?? e.versions[0] ?? null
  }
  return null
}

interface ComponentTileProps {
  entry: RegistryEntry
}

function ComponentTile({ entry }: ComponentTileProps): React.ReactElement {
  const version = pickVersion(entry)
  const displayName = version?.displayName ?? entry.name
  const category = version?.category ?? ''

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `panel-${entry.name}`,
    data: { source: 'panel', type: entry.name, category },
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex cursor-grab items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:border-primary/50 hover:bg-accent/50 active:cursor-grabbing transition-all ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <svg className="h-4 w-4 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
      </svg>
      <span className="truncate text-xs font-medium text-foreground">{displayName}</span>
    </div>
  )
}

export function ComponentPanel(): React.ReactElement {
  const entries = useRegistryStore(s => s.entries)
  const isLoading = useRegistryStore(s => s.isLoading)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return entries.filter(entry => {
      const version = pickVersion(entry)
      const displayName = version?.displayName ?? entry.name
      const category = version?.category ?? ''

      const matchesSearch = search === '' ||
        displayName.toLowerCase().includes(search.toLowerCase()) ||
        entry.name.toLowerCase().includes(search.toLowerCase())

      const matchesCategory = activeCategory === null || category === activeCategory

      return matchesSearch && matchesCategory && entry.status === 'ACTIVE'
    })
  }, [entries, search, activeCategory])

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="border-b border-border p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Components</h2>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search components…"
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border p-2">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className={`shrink-0 rounded px-2 py-0.5 text-xs transition-colors ${
            activeCategory === null
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent'
          }`}
        >
          All
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
            className={`shrink-0 rounded px-2 py-0.5 text-xs transition-colors ${
              activeCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">No components found</p>
        ) : (
          <div className="flex flex-col gap-1">
            {filtered.map(entry => (
              <ComponentTile key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
