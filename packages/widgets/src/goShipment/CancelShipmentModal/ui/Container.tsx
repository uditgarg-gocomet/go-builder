'use client'

// ── Container ────────────────────────────────────────────────────────────────
// Thin orchestrator: instantiates the hook, hands the view-model to View.tsx.
// This component is what the renderer actually mounts.

import React from 'react'
import { DEFAULTS } from '../shared/constants.js'
import { useCancelShipmentModal } from '../logic/hook.js'
import { CancelShipmentModalView } from './View.js'
import type { CancelShipmentModalProps } from '../shared/types.js'

export function CancelShipmentModal(
  props: CancelShipmentModalProps,
): React.ReactElement {
  const open = props.open ?? false
  const mockMode = props.mockMode ?? DEFAULTS.mockMode
  const vm = useCancelShipmentModal(props)

  return (
    <CancelShipmentModalView
      open={open}
      workflowId={props.workflowId}
      mockMode={mockMode}
      vm={vm}
    />
  )
}

export default CancelShipmentModal
