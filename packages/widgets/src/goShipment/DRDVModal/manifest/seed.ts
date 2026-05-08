import propsSchema from './propsSchema.json'
import type { WidgetSeedEntry } from '../../CancelShipmentModal/manifest/seed.js'

export const drdvModalSeedEntry: WidgetSeedEntry = {
  name: 'DRDVModal',
  displayName: 'DRDV Modal',
  description:
    'Document Review & Validation modal — two stages, server-driven actions, real API + mock toggle.',
  category: 'Widget',
  icon: 'file-check',
  tags: ['modal', 'drdv', 'document', 'verification', 'workflow', 'widget', 'shipment'],
  propsSchema,
  defaultProps: {
    open: false,
    swaId: 'de3c4868-57f9-48bd-b8c1-03a4c35b56cb',
    documentBucketId: 'draft_bill_of_lading',
    checklistTags: ['document_verification_step'],
    checklistId: '19.11',
    apiMode: 'mock',
    mockDelayMs: 800,
    hideCtas: false,
    extractionApprovedEventName: 'drdv:extraction-approved',
    verifySuccessEventName: 'drdv:verify-success',
    rejectSuccessEventName: 'drdv:reject-success',
    reverifySuccessEventName: 'drdv:reverify-success',
    retrySuccessEventName: 'drdv:retry-success',
    errorEventName: 'drdv:error',
    cancelEventName: 'drdv:cancel',
  },
}
