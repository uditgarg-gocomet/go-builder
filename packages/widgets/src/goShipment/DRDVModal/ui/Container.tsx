'use client'

import React from 'react'
import { useDRDVModal } from '../logic/hook.js'
import { DRDVModalView } from './View.js'
import type { DRDVModalProps } from '../shared/types.js'

export function DRDVModal(props: DRDVModalProps): React.ReactElement {
  const open = props.open ?? false
  const hideCtas = props.hideCtas ?? false
  const vm = useDRDVModal(props)

  return (
    <DRDVModalView
      open={open}
      hideCtas={hideCtas}
      documentBucketId={props.documentBucketId}
      vm={vm}
    />
  )
}

export default DRDVModal
