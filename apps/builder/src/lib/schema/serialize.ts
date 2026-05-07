import type { PageSchema, DataSourceDef, ActionDef, FormDef, StateSlotDef, ComponentNode } from '@portal/core'
import type { CanvasState, CanvasNode, AppMeta, PageMeta } from '@/types/canvas'

function canvasNodeToComponentNode(
  nodeId: string,
  nodes: Record<string, CanvasNode>,
  childMap: Record<string, string[]>,
): ComponentNode {
  const node = nodes[nodeId]!
  const childIds = childMap[nodeId] ?? []
  const children = childIds.map(childId =>
    canvasNodeToComponentNode(childId, nodes, childMap)
  )

  // Pass through the entire node and replace only `children`. This is an
  // allowlist-free copy so any new optional field we add later (e.g. a new
  // top-level node attribute) is preserved without having to touch this file.
  return {
    ...node,
    children,
  }
}

export function serializeCanvasToSchema(
  canvas: CanvasState,
  page: PageMeta,
  app: AppMeta,
  options: {
    dataSources?: DataSourceDef[]
    actions?: ActionDef[]
    forms?: FormDef[]
    stateSlots?: StateSlotDef[]
    version?: string
  } = {}
): PageSchema {
  if (!canvas.rootId || !canvas.nodes[canvas.rootId]) {
    throw new Error('Canvas has no root node')
  }

  const layout = canvasNodeToComponentNode(canvas.rootId, canvas.nodes, canvas.childMap)

  return {
    pageId: page.id,
    appId: app.id,
    version: options.version ?? '0.1.0',
    meta: {
      title: page.name,
      slug: page.slug,
      order: page.order,
      auth: { required: false, groups: [] },
    },
    layout,
    dataSources: options.dataSources ?? [],
    actions: options.actions ?? [],
    forms: options.forms ?? [],
    state: options.stateSlots ?? [],
    params: [],
  }
}
