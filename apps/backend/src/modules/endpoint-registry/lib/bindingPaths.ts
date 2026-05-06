// Recursively walks a JSON Schema and returns all leaf paths.
// Array items produce paths with [] suffix e.g. "data.rows[].id"

interface JSONSchema {
  type?: string | string[]
  properties?: Record<string, JSONSchema>
  items?: JSONSchema
  $ref?: string
  [key: string]: unknown
}

export function computeBindingPaths(schema: JSONSchema, prefix = ''): string[] {
  if (!schema || typeof schema !== 'object') return []

  const paths: string[] = []
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type

  if (type === 'object' && schema.properties) {
    for (const [key, subSchema] of Object.entries(schema.properties)) {
      const fullPath = prefix ? `${prefix}.${key}` : key
      const subType = Array.isArray(subSchema.type) ? subSchema.type[0] : subSchema.type

      if (subType === 'object' && subSchema.properties) {
        // Recurse into nested object
        paths.push(...computeBindingPaths(subSchema, fullPath))
      } else if (subType === 'array') {
        // Add the array path itself
        paths.push(fullPath)
        // Recurse into array items
        if (subSchema.items) {
          const itemPaths = computeBindingPaths(subSchema.items, `${fullPath}[]`)
          paths.push(...itemPaths)
        }
      } else {
        // Leaf node
        paths.push(fullPath)
      }
    }
  } else if (type === 'array') {
    if (prefix) paths.push(prefix)
    if (schema.items) {
      const itemPaths = computeBindingPaths(schema.items, `${prefix}[]`)
      paths.push(...itemPaths)
    }
  } else {
    // Leaf at root
    if (prefix) paths.push(prefix)
  }

  return paths
}
