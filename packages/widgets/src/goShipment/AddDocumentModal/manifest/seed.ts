import propsSchema from './propsSchema.json'
import type { WidgetSeedEntry } from '../../CancelShipmentModal/manifest/seed.js'

export const addDocumentModalSeedEntry: WidgetSeedEntry = {
  name: 'AddDocumentModal',
  displayName: 'Add Document Modal',
  description:
    'Modal that uploads one-or-more files of a chosen document type to a shipment workflow. ' +
    'Switchable between mock and real API via the apiMode prop. Emits add-document:success | :error | :cancel ' +
    'and exposes onSuccess / onError / onClose triggers for action binding.',
  category: 'Widget',
  icon: 'upload',
  tags: ['modal', 'document', 'upload', 'widget', 'workflow', 'shipment'],
  propsSchema,
  defaultProps: {
    open: false,
    swaId: '',
    existingDocumentKeys: [],
    apiMode: 'mock',
    mockDelayMs: 800,
    milestoneId: 'Non CSI Documents',
    checklistId: '32',
    source: 'table',
    acceptedFileTypes: '.pdf,.png,.jpg,.jpeg,.zip,.eml,.xls,.xlsx,.doc,.docx',
    maxFileSizeMb: 10,
    allowMultiple: true,
    successEventName: 'add-document:success',
    errorEventName: 'add-document:error',
    cancelEventName: 'add-document:cancel',
  },
}
