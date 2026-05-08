'use client'

import React from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { useBreakpointStore } from '@/stores/breakpointStore'
import { resolvePrimitive } from '@/lib/primitives'
import { CanvasNodeWrapper } from './CanvasNodeWrapper'
import { DropZone } from './DropZone'
import type { CanvasNode } from '@/types/canvas'

// True containers — the underlying React component accepts and renders `children`.
// Note: Tabs, Accordion, DropdownMenu render typed item arrays (props), NOT children.
const CONTAINER_TYPES = new Set([
  'Stack', 'Grid', 'Card', 'Modal', 'ErrorBoundary',
])

// Stable empty array — must NOT be inlined as `?? []` in selectors, or every store
// change creates a new reference and re-renders every NodeRenderer.
const EMPTY_CHILDREN: readonly string[] = Object.freeze([])

function useResolvedProps(node: CanvasNode): Record<string, unknown> {
  const { active } = useBreakpointStore()
  const base = node.props
  if (active === 'tablet' && node.responsive.tablet) {
    return { ...base, ...node.responsive.tablet }
  }
  if (active === 'mobile' && node.responsive.mobile) {
    return { ...base, ...node.responsive.mobile }
  }
  return base
}

interface NodeRendererProps {
  nodeId: string
  depth?: number
}

function NodeRendererImpl({ nodeId, depth = 0 }: NodeRendererProps): React.ReactElement | null {
  const node = useCanvasStore(s => s.nodes[nodeId])
  const childIds = useCanvasStore(s => s.childMap[nodeId] ?? EMPTY_CHILDREN) as readonly string[]
  const resolvedProps = useResolvedProps(node ?? { props: {}, responsive: {} } as CanvasNode)

  if (!node) return null

  const Component = resolvePrimitive(node.type)
  const isContainer = CONTAINER_TYPES.has(node.type)

  // Inner children — passed to the component when it's a true container.
  let innerChildren: React.ReactNode = null
  if (isContainer) {
    if (childIds.length === 0) {
      innerChildren = (
        <DropZone
          id={`empty-${nodeId}`}
          parentId={nodeId}
          position={0}
          label="Drop here"
          className="m-2 min-h-[80px]"
        />
      )
    } else {
      // Populated container: render children, then a slim "append" drop strip.
      // We deliberately drop the "+ drop here" text — it cluttered the canvas
      // and duplicated information now communicated by the canvas-surface
      // fallback droppable. The strip itself is preserved (with no label) so
      // appending into a *nested* container at the end still works; dropping
      // on the canvas surface only appends to the root.
      innerChildren = (
        <>
          {childIds.map(childId => (
            <NodeRenderer key={childId} nodeId={childId} depth={depth + 1} />
          ))}
          <DropZone
            id={`append-${nodeId}`}
            parentId={nodeId}
            position={childIds.length}
            label=""
            className="mx-2 mb-1 min-h-[12px] !border-primary/30 !bg-transparent hover:!border-primary hover:!bg-primary/5"
          />
        </>
      )
    }
  }

  // Outer children — for non-container components that have children dropped into them
  // (e.g. an Accordion that ignores its `children` prop). Render them as siblings below
  // so they're still visible and editable.
  const outerChildren: React.ReactNode = (!isContainer && childIds.length > 0) ? (
    <div className="ml-4 mt-1 flex flex-col gap-1 border-l-2 border-dashed border-border pl-2">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">orphaned children</span>
      {childIds.map(childId => (
        <NodeRenderer key={childId} nodeId={childId} depth={depth + 1} />
      ))}
    </div>
  ) : null

  const rendered = Component ? (
    <Component {...resolvedProps} style={node.style}>
      {innerChildren}
    </Component>
  ) : (
    <div className="rounded border border-dashed border-border p-2 text-xs text-muted-foreground">
      {node.type}
      {innerChildren}
    </div>
  )

  return (
    <CanvasNodeWrapper nodeId={nodeId} type={node.type}>
      {rendered}
      {outerChildren}
    </CanvasNodeWrapper>
  )
}

export const NodeRenderer = React.memo(NodeRendererImpl)
