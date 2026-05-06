'use client'

import React from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { useBreakpointStore } from '@/stores/breakpointStore'
import { resolvePrimitive } from '@/lib/primitives'
import { CanvasNodeWrapper } from './CanvasNodeWrapper'
import { DropZone } from './DropZone'
import type { CanvasNode } from '@/types/canvas'

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

  const children = childIds.length > 0
    ? childIds.map(childId => <NodeRenderer key={childId} nodeId={childId} depth={depth + 1} />)
    : depth > 0
      ? null
      : <DropZone id={`empty-${nodeId}`} label="Drop here" className="m-2 min-h-[60px]" />

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
