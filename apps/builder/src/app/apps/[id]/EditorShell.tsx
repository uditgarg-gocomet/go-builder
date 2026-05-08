'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useCanvasStore } from '@/stores/canvasStore'
import { usePageStore } from '@/stores/pageStore'
import { useAppStore } from '@/stores/appStore'
import { useRegistryStore } from '@/stores/registryStore'
import { useSession } from '@/hooks/useSession'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { deserializeSchemaToCanvas } from '@/lib/schema/deserialize'
import { createNode } from '@/lib/schema/createNode'
import type { PageSchema } from '@portal/core'
import { BuilderCanvas } from '@/components/canvas/BuilderCanvas'
import { ComponentPanel } from '@/components/panel/ComponentPanel'
import { ComponentGhost } from '@/components/canvas/ComponentGhost'
import { PropsEditor } from '@/components/props/PropsEditor'
import { SettingsSidebar } from '@/components/settings/SettingsSidebar'
import { SaveStatusIndicator } from '@/components/publish/SaveStatus'
import { PromoteDialog } from '@/components/publish/PromoteDialog'
import { VersionHistoryPanel } from '@/components/publish/VersionHistoryPanel'
import { AppSettingsModal } from '@/components/app-settings/AppSettingsModal'
import { CanvasChrome } from '@/components/layout/CanvasChrome'
import { HeaderPropsPanel } from '@/components/layout/HeaderPropsPanel'
import { NavPropsPanel } from '@/components/layout/NavPropsPanel'
import { useLayoutSelectionStore } from '@/stores/layoutSelectionStore'
import { clientFetch, getCookieToken } from '@/lib/clientFetch'
import type { AppMeta, PageMeta } from '@/types/canvas'

interface EditorShellProps {
  app: AppMeta
  initialPages: PageMeta[]
  token: string
}

