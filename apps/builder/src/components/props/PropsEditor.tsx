'use client'

import React from 'react'
import { z } from 'zod'
import { useCanvasStore } from '@/stores/canvasStore'
import { useRegistryStore } from '@/stores/registryStore'
import { isJsonSchemaObject, jsonSchemaToZodShape } from '@/lib/jsonSchemaToZod'
import { PropField } from './PropField'
import { ActionsEditor } from './ActionsEditor'
import { StyleEditor } from './StyleEditor'

function getZodShape(schema: unknown): Record<string, z.ZodTypeAny> | null {
  // Legacy: in-memory Zod object (kept for any caller still passing one).
  if (schema && typeof schema === 'object' && 'shape' in schema) {
    return (schema as z.ZodObject<z.ZodRawShape>).shape as Record<string, z.ZodTypeAny>
  }
  // Registry rows store JSON Schema — bridge it to Zod so PropField stays
  // unchanged.
  if (isJsonSchemaObject(schema)) {
    return jsonSchemaToZodShape(schema)
  }
  return null
}

// The /registry/entries API returns `currentVersionDetails` (single), but the
// shared RegistryEntry type still declares `versions?: []`. Read both so
// either runtime shape works.
function pickVersionDetails(entry: unknown): { propsSchema?: unknown } | null {
  if (!entry || typeof entry !== 'object') return null
  const e = entry as {
    currentVersion?: string
    currentVersionDetails?: { propsSchema?: unknown }
    versions?: Array<{ version: string; propsSchema?: unknown }>
  }
  if (e.currentVersionDetails) return e.currentVersionDetails
  if (e.versions && e.versions.length > 0) {
    return e.versions.find(v => v.version === e.currentVersion) ?? e.versions[0] ?? null
  }
  return null
}

export function PropsEditor(): React.ReactElement {
  const selectedNodeId = useCanvasStore(s => s.selectedNodeId)
  const node = useCanvasStore(s => selectedNodeId ? s.nodes[selectedNodeId] : null)
  const entries = useRegistryStore(s => s.entries)

  if (!selectedNodeId || !node) {
    return (
      <div className="flex h-full w-64 shrink-0 flex-col items-center justify-center border-l border-border bg-card p-4">
        <p className="text-center text-xs text-muted-foreground">Select a component to edit its properties</p>
      </div>
    )
  }

  const entry = entries.find(e => e.name === node.type)
  const versionEntry = pickVersionDetails(entry)
  const propsSchema = versionEntry?.propsSchema
  const shape = getZodShape(propsSchema)

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-l border-border bg-card">
      <div className="border-b border-border px-3 py-2.5">
        <p className="text-xs font-semibold text-foreground">{node.type}</p>
        <p className="text-[10px] text-muted-foreground">{selectedNodeId.slice(0, 8)}…</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Props */}
        {shape ? (
          <div className="flex flex-col gap-3 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Properties</p>
            {Object.entries(shape).map(([key, zodType]) => (
              <PropField
                key={key}
                nodeId={selectedNodeId}
                propKey={key}
                zodType={zodType}
                currentValue={node.props[key]}
                currentBinding={node.bindings[key]}
              />
            ))}
          </div>
        ) : (
          <div className="p-3">
            <p className="text-xs text-muted-foreground">No schema found for {node.type}</p>
          </div>
        )}

        {/* Actions */}
        <div className="border-t border-border p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</p>
          <ActionsEditor nodeId={selectedNodeId} node={node} />
        </div>

        {/* Style */}
        <StyleEditor nodeId={selectedNodeId} node={node} />
      </div>
    </div>
  )
}
