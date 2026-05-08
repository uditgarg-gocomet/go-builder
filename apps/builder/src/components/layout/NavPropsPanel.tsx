'use client'

import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import type { NavConfig, NavItem, PageNavItem, UrlNavItem, CustomNavItem, NavGroupItem } from '@portal/core'
import { useAppStore, DEFAULT_NAV_CONFIG } from '@/stores/appStore'
import { usePageStore } from '@/stores/pageStore'
import { useLayoutSelectionStore } from '@/stores/layoutSelectionStore'
import { useSaveStatusStore } from '@/stores/saveStatusStore'
import { clientFetch } from '@/lib/clientFetch'

const SAVE_DEBOUNCE_MS = 800
const SAVE_SLOT_KEY = 'chrome:nav'

interface NavPropsPanelProps {
  appId: string
}

// Form-driven nav editor. Two views:
//   - The config view (position, style, collapsible + item list with "+ New"
//     and reorder/delete per row)
//   - The item view (overlaid on config) — edits a single nav item's fields
//
// Which view is shown is driven by useLayoutSelectionStore:
//   selection.kind === 'nav'          → config view
//   selection.kind === 'nav-item'     → item view (Back button returns to nav)

export function NavPropsPanel({ appId }: NavPropsPanelProps): React.ReactElement {
  const selection = useLayoutSelectionStore(s => s.selection)
  const selectNav = useLayoutSelectionStore(s => s.selectNav)
  const clearSelection = useLayoutSelectionStore(s => s.clear)

  const nav = useAppStore(s => s.navConfig)
  const setNav = useAppStore(s => s.setNavConfig)
  const updateNav = useAppStore(s => s.updateNavConfig)
  const setItems = useAppStore(s => s.setNavItems)
  const setSlot = useSaveStatusStore(s => s.setSlot)

  const pages = usePageStore(s => s.pages)
  const userGroups = useAppStore(s => s.userGroups)

  const effective: NavConfig = nav ?? DEFAULT_NAV_CONFIG

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<string>(JSON.stringify(effective))

  const scheduleSave = useCallback((next: NavConfig | null) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const fingerprint = JSON.stringify(next)
    if (fingerprint === lastSavedRef.current) return
    setSlot(SAVE_SLOT_KEY, { status: 'saving', lastSavedAt: undefined, warning: undefined })
    timerRef.current = setTimeout(() => {
      void clientFetch(`/apps/${appId}/nav`, {
        method: 'PATCH',
        body: JSON.stringify({ nav: next }),
      }).then(() => {
        lastSavedRef.current = fingerprint
        setSlot(SAVE_SLOT_KEY, { status: 'saved', lastSavedAt: new Date(), warning: undefined })
      }).catch(() => {
        setSlot(SAVE_SLOT_KEY, { status: 'error', lastSavedAt: undefined, warning: undefined })
      })
    }, SAVE_DEBOUNCE_MS)
  }, [appId, setSlot])

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const patchNav = (updates: Partial<NavConfig>): void => {
    const next: NavConfig = { ...effective, ...updates }
    updateNav(updates)
    scheduleSave(next)
  }

  const replaceItems = (items: NavItem[]): void => {
    setItems(items)
    scheduleSave({ ...effective, items })
  }

  // ── Item ops ───────────────────────────────────────────────────────────────

  const findItemAndParent = (items: NavItem[], id: string): { item: NavItem | null; parentList: NavItem[] | null } => {
    for (const item of items) {
      if (item.id === id) return { item, parentList: items }
      if (item.kind === 'group') {
        const found = findItemAndParent(item.children, id)
        if (found.item) return found
      }
    }
    return { item: null, parentList: null }
  }

  const addItem = (item: NavItem): void => {
    replaceItems([...effective.items, item])
  }

  const updateItem = (id: string, updates: Partial<NavItem>): void => {
    const next = patchItemInTree(effective.items, id, updates)
    replaceItems(next)
  }

  const removeItem = (id: string): void => {
    const next = removeItemFromTree(effective.items, id)
    replaceItems(next)
  }

  const moveItem = (id: string, delta: -1 | 1): void => {
    const next = moveItemInList(effective.items, id, delta)
    replaceItems(next)
  }

  // ── Selected item (for item view) ─────────────────────────────────────────

  const selectedItem = useMemo(() => {
    if (selection.kind !== 'nav-item') return null
    return findItemAndParent(effective.items, selection.itemId).item
  }, [selection, effective.items])

  // ── Render ────────────────────────────────────────────────────────────────

  if (selection.kind === 'nav-item' && selectedItem) {
    return (
      <NavItemEditor
        item={selectedItem}
        userGroups={userGroups.map(g => g.name)}
        pages={pages.map(p => ({ slug: p.slug, name: p.name }))}
        onBack={selectNav}
        onChange={updates => updateItem(selectedItem.id, updates)}
        onDelete={() => {
          removeItem(selectedItem.id)
          selectNav()
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 w-80 shrink-0 border-l border-border bg-card overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Navigation</h3>
        <button
          type="button"
          onClick={clearSelection}
          className="text-xs text-muted-foreground hover:text-foreground"
          title="Close"
        >
          ✕
        </button>
      </div>

      <Toggle
        label="Show navigation"
        value={effective.enabled}
        onChange={() => {
          if (effective.enabled) {
            const next: NavConfig = { ...effective, enabled: false }
            setNav(next)
            scheduleSave(next)
          } else {
            const next: NavConfig = { ...DEFAULT_NAV_CONFIG, ...(nav ?? {}), enabled: true }
            setNav(next)
            scheduleSave(next)
          }
        }}
      />

      {effective.enabled && (
        <>
          <Field label="Position">
            <div className="grid grid-cols-2 gap-1">
              {(['top', 'side'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => patchNav({ position: p })}
                  className={`rounded border px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                    effective.position === p
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Style">
            <select
              value={effective.style}
              onChange={e => patchNav({ style: e.target.value as NavConfig['style'] })}
              className="w-full rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="text-and-icon">Text and icon</option>
              <option value="text">Text</option>
              <option value="icon">Icon</option>
            </select>
          </Field>

          <Field label="Collapsible">
            <div className="grid grid-cols-2 gap-1">
              {([['true', true], ['false', false]] as const).map(([label, v]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => patchNav({ collapsible: v })}
                  className={`rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
                    effective.collapsible === v
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {label === 'true' ? 'True' : 'False'}
                </button>
              ))}
            </div>
          </Field>

          <Divider label="Items" />

          {/* Items list */}
          <div className="flex flex-col gap-1.5">
            {effective.items.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No items yet. Add a page, URL, or custom link below.
              </p>
            ) : (
              effective.items.map((item, idx) => (
                <NavItemRow
                  key={item.id}
                  item={item}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < effective.items.length - 1}
                  onMove={delta => moveItem(item.id, delta)}
                  onRemove={() => removeItem(item.id)}
                />
              ))
            )}
          </div>

          <AddItemMenu
            pages={pages.map(p => ({ slug: p.slug, name: p.name }))}
            onAdd={addItem}
          />
        </>
      )}

      <p className="mt-4 text-[10px] text-muted-foreground/70">
        Changes are saved automatically. Navigation renders across all pages of the app.
      </p>
    </div>
  )
}

