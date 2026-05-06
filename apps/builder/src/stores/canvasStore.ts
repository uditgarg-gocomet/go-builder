'use client'

import { create } from 'zustand'
import { temporal } from 'zundo'
import { produce } from 'immer'
import type { CanvasNode, CanvasState, DragState } from '@/types/canvas'

function generateId(): string {
  return crypto.randomUUID()
}

function collectDescendants(nodeId: string, childMap: Record<string, string[]>): string[] {
  const ids: string[] = []
  const queue = [nodeId]
  while (queue.length > 0) {
    const id = queue.shift()!
    const children = childMap[id] ?? []
    ids.push(...children)
    queue.push(...children)
  }
  return ids
}

interface CanvasActions {
  addNode: (
    type: string,
    source: CanvasNode['source'],
    parentId: string,
    position: number,
    defaults?: Partial<CanvasNode>
  ) => string
  moveNode: (nodeId: string, targetParentId: string, position: number) => void
  updateProps: (nodeId: string, props: Record<string, unknown>) => void
  updateBinding: (nodeId: string, propKey: string, expression: string) => void
  updateStyle: (nodeId: string, style: Record<string, unknown>) => void
  updateResponsive: (nodeId: string, breakpoint: 'tablet' | 'mobile', overrides: Record<string, unknown>) => void
  updateActions: (nodeId: string, actions: CanvasNode['actions']) => void
  deleteNode: (nodeId: string) => void
  selectNode: (id: string | null) => void
  setHoveredNode: (id: string | null) => void
  setDragState: (drag: DragState | null) => void
  insertSubtree: (
    subtree: { nodes: Record<string, CanvasNode>; rootId: string; childMap: Record<string, string[]> },
    parentId: string,
    position: number
  ) => void
  loadCanvas: (state: CanvasState) => void
  undo: () => void
  redo: () => void
}

type CanvasStore = CanvasState & CanvasActions

const EMPTY_CANVAS: CanvasState = {
  nodes: {},
  rootId: '',
  childMap: {},
  parentMap: {},
  selectedNodeId: null,
  hoveredNodeId: null,
  dragState: null,
}

export const useCanvasStore = create<CanvasStore>()(
  temporal(
    (set, _get) => ({
      ...EMPTY_CANVAS,

      addNode: (type, source, parentId, position, defaults = {}) => {
        const id = generateId()
        const node: CanvasNode = {
          id,
          type,
          source,
          props: {},
          bindings: {},
          actions: [],
          style: {},
          responsive: {},
          ...defaults,
        }
        set(produce<CanvasStore>(state => {
          state.nodes[id] = node
          if (!state.childMap[parentId]) state.childMap[parentId] = []
          state.childMap[parentId]!.splice(position, 0, id)
          state.parentMap[id] = parentId
          if (!state.childMap[id]) state.childMap[id] = []
        }))
        return id
      },

      moveNode: (nodeId, targetParentId, position) => {
        set(produce<CanvasStore>(state => {
          const currentParentId = state.parentMap[nodeId]
          if (currentParentId != null) {
            const siblings = state.childMap[currentParentId] ?? []
            state.childMap[currentParentId] = siblings.filter(id => id !== nodeId)
          }
          if (!state.childMap[targetParentId]) state.childMap[targetParentId] = []
          state.childMap[targetParentId]!.splice(position, 0, nodeId)
          state.parentMap[nodeId] = targetParentId
        }))
      },

      updateProps: (nodeId, props) => {
        set(produce<CanvasStore>(state => {
          const node = state.nodes[nodeId]
          if (node) node.props = { ...node.props, ...props }
        }))
      },

      updateBinding: (nodeId, propKey, expression) => {
        set(produce<CanvasStore>(state => {
          const node = state.nodes[nodeId]
          if (node) node.bindings[propKey] = expression
        }))
      },

      updateStyle: (nodeId, style) => {
        set(produce<CanvasStore>(state => {
          const node = state.nodes[nodeId]
          if (node) node.style = { ...node.style, ...style }
        }))
      },

      updateResponsive: (nodeId, breakpoint, overrides) => {
        set(produce<CanvasStore>(state => {
          const node = state.nodes[nodeId]
          if (node) {
            if (breakpoint === 'tablet') {
              node.responsive.tablet = { ...(node.responsive.tablet ?? {}), ...overrides }
            } else {
              node.responsive.mobile = { ...(node.responsive.mobile ?? {}), ...overrides }
            }
          }
        }))
      },

      updateActions: (nodeId, actions) => {
        set(produce<CanvasStore>(state => {
          const node = state.nodes[nodeId]
          if (node) node.actions = actions
        }))
      },

      deleteNode: (nodeId) => {
        set(produce<CanvasStore>(state => {
          const descendants = collectDescendants(nodeId, state.childMap)
          const toDelete = [nodeId, ...descendants]

          for (const id of toDelete) {
            delete state.nodes[id]
            delete state.childMap[id]
            delete state.parentMap[id]
          }

          const parentId = state.parentMap[nodeId]
          if (parentId != null && state.childMap[parentId]) {
            state.childMap[parentId] = state.childMap[parentId]!.filter(id => id !== nodeId)
          }

          if (state.selectedNodeId === nodeId) state.selectedNodeId = null
        }))
      },

      selectNode: (id) => set({ selectedNodeId: id }),
      setHoveredNode: (id) => set({ hoveredNodeId: id }),
      setDragState: (drag) => set({ dragState: drag }),

      insertSubtree: (subtree, parentId, position) => {
        set(produce<CanvasStore>(state => {
          for (const [id, node] of Object.entries(subtree.nodes)) {
            state.nodes[id] = node
          }
          for (const [id, children] of Object.entries(subtree.childMap)) {
            state.childMap[id] = children
          }
          if (!state.childMap[parentId]) state.childMap[parentId] = []
          state.childMap[parentId]!.splice(position, 0, subtree.rootId)
          state.parentMap[subtree.rootId] = parentId

          for (const [childId, children] of Object.entries(subtree.childMap)) {
            for (const id of children) {
              state.parentMap[id] = childId
            }
          }
        }))
      },

      loadCanvas: (canvas) => set(canvas),

      undo: () => {
        const temporal = (useCanvasStore as unknown as { temporal: { getState: () => { undo: () => void } } }).temporal
        temporal.getState().undo()
      },

      redo: () => {
        const temporal = (useCanvasStore as unknown as { temporal: { getState: () => { redo: () => void } } }).temporal
        temporal.getState().redo()
      },
    }),
    {
      limit: 50,
      partialize: (state: CanvasStore) => ({
        nodes: state.nodes,
        childMap: state.childMap,
        parentMap: state.parentMap,
      }),
    }
  )
)
