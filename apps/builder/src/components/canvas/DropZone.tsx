'use client'

import React, { useMemo } from 'react'
import { useDroppable, useDndContext } from '@dnd-kit/core'

interface DropZoneProps {
  id: string
  parentId: string
  position: number
  label?: string
  className?: string
  /**
   * When true (default), the zone is hidden until a drag is in progress.
   * The empty-canvas placeholder sets this to false so the FDE sees a target
   * and an instructional message before they pick something up.
   */
  onlyWhileDragging?: boolean
}

export function DropZone({
  id,
  parentId,
  position,
  label = 'Drop components here',
  className,
  onlyWhileDragging = true,
}: DropZoneProps): React.ReactElement | null {
  // Memoize data so dnd-kit doesn't see a fresh object every render.
  const data = useMemo(() => ({ parentId, position }), [parentId, position])
  const { isOver, setNodeRef } = useDroppable({ id, data })

  // Read the active drag from the surrounding DndContext. When nothing is
  // being dragged, an "always-on" drop zone clutters the canvas — especially
  // the per-container "+ drop here" footers that previously rendered for
  // every Stack / Grid in the tree.
  const { active } = useDndContext()
  if (onlyWhileDragging && !active) return null

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[120px] items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
        isOver ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'
      } ${className ?? ''}`}
    >
      <p className="text-sm">{label}</p>
    </div>
  )
}
