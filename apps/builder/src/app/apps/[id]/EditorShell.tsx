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
import { remapSubtreeIds, type Subtree } from '@/lib/schema/remapSubtreeIds'
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
import { CanvasJsonPanel } from '@/components/debug/CanvasJsonPanel'
import { CanvasChrome } from '@/components/layout/CanvasChrome'
import { HeaderPropsPanel } from '@/components/layout/HeaderPropsPanel'
import { NavPropsPanel } from '@/components/layout/NavPropsPanel'
import { PageMenu } from '@/components/layout/PageMenu'
import { useLayoutSelectionStore } from '@/stores/layoutSelectionStore'
import { useSaveStatusStore, mergeSlots } from '@/stores/saveStatusStore'
import { usePreviewTab } from '@/hooks/usePreviewTab'
import { clientFetch } from '@/lib/clientFetch'
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

  // Bulk setters for page-level schema pieces — hydrated from the fetched
  // draft so downstream consumers (autosave, preview, binding suggestions)
  // see the real page state rather than an empty store.
  const setDataSources = useAppStore(s => s.setDataSources)
  const setActions = useAppStore(s => s.setActions)
  const setForms = useAppStore(s => s.setForms)
  const setStateSlots = useAppStore(s => s.setStateSlots)

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
    // Also clear app-store page-level lists so stale sources/actions/forms
    // from the previous page don't leak into the new page's autosave.
    setDataSources([])
    setActions([])
    setForms([])
    setStateSlots([])
    void (async () => {
      try {
        const data = await clientFetch<{ schema?: PageSchema }>(`/schema/${activePageId}/draft`)
        if (data.schema?.layout) {
          loadCanvas(deserializeSchemaToCanvas(data.schema))
          // Hydrate page-level pieces from the schema so preview + autosave
          // + binding suggestions all see the real values. Without this the
          // store stays empty after navigating to a pre-built page, and
          // any preview ships with no mock data.
          setDataSources(data.schema.dataSources ?? [])
          setActions(data.schema.actions ?? [])
          setForms(data.schema.forms ?? [])
          setStateSlots(data.schema.state ?? [])
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
  // The canvas JSON inspector is a right-sidebar view (mutually exclusive with
  // settings / history / props editor). Toggling it from the header mirrors
  // the existing pattern for those panels.
  const [jsonOpen, setJsonOpen] = useState(false)

  // Auto-save (page canvas). Also writes into useSaveStatusStore so chrome
  // edits can surface in the same top-right indicator.
  const { saveNow } = useAutoSave(userId)
  const saveSlots = useSaveStatusStore(s => s.slots)
  const mergedSave = mergeSlots(saveSlots)

  // Preview — opens a new tab rendering the current canvas with inline mock
  // data. No publish required, no Redis TTL to worry about at demo time
  // (session is 1h).
  const { opening: previewOpening, openPreview } = usePreviewTab()

  // Keyboard shortcuts
  useKeyboardShortcuts({ onSave: () => void saveNow() })

  // Drag-and-drop
  const addNode = useCanvasStore(s => s.addNode)
  const moveNode = useCanvasStore(s => s.moveNode)
  const insertSubtree = useCanvasStore(s => s.insertSubtree)
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

    const activeData = active.data.current as { source: string; type?: string; nodeId?: string } | undefined
    const overData = over?.data.current as { parentId?: string; position?: number } | undefined

    // Resolve drop target with a graceful fallback: if the drag ended outside
    // any registered droppable (over === null) OR landed on the canvas-surface
    // fallback (position === -1 sentinel), append to the root's children. This
    // makes the canvas feel "always droppable" instead of dead-ending the drag
    // when the user releases over whitespace between components.
    const currentRootId = rootId || useCanvasStore.getState().rootId
    const childMap = useCanvasStore.getState().childMap

    const isFallbackDrop =
      !over ||
      overData?.position === -1

    const parentId = isFallbackDrop
      ? currentRootId
      : (overData?.parentId ?? currentRootId)
    const position = isFallbackDrop
      ? (childMap[currentRootId]?.length ?? 0)
      : (overData?.position ?? (childMap[parentId]?.length ?? 0))

    // For canvas-internal moves, a fallback drop (whitespace release) is a
    // no-op — the user almost certainly didn't mean to relocate the node to
    // the very end of the root. Bail out instead of moving silently.
    if (isFallbackDrop && activeData?.source === 'canvas') return

    if (activeData?.source === 'panel' && activeData.type) {
      const entry = useRegistryStore.getState().entries.find(e => e.name === activeData.type)

      // Prebuilt views are *templates* — dropping one expands its stored node
      // tree onto the canvas as fresh, independent components. Each drop gets
      // freshly minted IDs so the same view can be imported multiple times
      // without collision, and post-import edits don't leak back to the
      // template.
      if (entry?.type === 'PREBUILT_VIEW') {
        const versionDetails = (entry as typeof entry & {
          currentVersionDetails?: { viewSchema?: unknown }
        }).currentVersionDetails
        const raw = versionDetails?.viewSchema as Partial<Subtree> | undefined
        if (raw && raw.nodes && raw.rootId && raw.childMap) {
          const remapped = remapSubtreeIds(raw as Subtree)
          if (!useCanvasStore.getState().rootId) {
            // Empty canvas: bootstrap by promoting the view's root into the
            // canvas root, then attach descendants via insertSubtree's
            // node/childMap merge (parentId of '' is fine — only the merge
            // path of insertSubtree runs, not the splice into a parent).
            useCanvasStore.setState(s => ({
              ...s,
              nodes: { ...s.nodes, ...remapped.nodes },
              childMap: { ...s.childMap, ...remapped.childMap },
              rootId: remapped.rootId,
            }))
            // Now wire parentMap for every descendant relationship.
            useCanvasStore.setState(s => {
              const parentMap = { ...s.parentMap }
              for (const [pid, children] of Object.entries(remapped.childMap)) {
                for (const cid of children) parentMap[cid] = pid
              }
              return { ...s, parentMap }
            })
          } else {
            insertSubtree(remapped, parentId, position)
          }
          return
        }
        // No viewSchema on the entry — fall through to single-node insert.
      }

      // Map the registry entry's component type to the schema's `source`
      // discriminator. Without this every widget / prebuilt view would land
      // as `primitive`, which the renderer's resolver can't dispatch.
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
  }, [rootId, addNode, moveNode, insertSubtree])

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

          <PageMenu appId={app.id} userId={userId} />
        </div>

        {/* Right: save status + actions */}
        <div className="flex shrink-0 items-center gap-2">
          <SaveStatusIndicator status={mergedSave.status} warning={mergedSave.warning} lastSavedAt={mergedSave.lastSavedAt} />

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
            onClick={() => setJsonOpen(o => !o)}
            title="Inspect canvas JSON"
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              jsonOpen ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            JSON
          </button>

          <button
            type="button"
            onClick={() => void openPreview()}
            disabled={previewOpening}
            title="Preview this page in a new tab with mock data"
            className="rounded border border-input px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            {previewOpening ? 'Opening…' : 'Preview ↗'}
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
          ) : jsonOpen ? (
            <CanvasJsonPanel onClose={() => setJsonOpen(false)} />
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
