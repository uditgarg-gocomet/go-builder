'use client'

import React, { useState, useEffect, useRef, createContext, useContext, useMemo } from 'react'
import type { PreviewSession } from '@/app/api/preview/create/route'
import type { ComponentNode, NodeVisibility } from '@portal/core'
import { resolveBinding as resolveBindingImpl } from '@portal/action-runtime'
import {
  Stack, Grid, Divider, Card, Tabs, Accordion, Modal,
  Button, IconButton, Link as UILink, DropdownMenu,
  Alert, Toast, Spinner, Skeleton, EmptyState,
  Heading, Text, Badge, Avatar, Tag, StatCard,
  DataTable, Chart,
  TextInput, NumberInput, Select, MultiSelect, DatePicker,
  Checkbox, Toggle, RadioGroup, Textarea, FileUpload,
} from '@portal/ui'

// ── Primitive map ────────────────────────────────────────────────────────────
// Mirrors the renderer's componentResolver. Any custom_widget nodes fall
// back to a small stub card — the preview is explicitly not a production
// environment, so we don't load widget bundles.

type ComponentType = React.ComponentType<Record<string, unknown>>

const PRIMITIVES: Record<string, ComponentType> = {
  Stack: Stack as ComponentType,
  Grid: Grid as ComponentType,
  Divider: Divider as ComponentType,
  Card: Card as ComponentType,
  Tabs: Tabs as ComponentType,
  Accordion: Accordion as ComponentType,
  Modal: Modal as ComponentType,
  Button: Button as ComponentType,
  IconButton: IconButton as ComponentType,
  Link: UILink as ComponentType,
  DropdownMenu: DropdownMenu as ComponentType,
  Alert: Alert as ComponentType,
  Toast: Toast as ComponentType,
  Spinner: Spinner as ComponentType,
  Skeleton: Skeleton as ComponentType,
  EmptyState: EmptyState as ComponentType,
  Heading: Heading as ComponentType,
  Text: Text as ComponentType,
  Badge: Badge as ComponentType,
  Avatar: Avatar as ComponentType,
  Tag: Tag as ComponentType,
  StatCard: StatCard as ComponentType,
  DataTable: DataTable as ComponentType,
  Chart: Chart as ComponentType,
  TextInput: TextInput as ComponentType,
  NumberInput: NumberInput as ComponentType,
  Select: Select as ComponentType,
  MultiSelect: MultiSelect as ComponentType,
  DatePicker: DatePicker as ComponentType,
  Checkbox: Checkbox as ComponentType,
  Toggle: Toggle as ComponentType,
  RadioGroup: RadioGroup as ComponentType,
  Textarea: Textarea as ComponentType,
  FileUpload: FileUpload as ComponentType,
  RichText: Text as ComponentType,
}

// ── Preview contexts ──────────────────────────────────────────────────────────

interface PreviewBindingCtx {
  // Shaped to mirror the renderer's full BindingContext so resolveBinding
  // works identically — bindings like `{{datasource.shipment.id}}` or
  // `{{params.id}}` resolve the same way as in production.
  context: {
    datasource: Record<string, unknown>
    params: Record<string, string>
    user: { id: string; email: string; groups: string[] } | undefined
    env: 'STAGING' | 'PRODUCTION'
    state: Record<string, unknown>
    form: Record<string, unknown>
  }
  resolve: (expr: string) => unknown
}

