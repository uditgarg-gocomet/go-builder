'use client'

import React, { useState, useEffect, useRef } from 'react'

const BACKEND_URL = typeof window !== 'undefined'
  ? (process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001')
  : 'http://localhost:3001'

interface Asset {
  id: string
  key: string
  url: string
  mimeType: string
  size: number
  originalName: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

interface AssetPanelProps {
  appId: string
}

export function AssetPanel({ appId }: AssetPanelProps): React.ReactElement {
  const [assets, setAssets] = useState<Asset[]>([])
  const [search, setSearch] = useState('')
  const [mimeFilter, setMimeFilter] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchAssets = async (): Promise<void> => {
    const params = new URLSearchParams({ appId })
    if (mimeFilter) params.set('mimeType', mimeFilter)
    if (search) params.set('search', search)
    const res = await fetch(`${BACKEND_URL}/assets?${params}`, { credentials: 'include' })
    if (res.ok) {
      const data = (await res.json()) as { assets: Asset[] }
      setAssets(data.assets ?? [])
    }
  }

  useEffect(() => { void fetchAssets() }, [appId, mimeFilter, search]) // eslint-disable-line react-hooks/exhaustive-deps

  const uploadFile = async (file: File): Promise<void> => {
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    await fetch(`${BACKEND_URL}/assets/upload`, {
      method: 'POST',
      headers: { 'x-app-id': appId },
      credentials: 'include',
      body: form,
    }).catch(() => undefined)
    await fetchAssets()
    setUploading(false)
  }

  const handleDelete = async (asset: Asset): Promise<void> => {
    await fetch(`${BACKEND_URL}/assets/${asset.id}`, { method: 'DELETE', credentials: 'include' })
    setAssets(a => a.filter(x => x.id !== asset.id))
  }

  const copyUrl = (url: string): void => {
    void navigator.clipboard.writeText(url)
    setCopied(url)
    setTimeout(() => setCopied(null), 1500)
  }

  const isImage = (mime: string): boolean => mime.startsWith('image/')

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">Assets</h3>

      <div className="flex gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
          className="flex-1 rounded border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
        <select value={mimeFilter} onChange={e => setMimeFilter(e.target.value)}
          className="rounded border border-input bg-background px-2 py-1.5 text-sm outline-none">
          <option value="">All types</option>
          <option value="image">Images</option>
          <option value="font">Fonts</option>
          <option value="application/pdf">PDF</option>
        </select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault(); setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) void uploadFile(file)
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed py-4 transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60'}`}
      >
        {uploading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        ) : (
          <p className="text-xs text-muted-foreground">Drop files or <span className="text-primary underline">browse</span></p>
        )}
        <input ref={fileInputRef} type="file" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void uploadFile(f) }} />
      </div>

      {/* Grid */}
      {assets.length === 0 ? (
        <p className="text-xs text-muted-foreground">No assets uploaded.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {assets.map(asset => (
            <div key={asset.id} className="group relative flex flex-col overflow-hidden rounded border border-border bg-background">
              <div
                className="flex h-20 cursor-pointer items-center justify-center bg-muted"
                onClick={() => copyUrl(asset.url)}
                title="Click to copy URL"
              >
                {isImage(asset.mimeType) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.url} alt={asset.originalName} className="h-full w-full object-cover" />
                ) : (
                  <svg className="h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                {copied === asset.url && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-medium text-white">Copied!</div>
                )}
              </div>
              <div className="p-1.5">
                <p className="truncate text-[10px] font-medium text-foreground">{asset.originalName}</p>
                <p className="text-[10px] text-muted-foreground">{formatBytes(asset.size)}</p>
              </div>
              <button type="button" onClick={() => handleDelete(asset)}
                className="absolute right-1 top-1 hidden rounded bg-destructive p-0.5 text-[10px] text-white group-hover:block">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
