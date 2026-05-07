'use client'

import React from 'react'
import type { ComponentNode, NodeVisibility, PageSchema } from '@portal/core'
import { resolveComponent, filterWidgetProps, isBuiltInWidget } from '../resolver/componentResolver.js'
import { TrackedErrorBoundary } from '../../components/ErrorBoundary.js'
import { useResolvedProps, useResolvedActions } from '../../hooks/useResolvedProps.js'
import { useBindingContext } from '../binding/bindingContext.js'

// ── Visibility check (renderer permission hook) ──────────────────────────────
// Applied per-node in NodeRenderer. When the rule fails the node and its whole
// subtree are removed from the React tree — not CSS-hidden. This satisfies the
// "hidden nav item not present in DOM" acceptance criterion.

function isVisible(
  visibility: NodeVisibility | undefined,
  userGroups: string[],
): boolean {
  if (!visibility) return true

  const groups = userGroups ?? []

  if (visibility.requireGroups && visibility.requireGroups.length > 0) {
    const hasAny = visibility.requireGroups.some(g => groups.includes(g))
    if (!hasAny) return false
  }

  if (visibility.hideForGroups && visibility.hideForGroups.length > 0) {
    const hasHidden = visibility.hideForGroups.some(g => groups.includes(g))
    if (hasHidden) return false
  }

  return true
}

// ── NodeRenderer ──────────────────────────────────────────────────────────────

export interface NodeRendererProps {
  node: ComponentNode
}

export function NodeRenderer({ node }: NodeRendererProps): React.ReactElement | null {
  const { context } = useBindingContext()
  const userGroups = context.user?.groups ?? []

  // Hooks must run unconditionally (React rules of hooks). We always call
  // these and decide what to render afterwards.
  const Component = resolveComponent(node)
  const resolvedProps = useResolvedProps(node)
  const resolvedActions = useResolvedActions(node)

  if (!isVisible(node.visibility, userGroups)) {
    return null
  }

  // Library-locked invariant: for built-in custom widgets, filter props to
  // the manifest's declared shape. Overrides injected via the page definition
  // that aren't declared by the widget are dropped so the page cannot reach
  // into widget internals.
  const safeProps =
    node.source === 'custom_widget' && isBuiltInWidget(node.type)
      ? filterWidgetProps(node.type, resolvedProps)
      : resolvedProps

  const children =
    node.children.length > 0
      ? node.children.map(child => <NodeRenderer key={child.id} node={child} />)
      : undefined

  return (
    <TrackedErrorBoundary nodeId={node.id} componentType={node.type}>
      <Component
        {...safeProps}
        {...resolvedActions}
      >
        {children}
      </Component>
    </TrackedErrorBoundary>
  )
}

// ── SchemaRenderer ────────────────────────────────────────────────────────────

export interface SchemaRendererProps {
  schema: PageSchema
}

export function SchemaRenderer({ schema }: SchemaRendererProps): React.ReactElement {
  return <NodeRenderer node={schema.layout} />
}
