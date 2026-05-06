const BINDING_PATTERN = /\{\{([^}]+)\}\}/g

export function resolveBinding(expression: string, context: Record<string, unknown>): unknown {
  const match = expression.match(/^\{\{([^}]+)\}\}$/)
  if (match?.[1]) {
    return resolvePath(match[1].trim(), context)
  }
  return expression.replace(BINDING_PATTERN, (_, path: string) => {
    const value = resolvePath(path.trim(), context)
    return value != null ? String(value) : ''
  })
}

function resolvePath(path: string, context: Record<string, unknown>): unknown {
  const parts = path.split('.')
  let current: unknown = context
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function deepResolve(obj: unknown, context: Record<string, unknown>): unknown {
  if (typeof obj === 'string') return resolveBinding(obj, context)
  if (Array.isArray(obj)) return obj.map((item) => deepResolve(item, context))
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, deepResolve(v, context)])
    )
  }
  return obj
}
