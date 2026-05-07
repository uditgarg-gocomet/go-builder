'use client'

// ── CancelShipmentModalView ──────────────────────────────────────────────────
// Pure presentation. No state, no eventBus, no fetch. The container passes
// the view-model + a few static props down. This is where designers iterate.

import React from 'react'
import { Modal, Select, Textarea, Button } from '@portal/ui'
import { CANCEL_REASONS, COPY } from './constants.js'
import type { CancelShipmentModalViewModel } from './hook.js'

export interface CancelShipmentModalViewProps {
  open: boolean
  workflowId: string | undefined
  mockMode: 'success' | 'failure'
  vm: CancelShipmentModalViewModel
}

export function CancelShipmentModalView({
  open,
  workflowId,
  mockMode,
  vm,
}: CancelShipmentModalViewProps): React.ReactElement {
  const {
    reason,
    remarks,
    submitting,
    error,
    needsRemarks,
    submitDisabled,
    onReasonChange,
    onRemarksChange,
    onConfirm,
    onOpenChange,
  } = vm

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={COPY.title}
      size="md"
      closeOnOverlayClick={!submitting}
      footer={
        <>
          <Button
            label={COPY.cancel}
            variant="outline"
            size="md"
            disabled={submitting}
            loading={false}
            fullWidth={false}
            onClick={() => onOpenChange(false)}
          />
          <Button
            label={COPY.confirm}
            variant="destructive"
            size="md"
            disabled={submitDisabled}
            loading={submitting}
            fullWidth={false}
            onClick={onConfirm}
          />
        </>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        <Select
          label={COPY.reasonLabel}
          required
          disabled={submitting}
          placeholder={COPY.reasonPlaceholder}
          options={[...CANCEL_REASONS]}
          value={reason}
          onChange={onReasonChange}
        />
        {needsRemarks && (
          <Textarea
            label={COPY.remarksLabel}
            required
            disabled={submitting}
            readOnly={false}
            resize="vertical"
            showCount={false}
            placeholder={COPY.remarksPlaceholder}
            rows={4}
            value={remarks}
            onChange={onRemarksChange}
          />
        )}
        {error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1.5">
            {error}
          </div>
        )}
        {workflowId && (
          <div className="text-[11px] text-muted-foreground">
            {COPY.workflowLabel}:{' '}
            <code className="font-mono bg-muted px-1 py-0.5 rounded">
              {workflowId}
            </code>
            {mockMode === 'failure' && (
              <span className="ml-2 text-amber-600">· {COPY.failureBadge}</span>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
