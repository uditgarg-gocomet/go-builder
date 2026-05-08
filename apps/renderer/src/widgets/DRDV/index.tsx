'use client'

// ── DRDV Widget ──────────────────────────────────────────────────────────────
// Document Review & Data Validation widget. Mimics the GoComet shipment-detail
// document review modal (see POC objective doc page 3).
//
// POC contract:
//   - Registered with the App Builder via manifest (see `drdvManifest` below)
//   - Declares its configuration shape (`DRDVConfigSchema`)
//   - Consumes a typed documents-list binding
//   - Emits `drdv:approve` / `drdv:reject` on the eventBus when the user acts
//   - Consults BindingContext.user.groups for per-field edit-vs-view and for
//     whether the Approve/Reject actions are enabled (widget permission hook)
//   - Same widget mounted twice with different `config` produces visibly
//     different behaviour on the same page (configuration-only differentiation)

import React, { useMemo, useState } from 'react'
import { z } from 'zod'
import { eventBus } from '@portal/action-runtime'
import type { WidgetPermissions } from '@portal/core'
import { useBindingContext } from '../../lib/binding/bindingContext.js'

// ── Data + config contracts ──────────────────────────────────────────────────

export const DRDVDocumentFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  value: z.union([z.string(), z.number(), z.null()]),
  source: z.string().optional(),
})

export const DRDVDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['Ready', 'Extraction Error', 'Validation Pending', 'Pending']),
  dueDate: z.string().optional(),
  extractionScore: z.string().optional(),
  validationScore: z.string().optional(),
  fields: z.array(DRDVDocumentFieldSchema),
})

export const DRDVConfigSchema = z.object({
  // Which field names to show (in order). An empty array = all fields.
  fieldsToShow: z.array(z.string()).default([]),
  // Per-field validation rules keyed by field name
  validationRules: z
    .record(
      z.string(),
      z.object({
        required: z.boolean().optional(),
        minLength: z.number().int().positive().optional(),
      }),
    )
    .default({}),
  // Whether to show the Approve/Reject action bar
  showActions: z.boolean().default(true),
  // Optional header label so the same widget can be distinguished on screen
  // when mounted twice with different configs.
  heading: z.string().optional(),
})

export type DRDVDocumentField = z.infer<typeof DRDVDocumentFieldSchema>
export type DRDVDocument = z.infer<typeof DRDVDocumentSchema>
export type DRDVConfig = z.infer<typeof DRDVConfigSchema>

// ── Props ────────────────────────────────────────────────────────────────────

export interface DRDVApprovePayload {
  documentId: string | undefined
  documentName: string | undefined
  edits: Record<string, string>
}

export interface DRDVRejectPayload {
  documentId: string | undefined
  documentName: string | undefined
}

export interface DRDVProps {
  documents?: DRDVDocument[]
  config?: Partial<DRDVConfig>
  // Which document to display. Defaults to the first document.
  selectedDocumentId?: string
  // Optional event name overrides so the page can wire an ActionBinding to
  // the exact emit name if it wants to.
  approveEventName?: string
  rejectEventName?: string
  // Action-binding triggers. Fire alongside the eventBus emit so the page
  // schema can wire them via `actions: [{ trigger: 'onApprove', actionId: … }]`.
  // Payload is identical to the eventBus emit's data.
  onApprove?: (payload: DRDVApprovePayload) => void
  onReject?: (payload: DRDVRejectPayload) => void
}

// ── Permissions helpers ──────────────────────────────────────────────────────

// When no permissions are declared, we default-open so static previews and
// unauthenticated dev flows work. Production widgets SHOULD declare
// permissions via the registry manifest.
function canEditField(
  fieldName: string,
  userGroups: string[],
  perms: WidgetPermissions | undefined,
): boolean {
  const rule = perms?.fields?.[fieldName]
  if (!rule?.editFor || rule.editFor.length === 0) return true
  return rule.editFor.some(g => userGroups.includes(g))
}

