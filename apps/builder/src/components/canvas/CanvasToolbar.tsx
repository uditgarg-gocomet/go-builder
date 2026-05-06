'use client'

import React from 'react'
import { useBreakpointStore } from '@/stores/breakpointStore'
import type { Breakpoint } from '@/types/canvas'

const BREAKPOINTS: { value: Breakpoint; label: string; width: string; shortcut: string }[] = [
  { value: 'desktop', label: 'Desktop', width: '100%', shortcut: '⌘1' },
  { value: 'tablet', label: 'Tablet', width: '768px', shortcut: '⌘2' },
  { value: 'mobile', label: 'Mobile', width: '375px', shortcut: '⌘3' },
]

interface CanvasToolbarProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
}

export function CanvasToolbar({ zoom, onZoomIn, onZoomOut, onZoomReset }: CanvasToolbarProps): React.ReactElement {
  const { active, setActive } = useBreakpointStore()

  return (
    <div className="flex h-10 items-center justify-between border-t border-border bg-card px-4">
      <div className="flex items-center gap-1">
        {BREAKPOINTS.map(bp => (
          <button
            key={bp.value}
            type="button"
            onClick={() => setActive(bp.value)}
            title={`${bp.label} (${bp.shortcut})`}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              active === bp.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            {bp.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onZoomOut}
          title="Zoom out (⌘-)"
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          −
        </button>
        <button
          type="button"
          onClick={onZoomReset}
          title="Reset zoom (⌘0)"
          className="rounded px-2 py-1 text-xs tabular-nums text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          title="Zoom in (⌘=)"
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          +
        </button>
      </div>
    </div>
  )
}
