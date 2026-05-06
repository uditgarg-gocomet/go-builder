'use client'

import React from 'react'
import { useDroppable } from '@dnd-kit/core'

interface DropZoneProps {
  id: string
  label?: string
  className?: string
}

export function DropZone({ id, label = 'Drop components here', className }: DropZoneProps): React.ReactElement {
  const { isOver, setNodeRef } = useDroppable({ id })

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