function canFireAction(
  actionName: string,
  userGroups: string[],
  perms: WidgetPermissions | undefined,
): boolean {
  const rule = perms?.actions?.[actionName]
  if (!rule?.enabledFor || rule.enabledFor.length === 0) return true
  return rule.enabledFor.some(g => userGroups.includes(g))
}

// ── Component ────────────────────────────────────────────────────────────────

export function DRDV(props: DRDVProps): React.ReactElement {
  const { context } = useBindingContext()
  const userGroups = context.user?.groups ?? []

  const config: DRDVConfig = {
    fieldsToShow: props.config?.fieldsToShow ?? [],
    validationRules: props.config?.validationRules ?? {},
    showActions: props.config?.showActions ?? true,
    heading: props.config?.heading,
  }

  const documents = props.documents ?? []
  const selected = useMemo(() => {
    if (documents.length === 0) return null
    if (props.selectedDocumentId) {
      return documents.find(d => d.id === props.selectedDocumentId) ?? documents[0]
    }
    return documents[0]
  }, [documents, props.selectedDocumentId])

  // Track edits locally so view vs edit is observable in the UI. This is a
  // POC demonstration — real widgets would write back to a form or data store.
  const [edits, setEdits] = useState<Record<string, string>>({})

  // Permissions on the widget version. These come from the registry at
  // build-time via the manifest and are attached to the component for runtime
  // read. See `drdvManifest` at the bottom of this file.
  const perms: WidgetPermissions | undefined = drdvManifest.permissions

  const approveEnabled = canFireAction('approve', userGroups, perms)
  const rejectEnabled = canFireAction('reject', userGroups, perms)
  const approveEventName = props.approveEventName ?? 'drdv:approve'
  const rejectEventName = props.rejectEventName ?? 'drdv:reject'

  if (!selected) {
    return (
      <div className="border rounded-lg p-4 bg-muted/20 text-sm text-muted-foreground">
        No documents available.
      </div>
    )
  }

  // Filter + order fields by config
  const orderedFields =
    config.fieldsToShow.length > 0
      ? (config.fieldsToShow
          .map(n => selected.fields.find(f => f.name === n))
          .filter((f): f is DRDVDocumentField => f !== undefined))
      : selected.fields

  function onApprove(): void {
    if (!approveEnabled) return
    const payload: DRDVApprovePayload = {
      documentId: selected?.id,
      documentName: selected?.name,
      edits,
    }
    eventBus.emit(approveEventName, payload)
    props.onApprove?.(payload)
  }

  function onReject(): void {
    if (!rejectEnabled) return
    const payload: DRDVRejectPayload = {
      documentId: selected?.id,
      documentName: selected?.name,
    }
    eventBus.emit(rejectEventName, payload)
    props.onReject?.(payload)
  }

  return (
    <div className="border rounded-lg bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b flex items-center justify-between gap-4">
        <div>
          <div className="text-base font-semibold">
            {config.heading ?? `${selected.name} - Extraction`}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {selected.status}
            {selected.dueDate ? ` • Due ${selected.dueDate}` : ''}
          </div>
        </div>
        <div className="text-xs">
          {userGroups.length > 0 ? (
            <span className="px-2 py-1 rounded bg-muted text-muted-foreground">
              Role: {userGroups.join(', ')}
            </span>
          ) : null}
        </div>
      </div>

      {/* Field grid */}
      <div className="px-5 py-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="pb-2 font-semibold">Field Name</th>
              <th className="pb-2 font-semibold">Value</th>
              <th className="pb-2 font-semibold">Source</th>
            </tr>
          </thead>
          <tbody>
            {orderedFields.map(field => {
              const editable = canEditField(field.name, userGroups, perms)
              const displayValue =
                edits[field.name] ?? (field.value === null ? '-' : String(field.value))
              const rule = config.validationRules[field.name]
              const violatesRequired =
                rule?.required === true && (displayValue === '-' || displayValue === '')

              return (
                <tr key={field.name} className="border-t">
                  <td className="py-2 pr-4 align-middle">{field.label}</td>
                  <td className="py-2 pr-4 align-middle">
                    {editable ? (
                      <input
                        className={[
                          'w-full rounded border px-2 py-1 text-sm',
                          violatesRequired
                            ? 'border-red-400 bg-red-50'
                            : 'border-input bg-background',
                        ].join(' ')}
                        defaultValue={displayValue}
                        onChange={e =>
                          setEdits(prev => ({ ...prev, [field.name]: e.target.value }))
                        }
                        aria-invalid={violatesRequired}
                      />
                    ) : (
                      <span
                        className={[
                          'inline-block w-full rounded border px-2 py-1 bg-muted/30 text-muted-foreground',
                          violatesRequired ? 'border-red-300' : 'border-transparent',
                        ].join(' ')}
                      >
                        {displayValue}
                      </span>
                    )}
                  </td>
                  <td className="py-2 align-middle text-xs text-blue-600">
                    {field.source ?? '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Action bar */}
      {config.showActions && (
        <div className="px-5 py-3 border-t flex items-center justify-end gap-2 bg-muted/20">
          <button
            type="button"
            disabled={!rejectEnabled}
            onClick={onReject}
            className={[
              'px-3 py-1.5 rounded text-sm border',
              rejectEnabled
                ? 'border-input bg-background hover:bg-muted'
                : 'border-input bg-muted text-muted-foreground cursor-not-allowed opacity-60',
            ].join(' ')}
            aria-disabled={!rejectEnabled}
            title={rejectEnabled ? 'Reject document' : 'You do not have permission to reject'}
          >
            Reject
          </button>
          <button
            type="button"
            disabled={!approveEnabled}
            onClick={onApprove}
            className={[
              'px-3 py-1.5 rounded text-sm font-medium',
              approveEnabled
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-300 text-white cursor-not-allowed opacity-70',
            ].join(' ')}
            aria-disabled={!approveEnabled}
            title={approveEnabled ? 'Approve document' : 'You do not have permission to approve'}
          >
            Approve
          </button>
        </div>
      )}
    </div>
  )
}

// ── Manifest ─────────────────────────────────────────────────────────────────
// Read by both the registry seeder (so this is what's written into Postgres)
// and by the widget itself at render time (so permission checks are a single
// source of truth).

export const drdvManifest = {
  name: 'DRDV',
  version: '1.0.0',
  displayName: 'Document Review & Data Validation',
  category: 'Data',
  description: 'Renders a document extraction view with configurable fields, validation rules, and Approve/Reject actions.',
  icon: 'file-check',
  tags: ['document', 'review', 'approve', 'drdv'],
  propsShape: {
    documents: 'DRDVDocument[]',
    config: 'Partial<DRDVConfig>',
    selectedDocumentId: 'string?',
    approveEventName: 'string?',
    rejectEventName: 'string?',
  },
  events: ['drdv:approve', 'drdv:reject'],
  permissions: {
    fields: {
      // `blType`, `quantity`, `totalCbm`, `netWeight`, `grossWeight` are all
      // editable by admins; view-only for viewers.
      blType: { editFor: ['ops_admin'] },
      quantity: { editFor: ['ops_admin'] },
      totalCbm: { editFor: ['ops_admin'] },
      netWeight: { editFor: ['ops_admin'] },
      grossWeight: { editFor: ['ops_admin'] },
      // `shipper` and `consignee` always view-only (even for admins in POC)
      shipper: { viewFor: ['ops_admin', 'ops_viewer'] },
      consignee: { viewFor: ['ops_admin', 'ops_viewer'] },
    },
    actions: {
      approve: { enabledFor: ['ops_admin'] },
      reject: { enabledFor: ['ops_admin'] },
    },
  },
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
  permissions: WidgetPermissions
}

export default DRDV
