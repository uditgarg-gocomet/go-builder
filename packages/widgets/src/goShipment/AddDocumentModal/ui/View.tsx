'use client'

import React from 'react'
import { Modal, Select, Button, FileUpload, Spinner } from '@portal/ui'
import { COPY } from '../shared/constants.js'
import type { AddDocumentModalViewModel } from '../logic/hook.js'

export interface AddDocumentModalViewProps {
  open: boolean
  acceptedFileTypes: string
  maxFileSizeMb: number
  allowMultiple: boolean
  vm: AddDocumentModalViewModel
}

export function AddDocumentModalView({
  open,
  acceptedFileTypes,
  maxFileSizeMb,
  allowMultiple,
  vm,
}: AddDocumentModalViewProps): React.ReactElement {
  const {
    options,
    optionsLoading,
    optionsError,
    selectedType,
    files,
    submitting,
    error,
    filteredOptions,
    submitDisabled,
    onTypeChange,
    onFilesAdd,
    onFileRemove,
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
            variant="default"
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
        {/* ── Document Type select ─────────────────────────────────────── */}
        <div className="flex flex-col gap-1.5">
          {optionsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner size="sm" />
              <span>{COPY.loadingOptions}</span>
            </div>
          ) : optionsError ? (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1.5">
              {optionsError}
            </div>
          ) : options.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">{COPY.emptyOptions}</div>
          ) : (
            <Select
              label={COPY.documentTypeLabel}
              required
              disabled={submitting}
              placeholder={COPY.documentTypePlaceholder}
              options={filteredOptions.map(o => ({
                label: o.document_name,
                value: o.document_key,
              }))}
              value={selectedType?.document_key}
              onChange={onTypeChange}
            />
          )}
        </div>

        {/* ── File upload ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-1.5">
          <FileUpload
            label={COPY.uploadFileLabel}
            accept={acceptedFileTypes}
            maxSize={maxFileSizeMb * 1024 * 1024}
            multiple={allowMultiple}
            disabled={submitting}
            required
            helperText={`Up to ${maxFileSizeMb}MB per file`}
            onFiles={onFilesAdd}
          />

          {/* Accumulated file list — FileUpload only shows the latest batch,
              we render the cumulative list here so the user can remove
              specific files between drops. */}
          {files.length > 0 && (
            <ul className="mt-1 flex flex-col gap-1">
              {files.map(f => (
                <li
                  key={f.name}
                  className="flex items-center justify-between rounded border border-border bg-muted/30 px-2 py-1 text-xs"
                >
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => onFileRemove(f.name)}
                    disabled={submitting}
                    className="ml-2 shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-50"
                    aria-label={`Remove ${f.name}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1.5">
            {error}
          </div>
        )}
      </div>
    </Modal>
  )
}
