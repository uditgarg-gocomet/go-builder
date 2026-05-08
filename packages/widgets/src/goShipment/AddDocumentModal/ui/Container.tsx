'use client'

import React from 'react'
import { DEFAULTS } from '../shared/constants.js'
import { useAddDocumentModal } from '../logic/hook.js'
import { AddDocumentModalView } from './View.js'
import type { AddDocumentModalProps } from '../shared/types.js'

export function AddDocumentModal(
  props: AddDocumentModalProps,
): React.ReactElement {
  const open = props.open ?? false
  const acceptedFileTypes = props.acceptedFileTypes ?? DEFAULTS.acceptedFileTypes
  const maxFileSizeMb = props.maxFileSizeMb ?? DEFAULTS.maxFileSizeMb
  const allowMultiple = props.allowMultiple ?? DEFAULTS.allowMultiple
  const vm = useAddDocumentModal(props)

  return (
    <AddDocumentModalView
      open={open}
      acceptedFileTypes={acceptedFileTypes}
      maxFileSizeMb={maxFileSizeMb}
      allowMultiple={allowMultiple}
      vm={vm}
    />
  )
}

export default AddDocumentModal
