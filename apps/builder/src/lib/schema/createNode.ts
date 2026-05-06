import type { RegistryEntry } from '@portal/core'
import type { CanvasNode } from '@/types/canvas'

export function createNode(
  type: string,
  source: CanvasNode['source'],
  registryEntry?: RegistryEntry,
): CanvasNode {
  const currentVersion = registryEntry?.currentVersion
  const versionEntry = registryEntry?.versions?.find(v => v.version === currentVersion)
  const defaultProps = (versionEntry?.defaultProps as Record<string, unknown> | undefined) ?? {}

  return {
    id: crypto.randomUUID(),
    type,
    source,
    props: { ...defaultProps },
    bindings: {},
    actions: [],
    style: {},
    responsive: {},
  }
}
