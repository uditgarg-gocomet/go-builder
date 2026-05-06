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

  return {
    id: node.id,
    type: node.type,
    source: node.source,
    props: node.props,
    bindings: node.bindings,
    actions: node.actions,
    style: node.style,
    responsive: node.responsive,
    dataSource: node.dataSource,
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
