'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { useAppStore } from '@/stores/appStore'
import { usePageStore } from '@/stores/pageStore'
import { deserializeSchemaToCanvas } from '@/lib/schema/deserialize'
import { clientFetch, getCookieToken } from '@/lib/clientFetch'
import { useAIGenerate, type AIMessage, type AttachedImage, type ImageMediaType } from '@/hooks/useAIGenerate'
import { useSession } from '@/hooks/useSession'
import type { PageMeta } from '@/types/canvas'

interface AIGeneratePanelProps {
  appId: string
  onClose: () => void
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024  // 5 MB per image
const ACCEPTED_TYPES = 'image/jpeg,image/png,image/gif,image/webp'

interface PreviewImage extends AttachedImage {
  previewUrl: string
}

export function AIGeneratePanel({ appId, onClose }: AIGeneratePanelProps): React.ReactElement {
  const [prompt, setPrompt] = useState('')
  const [applyError, setApplyError] = useState<string | null>(null)
  const [attachedImages, setAttachedImages] = useState<PreviewImage[]>([])
  const [imageError, setImageError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const session = useSession()
  const { messages, isLoading, lastResult, endpointsLoading, generate, clearMessages } = useAIGenerate(appId)

  // Canvas + store setters for Apply
  const loadCanvas = useCanvasStore(s => s.loadCanvas)
  const selectedNodeId = useCanvasStore(s => s.selectedNodeId)
  const nodes = useCanvasStore(s => s.nodes)
  const activePageId = usePageStore(s => s.activePageId)
  const pages = usePageStore(s => s.pages)
  const addPage = usePageStore(s => s.addPage)
  const setActivePage = usePageStore(s => s.setActivePage)
  const setDataSources = useAppStore(s => s.setDataSources)
  const setActions = useAppStore(s => s.setActions)
  const setForms = useAppStore(s => s.setForms)
  const setStateSlots = useAppStore(s => s.setStateSlots)
  const setHeaderConfig = useAppStore(s => s.setHeaderConfig)
  const setNavConfig = useAppStore(s => s.setNavConfig)

  const selectedNode = selectedNodeId ? nodes[selectedNodeId] : null

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    e.target.value = ''  // allow re-selecting the same file
    setImageError(null)

    const remaining = 4 - attachedImages.length
    const toProcess = files.slice(0, remaining)

    void Promise.all(
      toProcess.map(file => new Promise<PreviewImage | null>(resolve => {
        if (file.size > MAX_IMAGE_BYTES) {
          setImageError(`${file.name} exceeds 5 MB limit`)
          resolve(null)
          return
        }
        const reader = new FileReader()
        reader.onload = (ev): void => {
          const dataUrl = ev.target?.result as string
          // dataUrl = "data:image/png;base64,<data>"
          const [header, data] = dataUrl.split(',')
          const mediaType = header?.match(/:(.*?);/)?.[1] as ImageMediaType | undefined
          if (!data || !mediaType) { resolve(null); return }
          resolve({ data, mediaType, name: file.name, previewUrl: dataUrl })
        }
        reader.readAsDataURL(file)
      }))
    ).then(results => {
      const valid = results.filter((r): r is PreviewImage => r !== null)
      setAttachedImages(prev => [...prev, ...valid].slice(0, 4))
    })
  }

  const removeImage = (index: number): void => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index))
    setImageError(null)
  }

  const handleGenerate = async (): Promise<void> => {
    if (!prompt.trim() || isLoading) return
    const p = prompt
    const imgs = attachedImages.length > 0 ? attachedImages.map(({ data, mediaType, name }) => ({ data, mediaType, name })) : undefined
    setPrompt('')
    setAttachedImages([])
    setApplyError(null)
    setImageError(null)
    await generate(p, imgs)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      void handleGenerate()
    }
  }

  const applyPage = async (): Promise<void> => {
    if (!lastResult?.page) return
    try {
      // Auto-create a page when the app has none yet
      let targetPageId = activePageId
      if (!targetPageId) {
        const schema = lastResult.page
        const name = schema.meta.title || 'Untitled'
        const slug = schema.meta.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        const userId = session?.userId ?? 'unknown'
        const page = await clientFetch<PageMeta>(
          `/apps/${appId}/pages`,
          { method: 'POST', body: JSON.stringify({ name, slug, order: pages.length, createdBy: userId }) },
          getCookieToken(),
        )
        if (!page?.id) throw new Error('Page creation failed')
        addPage(page)
        setActivePage(page.id)
        targetPageId = page.id
      }

      const canvasState = deserializeSchemaToCanvas(lastResult.page)
      loadCanvas(canvasState)
      setDataSources(lastResult.page.dataSources ?? [])
      setActions(lastResult.page.actions ?? [])
      setForms(lastResult.page.forms ?? [])
      setStateSlots(lastResult.page.state ?? [])
      setApplyError(null)
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Page schema could not be applied to the canvas')
    }
  }

  const applyHeader = (): void => {
    if (!lastResult?.header) return
    setHeaderConfig(lastResult.header)
    void clientFetch(`/apps/${appId}/header`, {
      method: 'PATCH',
      body: JSON.stringify({ header: lastResult.header }),
    }).catch(() => { /* non-critical — store is already updated */ })
  }

  const applyNav = (): void => {
    if (!lastResult?.nav) return
    setNavConfig(lastResult.nav)
    void clientFetch(`/apps/${appId}/nav`, {
      method: 'PATCH',
      body: JSON.stringify({ nav: lastResult.nav }),
    }).catch(() => { /* non-critical — store is already updated */ })
  }

  const applyAll = (): void => {
    if (lastResult?.page) void applyPage()
    if (lastResult?.header) applyHeader()
    if (lastResult?.nav) applyNav()
  }

  const resultSections = lastResult ? (Object.keys(lastResult) as Array<'page' | 'header' | 'nav'>) : []

  return (
    <aside className="flex h-full w-96 shrink-0 flex-col border-l border-border bg-card">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Nova
          </h2>
          {endpointsLoading && (
            <span className="text-[10px] text-muted-foreground animate-pulse">loading endpoints…</span>
          )}
          {selectedNode && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary truncate max-w-[100px]">
              {selectedNode.type}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearMessages}
              aria-label="Clear chat history"
              title="Clear chat history"
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI panel"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Message history */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground pt-4">
            Describe a page, header, or nav to generate.
            {selectedNode && (
              <span className="block mt-1">
                Selected widget: <strong>{selectedNode.type}</strong> — modifications will target it.
              </span>
            )}
          </p>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
            Generating…
          </div>
        )}

        {applyError && (
          <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {applyError}
          </p>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border p-3 space-y-2">
        {/* Image thumbnails */}
        {attachedImages.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {attachedImages.map((img, i) => (
              <div key={i} className="relative group w-14 h-14 rounded overflow-hidden border border-border shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.previewUrl} alt={img.name} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Remove ${img.name}`}
                >
                  <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {imageError && (
          <p className="text-[11px] text-destructive">{imageError}</p>
        )}

        <textarea
          ref={textareaRef}
          rows={3}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the page, or attach a design image and describe what to build… (⌘↵ to send)"
          className="w-full resize-none rounded border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          disabled={isLoading}
        />

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || attachedImages.length >= 4}
            title={attachedImages.length >= 4 ? 'Max 4 images' : 'Attach design image (PNG, JPG, WebP, GIF — max 5 MB each)'}
            className="rounded border border-input px-2.5 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={isLoading || !prompt.trim()}
            className="flex-1 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isLoading ? 'Generating…' : lastResult ? 'Refine' : 'Generate'}
          </button>
        </div>

        {/* Per-section apply buttons */}
        {resultSections.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {lastResult?.page && (
              <button
                type="button"
                onClick={() => void applyPage()}
                title="Apply generated page to canvas — Ctrl+Z to undo"
                className="rounded border border-input px-2 py-1 text-[11px] font-medium hover:bg-accent transition-colors"
              >
                Apply Page
              </button>
            )}
            {lastResult?.header && (
              <button
                type="button"
                onClick={applyHeader}
                className="rounded border border-input px-2 py-1 text-[11px] font-medium hover:bg-accent transition-colors"
              >
                Apply Header
              </button>
            )}
            {lastResult?.nav && (
              <button
                type="button"
                onClick={applyNav}
                className="rounded border border-input px-2 py-1 text-[11px] font-medium hover:bg-accent transition-colors"
              >
                Apply Nav
              </button>
            )}
            {resultSections.length > 1 && (
              <button
                type="button"
                onClick={applyAll}
                className="rounded bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                Apply All
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

// ── Message bubble sub-component ──────────────────────────────────────────────

function MessageBubble({ msg }: { msg: AIMessage }): React.ReactElement {
  const [expanded, setExpanded] = useState(false)

  if (msg.role === 'user') {
    return (
      <div className="flex flex-col items-end gap-1">
        {msg.images && msg.images.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1">
            {msg.images.map((img, i) => (
              <div key={i} className="h-16 w-16 overflow-hidden rounded border border-border">
                {/* Stored images only have base64 data, not a data-URL — rebuild it */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:${img.mediaType};base64,${img.data}`}
                  alt={img.name}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        )}
        <p className="max-w-[80%] rounded-lg bg-primary/10 px-3 py-2 text-sm text-foreground">
          {msg.content}
        </p>
      </div>
    )
  }

  // Error
  if (msg.kind === 'error') {
    return (
      <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        {msg.content}
      </div>
    )
  }

  // Clarifying question
  if (msg.kind === 'askUser') {
    return (
      <div className="rounded border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200">
        <p className="font-medium mb-0.5">Clarification needed</p>
        <p>{msg.content}</p>
      </div>
    )
  }

  // Schema generated
  if (msg.kind === 'schema') {
    return (
      <div className="rounded border border-border bg-muted/40 px-3 py-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-foreground">{msg.content}</span>
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? '▲ hide' : '▼ json'}
          </button>
        </div>
        {!expanded && msg.sections && (
          <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
            {msg.sections.map(s => (
              <li key={s} className="flex items-center gap-1">
                <span className="text-green-600">✓</span>
                <span className="capitalize">{s} generated</span>
              </li>
            ))}
          </ul>
        )}
        {expanded && msg.result && (
          <pre className="mt-2 max-h-72 overflow-auto rounded bg-background/80 p-2 text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-all">
            {JSON.stringify(msg.result, null, 2)}
          </pre>
        )}
      </div>
    )
  }

  // Generic assistant message
  return (
    <div className="rounded bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      {msg.content}
    </div>
  )
}
