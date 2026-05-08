'use client'

import React, { useState } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { usePageStore } from '@/stores/pageStore'
import { JsonViewer } from './JsonViewer'

type View = 'tree' | 'flat' | 'page'

const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: 'tree', label: 'Tree', hint: 'Nested node tree (root → children)' },
  { id: 'flat', label: 'Flat', hint: 'Raw store: nodes + childMap + parentMap' },
  { id: 'page', label: 'Page', hint: 'Active page metadata' },
]

interface CanvasJsonPanelProps {
  onClose: () => void
}

/**
 * Right-sidebar JSON inspector for the current canvas. Three views:
 *   - **Tree**: nested representation rooted at `rootId`. Useful for eyeballing
 *     structure and copying a subtree shape (e.g. when authoring a new
 *     prebuilt view in seed.ts).
 *   - **Flat**: the raw normalized store — what actually lives in zustand.
 *     Matches the schema we serialise on save.
 *   - **Page**: metadata for the active page (id, slug, order, …).
 */
export function CanvasJsonPanel({ onClose }: CanvasJsonPanelProps): React.ReactElement {
  const [view, setView] = useState<View>('tree')

  const nodes = useCanvasStore(s => s.nodes)
  const rootId = useCanvasStore(s => s.rootId)
  const childMap = useCanvasStore(s => s.childMap)
  const parentMap = useCanvasStore(s => s.parentMap)

  const activePageId = usePageStore(s => s.activePageId)
  const pages = usePageStore(s => s.pages)
  const activePage = pages.find(p => p.id === activePageId) ?? null

  const value =
    view === 'tree' ? buildTree(rootId, nodes, childMap)
    : view === 'page' ? activePage
    : { rootId, nodes, childMap, parentMap }

  return (
    <aside className="flex h-full w-96 shrink-0 flex-col border-l border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Canvas JSON
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close JSON panel"
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div className="flex gap-1 border-b border-border px-3 py-2">
        {VIEWS.map(v => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            title={v.hint}
            className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              view === v.id
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        <JsonViewer value={value} />
      </div>
    </aside>
  )
}

interface TreeNode {
  id: string
  type: string
  source: string
  props: Record<string, unknown>
  children: TreeNode[]
}

function buildTree(
  rootId: string,
  nodes: Record<string, { id: string; type: string; source: string; props: Record<string, unknown> }>,
  childMap: Record<string, string[]>,
): TreeNode | null {
  if (!rootId || !nodes[rootId]) return null
  const visited = new Set<string>()
  function walk(id: string): TreeNode | null {
    if (visited.has(id)) return { id, type: '[Circular]', source: '', props: {}, children: [] }
    visited.add(id)
    const n = nodes[id]
    if (!n) return null
    return {
      id: n.id,
      type: n.type,
      source: n.source,
      props: n.props,
      children: (childMap[id] ?? []).map(walk).filter((c): c is TreeNode => c !== null),
    }
  }
  return walk(rootId)
}
