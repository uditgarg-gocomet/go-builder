'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { usePageStore } from '@/stores/pageStore'
import { useAppStore } from '@/stores/appStore'
import { useSaveStatusStore } from '@/stores/saveStatusStore'
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

// Cheap structural fingerprint of the canvas tree. Stringifying the node map
// + childMap + rootId is O(tree-size) and sufficient to detect any real edit
// (prop change, node move, add, delete). Memory is bounded by MAX_SCHEMA_BYTES
// (5MB) — fine to hold in a ref.
function fingerprintCanvas(
  nodes: Record<string, unknown>,
  childMap: Record<string, string[]>,
  rootId: string,
): string {
  return JSON.stringify({ nodes, childMap, rootId })
}

export function useAutoSave(userId: string): AutoSaveResult {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [warning, setWarning] = useState<string | undefined>(undefined)
  const [lastSavedAt, setLastSavedAt] = useState<Date | undefined>(undefined)

  const setSlot = useSaveStatusStore(s => s.setSlot)
  const clearSlot = useSaveStatusStore(s => s.clearSlot)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)

  // Tracks the serialised canvas state we most recently accepted as "saved".
  // Seeded on first non-empty observation after a page change so the initial
  // load from the server does not trigger a save. Updated after each
  // successful save so redundant re-saves of the same content are skipped.
  const lastSavedFingerprintRef = useRef<string | null>(null)

  // Subscribe to ONLY the canvas slices that should trigger an auto-save.
  // selectedNodeId/hoveredNodeId/dragState change on every click & mouse move —
  // subscribing to them re-renders EditorShell (and cascades to the entire
  // canvas tree) on every interaction. Read those via getState() inside doSave.
  const nodes = useCanvasStore(s => s.nodes)
  const childMap = useCanvasStore(s => s.childMap)
  const rootId = useCanvasStore(s => s.rootId)

  const activePageId = usePageStore(s => s.activePageId)
  const pages = usePageStore(s => s.pages)
  const app = useAppStore(s => s.app)
  const dataSources = useAppStore(s => s.dataSources)
  const actions = useAppStore(s => s.actions)
  const forms = useAppStore(s => s.forms)
  const stateSlots = useAppStore(s => s.stateSlots)

  // Reset the "last saved" baseline when the active page changes. The next
  // non-empty observation of the canvas will reseed from the freshly-loaded
  // schema — meaning the load itself is treated as already-saved.
  useEffect(() => {
    lastSavedFingerprintRef.current = null
    setStatus('idle')
    setWarning(undefined)
  }, [activePageId])

  const doSave = useCallback(async (): Promise<void> => {
    if (savingRef.current) return
    if (!activePageId || !app) return

    const activePage = pages.find(p => p.id === activePageId)
    if (!activePage) return

    // Read latest canvas state at save time (not subscribed deps).
    const cs = useCanvasStore.getState()
    if (!cs.rootId || !cs.nodes[cs.rootId]) return

    // Fingerprint the exact state we are about to persist. If it already
    // matches the last saved fingerprint (e.g. an effect raced with a prior
    // save that landed the same content), skip.
    const fingerprint = fingerprintCanvas(cs.nodes, cs.childMap, cs.rootId)
    if (lastSavedFingerprintRef.current === fingerprint) {
      setStatus('saved')
      return
    }

    savingRef.current = true
    setStatus('saving')
    setWarning(undefined)

    try {
      const canvas = {
        nodes: cs.nodes,
        childMap: cs.childMap,
        parentMap: cs.parentMap,
        rootId: cs.rootId,
        selectedNodeId: cs.selectedNodeId,
        hoveredNodeId: cs.hoveredNodeId,
        dragState: cs.dragState,
      }
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
      // Record what we just saved so subsequent no-op effects are skipped.
      lastSavedFingerprintRef.current = fingerprint
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
  }, [activePageId, app, pages, dataSources, actions, forms, stateSlots, userId])

  // Debounced auto-save on canvas change.
  //
  // The first non-empty canvas observation after a page change seeds the
  // "last saved" baseline without triggering a save — this is the normal
  // "page just loaded" path. Subsequent real edits (any change to nodes /
  // childMap / rootId that produces a different fingerprint) schedule a
  // debounced save.
  useEffect(() => {
    if (!rootId || !nodes[rootId]) return

    const fingerprint = fingerprintCanvas(nodes, childMap, rootId)

    // Seed baseline from first non-empty load — treat as already saved.
    if (lastSavedFingerprintRef.current === null) {
      lastSavedFingerprintRef.current = fingerprint
      setStatus('saved')
      return
    }

    // No real change since last save — skip.
    if (lastSavedFingerprintRef.current === fingerprint) return

    // Real edit — debounce and save.
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
  }, [nodes, childMap, rootId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mirror local state into the shared save-status store so the top-right
  // SaveStatusIndicator reflects the page canvas alongside chrome edits.
  useEffect(() => {
    setSlot('page', { status, lastSavedAt, warning })
  }, [status, lastSavedAt, warning, setSlot])

  // Remove the slot on unmount so a torn-down editor doesn't leave stale state
  useEffect(() => () => { clearSlot('page') }, [clearSlot])

  return { status, warning, lastSavedAt, saveNow: doSave }
}
