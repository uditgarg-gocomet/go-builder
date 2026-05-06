'use client'

import { useEffect } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { useClipboardStore } from '@/stores/clipboardStore'
import { useBreakpointStore } from '@/stores/breakpointStore'

interface UseKeyboardShortcutsOptions {
  onSave?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onZoomReset?: () => void
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      // Escape — deselect
      if (e.key === 'Escape') {
        useCanvasStore.getState().selectNode(null)
        return
      }

      // Delete / Backspace — delete selected node (not when in input)
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
        const { selectedNodeId, deleteNode } = useCanvasStore.getState()
        if (selectedNodeId) {
          e.preventDefault()
          deleteNode(selectedNodeId)
        }
        return
      }

      if (!mod) return

      switch (e.key) {
        case 'z':
          e.preventDefault()
          if (e.shiftKey) {
            useCanvasStore.getState().redo()
          } else {
            useCanvasStore.getState().undo()
          }
          break

        case 'c': {
          if (isInput) break
          e.preventDefault()
          const { selectedNodeId, nodes, childMap } = useCanvasStore.getState()
          if (selectedNodeId) {
            useClipboardStore.getState().copy(selectedNodeId, { nodes, childMap })
          }
          break
        }

        case 'v': {
          if (isInput) break
          e.preventDefault()
          const { selectedNodeId, childMap, insertSubtree } = useCanvasStore.getState()
          const parentId = selectedNodeId ?? useCanvasStore.getState().rootId
          const position = childMap[parentId]?.length ?? 0
          const subtree = useClipboardStore.getState().paste(parentId, position)
          if (subtree) insertSubtree(subtree, parentId, position)
          break
        }

        case 'd': {
          if (isInput) break
          e.preventDefault()
          const { selectedNodeId: sel, nodes: ns, childMap: cm, parentMap, insertSubtree: insert } = useCanvasStore.getState()
          if (sel) {
            const parentId = parentMap[sel] ?? useCanvasStore.getState().rootId
            const siblings = cm[parentId] ?? []
            const pos = siblings.indexOf(sel) + 1
            useClipboardStore.getState().copy(sel, { nodes: ns, childMap: cm })
            const subtree = useClipboardStore.getState().paste(parentId, pos)
            if (subtree) insert(subtree, parentId, pos)
          }
          break
        }

        case 'ArrowUp': {
          if (isInput) break
          e.preventDefault()
          const { selectedNodeId: sel2, childMap: cm2, parentMap: pm2, moveNode } = useCanvasStore.getState()
          if (sel2) {
            const parentId = pm2[sel2]
            if (parentId) {
              const siblings = cm2[parentId] ?? []
              const idx = siblings.indexOf(sel2)
              if (idx > 0) moveNode(sel2, parentId, idx - 1)
            }
          }
          break
        }

        case 'ArrowDown': {
          if (isInput) break
          e.preventDefault()
          const { selectedNodeId: sel3, childMap: cm3, parentMap: pm3, moveNode: mv3 } = useCanvasStore.getState()
          if (sel3) {
            const parentId = pm3[sel3]
            if (parentId) {
              const siblings = cm3[parentId] ?? []
              const idx = siblings.indexOf(sel3)
              if (idx < siblings.length - 1) mv3(sel3, parentId, idx + 1)
            }
          }
          break
        }

        case '1':
          e.preventDefault()
          useBreakpointStore.getState().setActive('desktop')
          break

        case '2':
          e.preventDefault()
          useBreakpointStore.getState().setActive('tablet')
          break

        case '3':
          e.preventDefault()
          useBreakpointStore.getState().setActive('mobile')
          break

        case 's':
          e.preventDefault()
          options.onSave?.()
          break

        case '=':
        case '+':
          e.preventDefault()
          options.onZoomIn?.()
          break

        case '-':
          e.preventDefault()
          options.onZoomOut?.()
          break

        case '0':
          e.preventDefault()
          options.onZoomReset?.()
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [options])
}
