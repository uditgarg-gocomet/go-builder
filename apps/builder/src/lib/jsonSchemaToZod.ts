// ── JSON Schema → Zod shape adapter ──────────────────────────────────────────
// Registry rows store `propsSchema` as JSON Schema. The property editor's
// PropField + StaticInput are Zod-coupled (use `instanceof z.ZodString`,
// `z.ZodEnum`, etc.). This converter bridges the two so we don't need to
// rewrite the editor.
//
// Scope: handles the property kinds we actually emit from widget / primitive
// manifests today — string, number, integer, boolean, array, object, and
// string enums. Falls back to `z.unknown()` (which StaticInput renders as a
// JSON textarea) for anything richer.

import { z } from 'zod'

export interface JsonSchemaProperty {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
  enum?: unknown[]
  default?: unknown
  description?: string
  items?: JsonSchemaProperty
  properties?: Record<string, JsonSchemaProperty>
  required?: string[]
  minimum?: number
  maximum?: number
}

export interface JsonSchemaObject {
  type: 'object'
  properties?: Record<string, JsonSchemaProperty>
  required?: string[]
}

export function isJsonSchemaObject(value: unknown): value is JsonSchemaObject {
  if (!value || typeof value !== 'object') return false
  const v = value as { type?: unknown; properties?: unknown }
  return v.type === 'object' && typeof v.properties === 'object'
}

export function jsonSchemaToZodShape(
  schema: JsonSchemaObject,
): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {}
  const required = new Set(schema.required ?? [])

  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    let zodType = jsonSchemaPropertyToZod(prop)
    if (!required.has(key)) {
      zodType = zodType.optional()
    }
    if (prop.default !== undefined) {
      // `as never` keeps Zod's stricter inference happy with `unknown` defaults.
      zodType = zodType.default(prop.default as never)
    }
    shape[key] = zodType
  }

  return shape
}

function jsonSchemaPropertyToZod(prop: JsonSchemaProperty): z.ZodTypeAny {
  // String enum — the only enum kind we actually emit from manifests.
  if (
    Array.isArray(prop.enum) &&
    prop.enum.length > 0 &&
    prop.enum.every(v => typeof v === 'string')
  ) {
    return z.enum(prop.enum as [string, ...string[]])
  }

  switch (prop.type) {
    case 'string':
      return z.string()
    case 'number':
    case 'integer':
      return z.number()
    case 'boolean':
      return z.boolean()
    case 'array':
      return z.array(prop.items ? jsonSchemaPropertyToZod(prop.items) : z.unknown())
    case 'object':
      if (prop.properties) {
        return z.object(jsonSchemaToZodShape(prop as JsonSchemaObject))
      }
      return z.record(z.string(), z.unknown())
    default:
      return z.unknown()
  }
}
