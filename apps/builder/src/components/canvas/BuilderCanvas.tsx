'use client'

import React, { useState } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { useBreakpointStore } from '@/stores/breakpointStore'
import { NodeRenderer } from './NodeRenderer'
import { DropZone } from './DropZone'
import { CanvasToolbar } from './CanvasToolbar'

const BREAKPOINT_WIDTHS: Record<string, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
}

export function BuilderCanvas(): React.ReactElement {
  const rootId = useCanvasStore(s => s.rootId)
  const nodes = useCanvasStore(s => s.nodes)
  const selectNode = useCanvasStore(s => s.selectNode)
  const { active: breakpoint } = useBreakpointStore()

  const [zoom, setZoom] = useState(1)

  const hasRoot = Boolean(rootId && nodes[rootId])
  const canvasWidth = BREAKPOINT_WIDTHS[breakpoint] ?? '100%'

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div
        className="flex-1 overflow-auto bg-muted/30 p-6"
        onClick={() => selectNode(null)}
      >
        <div
          className="mx-auto min-h-full rounded-lg border border-border bg-background shadow-sm transition-all"
          style={{ width: canvasWidth, transform: `scale(${zoom})`, transformOrigin: 'top center' }}
        >
          {hasRoot ? (
            <NodeRenderer nodeId={rootId} />
          ) : (
            <DropZone
              id="canvas-root-drop"
              parentId=""
              position={0}
              label="Drag components from the panel to get started"
              className="m-4 min-h-[400px]"
            />
          )}
        </div>
      </div>

      <CanvasToolbar
        zoom={zoom}
        onZoomIn={() => setZoom(z => Math.min(z + 0.1, 2))}
        onZoomOut={() => setZoom(z => Math.max(z - 0.1, 0.25))}
        onZoomReset={() => setZoom(1)}
      />
    </div>
  )
}