const PreviewBindingContext = createContext<PreviewBindingCtx>({
  context: {
    datasource: {}, params: {}, user: undefined,
    env: 'STAGING', state: {}, form: {},
  },
  resolve: () => undefined,
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

// ── Visibility + permission helpers ──────────────────────────────────────────

function isVisible(v: NodeVisibility | undefined, groups: string[]): boolean {
  if (!v) return true
  if (v.requireGroups && v.requireGroups.length > 0 && !v.requireGroups.some(g => groups.includes(g))) {
    return false
  }
  if (v.hideForGroups && v.hideForGroups.length > 0 && v.hideForGroups.some(g => groups.includes(g))) {
    return false
  }
  return true
}

// ── PreviewNode — real primitive rendering with binding + dataSource support ─

function PreviewNode({ node }: { node: ComponentNode }): React.ReactElement | null {
  const { context, resolve } = useContext(PreviewBindingContext)
  const { executeAction } = useContext(PreviewActionContext)

  // Visibility hook — same semantics as production renderer
  const groups = context.user?.groups ?? []
  if (!isVisible(node.visibility, groups)) return null

  // Resolve all bindings into a flat props map
  const resolvedBindings: Record<string, unknown> = {}
  for (const [key, expr] of Object.entries(node.bindings ?? {})) {
    resolvedBindings[key] = resolve(expr)
  }

  // Merge: static props < resolved bindings
  let props: Record<string, unknown> = { ...node.props, ...resolvedBindings }

  // ── dataSource injection ───────────────────────────────────────────────
  // Same rule as production renderer: when a node has `dataSource.alias`,
  // inject `context.datasource[alias]` as the `data` prop. DataTables and
  // other list consumers pick it up automatically.
  const dsAlias = node.dataSource?.alias
  if (dsAlias) {
    props = { data: context.datasource[dsAlias] ?? [], ...props }
  }

  // ── Action bindings → intercepted callbacks ───────────────────────────
  const handlers: Record<string, (...args: unknown[]) => void> = {}
  for (const binding of node.actions ?? []) {
    handlers[binding.trigger] = (...args: unknown[]) => {
      executeAction(binding.actionId, binding.trigger, {
        params: binding.params,
        eventArg: args[0],
      })
    }
  }

  // ── Tabs content wiring (matches production) ───────────────────────────
  let childrenOverride: React.ReactNode | undefined
  let suppressChildren = false
  if (node.type === 'Tabs' && Array.isArray(props['items'])) {
    const items = (props['items'] as Array<Record<string, unknown>>).map((item, idx) => ({
      ...item,
      content: node.children[idx]
        ? <PreviewNode key={node.children[idx]!.id} node={node.children[idx]!} />
        : null,
    }))
    props = { ...props, items }
    suppressChildren = true
  }

  const children = suppressChildren
    ? undefined
    : node.children && node.children.length > 0
      ? node.children.map(child => <PreviewNode key={child.id} node={child} />)
      : undefined
  if (children !== undefined) childrenOverride = children

  const Component = PRIMITIVES[node.type]
  if (!Component) {
    // custom_widget or unknown type — render a stub so users see it but
    // know it's not the full production widget
    return (
      <div
        className="rounded border border-dashed border-yellow-400 bg-yellow-50/40 p-3 text-xs text-yellow-800"
        style={node.style as React.CSSProperties}
      >
        <div className="font-semibold">{node.type}</div>
        <div className="opacity-70">Preview stub — widgets render fully in production.</div>
      </div>
    )
  }

  return (
    <Component {...props} {...handlers}>
      {childrenOverride}
    </Component>
  )
}

// ── Action log panel ──────────────────────────────────────────────────────────

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

  // Poll for schema updates every 2s — lets the Builder push edits into the
  // preview tab without requiring a manual refresh.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/preview/${session.token}`, { cache: 'no-store' })
        if (res.ok) {
          const data = (await res.json()) as { session: PreviewSession }
          setCurrentSession(data.session)
        }
      } catch { /* non-critical */ }
    }, 2000)
    return () => clearInterval(id)
  }, [session.token])

  useEffect(() => {
    const handler = (e: Event): void => {
      const ce = e as CustomEvent<string>
      setFrameWidth(ce.detail)
    }
    window.addEventListener('preview:breakpoint', handler)
    return () => window.removeEventListener('preview:breakpoint', handler)
  }, [])

  // Shape `mockData` into the full BindingContext. The builder's
  // usePreviewTab sends `{ datasource: { alias: ... } }` already; we fill in
  // defaults for the rest so resolveBinding is happy.
  const context = useMemo(() => {
    const md = (currentSession.mockData ?? {}) as Record<string, unknown>
    return {
      datasource: (md['datasource'] as Record<string, unknown>) ?? {},
      params: (md['params'] as Record<string, string>) ?? {},
      user: (md['user'] as { id: string; email: string; groups: string[] } | undefined),
      env: (md['env'] as 'STAGING' | 'PRODUCTION' | undefined) ?? 'STAGING',
      state: (md['state'] as Record<string, unknown>) ?? {},
      form: (md['form'] as Record<string, unknown>) ?? {},
    }
  }, [currentSession.mockData])

  const resolve = (expr: string): unknown => {
    try {
      return resolveBindingImpl(expr, context as never)
    } catch {
      return undefined
    }
  }

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
    <PreviewBindingContext.Provider value={{ context, resolve }}>
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

          {/* Action log panel */}
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
