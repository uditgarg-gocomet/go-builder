'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { usePageStore } from '@/stores/pageStore'
import { useAppStore } from '@/stores/appStore'
import { serializeCanvasToSchema } from '@/lib/schema/serialize'
import { clientFetch } from '@/lib/clientFetch'

const DEBOUNCE_MS = 1500

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface AutoSaveResult {
  status: SaveStatus
  warning: string | undefined
  lastSavedAt: Date | undefined
  saveNow: () => Promise<void>
}

export function useAutoSave(userId: string): AutoSaveResult {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [warning, setWarning] = useState<string | undefined>(undefined)
  const [lastSavedAt, setLastSavedAt] = useState<Date | undefined>(undefined)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)

  // Canvas state
  const nodes = useCanvasStore(s => s.nodes)
  const childMap = useCanvasStore(s => s.childMap)
  const rootId = useCanvasStore(s => s.rootId)
  const parentMap = useCanvasStore(s => s.parentMap)
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

  const doSave = useCallback(async (): Promise<void> => {
    if (savingRef.current) return
    if (!activePageId || !app) return

    const activePage = pages.find(p => p.id === activePageId)
    if (!activePage) return
    if (!rootId || !nodes[rootId]) return

    savingRef.current = true
    setStatus('saving')
    setWarning(undefined)

    try {
      const canvas = { nodes, childMap, parentMap, rootId, selectedNodeId, hoveredNodeId, dragState }
      const schema = serializeCanvasToSchema(canvas, activePage, app, {
        dataSources,
        actions,
        forms,
        stateSlots,
      })

      const data = await clientFetch<{ concurrentEditWarning?: boolean }>(
        '/schema/draft',
        { method: 'POST', body: JSON.stringify({ pageId: activePageId, schema, savedBy: userId }) },
      )
      setStatus('saved')
      setLastSavedAt(new Date())
      if (data.concurrentEditWarning) {
        setWarning('Another editor saved changes while you were editing.')
      }
    } catch {
      setStatus('error')
      setWarning(undefined)
    } finally {
      savingRef.current = false
    }
  }, [
    activePageId, app, pages, rootId, nodes, childMap, parentMap,
    selectedNodeId, hoveredNodeId, dragState, dataSources, actions, forms, stateSlots, userId,
  ])

  // Debounced auto-save on canvas change
  useEffect(() => {
    if (!rootId || !nodes[rootId]) return

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
    }
    setStatus('saving')
    timerRef.current = setTimeout(() => {
      void doSave()
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [nodes, childMap]) // eslint-disable-line react-hooks/exhaustive-deps

  return { status, warning, lastSavedAt, saveNow: doSave }
}
