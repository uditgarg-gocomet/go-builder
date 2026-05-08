import propsSchema from './propsSchema.json'

const propsShape: Record<string, string> = Object.fromEntries(
  Object.entries(propsSchema.properties as Record<string, { type?: string }>).map(
    ([key, value]) => [key, value.type ?? 'unknown'],
  ),
)

export const drdvModalManifest = {
  name: 'DRDVModal',
  version: '1.0.0',
  displayName: 'DRDV Modal',
  category: 'Widget',
  description:
    'Document Review & Validation modal with two stages — extraction view (read-only fields + line items + iframe preview) and verification view (side-by-side compare + approve / reject / reverify). Server-driven action visibility; honors form_requisite from the API. Switchable mock/real via apiMode.',
  icon: 'file-check',
  tags: ['modal', 'drdv', 'document', 'verification', 'workflow', 'widget', 'shipment'],
  propsShape,
  events: [
    'drdv:extraction-approved',
    'drdv:verify-success',
    'drdv:reject-success',
    'drdv:reverify-success',
    'drdv:retry-success',
    'drdv:error',
    'drdv:cancel',
  ],
  triggers: [
    { name: 'onExtractionApproved', description: 'Fires when the user clicks Next on the extraction stage. Payload: { swaId, documentBucketId }.' },
    { name: 'onVerify',     description: 'Fires after a successful Verify action on the verification stage. Payload: { swaId, documentBucketId, approvalStatus, ... }.' },
    { name: 'onReject',     description: 'Fires after a successful Reject. Payload: { swaId, documentBucketId, approvalStatus, reason, remarks }.' },
    { name: 'onReverify',   description: 'Fires after Submit-to-Validate. Payload: { swaId, documentBucketId, approvalStatus, ... }.' },
    { name: 'onRetry',      description: 'Fires after the Retry-extraction call succeeds. Payload: { swaId, documentBucketId, triggeredCount?, message? }.' },
    { name: 'onError',      description: 'Fires on any failed step. Payload: { swaId, documentBucketId, step, error }.' },
    { name: 'onClose',      description: 'Fires whenever the modal would close. Payload: { swaId, documentBucketId, reason }.' },
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

export { propsSchema as drdvModalPropsSchema }
