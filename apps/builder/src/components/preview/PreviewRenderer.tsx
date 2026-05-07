'use client'

import React, { useState, useEffect, useRef, createContext, useContext } from 'react'
import type { PreviewSession } from '@/app/api/preview/create/route'
import type { ComponentNode } from '@portal/core'

// ── Preview contexts ──────────────────────────────────────────────────────────

interface PreviewBindingCtx {
  mockData: Record<string, unknown>
  resolveBinding: (expr: string) => unknown
}

const PreviewBindingContext = createContext<PreviewBindingCtx>({
  mockData: {},
  resolveBinding: () => undefined,
})

interface InterceptedAction {
  id: string
  type: string
  name: string
  payload: unknown
  timestamp: string
}

interface PreviewActionCtx {
  interceptedActions: InterceptedAction[]
  executeAction: (actionId: string, trigger: string, params?: Record<string, unknown>) => void
}

const PreviewActionContext = createContext<PreviewActionCtx>({
  interceptedActions: [],
  executeAction: () => undefined,
})

// ── Binding resolver ──────────────────────────────────────────────────────────

function resolveValue(expr: string, mockData: Record<string, unknown>): unknown {
  // Strip {{ }} if present
  const cleaned = expr.replace(/^\{\{|\}\}$/g, '').trim()
  const parts = cleaned.split('.')
  let current: unknown = mockData
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

// ── Minimal schema renderer ───────────────────────────────────────────────────

function PreviewNode({ node }: { node: ComponentNode }): React.ReactElement {
  const { resolveBinding } = useContext(PreviewBindingContext)

  // Resolve bindings into props
  const resolvedProps: Record<string, unknown> = { ...node.props }
  for (const [key, expr] of Object.entries(node.bindings)) {
    resolvedProps[key] = resolveBinding(expr)
  }

  const children = node.children?.map(child => (
    <PreviewNode key={child.id} node={child} />
  ))

  // Minimal render by type family
  const type = node.type.toLowerCase()

  if (type.includes('stack') || type.includes('grid') || type.includes('container')) {
    return (
      <div style={node.style as React.CSSProperties} className="flex flex-col gap-2">
        {children}
      </div>
    )
  }
  if (type.includes('card')) {
    return (
      <div className="rounded border border-border bg-card p-4" style={node.style as React.CSSProperties}>
        {children}
      </div>
    )
  }
  if (type.includes('button')) {
    return (
      <button
        type="button"
        className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        style={node.style as React.CSSProperties}
      >
        {String(resolvedProps['label'] ?? resolvedProps['children'] ?? 'Button')}
      </button>
    )
  }
  if (type.includes('text') || type.includes('heading') || type.includes('label')) {
    return (
      <p style={node.style as React.CSSProperties}>
        {String(resolvedProps['content'] ?? resolvedProps['children'] ?? resolvedProps['text'] ?? '')}
      </p>
    )
  }
  if (type.includes('input') || type.includes('textfield')) {
    return (
      <input
        type="text"
        placeholder={String(resolvedProps['placeholder'] ?? '')}
        className="rounded border border-input bg-background px-3 py-2 text-sm"
        style={node.style as React.CSSProperties}
        readOnly
      />
    )
  }
  if (type.includes('image') || type.includes('img')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={String(resolvedProps['src'] ?? '')}
        alt={String(resolvedProps['alt'] ?? '')}
        style={node.style as React.CSSProperties}
        className="max-w-full"
      />
    )
  }

  // Fallback: render as div with children
  return (
    <div
      data-preview-type={node.type}
      className="rounded border border-dashed border-muted-foreground/30 p-2"
      style={node.style as React.CSSProperties}
    >
      <span className="text-[10px] text-muted-foreground">{node.type}</span>
      <div>{children}</div>
    </div>
  )
}

// ── PreviewActionLogPanel ─────────────────────────────────────────────────────