// ── Row with label + move + edit + delete ────────────────────────────────────

function NavItemRow({
  item,
  canMoveUp,
  canMoveDown,
  onMove,
  onRemove,
}: {
  item: NavItem
  canMoveUp: boolean
  canMoveDown: boolean
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
}): React.ReactElement {
  const selectNavItem = useLayoutSelectionStore(s => s.selectNavItem)
  const kindLabel: Record<NavItem['kind'], string> = {
    page: 'Page',
    url: 'URL',
    custom: 'Custom',
    group: 'Group',
  }

  return (
    <div
      className="flex items-center gap-1 rounded border border-border bg-background px-2 py-1.5 cursor-pointer hover:border-primary/50"
      onClick={() => selectNavItem(item.id)}
    >
      <div className="flex-1 min-w-0">
        <div className="truncate text-sm text-foreground">{item.label || <em className="opacity-60">Untitled</em>}</div>
        <div className="text-[10px] text-muted-foreground">{kindLabel[item.kind]}</div>
      </div>
      <button
        type="button"
        disabled={!canMoveUp}
        onClick={e => { e.stopPropagation(); onMove(-1) }}
        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed px-1"
        title="Move up"
      >
        ↑
      </button>
      <button
        type="button"
        disabled={!canMoveDown}
        onClick={e => { e.stopPropagation(); onMove(1) }}
        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed px-1"
        title="Move down"
      >
        ↓
      </button>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onRemove() }}
        className="text-xs text-destructive hover:opacity-70 px-1"
        title="Delete"
      >
        ✕
      </button>
    </div>
  )
}

