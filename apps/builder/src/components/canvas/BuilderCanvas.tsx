'use client'

import React, { useMemo, useState } from 'react'
import { useDroppable, useDndContext } from '@dnd-kit/core'
import { useCanvasStore } from '@/stores/canvasStore'
import { useBreakpointStore } from '@/stores/breakpointStore'
import { useAppStore } from '@/stores/appStore'
import { NodeRenderer } from './NodeRenderer'
import { DropZone } from './DropZone'
import { CanvasToolbar } from './CanvasToolbar'

const BREAKPOINT_WIDTHS: Record<string, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
}

/**
 * Theme token → CSS var mapping for the canvas surface. The `App Settings →
 * Theme` panel writes `--brand-surface` / `--brand-text` / `--radius`; we
 * apply them as inline CSS variables so the page area in the builder mirrors
 * what the renderer will produce. Falls back to the builder's neutral palette
 * when an app has no theme overrides set yet.
 */
function useCanvasThemeVars(): React.CSSProperties {
  const tokens = useAppStore(s => s.theme.tokens) ?? {}
  return useMemo(() => {
    const vars: Record<string, string> = {}
    if (tokens['--brand-surface']) vars['--canvas-surface'] = tokens['--brand-surface']
    if (tokens['--brand-text'])    vars['--canvas-text']    = tokens['--brand-text']
    if (tokens['--brand-primary']) vars['--canvas-primary'] = tokens['--brand-primary']
    if (tokens['--radius'])        vars['--canvas-radius']  = tokens['--radius']
    return vars as React.CSSProperties
  }, [tokens])
}

export function BuilderCanvas(): React.ReactElement {
  const rootId = useCanvasStore(s => s.rootId)
  const nodes = useCanvasStore(s => s.nodes)
  const selectNode = useCanvasStore(s => s.selectNode)
  const { active: breakpoint } = useBreakpointStore()

  const [zoom, setZoom] = useState(1)

  const hasRoot = Boolean(rootId && nodes[rootId])
  const canvasWidth = BREAKPOINT_WIDTHS[breakpoint] ?? '100%'
  const themeVars = useCanvasThemeVars()

  // Fallback droppable wrapping the entire canvas page surface. When the FDE
  // releases a drag *anywhere* over the canvas (even outside an inner drop
  // zone), the EditorShell's drag-end handler reads this `over` target and
  // appends to the root. This mirrors typical builder UX (Webflow, Framer)
  // where the canvas frame itself is always a valid drop target. The data is
  // structured so `parentId = rootId` and the position is "end of children".
  const { setNodeRef: setSurfaceRef, isOver: isSurfaceOver } = useDroppable({
    id: 'canvas-surface-drop',
    data: { parentId: rootId, position: -1 /* sentinel: append-to-end */ },
  })

  // Active drag → highlight the surface so the FDE knows the drop will land
  // somewhere valid. Only when no inner drop target is also being hovered, to
  // avoid double-highlighting.
  const { active } = useDndContext()
  const showSurfaceHighlight = !!active && isSurfaceOver

  return (
    <div className="flex flex-1 flex-col overflow-hidden" style={themeVars}>
      <div
        className="flex-1 overflow-auto bg-muted/30 p-6"
        onClick={() => selectNode(null)}
      >
        <div
          ref={setSurfaceRef}
          className={`mx-auto min-h-full rounded-lg border shadow-sm transition-all ${
            showSurfaceHighlight ? 'border-primary/60 ring-2 ring-primary/20' : 'border-border'
          }`}
          style={{
            width: canvasWidth,
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            // App-theme-driven surface + text. Falls through to the builder's
            // shadcn neutrals when an app hasn't customised its palette.
            background: 'var(--canvas-surface, hsl(var(--background)))',
            color: 'var(--canvas-text, hsl(var(--foreground)))',
            borderRadius: 'var(--canvas-radius, 0.5rem)',
          }}
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
              // Empty-canvas affordance must be visible at all times, not just
              // mid-drag — otherwise a fresh app looks broken.
              onlyWhileDragging={false}
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