function PreviewActionLogPanel(): React.ReactElement {
  const { interceptedActions } = useContext(PreviewActionContext)

  if (interceptedActions.length === 0) {
    return <p className="text-xs text-muted-foreground">No actions fired yet.</p>
  }

  return (
    <div className="flex flex-col gap-1">
      {interceptedActions.map(a => (
        <div key={a.id} className="rounded border border-border bg-background px-2 py-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{new Date(a.timestamp).toLocaleTimeString()}</span>
            <span className="text-xs font-medium text-foreground">{a.name}</span>
            <span className="rounded bg-secondary px-1 py-0.5 text-[10px]">{a.type}</span>
          </div>
          <pre className="mt-1 max-h-20 overflow-auto text-[10px] text-muted-foreground">
            {JSON.stringify(a.payload, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  )
}

// ── Main PreviewRenderer ──────────────────────────────────────────────────────

interface PreviewRendererProps {
  session: PreviewSession
}

export function PreviewRenderer({ session }: PreviewRendererProps): React.ReactElement {
  const [currentSession, setCurrentSession] = useState(session)
  const [interceptedActions, setInterceptedActions] = useState<InterceptedAction[]>([])
  const [showActions, setShowActions] = useState(false)
  const [frameWidth, setFrameWidth] = useState('100%')
  const containerRef = useRef<HTMLDivElement>(null)

  // Poll for schema updates every 2s
  useEffect(() => {
    const id = setInterval(async () => {
      const res = await fetch(`/api/preview/${session.token}`, { cache: 'no-store' })
      if (res.ok) {
        const data = (await res.json()) as { session: PreviewSession }
        setCurrentSession(data.session)
      }
    }, 2000)
    return () => clearInterval(id)
  }, [session.token])

  // Listen to breakpoint changes from PreviewShell
  useEffect(() => {
    const handler = (e: Event): void => {
      const ce = e as CustomEvent<string>
      setFrameWidth(ce.detail)
    }
    window.addEventListener('preview:breakpoint', handler)
    return () => window.removeEventListener('preview:breakpoint', handler)
  }, [])

  const resolveBinding = (expr: string): unknown =>
    resolveValue(expr, currentSession.mockData)

  const executeAction = (actionId: string, trigger: string, params?: Record<string, unknown>): void => {
    setInterceptedActions(prev => [
      {
        id: crypto.randomUUID(),
        type: trigger,
        name: actionId,
        payload: params ?? {},
        timestamp: new Date().toISOString(),
      },
      ...prev.slice(0, 49),
    ])
  }

  const schema = currentSession.schema as { layout?: ComponentNode } | null

  return (
    <PreviewBindingContext.Provider value={{ mockData: currentSession.mockData, resolveBinding }}>
      <PreviewActionContext.Provider value={{ interceptedActions, executeAction }}>
        <div className="flex h-full flex-col">
          {/* Viewport frame */}
          <div ref={containerRef} className="flex flex-1 justify-center overflow-auto bg-muted/30 p-4">
            <div
              className="overflow-auto rounded border border-border bg-background shadow-sm transition-all"
              style={{ width: frameWidth, minHeight: '100%' }}
            >
              <div className="p-4">
                {schema?.layout ? (
                  <PreviewNode node={schema.layout} />
                ) : (
                  <div className="flex h-40 items-center justify-center">
                    <p className="text-sm text-muted-foreground">Empty canvas — nothing to preview.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action log panel (collapsible) */}
          <div className="border-t border-border">
            <button
              type="button"
              onClick={() => setShowActions(v => !v)}
              className="flex w-full items-center justify-between px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
            >
              <span>Action Log ({interceptedActions.length})</span>
              <span>{showActions ? '▾' : '▸'}</span>
            </button>
            {showActions && (
              <div className="max-h-48 overflow-y-auto p-3">
                <PreviewActionLogPanel />
              </div>
            )}
          </div>
        </div>
      </PreviewActionContext.Provider>
    </PreviewBindingContext.Provider>
  )
}
