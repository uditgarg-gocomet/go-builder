'use client'

import { useMemo } from 'react'
import { resolveBinding } from '@portal/action-runtime'
import type { ComponentNode } from '@portal/core'
import { useBindingContext } from '../lib/binding/bindingContext.js'
import { useResponsiveProps } from '../lib/resolver/responsiveResolver.js'
import { useActionContext } from '../lib/actions/actionContext.js'

export function useResolvedProps(node: ComponentNode): Record<string, unknown> {
  const { context } = useBindingContext()
  const responsiveOverrides = useResponsiveProps(node)

  return useMemo(() => {
    const resolvedBindings: Record<string, unknown> = {}
    for (const [key, expression] of Object.entries(node.bindings)) {
      try {
        resolvedBindings[key] = resolveBinding(expression, context)
      } catch {
        resolvedBindings[key] = undefined
      }
    }

    // Merge: static props < resolved bindings < responsive overrides
    return {
      ...node.props,
      ...resolvedBindings,
      ...responsiveOverrides,
      style: {
        ...(node.style as React.CSSProperties),
        ...(responsiveOverrides['style'] as React.CSSProperties | undefined),
      },
    }
  }, [node.props, node.bindings, node.style, responsiveOverrides, context])
}

export function useResolvedActions(node: ComponentNode): Record<string, () => void> {
  const { execute } = useActionContext()

  return useMemo(() => {
    const handlers: Record<string, () => void> = {}
    for (const binding of node.actions) {
      handlers[binding.trigger] = () => {
        void execute(binding.actionId, binding.params as Record<string, unknown> | undefined)
      }
    }
    return handlers
  }, [node.actions, execute])
}
