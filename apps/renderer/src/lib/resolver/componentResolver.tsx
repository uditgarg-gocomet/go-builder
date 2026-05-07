'use client'

import React from 'react'
import type { ComponentNode } from '@portal/core'

// Static primitive map — all @portal/ui primitives resolved at build time
import {
  Stack,
  Grid,
  Divider,
  Card,
  Tabs,
  Accordion,
  Modal,
  Button,
  IconButton,
  Link,
  DropdownMenu,
  Alert,
  Toast,
  Spinner,
  Skeleton,
  EmptyState,
  Heading,
  Text,
  Badge,
  Avatar,
  Tag,
  StatCard,
  DataTable,
  Chart,
  TextInput,
  NumberInput,
  Select,
  MultiSelect,
  DatePicker,
  Checkbox,
  Toggle,
  RadioGroup,
  Textarea,
  FileUpload,
} from '@portal/ui'

// Static custom-widget imports. Widgets registered this way resolve without
// a CDN fetch — they're bundled with the renderer. Add new built-in widgets
// to `BUILT_IN_WIDGETS` below.
import { DRDV, drdvManifest } from '../../widgets/DRDV/index.js'

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
  Link: Link as ComponentType,
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
  RichText: Text as ComponentType, // fallback for RichText in read-only mode
}

// Runtime cache for custom widgets loaded from CDN
const widgetCache = new Map<string, ComponentType>()

// Built-in custom widgets — bundled with the renderer, no CDN fetch needed.
// Pre-seeded into widgetCache below so resolveComponent() finds them
// immediately.
const BUILT_IN_WIDGETS: Record<string, ComponentType> = {
  DRDV: DRDV as ComponentType,
}
for (const [name, comp] of Object.entries(BUILT_IN_WIDGETS)) {
  widgetCache.set(name, comp)
}

// ── Library-locked invariant ─────────────────────────────────────────────────
// For each custom widget, the manifest declares the exact set of props the
// page definition may supply. Any prop in the node definition that isn't in
// this allowlist is dropped before the widget is rendered — so the page
// definition cannot override internals of a registered widget.
const WIDGET_PROP_ALLOWLIST: Record<string, Set<string>> = {
  DRDV: new Set(Object.keys(drdvManifest.propsShape)),
}

export function filterWidgetProps(
  widgetName: string,
  props: Record<string, unknown>,
): Record<string, unknown> {
  const allowlist = WIDGET_PROP_ALLOWLIST[widgetName]
  if (!allowlist) return props
  const filtered: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (allowlist.has(key)) {
      filtered[key] = value
    } else if (process.env['NODE_ENV'] !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        `[renderer] Prop "${key}" on widget "${widgetName}" is not declared in its manifest and was dropped.`,
      )
    }
  }
  return filtered
}

export function isBuiltInWidget(widgetName: string): boolean {
  return widgetName in BUILT_IN_WIDGETS
}

function UnknownComponent({ type }: { type: string }): React.ReactElement {
  return (
    <div className="border border-dashed border-yellow-400 bg-yellow-50 p-3 text-xs text-yellow-800 rounded">
      Unknown component: {type}
    </div>
  )
}

export function resolveComponent(node: ComponentNode): ComponentType {
  switch (node.source) {
    case 'primitive': {
      const comp = PRIMITIVES[node.type]
      if (comp) return comp
      return (() => React.createElement(UnknownComponent, { type: node.type })) as ComponentType
    }

    case 'custom_widget': {
      const cached = widgetCache.get(node.type)
      if (cached) return cached
      return (() => React.createElement(UnknownComponent, { type: node.type })) as ComponentType
    }

    case 'prebuilt_view': {
      return createPrebuiltViewComponent(node)
    }

    default: {
      return (() => React.createElement(UnknownComponent, { type: node.type })) as ComponentType
    }
  }
}

// Flatten a ComponentNode tree into a list
function flattenNodes(node: ComponentNode): ComponentNode[] {
  return [node, ...node.children.flatMap(flattenNodes)]
}

export async function preloadCustomWidgets(nodes: ComponentNode[]): Promise<void> {
  const allNodes = nodes.flatMap(flattenNodes)
  const customWidgets = allNodes.filter(n => n.source === 'custom_widget')

  await Promise.all(
    customWidgets.map(async node => {
      if (widgetCache.has(node.type)) return

      // Expect bundleUrl in node props
      const bundleUrl = node.props['bundleUrl']
      if (typeof bundleUrl !== 'string') return

      try {
        const mod = await import(/* webpackIgnore: true */ bundleUrl) as Record<string, unknown>
        const Component = (mod['default'] ?? mod[node.type]) as ComponentType | undefined
        if (Component && typeof Component === 'function') {
          widgetCache.set(node.type, Component)
        }
      } catch (err) {
        console.error(`Failed to load custom widget "${node.type}" from ${bundleUrl}:`, err)
      }
    }),
  )
}

function createPrebuiltViewComponent(node: ComponentNode): ComponentType {
  // Lazy import to avoid circular dep with NodeRenderer
  const PrebuiltView = React.lazy(async () => {
    const { NodeRenderer } = await import('../renderer/schemaRenderer.js')
    return {
      default: function PrebuiltViewInner(): React.ReactElement {
        return (
          <>
            {node.children.map(child => (
              <NodeRenderer key={child.id} node={child} />
            ))}
          </>
        )
      },
    }
  })

  return function PrebuiltViewComponent(props: Record<string, unknown>): React.ReactElement {
    return (
      <React.Suspense fallback={<Spinner size="md" />}>
        <PrebuiltView {...props} />
      </React.Suspense>
    )
  }
}
