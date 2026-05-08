'use client'

import { useCallback, useState } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { usePageStore } from '@/stores/pageStore'
import { useAppStore } from '@/stores/appStore'
import { serializeCanvasToSchema } from '@/lib/schema/serialize'
import type { DataSourceDef } from '@portal/core'

// Opens a new-tab preview of the current page using the in-memory canvas
// (no publish required). Serializes the active page + its data sources and
// POSTs them to /api/preview/create. Mock data is sourced from any data
// source that has `mockData` — regardless of its `useMock` flag — so the
// preview always renders with static fixtures even if the live data source
// is a real connector.

interface PreviewResult {
  opening: boolean
  error: string | null
  openPreview: () => Promise<void>
}

export function usePreviewTab(): PreviewResult {
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activePageId = usePageStore(s => s.activePageId)
  const pages = usePageStore(s => s.pages)
  const app = useAppStore(s => s.app)
  const dataSources = useAppStore(s => s.dataSources)
  const actions = useAppStore(s => s.actions)
  const forms = useAppStore(s => s.forms)
  const stateSlots = useAppStore(s => s.stateSlots)

  const openPreview = useCallback(async (): Promise<void> => {
    setError(null)
    if (!app || !activePageId) {
      setError('No page selected')
      return
    }
    const activePage = pages.find(p => p.id === activePageId)
    if (!activePage) {
      setError('Active page not found')
      return
    }

    const cs = useCanvasStore.getState()
    if (!cs.rootId || !cs.nodes[cs.rootId]) {
      setError('Canvas is empty')
      return
    }

    setOpening(true)
    try {
      const canvas = {
        nodes: cs.nodes,
        childMap: cs.childMap,
        parentMap: cs.parentMap,
        rootId: cs.rootId,
        selectedNodeId: null,
        hoveredNodeId: null,
        dragState: null,
      }
      const schema = serializeCanvasToSchema(canvas, activePage, app, {
        dataSources,
        actions,
        forms,
        stateSlots,
      })

      // Extract mock data keyed by alias so the PreviewRenderer can resolve
      // `{{datasource.<alias>.<path>}}` bindings. Any data source with a
      // `mockData` field contributes — useMock is not required here because
      // the preview is inherently static.
      const mockData = extractMockDatasourceMap(dataSources)

      // Persist the session. /api/preview/create is a Next.js API route on
      // the Builder itself (not the Core Backend), so we hit it with a plain
      // same-origin fetch rather than clientFetch (which targets the backend).
      const res = await fetch('/api/preview/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: app.id,
          pageId: activePageId,
          schema,
          mockData,
        }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Failed to create preview session (${res.status}): ${text}`)
      }
      const { previewToken } = (await res.json()) as { previewToken: string }

      // Open in a new tab. noopener keeps the preview tab isolated.
      if (typeof window !== 'undefined') {
        window.open(`/preview/${previewToken}`, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open preview')
    } finally {
      setOpening(false)
    }
  }, [app, activePageId, pages, dataSources, actions, forms, stateSlots])

  return { opening, error, openPreview }
}

// Shape: { datasource: { <alias>: <mockData>, ... } }
// The PreviewRenderer resolves bindings against this object directly, so we
// mirror the production `BindingContext.datasource` structure.
function extractMockDatasourceMap(sources: DataSourceDef[]): Record<string, unknown> {
  const datasource: Record<string, unknown> = {}
  for (const ds of sources) {
    if (ds.mockData !== undefined) {
      datasource[ds.alias] = ds.mockData
    }
  }
  return { datasource }
}
