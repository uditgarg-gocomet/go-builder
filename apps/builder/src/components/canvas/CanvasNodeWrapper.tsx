'use client'

import React from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useCanvasStore } from '@/stores/canvasStore'

interface CanvasNodeWrapperProps {
  nodeId: string
  children: React.ReactNode
}

export function CanvasNodeWrapper({ nodeId, children }: CanvasNodeWrapperProps): React.ReactElement {
  const selectedNodeId = useCanvasStore(s => s.selectedNodeId)
  const hoveredNodeId = useCanvasStore(s => s.hoveredNodeId)
  const selectNode = useCanvasStore(s => s.selectNode)
  const setHoveredNode = useCanvasStore(s => s.setHoveredNode)

  const isSelected = selectedNodeId === nodeId
  const isHovered = hoveredNodeId === nodeId && !isSelected

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: nodeId,
    data: { source: 'canvas', nodeId },
  })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `node-${nodeId}`,
    data: { parentId: nodeId, position: 0 },
  })

  const setRef = (el: HTMLDivElement | null): void => {
    setDragRef(el)
    setDropRef(el)
  }

  return (
    <div
      ref={setRef}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); selectNode(nodeId) }}
      onMouseEnter={(e) => { e.stopPropagation(); setHoveredNode(nodeId) }}
      onMouseLeave={() => setHoveredNode(null)}
      className={[
        'relative transition-all',
        isSelected ? 'outline outline-2 outline-blue-500 outline-offset-1' : '',
        isHovered ? 'outline outline-1 outline-gray-400 outline-offset-1' : '',
        isOver ? 'bg-primary/5' : '',
        isDragging ? 'opacity-40' : '',
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  )
}
