'use client'

import React from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { useBreakpointStore } from '@/stores/breakpointStore'
import { resolvePrimitive } from '@/lib/primitives'
import { CanvasNodeWrapper } from './CanvasNodeWrapper'
import { DropZone } from './DropZone'
import type { CanvasNode } from '@/types/canvas'

// Types that render children — show a drop zone when empty / at the end
const CONTAINER_TYPES = new Set([
  'Stack', 'Grid', 'Card', 'Tabs', 'Accordion', 'Modal', 'ErrorBoundary',
])

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

export function NodeRenderer({ nodeId, depth = 0 }: NodeRendererProps): React.ReactElement | null {
  const node = useCanvasStore(s => s.nodes[nodeId])
  const childIds = useCanvasStore(s => s.childMap[nodeId] ?? [])
  const resolvedProps = useResolvedProps(node ?? { props: {}, responsive: {} } as CanvasNode)

  if (!node) return null

  const Component = resolvePrimitive(node.type)
  const isContainer = CONTAINER_TYPES.has(node.type)

  let children: React.ReactNode = null

  if (isContainer) {
    if (childIds.length === 0) {
      // Empty container — full-size drop zone
      children = (
        <DropZone
          id={`empty-${nodeId}`}
          data={{ parentId: nodeId, position: 0 }}
          label="Drop here"
          className="m-2 min-h-[80px]"
        />
      )
    } else {
      // Has children — render them + compact append zone at the end
      children = (
        <>
          {childIds.map(childId => (
            <NodeRenderer key={childId} nodeId={childId} depth={depth + 1} />
          ))}
          <DropZone
            id={`append-${nodeId}`}
            data={{ parentId: nodeId, position: childIds.length }}
            label="+ drop here"
            className="mx-2 mb-1 min-h-[32px] opacity-40 hover:opacity-100 transition-opacity"
          />
        </>
      )
    }
  } else if (childIds.length > 0) {
    // Non-container that somehow has children (e.g. loaded from schema) — render them
    children = childIds.map(childId => (
      <NodeRenderer key={childId} nodeId={childId} depth={depth + 1} />
    ))
  }

  const rendered = Component ? (
    <Component {...resolvedProps} style={node.style}>
      {children}
    </Component>
  ) : (
    <div className="rounded border border-dashed border-border p-2 text-xs text-muted-foreground">
      {node.type}
      {children}
    </div>
  )

  return (
    <CanvasNodeWrapper nodeId={nodeId}>
      {rendered}
    </CanvasNodeWrapper>
  )
}
