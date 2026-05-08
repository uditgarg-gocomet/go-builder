'use client'

import React, { useState, useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { useRegistryStore } from '@/stores/registryStore'
import type { RegistryEntry, RegistryEntryVersion, ComponentType } from '@portal/core'
import { ComponentIcon } from '@/lib/componentIcons'

// Preferred render order for groups. Anything not listed here falls to the
// end in alphabetical order, so new groups added on the backend still show up
// without a code change here.
const GROUP_ORDER = ['Buttons', 'Data', 'Inputs', 'Layouts', 'Feedback', 'Typography']

type PanelTab = 'components' | 'widgets' | 'views'

const TAB_TYPE_MAP: Record<PanelTab, ComponentType> = {
  components: 'PRIMITIVE',
  widgets: 'CUSTOM_WIDGET',
  views: 'PREBUILT_VIEW',
}

const TAB_LABELS: Record<PanelTab, string> = {
  components: 'Components',
  widgets: 'Widgets',
  views: 'Views',
}

const TABS: PanelTab[] = ['components', 'widgets', 'views']

interface EnrichedEntry {
  entry: RegistryEntry
  version: RegistryEntryVersion | null
  displayName: string
  group: string
  icon: string | null
}

// The /registry/entries API returns `currentVersionDetails` (single field),
// but older callers / the shared type still expose `versions: []`. Read both
// so either runtime shape works.
function pickVersion(entry: RegistryEntry): RegistryEntryVersion | null {
  const e = entry as RegistryEntry & {
    currentVersionDetails?: RegistryEntryVersion
  }
  if (e.currentVersionDetails) return e.currentVersionDetails
  if (entry.versions && entry.versions.length > 0) {
    return entry.versions.find(v => v.version === entry.currentVersion) ?? entry.versions[0] ?? null
  }
  return null
}

function enrich(entry: RegistryEntry): EnrichedEntry {
  const version = pickVersion(entry)
  const displayName = version?.displayName ?? entry.name
  // Fall back to `category` if no explicit group is set — keeps older registry
  // rows (pre-group migration) usable without blocking the UI.
  const group = version?.group ?? version?.category ?? 'Other'
  const icon = version?.icon ?? null
  return { entry, version, displayName, group, icon }
}

function groupEntries(enriched: EnrichedEntry[]): Array<[string, EnrichedEntry[]]> {
  const byGroup = new Map<string, EnrichedEntry[]>()
  for (const item of enriched) {
    const list = byGroup.get(item.group) ?? []
    list.push(item)
    byGroup.set(item.group, list)
  }
  const orderedKnown = GROUP_ORDER.filter(g => byGroup.has(g))
  const extras = Array.from(byGroup.keys())
    .filter(g => !GROUP_ORDER.includes(g))
    .sort()
  return [...orderedKnown, ...extras].map(g => {
    const items = byGroup.get(g)!
    items.sort((a, b) => a.displayName.localeCompare(b.displayName))
    return [g, items] as [string, EnrichedEntry[]]
  })
}

interface ComponentTileProps {
  item: EnrichedEntry
}

function ComponentTile({ item }: ComponentTileProps): React.ReactElement {
  const { entry, displayName, group, icon } = item
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `panel-${entry.name}`,
    data: { source: 'panel', type: entry.name, category: item.version?.category ?? '' },
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      title={displayName}
      className={`group relative flex cursor-grab flex-col items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2 py-3 text-center transition-all hover:border-primary/50 hover:bg-accent/50 active:cursor-grabbing ${
        isDragging ? 'opacity-40' : ''
      }`}
      aria-label={`${displayName} (${group})`}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-muted-foreground group-hover:text-foreground">
        <ComponentIcon name={icon} className="h-5 w-5" />
      </div>
      <span className="line-clamp-2 text-[11px] font-medium text-foreground">
        {displayName}
      </span>
    </div>
  )
}

interface GroupSectionProps {
  name: string
  items: EnrichedEntry[]
  expanded: boolean
  onToggle: () => void
}

function GroupSection({ name, items, expanded, onToggle }: GroupSectionProps): React.ReactElement {
  return (
    <section className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent/30"
        aria-expanded={expanded}
      >
        <span className="text-xs font-semibold text-foreground">{name}</span>
        <svg
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? '' : '-rotate-90'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <polyline strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} points="6 9 12 15 18 9" />
        </svg>
      </button>
      {expanded ? (
        <div className="grid grid-cols-2 gap-2 px-3 pb-3">
          {items.map(item => (
            <ComponentTile key={item.entry.id} item={item} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

export function ComponentPanel(): React.ReactElement {
  const entries = useRegistryStore(s => s.entries)
  const isLoading = useRegistryStore(s => s.isLoading)
  const [activeTab, setActiveTab] = useState<PanelTab>('components')
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [panelCollapsed, setPanelCollapsed] = useState(false)

  const grouped = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const typeFilter = TAB_TYPE_MAP[activeTab]

    const enriched = entries
      .filter(e => e.status === 'ACTIVE' && e.type === typeFilter)
      .map(enrich)
      .filter(item => {
        if (!needle) return true
        const tags = item.version?.tags ?? []
        return (
          item.displayName.toLowerCase().includes(needle) ||
          item.entry.name.toLowerCase().includes(needle) ||
          tags.some(t => t.toLowerCase().includes(needle))
        )
      })

    return groupEntries(enriched)
  }, [entries, search, activeTab])

  const toggle = (group: string) =>
    setCollapsed(prev => ({ ...prev, [group]: !prev[group] }))

  const isExpanded = (group: string): boolean => collapsed[group] !== true
  const totalMatches = grouped.reduce((sum, [, items]) => sum + items.length, 0)

  if (panelCollapsed) {
    return (
      <div className="flex h-full w-9 shrink-0 flex-col items-center border-r border-border bg-card py-2">
        <button
          type="button"
          onClick={() => setPanelCollapsed(false)}
          title="Expand panel"
          aria-label="Expand panel"
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <polyline strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} points="9 18 15 12 9 6" />
          </svg>
        </button>
        <span
          className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          style={{ writingMode: 'vertical-rl' }}
        >
          {TAB_LABELS[activeTab]}
        </span>
      </div>
    )
  }

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-card">
      <div className="border-b border-border px-3 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Library
          </h2>
          <button
            type="button"
            onClick={() => setPanelCollapsed(true)}
            title="Collapse panel"
            aria-label="Collapse panel"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <polyline strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>
        <div className="mb-3 flex rounded-md border border-border bg-muted p-0.5">
          {TABS.map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => { setActiveTab(tab); setSearch('') }}
              className={`flex-1 rounded py-1 text-[11px] font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${TAB_LABELS[activeTab].toLowerCase()}…`}
          className="mb-3 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : totalMatches === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No {TAB_LABELS[activeTab].toLowerCase()} found
          </p>
        ) : (
          grouped.map(([group, items]) => (
            <GroupSection
              key={group}
              name={group}
              items={items}
              expanded={isExpanded(group)}
              onToggle={() => toggle(group)}
            />
          ))
        )}
      </div>
    </div>
  )
}
