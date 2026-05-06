import type { PageSchema, ComponentNode } from '@portal/core'
import type { CanvasState, CanvasNode } from '@/types/canvas'

function flattenNode(
  node: ComponentNode,
  parentId: string | null,
  nodes: Record<string, CanvasNode>,
  childMap: Record<string, string[]>,
  parentMap: Record<string, string>,
): void {
  const canvasNode: CanvasNode = {
    id: node.id,
    type: node.type,
    source: node.source,
    props: node.props,
    bindings: node.bindings,
    actions: node.actions,
    style: node.style,
    responsive: node.responsive,
    dataSource: node.dataSource,
  }
  nodes[node.id] = canvasNode
  childMap[node.id] = node.children.map(c => c.id)

  if (parentId != null) {
    parentMap[node.id] = parentId
  }

  for (const child of node.children) {
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
