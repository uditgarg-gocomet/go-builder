'use client'

import React, { useCallback, useMemo } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useCanvasStore } from '@/stores/canvasStore'

interface CanvasNodeWrapperProps {
  nodeId: string
  type: string
  children: React.ReactNode
}

function CanvasNodeWrapperImpl({ nodeId, type, children }: CanvasNodeWrapperProps): React.ReactElement {
  const isSelected = useCanvasStore(s => s.selectedNodeId === nodeId)
  const selectNode = useCanvasStore(s => s.selectNode)

  // Stable data refs — recreating these each render makes dnd-kit see new prop
  // identity and can re-run subscribe effects.
  const dragData = useMemo(() => ({ source: 'canvas' as const, nodeId }), [nodeId])
  const dropData = useMemo(() => ({ parentId: nodeId, position: 0 }), [nodeId])

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: nodeId,
    data: dragData,
  })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `node-${nodeId}`,
    data: dropData,
  })

  const setRef = useCallback((el: HTMLDivElement | null): void => {
    setDragRef(el)
    setDropRef(el)
  }, [setDragRef, setDropRef])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    selectNode(nodeId)
  }, [nodeId, selectNode])

  // NOTE: Hover state is handled via Tailwind `group`/`group-hover:` rather than
  // store state + onMouseEnter/Leave. The badge sits at `-top-2.5` (outside the
  // wrapper's bounding box), and using JS hover causes a feedback loop:
  // enter → render badge → cursor "leaves" wrapper into badge area → render
  // without badge → cursor "enters" wrapper again → infinite flicker / freeze.

  return (
    <div
      ref={setRef}
      onClick={handleClick}
      className={[
        'group relative min-h-[28px] rounded-sm',
        'outline outline-1 outline-dashed outline-border/60 outline-offset-1',
        // Only emphasise the outline when *this* wrapper is hovered and no
        // descendant `.group` is also hovered. Without the `:not(:has(...))`
        // guard, every ancestor up the tree would highlight at the same time
        // because `:hover` propagates up the DOM.
        '[&:hover:not(:has(.group:hover))]:outline-gray-400',
        isSelected ? '!outline-2 !outline-blue-500 !outline-solid' : '',
        isOver ? 'bg-primary/5' : '',
        isDragging ? 'opacity-40' : '',
      ].filter(Boolean).join(' ')}
    >
      {/* Type badge — visible on hover or when selected. Pure CSS hover
          prevents mouseEnter/Leave loops with the negatively-positioned badge.
          `:hover` propagates up the DOM, which used to make every ancestor
          wrapper light up its badge at once. We mute that with
          `group-has-[.group:hover]:!hidden` — when this wrapper has a
          descendant `.group` (i.e. another node wrapper) currently hovered,
          our badge hides. Net effect: only the innermost hovered node shows
          its tooltip. The selected-state override (`!flex`) still wins so a
          selected node's badge stays pinned regardless of where the cursor is. */}
      <div
        {...attributes}
        {...listeners}
        onClick={e => e.stopPropagation()}
        className={[
          'absolute -top-2.5 left-2 z-50 hidden h-4 cursor-grab items-center rounded px-1.5 text-[10px] font-medium text-white shadow active:cursor-grabbing',
          'group-hover:flex group-has-[.group:hover]:!hidden',
          isSelected ? '!flex bg-blue-500' : 'bg-gray-500',
        ].join(' ')}
      >
        {type}
      </div>
      {children}
    </div>
  )
}

export const CanvasNodeWrapper = React.memo(CanvasNodeWrapperImpl)