// ── Add item menu ───────────────────────────────────────────────────────────

function AddItemMenu({
  pages,
  onAdd,
}: {
  pages: { slug: string; name: string }[]
  onAdd: (item: NavItem) => void
}): React.ReactElement {
  const [open, setOpen] = React.useState(false)

  const makeId = (): string => crypto.randomUUID()

  const addPage = (slug: string, name: string): void => {
    const item: PageNavItem = { kind: 'page', id: makeId(), label: name, pageSlug: slug }
    onAdd(item)
    setOpen(false)
  }
  const addUrl = (): void => {
    const item: UrlNavItem = { kind: 'url', id: makeId(), label: 'New link', url: 'https://', external: true }
    onAdd(item)
    setOpen(false)
  }
  const addCustom = (): void => {
    const item: CustomNavItem = { kind: 'custom', id: makeId(), label: 'New custom', customRoute: '/' }
    onAdd(item)
    setOpen(false)
  }
  const addGroup = (): void => {
    const item: NavGroupItem = { kind: 'group', id: makeId(), label: 'New group', children: [] }
    onAdd(item)
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded border border-dashed border-border bg-transparent px-3 py-2 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
      >
        + New item
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1 rounded border border-border bg-background p-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Page</p>
      {pages.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No pages yet.</p>
      ) : (
        pages.map(p => (
          <button
            key={p.slug}
            type="button"
            onClick={() => addPage(p.slug, p.name)}
            className="text-left text-xs rounded px-2 py-1 hover:bg-accent"
          >
            {p.name} <span className="text-muted-foreground/70">/{p.slug}</span>
          </button>
        ))
      )}
      <div className="h-px bg-border my-1" />
      <button type="button" onClick={addUrl} className="text-left text-xs rounded px-2 py-1 hover:bg-accent">URL link</button>
      <button type="button" onClick={addCustom} className="text-left text-xs rounded px-2 py-1 hover:bg-accent">Custom</button>
      <button type="button" onClick={addGroup} className="text-left text-xs rounded px-2 py-1 hover:bg-accent">Group</button>
      <div className="h-px bg-border my-1" />
      <button type="button" onClick={() => setOpen(false)} className="text-left text-xs rounded px-2 py-1 text-muted-foreground hover:text-foreground">Cancel</button>
    </div>
  )
}

// ── Item editor (the nested form overlaid on nav config) ─────────────────────

