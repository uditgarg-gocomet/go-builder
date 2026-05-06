import React from 'react'
import { z } from 'zod'
import { cn } from '../../lib/utils.js'

export const FileUploadPropsSchema = z.object({
  label: z.string().optional(),
  accept: z.string().optional(),
  maxSize: z.number().positive().optional(),
  multiple: z.boolean().default(false),
  disabled: z.boolean().default(false),
  required: z.boolean().default(false),
  error: z.string().optional(),
  helperText: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  className: z.string().optional(),
})

export type FileUploadProps = z.infer<typeof FileUploadPropsSchema> & {
  onFiles?: (files: File[]) => void
  style?: React.CSSProperties
  name?: string
  id?: string
}

export const fileUploadManifest = {
  displayName: 'File Upload',
  category: 'Input',
  description: 'File upload with drag-and-drop zone, accept filter, size limit, and progress',
  icon: 'upload',
  tags: ['file', 'upload', 'drag-drop', 'input', 'form'],
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileUpload({ label, accept, maxSize, multiple = false, disabled = false, required = false, error, helperText, progress, className, style, onFiles, name, id }: FileUploadProps): React.ReactElement {
  const inputId = id ?? name ?? 'file-upload'
  const [dragging, setDragging] = React.useState(false)
  const [localError, setLocalError] = React.useState<string | undefined>()
  const [fileNames, setFileNames] = React.useState<string[]>([])

  const handleFiles = (files: FileList | null): void => {
    if (!files || files.length === 0) return
    const arr = Array.from(files)
    if (maxSize) {
      const oversized = arr.filter(f => f.size > maxSize)
      if (oversized.length > 0) {
        setLocalError(`File exceeds maximum size of ${formatBytes(maxSize)}`)
        return
      }
    }
    setLocalError(undefined)
    setFileNames(arr.map(f => f.name))
    onFiles?.(arr)
  }

  const displayError = error ?? localError

  return (
    <div style={style} className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}{required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
      )}
      <div
        onDragOver={e => { e.preventDefault(); !disabled && setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); if (!disabled) handleFiles(e.dataTransfer.files) }}
        className={cn(
          'flex flex-col items-center justify-center rounded-md border-2 border-dashed p-6 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : displayError ? 'border-destructive' : 'border-input',
          disabled && 'opacity-50 cursor-not-allowed',
          !disabled && 'cursor-pointer hover:border-primary/60',
        )}
        onClick={() => !disabled && document.getElementById(inputId)?.click()}
      >
        <svg className="mb-2 h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        {fileNames.length > 0 ? (
          <p className="text-sm text-foreground">{fileNames.join(', ')}</p>
        ) : (
          <>
            <p className="text-sm text-foreground">Drag & drop or <span className="text-primary underline">browse</span></p>
            {accept && <p className="mt-1 text-xs text-muted-foreground">Accepted: {accept}</p>}
            {maxSize && <p className="text-xs text-muted-foreground">Max size: {formatBytes(maxSize)}</p>}
          </>
        )}
        <input
          id={inputId}
          name={name}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          required={required}
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>
      {progress !== undefined && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {displayError && <p className="text-xs text-destructive">{displayError}</p>}
      {!displayError && helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
    </div>
  )
}
