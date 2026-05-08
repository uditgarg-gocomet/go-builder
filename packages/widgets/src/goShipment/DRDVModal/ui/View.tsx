'use client'

import React from 'react'
import { Modal, Button } from '@portal/ui'
import { COPY, STAGE } from '../shared/constants.js'
import { titleCase } from '../shared/textUtils.js'
import type { DRDVModalViewModel } from '../logic/hook.js'
import type { ActionConfig } from '../shared/types.js'
import { StepIndicator } from './shared/StepIndicator.js'
import { ValidationStage } from './validation/ValidationStage.js'
import { VerificationStage } from './verification/VerificationStage.js'

export interface DRDVModalViewProps {
  open: boolean
  hideCtas: boolean
  documentBucketId: string | undefined
  vm: DRDVModalViewModel
}

const NULL_ACTION: ActionConfig = { enabled: false, visibility: false, display_name: '', tooltip_text: '' }

export function DRDVModalView({ open, hideCtas, documentBucketId, vm }: DRDVModalViewProps): React.ReactElement {
  const isExtraction = vm.currentStage === STAGE.EXTRACTION
  const isVerification = vm.currentStage === STAGE.VERIFICATION

  const documentTitle = titleCase(documentBucketId ?? '') || 'Document'
  const stageLabel = isExtraction ? 'Extraction' : (vm.extraction?.dv_modal_label || 'Validation')

  // Build a "Document Name - Stage" title with a trailing VALIDATION ERROR
  // badge when the extraction status indicates errors.
  const status = vm.extraction?.status
  const isError =
    status === 'validation_error' ||
    status === 'extraction_error' ||
    status === 'rejected'

  const titleNode = (
    <div className="flex items-center gap-3">
      <span>{documentTitle} - {stageLabel}</span>
      {isError && isVerification && (
        <span className="rounded bg-rose-100 text-rose-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
          Validation Error
        </span>
      )}
    </div>
  )

  // Server-driven action configs
  const next = vm.extraction?.action?.next ?? NULL_ACTION
  const retry = vm.extraction?.action?.retry ?? NULL_ACTION
  const verify = vm.verification?.form_requisite?.actions?.verify ?? NULL_ACTION
  const reject = vm.verification?.form_requisite?.actions?.reject ?? NULL_ACTION
  const reverify = vm.verification?.form_requisite?.actions?.submit_for_reverification ?? NULL_ACTION

  // Verification stage shows step indicator only when verification is enabled
  // and the API didn't return existing remarks (legacy hides the steps when
  // there's a reason on either stage).
  const showStepIndicator =
    !!vm.extraction?.verification_enabled &&
    !vm.extraction?.remarks &&
    !vm.verification?.approval_status_description?.reason

  const dvStepLabel = vm.extraction?.dv_modal_label || 'Validation'

  return (
    <Modal
      open={open}
      onOpenChange={vm.onOpenChange}
      title={titleNode as unknown as string}
      size="full"
      style={{ maxWidth: '1280px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      closeOnOverlayClick={!vm.submitting}
      footer={
        hideCtas ? null : isExtraction ? (
          <ExtractionFooter
            next={next}
            retry={retry}
            submitting={vm.submitting}
            onNextClick={vm.onNextClick}
            onRetryClick={vm.onRetryClick}
          />
        ) : (
          <VerificationFooter
            verify={verify}
            reject={reject}
            reverify={reverify}
            submitting={vm.submitting}
            isRejectFormVisible={vm.isRejectFormVisible}
            onBack={() => vm.onStageChange(STAGE.EXTRACTION)}
            onVerifyClick={vm.onVerifyClick}
            onRejectClick={vm.onRejectClick}
            onReverifyClick={vm.onReverifyClick}
          />
        )
      }
    >
      <div className="flex flex-col gap-3">
        {showStepIndicator && (
          <StepIndicator
            currentStep={vm.currentStage}
            steps={[
              { title: 'Extraction' },
              { title: dvStepLabel, disabled: !vm.extraction?.verification_enabled },
            ]}
            onStepChange={vm.onStageChange}
          />
        )}

        {isExtraction && (
          <ValidationStage
            loading={vm.extractionLoading}
            error={vm.extractionError}
            data={vm.extraction}
            documentBucketId={documentBucketId}
          />
        )}
        {isVerification && (
          <VerificationStage
            loading={vm.verificationLoading}
            error={vm.verificationError}
            data={vm.verification}
            extraction={vm.extraction}
            documentBucketId={documentBucketId}
            isRejectFormVisible={vm.isRejectFormVisible}
            rejectReason={vm.rejectReason}
            rejectRemarks={vm.rejectRemarks}
            onRejectReasonChange={vm.onRejectReasonChange}
            onRejectRemarksChange={vm.onRejectRemarksChange}
            onRejectSubmit={vm.onRejectSubmit}
            isConfirmDialogOpen={vm.isConfirmDialogOpen}
            onConfirmDialogToggle={vm.onConfirmDialogToggle}
            onConfirmVerify={vm.onConfirmVerify}
            submitting={vm.submitting}
          />
        )}
      </div>
    </Modal>
  )
}

// ── Footers ────────────────────────────────────────────────────────────────

interface ExtractionFooterProps {
  next: ActionConfig
  retry: ActionConfig
  submitting: boolean
  onNextClick: () => void
  onRetryClick: () => void
}

function ExtractionFooter({
  next, retry, submitting, onNextClick, onRetryClick,
}: ExtractionFooterProps): React.ReactElement | null {
  if (!next.visibility && !retry.visibility) return null
  return (
    <div className="flex items-center justify-end gap-2">
      {retry.visibility && (
        <Button
          label={retry.display_name || COPY.retryDefault}
          variant="outline"
          size="md"
          disabled={!retry.enabled || submitting}
          loading={submitting}
          fullWidth={false}
          onClick={onRetryClick}
        />
      )}
      {next.visibility && (
        <Button
          label={next.display_name || COPY.nextDefault}
          variant="default"
          size="md"
          disabled={!next.enabled || submitting}
          loading={false}
          fullWidth={false}
          onClick={onNextClick}
        />
      )}
    </div>
  )
}

interface VerificationFooterProps {
  verify: ActionConfig
  reject: ActionConfig
  reverify: ActionConfig
  submitting: boolean
  isRejectFormVisible: boolean
  onBack: () => void
  onVerifyClick: () => void
  onRejectClick: () => void
  onReverifyClick: () => void
}

function VerificationFooter({
  verify, reject, reverify, submitting,
  isRejectFormVisible,
  onBack, onVerifyClick, onRejectClick, onReverifyClick,
}: VerificationFooterProps): React.ReactElement {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        label={COPY.back}
        variant="outline"
        size="md"
        disabled={submitting}
        loading={false}
        fullWidth={false}
        onClick={onBack}
      />
      {reject.visibility && (
        <Button
          label={reject.display_name || COPY.rejectDefault}
          variant="outline"
          size="md"
          disabled={!reject.enabled || submitting}
          loading={false}
          fullWidth={false}
          onClick={onRejectClick}
        />
      )}
      {!isRejectFormVisible && verify.visibility && (
        <Button
          label={verify.display_name || COPY.verifyDefault}
          variant="default"
          size="md"
          disabled={!verify.enabled || submitting}
          loading={submitting}
          fullWidth={false}
          onClick={onVerifyClick}
        />
      )}
      {reverify.visibility && (
        <Button
          label={reverify.display_name || COPY.reverifyDefault}
          variant="default"
          size="md"
          disabled={!reverify.enabled || submitting}
          loading={submitting}
          fullWidth={false}
          onClick={onReverifyClick}
        />
      )}
    </div>
  )
}