function NavItemEditor({
  item,
  userGroups,
  pages,
  onBack,
  onChange,
  onDelete,
}: {
  item: NavItem
  userGroups: string[]
  pages: { slug: string; name: string }[]
  onBack: () => void
  onChange: (updates: Partial<NavItem>) => void
  onDelete: () => void
}): React.ReactElement {
  const requireGroups = item.visibility?.requireGroups ?? []

  const toggleGroup = (groupName: string): void => {
    const next = requireGroups.includes(groupName)
      ? requireGroups.filter(g => g !== groupName)
      : [...requireGroups, groupName]
    onChange({
      visibility: next.length > 0 ? { requireGroups: next } : undefined,
    } as Partial<NavItem>)
  }

  return (
    <div className="flex flex-col gap-4 p-4 w-80 shrink-0 border-l border-border bg-card overflow-y-auto">
      {/* Header with back */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground text-sm"
          title="Back to navigation"
        >
          ←
        </button>
        <h3 className="flex-1 text-sm font-semibold text-foreground">New nav item</h3>
        <button
          type="button"
          onClick={onDelete}
          className="text-xs text-destructive hover:opacity-70"
          title="Delete item"
        >
          ✕
        </button>
      </div>

      <Field label="Label">
        <input
          type="text"
          value={item.label}
          onChange={e => onChange({ label: e.target.value } as Partial<NavItem>)}
          className="w-full rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      </Field>

      <Field label="Icon">
        <input
          type="text"
          value={item.icon ?? ''}
          onChange={e => onChange({ icon: e.target.value || undefined } as Partial<NavItem>)}
          placeholder="icon name (e.g. home, settings)"
          className="w-full rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      </Field>

      {/* Kind-specific fields */}
      {item.kind === 'page' && (
        <Field label="Page">
          <select
            value={item.pageSlug}
            onChange={e => onChange({ pageSlug: e.target.value } as Partial<NavItem>)}
            className="w-full rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
          >
            {pages.map(p => <option key={p.slug} value={p.slug}>{p.name} (/{p.slug})</option>)}
          </select>
        </Field>
      )}

      {item.kind === 'url' && (
        <>
          <Field label="URL">
            <input
              type="url"
              value={item.url}
              onChange={e => onChange({ url: e.target.value } as Partial<NavItem>)}
              className="w-full rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={item.external}
              onChange={() => onChange({ external: !item.external } as Partial<NavItem>)}
              className="accent-primary"
            />
            Open in new tab
          </label>
        </>
      )}

      {item.kind === 'custom' && (
        <Field label="Custom route">
          <input
            type="text"
            value={item.customRoute}
            onChange={e => onChange({ customRoute: e.target.value } as Partial<NavItem>)}
            className="w-full rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </Field>
      )}

      {item.kind === 'group' && (
        <p className="text-xs text-muted-foreground italic">
          Groups contain nested items. Nested item editing is coming in a later release.
        </p>
      )}

      <Divider label="Visibility" />

      {userGroups.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No user groups configured. Add groups in App Settings → User Groups to gate this item.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground mb-1">
            Show only for users in at least one of these groups (leave all unchecked to show to everyone):
          </p>
          {userGroups.map(g => (
            <label key={g} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={requireGroups.includes(g)}
                onChange={() => toggleGroup(g)}
                className="accent-primary"
              />
              {g}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tree helpers ─────────────────────────────────────────────────────────────

function patchItemInTree(items: NavItem[], id: string, updates: Partial<NavItem>): NavItem[] {
  return items.map(item => {
    if (item.id === id) return { ...item, ...updates } as NavItem
    if (item.kind === 'group') {
      return { ...item, children: patchItemInTree(item.children, id, updates) }
    }
    return item
  })
}

function removeItemFromTree(items: NavItem[], id: string): NavItem[] {
  const filtered: NavItem[] = []
  for (const item of items) {
    if (item.id === id) continue
    if (item.kind === 'group') {
      filtered.push({ ...item, children: removeItemFromTree(item.children, id) })
    } else {
      filtered.push(item)
    }
  }
  return filtered
}

function moveItemInList(items: NavItem[], id: string, delta: -1 | 1): NavItem[] {
  // Only moves within the top-level list. Nested groups don't support reorder yet.
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return items
  const next = [...items]
  const targetIdx = idx + delta
  if (targetIdx < 0 || targetIdx >= next.length) return items
  const [moved] = next.splice(idx, 1)
  if (moved) next.splice(targetIdx, 0, moved)
  return next
}

// ── Shared form primitives ──────────────────────────────────────────────────

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
