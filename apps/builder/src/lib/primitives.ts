import type React from 'react'

// Static map of primitive name → component. Populated lazily at module load time.
// All imports must be from the built @portal/ui package.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PRIMITIVES: Record<string, React.ComponentType<any>> = {}

export function registerPrimitives(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: Record<string, React.ComponentType<any>>
): void {
  Object.assign(PRIMITIVES, map)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolvePrimitive(type: string): React.ComponentType<any> | null {
  return PRIMITIVES[type] ?? null
}
