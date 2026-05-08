import type { CanvasNode } from '@/types/canvas'

export interface Subtree {
  nodes: Record<string, CanvasNode>
  rootId: string
  childMap: Record<string, string[]>
}

/**
 * Mints fresh UUIDs for every node in a subtree and rewires `rootId` and
 * `childMap` to reference the new IDs. Used when:
 *   - pasting a copied subtree (multiple paste must not collide)
 *   - importing a prebuilt view from the registry (every drop is a fresh copy)
 */
export function remapSubtreeIds(subtree: Subtree): Subtree {
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
