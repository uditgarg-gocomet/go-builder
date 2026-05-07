'use client'

import React, { useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'

interface DropZoneProps {
  id: string
  parentId: string
  position: number
  label?: string
  className?: string
}

export function DropZone({ id, parentId, position, label = 'Drop components here', className }: DropZoneProps): React.ReactElement {
  // Memoize data so dnd-kit doesn't see a fresh object every render.
  const data = useMemo(() => ({ parentId, position }), [parentId, position])
  const { isOver, setNodeRef } = useDroppable({ id, data })

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
