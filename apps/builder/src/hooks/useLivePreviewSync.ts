'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { usePageStore } from '@/stores/pageStore'
import { useAppStore } from '@/stores/appStore'
import { serializeCanvasToSchema } from '@/lib/schema/serialize'

const DEBOUNCE_MS = 1500

interface LivePreviewSyncResult {
  previewToken: string | null
  previewUrl: string | null
}

export function useLivePreviewSync(userId: string): LivePreviewSyncResult {
  const [previewToken, setPreviewToken] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncRef = useRef(false)

  const nodes = useCanvasStore(s => s.nodes)
  const childMap = useCanvasStore(s => s.childMap)
  const parentMap = useCanvasStore(s => s.parentMap)
  const rootId = useCanvasStore(s => s.rootId)
  const selectedNodeId = useCanvasStore(s => s.selectedNodeId)
  const hoveredNodeId = useCanvasStore(s => s.hoveredNodeId)
  const dragState = useCanvasStore(s => s.dragState)

  const activePageId = usePageStore(s => s.activePageId)
  const pages = usePageStore(s => s.pages)
  const app = useAppStore(s => s.app)
  const dataSources = useAppStore(s => s.dataSources)
  const actions = useAppStore(s => s.actions)
  const forms = useAppStore(s => s.forms)
  const stateSlots = useAppStore(s => s.stateSlots)

  const doSync = useCallback(async (): Promise<void> => {
    if (syncRef.current) return
    if (!activePageId || !app) return

    const activePage = pages.find(p => p.id === activePageId)
    if (!activePage || !rootId || !nodes[rootId]) return

    syncRef.current = true
    try {
      const canvas = { nodes, childMap, parentMap, rootId, selectedNodeId, hoveredNodeId, dragState }
      const schema = serializeCanvasToSchema(canvas, activePage, app, {
        dataSources, actions, forms, stateSlots,
      })

      const res = await fetch('/api/preview/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: app.id,
          pageId: activePageId,
          schema,
          existingToken: previewToken,
        }),
      })

      if (res.ok) {
        const data = (await res.json()) as { previewToken: string }
        setPreviewToken(data.previewToken)
      }
    } catch {
      // Silent — preview sync is non-critical
    } finally {
      syncRef.current = false
    }
  }, [
    activePageId, app, pages, rootId, nodes, childMap, parentMap,
    selectedNodeId, hoveredNodeId, dragState, dataSources, actions, forms, stateSlots, previewToken,
  ])

  useEffect(() => {
    if (!rootId || !nodes[rootId]) return
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { void doSync() }, DEBOUNCE_MS)
    return () => { if (timerRef.current !== null) clearTimeout(timerRef.current) }
  }, [nodes, childMap]) // eslint-disable-line react-hooks/exhaustive-deps

  const previewUrl = previewToken ? `/preview/${previewToken}` : null

  return { previewToken, previewUrl }
}
