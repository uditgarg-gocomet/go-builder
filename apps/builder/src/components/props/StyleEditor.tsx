'use client'

import React, { useState } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { useBreakpointStore } from '@/stores/breakpointStore'
import type { CanvasNode } from '@/types/canvas'

const STYLE_PROPS = [
  { key: 'padding', label: 'Padding', placeholder: '8px' },
  { key: 'margin', label: 'Margin', placeholder: '0px' },
  { key: 'width', label: 'Width', placeholder: 'auto' },
  { key: 'height', label: 'Height', placeholder: 'auto' },
  { key: 'background', label: 'Background', placeholder: '#ffffff' },
  { key: 'border', label: 'Border', placeholder: '1px solid #e2e8f0' },
  { key: 'borderRadius', label: 'Border Radius', placeholder: '4px' },
  { key: 'display', label: 'Display', placeholder: 'block' },
]

interface StyleEditorProps {
  nodeId: string
  node: CanvasNode
}

export function StyleEditor({ nodeId, node }: StyleEditorProps): React.ReactElement {
  const [open, setOpen] = useState(false)
  const updateStyle = useCanvasStore(s => s.updateStyle)
  const updateResponsive = useCanvasStore(s => s.updateResponsive)
  const { active: breakpoint } = useBreakpointStore()

  const isResponsiveMode = breakpoint !== 'desktop'

  const getStyleValue = (key: string): string => {
    if (isResponsiveMode) {
      const overrides = breakpoint === 'tablet' ? node.responsive.tablet : node.responsive.mobile
      return String(overrides?.[key] ?? node.style[key] ?? '')
    }
    return String(node.style[key] ?? '')
  }

  const setStyleValue = (key: string, value: string): void => {
    if (isResponsiveMode) {
      updateResponsive(nodeId, breakpoint as 'tablet' | 'mobile', { [key]: value || undefined })
    } else {
      updateStyle(nodeId, { [key]: value || undefined })
    }
  }

  const hasResponsiveOverrides =
    Object.keys(node.responsive.tablet ?? {}).length > 0 ||
    Object.keys(node.responsive.mobile ?? {}).length > 0

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <span className="flex items-center gap-1.5">
          Style
          {hasResponsiveOverrides && (
            <span className="rounded bg-violet-100 px-1 py-0.5 text-[10px] text-violet-700">responsive</span>
          )}
          {isResponsiveMode && (
            <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] text-amber-700">{breakpoint}</span>
          )}
        </span>
        <svg className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="flex flex-col gap-2 px-3 pb-3">
          {STYLE_PROPS.map(({ key, label, placeholder }) => (
            <div key={key} className="flex items-center gap-2">
              <label className="w-24 shrink-0 text-xs text-muted-foreground">{label}</label>
              <input
                type="text"
                value={getStyleValue(key)}
                onChange={e => setStyleValue(key, e.target.value)}
                placeholder={placeholder}
                className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
