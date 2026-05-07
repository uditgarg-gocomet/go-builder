import type { RegistryEntry } from '@portal/core'
import type { CanvasNode } from '@/types/canvas'

// The /registry/entries API returns `currentVersionDetails` (single), but the
// shared RegistryEntry type still declares `versions?: []`. Read both so
// either runtime shape works.
function pickVersionDefaults(entry: RegistryEntry | undefined): Record<string, unknown> {
  if (!entry) return {}
  const e = entry as RegistryEntry & {
    currentVersionDetails?: { defaultProps?: unknown }
  }
  if (e.currentVersionDetails?.defaultProps) {
    return e.currentVersionDetails.defaultProps as Record<string, unknown>
  }
  if (e.versions && e.versions.length > 0) {
    const v = e.versions.find(x => x.version === e.currentVersion) ?? e.versions[0]
    return (v?.defaultProps as Record<string, unknown> | undefined) ?? {}
  }
  return {}
}

export function createNode(
  type: string,
  source: CanvasNode['source'],
  registryEntry?: RegistryEntry,
): CanvasNode {
  const defaultProps = pickVersionDefaults(registryEntry)

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
