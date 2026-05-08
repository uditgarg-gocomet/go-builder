'use client'

import React, { useMemo, useState } from 'react'

interface JsonViewerProps {
  /** The value to render. Anything JSON-serializable. */
  value: unknown
  /** Optional title shown above the viewer. */
  title?: string
  /** Optional className for the outer wrapper. */
  className?: string
  /** Indent level for stringification. Default 2. */
  indent?: number
}

/**
 * Read-only JSON inspector with copy-to-clipboard and search filter.
 *
 * Kept dependency-free on purpose — a pre-formatted block is enough for the
 * builder's debug surfaces (canvas state, app config). If we ever need
 * collapsible nodes or syntax highlighting we can swap the implementation
 * without touching call-sites.
 */
export function JsonViewer({ value, title, className, indent = 2 }: JsonViewerProps): React.ReactElement {
  const [copied, setCopied] = useState(false)
  const [filter, setFilter] = useState('')

  const json = useMemo(() => {
    try {
      return JSON.stringify(value, makeReplacer(), indent)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return `// JSON.stringify failed: ${message}`
    }
  }, [value, indent])

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    if (!needle) return json
    // Keep only the matching lines plus a touch of context — surrounding
    // braces would be ideal but a flat line filter is cheap and "good enough"
    // for debug spelunking.
    return json
      .split('\n')
      .filter(line => line.toLowerCase().includes(needle))
      .join('\n')
  }, [json, filter])

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard may be unavailable in non-secure contexts — fail silently;
      // the user can still select and copy manually.
    }
  }

  const sizeBytes = new Blob([json]).size

  return (
    <div className={`flex h-full min-h-0 flex-col ${className ?? ''}`}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {title ? (
            <span className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {title}
            </span>
          ) : null}
          <span className="shrink-0 text-[10px] text-muted-foreground/70">
            {formatBytes(sizeBytes)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter…"
            className="w-28 rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="rounded border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-accent"
            title="Copy JSON to clipboard"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre className="flex-1 overflow-auto bg-muted/30 px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground">
        {filtered || '// no matches'}
      </pre>
    </div>
  )
}

/**
 * Build a fresh JSON.stringify replacer per call — the closed-over `seen`
 * set must reset between renders, otherwise unrelated subtrees would falsely
 * register as circular on the second stringify.
 *
 * Handles non-JSON-native values that show up in store snapshots
 * (Maps/Sets from selectors, Dates from Prisma rows, undefined props,
 * occasional functions on stale references).
 */
function makeReplacer(): (key: string, val: unknown) => unknown {
  const seen = new WeakSet<object>()
  return (_key, val) => {
    if (val instanceof Map) return Object.fromEntries(val)
    if (val instanceof Set) return Array.from(val)
    if (val instanceof Date) return val.toISOString()
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val)) return '[Circular]'
      seen.add(val)
    }
    if (typeof val === 'function') return `[Function ${val.name || 'anonymous'}]`
    if (typeof val === 'undefined') return null
    if (typeof val === 'bigint') return val.toString()
    return val
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}