export function EditorShell({ app, initialPages, token }: EditorShellProps): React.ReactElement {
  const session = useSession()
  const userId = session?.userId ?? app.createdBy

  // Store initialisation
  const setApp = useAppStore(s => s.setApp)
  const setPages = usePageStore(s => s.setPages)
  const activePageId = usePageStore(s => s.activePageId)
  const pages = usePageStore(s => s.pages)
  const setActivePage = usePageStore(s => s.setActivePage)
  const fetchEntries = useRegistryStore(s => s.fetchEntries)
  const loadCanvas = useCanvasStore(s => s.loadCanvas)

  // Chrome + layout selection
  const setHeaderConfig = useAppStore(s => s.setHeaderConfig)
  const setNavConfig = useAppStore(s => s.setNavConfig)
  const setUserGroups = useAppStore(s => s.setUserGroups)
  const layoutSelection = useLayoutSelectionStore(s => s.selection)

  const resetCanvas = useCallback(() => {
    loadCanvas({ nodes: {}, rootId: '', childMap: {}, parentMap: {}, selectedNodeId: null, hoveredNodeId: null, dragState: null })
  }, [loadCanvas])

  useEffect(() => {
    setApp(app)
    setPages(initialPages)
    if (initialPages.length > 0 && initialPages[0]) {
      setActivePage(initialPages[0].id)
    }
    void fetchEntries(app.id)

    // Bootstrap chrome + user groups so the Layout panels + nav visibility
    // dropdowns are populated when the user first opens them.
    void (async () => {
      try {
        const chrome = await clientFetch<{ header: unknown | null; nav: unknown | null }>(
          `/apps/${app.id}/chrome`,
        )
        setHeaderConfig(chrome.header as never)
        setNavConfig(chrome.nav as never)
      } catch { /* non-critical */ }

      try {
        const groups = await clientFetch<{ groups: Array<{ id: string; name: string; description?: string | null; members?: string[] }> }>(
          `/apps/${app.id}/user-groups`,
        )
        setUserGroups(groups.groups.map(g => ({
          id: g.id,
          name: g.name,
          description: g.description ?? undefined,
          members: g.members,
        })))
      } catch { /* non-critical */ }
    })()
  }, [app.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load canvas state when active page changes
  useEffect(() => {
    if (!activePageId) return
    resetCanvas() // Clear immediately so canvas isn't stale while fetch is in flight
    void (async () => {
      try {
        const data = await clientFetch<{ schema?: PageSchema }>(`/schema/${activePageId}/draft`)
        if (data.schema?.layout) {
          loadCanvas(deserializeSchemaToCanvas(data.schema))
        }
        // No resetCanvas() here — already done synchronously above
      } catch {
        // Canvas already reset above; nothing more to do
      }
    })()
  }, [activePageId]) // eslint-disable-line react-hooks/exhaustive-deps

  // UI state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [appSettingsOpen, setAppSettingsOpen] = useState(false)
  const [addingPage, setAddingPage] = useState(false)
  const [newPageName, setNewPageName] = useState('')

  // Auto-save
  const { status: saveStatus, warning: saveWarning, lastSavedAt, saveNow } = useAutoSave(userId)

  // Keyboard shortcuts
  useKeyboardShortcuts({ onSave: () => void saveNow() })

  // Drag-and-drop
  const addNode = useCanvasStore(s => s.addNode)
  const moveNode = useCanvasStore(s => s.moveNode)
  const nodes = useCanvasStore(s => s.nodes)
  const rootId = useCanvasStore(s => s.rootId)
  const [activeLabel, setActiveLabel] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const handleDragStart = useCallback((event: DragStartEvent): void => {
    const data = event.active.data.current as { source: string; type?: string; nodeId?: string } | undefined
    if (data?.source === 'panel' && data.type) {
      setActiveLabel(data.type)
    } else if (data?.source === 'canvas' && data.nodeId) {
      const node = nodes[data.nodeId]
      setActiveLabel(node?.type ?? null)
    }
  }, [nodes])

  const handleDragEnd = useCallback((event: DragEndEvent): void => {
    setActiveLabel(null)
    const { active, over } = event
    if (!over) return

    const activeData = active.data.current as { source: string; type?: string; nodeId?: string } | undefined
    const overData = over.data.current as { parentId?: string; position?: number } | undefined

    const parentId = overData?.parentId ?? rootId
    const position = overData?.position ?? (useCanvasStore.getState().childMap[parentId]?.length ?? 0)

    if (activeData?.source === 'panel' && activeData.type) {
      // Map the registry entry's component type to the schema's `source`
      // discriminator. Without this every widget / prebuilt view would land
      // as `primitive`, which the renderer's resolver can't dispatch.
      const entry = useRegistryStore.getState().entries.find(e => e.name === activeData.type)
      const nodeSource: 'primitive' | 'custom_widget' | 'prebuilt_view' =
        entry?.type === 'CUSTOM_WIDGET' ? 'custom_widget'
        : entry?.type === 'PREBUILT_VIEW' ? 'prebuilt_view'
        : 'primitive'
      addNode(activeData.type, nodeSource, parentId, position, createNode(activeData.type, nodeSource, entry))
    } else if (activeData?.source === 'canvas' && activeData.nodeId) {
      if (activeData.nodeId !== parentId) {
        moveNode(activeData.nodeId, parentId, position)
      }
    }
  }, [rootId, addNode, moveNode])

  // Add a new page
  const handleAddPage = useCallback(async () => {
    if (!newPageName.trim()) return
    const slug = newPageName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    try {
      const page = await clientFetch<PageMeta>(
        `/apps/${app.id}/pages`,
        { method: 'POST', body: JSON.stringify({ name: newPageName.trim(), slug, order: pages.length, createdBy: userId }) },
        getCookieToken(),
      )
      if (!page?.id) return
      usePageStore.getState().addPage(page)
      setActivePage(page.id)
      setNewPageName('')
      setAddingPage(false)
    } catch { /* non-critical */ }
  }, [app.id, newPageName, pages.length, userId, setActivePage])

  const activePage = pages.find(p => p.id === activePageId)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* ── Top header ──────────────────────────────────────────────────────────── */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-3">
        {/* Left: back + app name + page tabs */}
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/apps"
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="All apps"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>

          <button
            type="button"
            onClick={() => setAppSettingsOpen(true)}
            className="max-w-[160px] truncate text-sm font-semibold text-foreground hover:text-primary transition-colors"
            title="App settings"
          >
            {app.name}
          </button>

          <span className="text-muted-foreground/40">›</span>

          {/* Page tabs */}
          <div className="flex items-center gap-0.5 overflow-x-auto">
            {pages.map(page => (
              <button
                key={page.id}
                type="button"
                onClick={() => setActivePage(page.id)}
                className={`shrink-0 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  activePageId === page.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {page.name}
              </button>
            ))}

            {addingPage ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={newPageName}
                  onChange={e => setNewPageName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') void handleAddPage()
                    if (e.key === 'Escape') { setAddingPage(false); setNewPageName('') }
                  }}
                  placeholder="Page name"
                  className="w-28 rounded border border-input bg-background px-2 py-0.5 text-xs outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => void handleAddPage()}
                  className="rounded px-1.5 py-0.5 text-xs text-primary hover:bg-primary/10"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingPage(false); setNewPageName('') }}
                  className="rounded px-1 py-0.5 text-xs text-muted-foreground hover:bg-accent"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingPage(true)}
                className="shrink-0 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title="Add page"
              >
                + Page
              </button>
            )}
          </div>
        </div>

        {/* Right: save status + actions */}
        <div className="flex shrink-0 items-center gap-2">
          <SaveStatusIndicator status={saveStatus} warning={saveWarning} lastSavedAt={lastSavedAt} />

          <div className="h-4 w-px bg-border" />

          <button
            type="button"
            onClick={() => setSettingsOpen(o => !o)}
            title="Page settings"
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              settingsOpen ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            Settings
          </button>

          <button
            type="button"
            onClick={() => setHistoryOpen(o => !o)}
            title="Version history"
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              historyOpen ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            History
          </button>

          <button
            type="button"
            onClick={() => setPublishOpen(true)}
            className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Publish
          </button>
        </div>
      </header>

      {/* ── Main editor area ─────────────────────────────────────────────────────── */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 overflow-hidden">
          {/* Left: component panel */}
          <ComponentPanel />

          {/* Center: canvas wrapped in app chrome preview */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {activePage ? (
              <CanvasChrome>
                <BuilderCanvas />
              </CanvasChrome>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                {pages.length === 0 ? 'Add a page to get started' : 'Select a page'}
              </div>
            )}
          </div>

          {/* Right: chrome panel > settings > history > props editor */}
          {layoutSelection.kind === 'header' ? (
            <HeaderPropsPanel appId={app.id} />
          ) : layoutSelection.kind === 'nav' || layoutSelection.kind === 'nav-item' ? (
            <NavPropsPanel appId={app.id} />
          ) : settingsOpen ? (
            <SettingsSidebar open={settingsOpen} onClose={() => setSettingsOpen(false)} />
          ) : historyOpen ? (
            <VersionHistoryPanel userId={userId} />
          ) : (
            <PropsEditor />
          )}
        </div>

        <DragOverlay>
          {activeLabel ? <ComponentGhost label={activeLabel} /> : null}
        </DragOverlay>
      </DndContext>

      {/* ── Modals ───────────────────────────────────────────────────────────────── */}
      {publishOpen && (
        <PromoteDialog
          appId={app.id}
          userId={userId}
          onClose={() => setPublishOpen(false)}
        />
      )}

      {appSettingsOpen && (
        <AppSettingsModal
          appId={app.id}
          onClose={() => setAppSettingsOpen(false)}
        />
      )}
    </div>
  )
}
