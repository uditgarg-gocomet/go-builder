'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CanvasNode, CanvasState, ClipboardEntry } from '@/types/canvas'

function remapIds(
  subtree: ClipboardEntry['subtree']
): ClipboardEntry['subtree'] {
  const idMap = new Map<string, string>()
  for (const id of Object.keys(subtree.nodes)) {
    idMap.set(id, crypto.randomUUID())
  }

  const nodes: Record<string, CanvasNode> = {}
  for (const [oldId, node] of Object.entries(subtree.nodes)) {
    const newId = idMap.get(oldId)!
    nodes[newId] = { ...node, id: newId }
  }

  const childMap: Record<string, string[]> = {}
  for (const [oldId, children] of Object.entries(subtree.childMap)) {
    const newId = idMap.get(oldId) ?? oldId
    childMap[newId] = children.map(c => idMap.get(c) ?? c)
  }

  const newRootId = idMap.get(subtree.rootId) ?? subtree.rootId

  return { nodes, rootId: newRootId, childMap }
}

function extractSubtree(
  nodeId: string,
  canvas: Pick<CanvasState, 'nodes' | 'childMap'>
): ClipboardEntry['subtree'] {
  const nodes: Record<string, CanvasNode> = {}
  const childMap: Record<string, string[]> = {}
  const queue = [nodeId]

  while (queue.length > 0) {
    const id = queue.shift()!
    const node = canvas.nodes[id]
    if (!node) continue
    nodes[id] = node
    const children = canvas.childMap[id] ?? []
    childMap[id] = children
    queue.push(...children)
  }

  return { nodes, rootId: nodeId, childMap }
}

interface ClipboardStore {
  clipboard: ClipboardEntry | null
  copy: (nodeId: string, canvas: Pick<CanvasState, 'nodes' | 'childMap'>) => void
  paste: (targetParentId: string, position: number) => ClipboardEntry['subtree'] | null
  clear: () => void
}

export const useClipboardStore = create<ClipboardStore>()(
  persist(
    (set, get) => ({
      clipboard: null,

      copy: (nodeId, canvas) => {
        const subtree = extractSubtree(nodeId, canvas)
        set({ clipboard: { subtree, copiedAt: Date.now() } })
      },

      paste: (targetParentId, position) => {
        const { clipboard } = get()
        if (!clipboard) return null
        const remapped = remapIds(clipboard.subtree)
        // caller is responsible for calling canvasStore.insertSubtree
        void targetParentId
        void position
        return remapped
      },

      clear: () => set({ clipboard: null }),
    }),
    {
      name: 'portal-builder-clipboard',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? sessionStorage : {
          getItem: () => null,
          setItem: () => undefined,
          removeItem: () => undefined,
        }
      ),
    }
  )
)
