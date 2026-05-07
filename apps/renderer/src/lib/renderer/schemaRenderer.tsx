'use client'

import React from 'react'
import type { ComponentNode, PageSchema } from '@portal/core'
import { resolveComponent } from '../resolver/componentResolver.js'
import { TrackedErrorBoundary } from '../../components/ErrorBoundary.js'
import { useResolvedProps, useResolvedActions } from '../../hooks/useResolvedProps.js'

// ── NodeRenderer ──────────────────────────────────────────────────────────────

export interface NodeRendererProps {
  node: ComponentNode
}

export function NodeRenderer({ node }: NodeRendererProps): React.ReactElement {
  const Component = resolveComponent(node)
  const resolvedProps = useResolvedProps(node)
  const resolvedActions = useResolvedActions(node)

  const children =
    node.children.length > 0
      ? node.children.map(child => <NodeRenderer key={child.id} node={child} />)
      : undefined

  return (
    <TrackedErrorBoundary nodeId={node.id} componentType={node.type}>
      <Component
        {...resolvedProps}
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
