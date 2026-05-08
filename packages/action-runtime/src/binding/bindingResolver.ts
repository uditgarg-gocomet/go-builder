import type { BindingContext } from '@portal/core'

const BINDING_PATTERN = /\{\{([^}]+)\}\}/g

// Fallback operator: `{{a || b || c}}` returns the first non-empty value
// among the resolved paths. Treats `null`, `undefined`, and `''` as empty.
// Paths on either side are trimmed individually.
function resolveWithFallback(expr: string, context: Record<string, unknown>): unknown {
  const parts = expr.split('||').map(p => p.trim()).filter(p => p.length > 0)
  for (const p of parts) {
    const v = resolvePath(p, context)
    if (v !== undefined && v !== null && v !== '') return v
  }
  // When all paths are empty, return `undefined` so string-template
  // interpolation renders as empty rather than 'undefined'.
  return undefined
}

export function resolveBinding(expression: string, context: BindingContext): unknown {
  const match = expression.match(/^\{\{([^}]+)\}\}$/)
  if (match?.[1] != null) {
    return resolveWithFallback(match[1].trim(), context as Record<string, unknown>)
  }
  return expression.replace(BINDING_PATTERN, (_, path: string) => {
    const value = resolveWithFallback(path.trim(), context as Record<string, unknown>)
    return value != null ? String(value) : ''
  })
}

function resolvePath(path: string, context: Record<string, unknown>): unknown {
  const parts = path.split('.')
  let current: unknown = context
  for (const part of parts) {
    if (current == null) return undefined
    // array notation: rows[] — walk into each item and collect values
    if (part.endsWith('[]')) {
      const key = part.slice(0, -2)
      if (typeof current !== 'object') return undefined
      const arr = (current as Record<string, unknown>)[key]
      if (!Array.isArray(arr)) return undefined
      return arr
    }
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function interpolate(value: unknown, context: BindingContext): unknown {
  if (typeof value === 'string') {
    if (BINDING_PATTERN.test(value)) {
      BINDING_PATTERN.lastIndex = 0
      return resolveBinding(value, context)
    }
    return value
  }
  if (Array.isArray(value)) {
    return value.map(item => interpolate(item, context))
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, interpolate(v, context)])
    )
  }
  return value
}

export function deepResolve(obj: unknown, context: BindingContext): unknown {
  return interpolate(obj, context)
}
