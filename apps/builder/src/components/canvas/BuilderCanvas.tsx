'use client'

import React, { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useCanvasStore } from '@/stores/canvasStore'
import { useBreakpointStore } from '@/stores/breakpointStore'
import { createNode } from '@/lib/schema/createNode'
import { NodeRenderer } from './NodeRenderer'
import { DropZone } from './DropZone'
import { ComponentGhost } from './ComponentGhost'
import { CanvasToolbar } from './CanvasToolbar'

const BREAKPOINT_WIDTHS: Record<string, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
}

export function BuilderCanvas(): React.ReactElement {
  const rootId = useCanvasStore(s => s.rootId)
  const nodes = useCanvasStore(s => s.nodes)
  const addNode = useCanvasStore(s => s.addNode)
  const moveNode = useCanvasStore(s => s.moveNode)
  const selectNode = useCanvasStore(s => s.selectNode)
  const { active: breakpoint } = useBreakpointStore()

  const [zoom, setZoom] = useState(1)
  const [activeLabel, setActiveLabel] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const handleDragStart = (event: DragStartEvent): void => {
    const data = event.active.data.current as { source: string; type?: string; nodeId?: string } | undefined
    if (data?.source === 'panel' && data.type) {
      setActiveLabel(data.type)
    } else if (data?.source === 'canvas' && data.nodeId) {
      const node = nodes[data.nodeId]
      setActiveLabel(node?.type ?? null)
    }
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    setActiveLabel(null)
    const { active, over } = event
    if (!over) return

    const activeData = active.data.current as { source: string; type?: string; nodeId?: string } | undefined
    const overData = over.data.current as { parentId?: string; position?: number } | undefined

    const parentId = overData?.parentId ?? rootId
    const position = overData?.position ?? (useCanvasStore.getState().childMap[parentId]?.length ?? 0)

    if (activeData?.source === 'panel' && activeData.type) {
      addNode(activeData.type, 'primitive', parentId, position, createNode(activeData.type, 'primitive'))
    } else if (activeData?.source === 'canvas' && activeData.nodeId) {
      if (activeData.nodeId !== parentId) {
        moveNode(activeData.nodeId, parentId, position)
      }
    }
  }

  const hasRoot = Boolean(rootId && nodes[rootId])
  const canvasWidth = BREAKPOINT_WIDTHS[breakpoint] ?? '100%'

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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

      <DragOverlay>
        {activeLabel ? <ComponentGhost label={activeLabel} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
