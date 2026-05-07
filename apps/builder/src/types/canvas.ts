import type { ComponentDataSource, NodeVisibility } from '@portal/core'

export interface CanvasNode {
  id: string
  type: string
  source: 'primitive' | 'custom_widget' | 'prebuilt_view'
  props: Record<string, unknown>
  bindings: Record<string, string>
  actions: Array<{ trigger: string; actionId: string; params?: Record<string, unknown> | undefined }>
  style: Record<string, unknown>
  responsive: { tablet?: Record<string, unknown> | undefined; mobile?: Record<string, unknown> | undefined }
  dataSource?: ComponentDataSource | undefined
  visibility?: NodeVisibility | undefined
}

export interface DragState {
  draggedNodeId: string
  sourceParentId: string | null
  overParentId: string | null
  overPosition: number
}

export interface CanvasState {
  nodes: Record<string, CanvasNode>
  rootId: string
  childMap: Record<string, string[]>
  parentMap: Record<string, string>
  selectedNodeId: string | null
  hoveredNodeId: string | null
  dragState: DragState | null
}

export type Breakpoint = 'desktop' | 'tablet' | 'mobile'

// App + Page types not in @portal/core (builder-local)
export interface AppMeta {
  id: string
  name: string
  slug: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface PageMeta {
  id: string
  appId: string
  name: string
  slug: string
  order: number
  createdAt: string
}

export interface AppIdentityProvider {
  id: string
  displayName: string
  protocol: 'OIDC' | 'SAML'
  environment: 'STAGING' | 'PRODUCTION'
  enabled: boolean
}

export interface AppUserGroup {
  id: string
  name: string
  description?: string | undefined
  members?: string[] | undefined
}

export interface ClipboardEntry {
  subtree: {
    nodes: Record<string, CanvasNode>
    rootId: string
    childMap: Record<string, string[]>
  }
  copiedAt: number
}
