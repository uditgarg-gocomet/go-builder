'use client'

import React, { useEffect, useRef, useState } from 'react'
import { clientFetch, getCookieToken } from '@/lib/clientFetch'

const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001'

// Backend shape — matches the Asset Prisma model. We only need fields relevant
// to picking an image logo, so the local type is intentionally narrow.
interface AssetListItem {
  id: string
  key: string
  url: string
  name: string
  mimeType: string
  sizeBytes: number
}

interface LogoPickerProps {
  appId: string
  // The renderer resolves this as a path segment against GET /assets/*, so the
  // stored value is the asset's `key` (e.g. `apps/<appId>/<hash>.png`). The
  // field name matches the HeaderConfig schema for backwards compatibility.
  value: string | undefined
  onChange: (next: string | undefined) => void
}

type Mode = 'idle' | 'browse'

export function LogoPicker({ appId, value, onChange }: LogoPickerProps): React.ReactElement {
  const [mode, setMode] = useState<Mode>('idle')
  const [assets, setAssets] = useState<AssetListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Preview URL — the renderer constructs the same URL from `key`, so we can
  // preview by hitting /assets/<key> directly. If `value` looks like a full
  // URL (e.g. someone pasted one), fall back to using it verbatim.
  const previewUrl = value
    ? value.startsWith('http://') || value.startsWith('https://')
      ? value
      : `${BACKEND_URL}/assets/${value}`
    : undefined

  const fetchImages = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ appId, mimeType: 'image' })
      const data = await clientFetch<{ assets: AssetListItem[] }>(`/assets?${params}`)
      setAssets(data.assets ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (mode === 'browse') void fetchImages()
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const openUpload = (): void => fileInputRef.current?.click()

  const handleUpload = async (file: File): Promise<void> => {
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const tok = getCookieToken()
      const headers: Record<string, string> = { 'x-app-id': appId }
      if (tok) headers['Authorization'] = `Bearer ${tok}`
      const res = await fetch(`${BACKEND_URL}/assets/upload`, { method: 'POST', headers, body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Upload failed (${res.status})`)
      }
      const { asset } = (await res.json()) as { asset: AssetListItem }
      onChange(asset.key)
      setMode('idle')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handlePick = (asset: AssetListItem): void => {
    onChange(asset.key)
    setMode('idle')
  }

  const handleRemove = (): void => onChange(undefined)

  return (
    <div className="flex flex-col gap-2">
      {/* Preview + primary actions */}
      <div className="flex items-center gap-2 rounded border border-border bg-background p-2">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Logo" className="h-full w-full object-contain" />
          ) : (
            <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-4 6l5-5 3 3 3-3 5 5" />
            </svg>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 min-w-0">
          <p className="truncate text-xs text-foreground">
            {value ? value.split('/').pop() : 'No logo'}
          </p>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={openUpload} disabled={uploading}
              className="rounded border border-border bg-background px-2 py-0.5 text-[11px] font-medium hover:bg-accent disabled:opacity-50">
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
            <button type="button" onClick={() => setMode(mode === 'browse' ? 'idle' : 'browse')}
              className={`rounded border px-2 py-0.5 text-[11px] font-medium ${mode === 'browse' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:bg-accent'}`}>
              Choose from assets
            </button>
            {value ? (
              <button type="button" onClick={handleRemove}
                className="rounded border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-destructive">
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) void handleUpload(f)
          e.target.value = '' // allow re-selecting the same file
        }} />

      {error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : null}

      {/* Asset browser — lazy-loaded when opened */}
      {mode === 'browse' ? (
        <div className="rounded border border-border bg-background p-2">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : assets.length === 0 ? (
            <p className="py-2 text-center text-[11px] text-muted-foreground">
              No images uploaded yet.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
              {assets.map(asset => {
                const selected = asset.key === value
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => handlePick(asset)}
                    title={asset.name}
                    className={`group relative aspect-square overflow-hidden rounded border bg-muted transition-colors ${
                      selected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/60'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.url} alt={asset.name} className="h-full w-full object-contain" />
                    {selected ? (
                      <span className="absolute right-0.5 top-0.5 rounded bg-primary px-1 py-0.5 text-[9px] font-semibold leading-none text-primary-foreground">
                        ✓
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
