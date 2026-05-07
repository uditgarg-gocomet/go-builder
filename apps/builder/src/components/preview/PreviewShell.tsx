'use client'

import React, { useState } from 'react'

type Breakpoint = 'desktop' | 'tablet' | 'mobile'

const BREAKPOINTS: { id: Breakpoint; label: string; icon: string; width: string }[] = [
  { id: 'desktop', label: 'Desktop', icon: '🖥', width: '100%' },
  { id: 'tablet', label: 'Tablet', icon: '📱', width: '768px' },
  { id: 'mobile', label: 'Mobile', icon: '📲', width: '375px' },
]

interface PreviewShellProps {
  token: string
  isShared: boolean
}

export function PreviewShell({ token, isShared }: PreviewShellProps): React.ReactElement {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop')
  const [sharing, setSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleShare = async (): Promise<void> => {
    setSharing(true)
    try {
      const res = await fetch('/api/preview/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (res.ok) {
        const data = (await res.json()) as { shareUrl: string }
        setShareUrl(data.shareUrl)
      }
    } finally {
      setSharing(false)
    }
  }

  const handleCopy = (): void => {
    const url = shareUrl ?? `${window.location.origin}/preview/${token}`
    void navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const openNewTab = (): void => {
    window.open(`/preview/${token}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-card px-4">
      {/* Left: badge */}
      <div className="flex items-center gap-3">
        <span className="rounded bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-600">
          PREVIEW
        </span>
        {isShared && (
          <span className="text-[10px] text-muted-foreground">Shared link</span>
        )}
      </div>

      {/* Center: breakpoint switcher */}
      <div className="flex items-center gap-1">
        {BREAKPOINTS.map(bp => (
          <button
            key={bp.id}
            type="button"
            onClick={() => {
              setBreakpoint(bp.id)
              // Emit custom event for PreviewRenderer to pick up
              window.dispatchEvent(new CustomEvent('preview:breakpoint', { detail: bp.width }))
            }}
            title={bp.label}
            className={`rounded px-2 py-1 text-sm transition-colors ${
              breakpoint === bp.id
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            {bp.icon}
          </button>
        ))}
      </div>

      {/* Right: share + new tab */}
      <div className="flex items-center gap-2">
        {shareUrl ? (
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs text-primary hover:opacity-70"
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleShare()}
            disabled={sharing}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {sharing ? 'Sharing…' : 'Share'}
          </button>
        )}
        <button
          type="button"
          onClick={openNewTab}
          title="Open in new tab"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ↗
        </button>
      </div>
    </div>
  )
}
