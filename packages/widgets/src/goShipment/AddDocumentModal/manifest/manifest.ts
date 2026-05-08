import propsSchema from './propsSchema.json'

const propsShape: Record<string, string> = Object.fromEntries(
  Object.entries(propsSchema.properties as Record<string, { type?: string }>).map(
    ([key, value]) => [key, value.type ?? 'unknown'],
  ),
)

export const addDocumentModalManifest = {
  name: 'AddDocumentModal',
  version: '1.0.0',
  displayName: 'Add Document Modal',
  category: 'Widget',
  description:
    'Modal that uploads one-or-more files of a chosen document type to a shipment workflow. ' +
    'Switchable between mock and real API via the apiMode prop. Emits add-document:success | :error | :cancel ' +
    'and exposes onSuccess / onError / onClose triggers for action binding.',
  icon: 'upload',
  tags: ['modal', 'document', 'upload', 'widget', 'workflow', 'shipment'],
  propsShape,
  events: [
    'add-document:success',
    'add-document:error',
    'add-document:cancel',
  ],
  triggers: [
    { name: 'onSuccess', description: 'Fires after a successful upload + attach. Payload: { swaId, documentKey, documentName, documentIds, fileCount, message }.' },
    { name: 'onError',   description: 'Fires on failure (any step). Payload: { swaId, documentKey?, fileCount, error }.' },
    { name: 'onClose',   description: 'Fires whenever the modal would close (after_success | user_dismissed). Payload: { swaId, reason }.' },
  ],
} satisfies {
  name: string
  version: string
  displayName: string
  category: string
  description: string
  icon: string
  tags: string[]
  propsShape: Record<string, string>
  events: string[]
  triggers: ReadonlyArray<{ name: string; description: string }>
}

export { propsSchema as addDocumentModalPropsSchema }
