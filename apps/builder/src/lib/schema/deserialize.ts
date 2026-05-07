import type { PageSchema, ComponentNode } from '@portal/core'
import type { CanvasState, CanvasNode } from '@/types/canvas'

function flattenNode(
  node: ComponentNode,
  parentId: string | null,
  nodes: Record<string, CanvasNode>,
  childMap: Record<string, string[]>,
  parentMap: Record<string, string>,
): void {
  // Strip children (lifted into childMap) and keep everything else. An
  // allowlist-free copy so future ComponentNode additions flow through without
  // code changes. The cast is safe: ComponentNode's other fields are
  // structurally a superset of CanvasNode.
  const { children, ...rest } = node
  const canvasNode = { ...rest } as CanvasNode
  nodes[node.id] = canvasNode
  childMap[node.id] = children.map(c => c.id)

  if (parentId != null) {
    parentMap[node.id] = parentId
  }

  for (const child of children) {
    flattenNode(child, node.id, nodes, childMap, parentMap)
  }
}

export function deserializeSchemaToCanvas(schema: PageSchema): CanvasState {
  const nodes: Record<string, CanvasNode> = {}
  const childMap: Record<string, string[]> = {}
  const parentMap: Record<string, string> = {}

  flattenNode(schema.layout, null, nodes, childMap, parentMap)

  return {
    nodes,
    rootId: schema.layout.id,
    childMap,
    parentMap,
    selectedNodeId: null,
    hoveredNodeId: null,
    dragState: null,
  }
}
