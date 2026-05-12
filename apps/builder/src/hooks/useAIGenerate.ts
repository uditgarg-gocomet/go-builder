'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { PageSchema, HeaderConfig, NavConfig } from '@portal/core'
import { useCanvasStore } from '@/stores/canvasStore'
import { usePageStore } from '@/stores/pageStore'
import { useAppStore } from '@/stores/appStore'
import { serializeCanvasToSchema } from '@/lib/schema/serialize'
import { clientFetch } from '@/lib/clientFetch'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

export interface AttachedImage {
  /** Base64-encoded image data (no data-URL prefix) */
  data: string
  mediaType: ImageMediaType
  name: string
}

export interface AIMessage {
  role: 'user' | 'assistant'
  // kind distinguishes assistant message subtypes for rendering
  kind?: 'schema' | 'askUser' | 'error'
  content: string
  /** Sections generated (for 'schema' kind) */
  sections?: Array<'page' | 'header' | 'nav'>
  /** Raw result attached to 'schema' messages for JSON inspection */
  result?: AIResult
  /** Images attached to this user message */
  images?: AttachedImage[]
}

export interface AIResult {
  page?: PageSchema
  header?: HeaderConfig
  nav?: NavConfig
}

interface AvailableEndpoint {
  id: string
  name: string
  description?: string
  method: string
  path: string
  connectorId: string
  connectorName: string
  category: string
  tags: string[]
  responseSample?: Record<string, unknown>
}

export interface UseAIGenerate {
  messages: AIMessage[]
  isLoading: boolean
  error: string | null
  lastResult: AIResult | null
  availableEndpoints: AvailableEndpoint[]
  endpointsLoading: boolean
  generate: (prompt: string, images?: AttachedImage[]) => Promise<void>
  clearMessages: () => void
}

// ── Backend response shapes ───────────────────────────────────────────────────

interface ConnectorListResponse {
  connectors: Array<{ id: string; name: string; [key: string]: unknown }>
}

interface EndpointListResponse {
  endpoints: Array<{
    id: string
    name: string
    description?: string
    method: string
    path: string
    category: string
    tags: string[]
    responseSample?: Record<string, unknown>
  }>
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const STORAGE_KEY = (appId: string): string => `nova:${appId}`
const MAX_STORED_MESSAGES = 100

function loadPersistedChat(appId: string): { messages: AIMessage[]; lastResult: AIResult | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(appId))
    if (!raw) return { messages: [], lastResult: null }
    return JSON.parse(raw) as { messages: AIMessage[]; lastResult: AIResult | null }
  } catch {
    return { messages: [], lastResult: null }
  }
}

function persistChat(appId: string, messages: AIMessage[], lastResult: AIResult | null): void {
  try {
    // Keep only the last N messages to stay within localStorage limits
    const trimmed = messages.slice(-MAX_STORED_MESSAGES)
    localStorage.setItem(STORAGE_KEY(appId), JSON.stringify({ messages: trimmed, lastResult }))
  } catch {
    // Storage full — non-critical
  }
}

export function useAIGenerate(appId: string): UseAIGenerate {
  const initial = loadPersistedChat(appId)
  const [messages, setMessages] = useState<AIMessage[]>(initial.messages)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<AIResult | null>(initial.lastResult)
  const [availableEndpoints, setAvailableEndpoints] = useState<AvailableEndpoint[]>([])
  const [endpointsLoading, setEndpointsLoading] = useState(false)
  const lastResultRef = useRef<AIResult | null>(null)

  // Keep ref in sync so generate() always reads the latest result
  lastResultRef.current = lastResult

  // Persist chat to localStorage whenever it changes
  useEffect(() => {
    persistChat(appId, messages, lastResult)
  }, [appId, messages, lastResult])

  // Read canvas + app state at generate time (not as deps)
  const nodes = useCanvasStore(s => s.nodes)
  const rootId = useCanvasStore(s => s.rootId)
  const childMap = useCanvasStore(s => s.childMap)
  const parentMap = useCanvasStore(s => s.parentMap)
  const selectedNodeId = useCanvasStore(s => s.selectedNodeId)

  const activePageId = usePageStore(s => s.activePageId)
  const pages = usePageStore(s => s.pages)

  const app = useAppStore(s => s.app)
  const headerConfig = useAppStore(s => s.headerConfig)
  const navConfig = useAppStore(s => s.navConfig)
  const dataSources = useAppStore(s => s.dataSources)
  const actions = useAppStore(s => s.actions)
  const forms = useAppStore(s => s.forms)
  const stateSlots = useAppStore(s => s.stateSlots)

  // Fetch endpoint catalog on mount
  useEffect(() => {
    void (async () => {
      setEndpointsLoading(true)
      try {
        const { connectors } = await clientFetch<ConnectorListResponse>('/endpoints/connectors')
        const endpointArrays = await Promise.all(
          connectors.map(async c => {
            try {
              const { endpoints } = await clientFetch<EndpointListResponse>(
                `/endpoints/connectors/${c.id}/endpoints`,
              )
              return endpoints.map(ep => ({
                ...ep,
                connectorId: c.id,
                connectorName: c.name,
              }))
            } catch {
              return []
            }
          }),
        )
        setAvailableEndpoints(endpointArrays.flat())
      } catch {
        // Non-critical — AI can still generate with CUSTOM_MANUAL fallback
        setAvailableEndpoints([])
      } finally {
        setEndpointsLoading(false)
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const generate = useCallback(async (prompt: string, images?: AttachedImage[]): Promise<void> => {
    const trimmed = prompt.trim()
    if (!trimmed || isLoading) return

    setIsLoading(true)
    setError(null)

    // Append user message immediately (include image metadata for display)
    setMessages(prev => [...prev, { role: 'user', content: trimmed, images: images?.length ? images : undefined }])

    try {
      const activePage = pages.find(p => p.id === activePageId)

      // Serialize current canvas as existingSchema for refinement turns
      let existingSchema: PageSchema | undefined
      if (rootId && nodes[rootId] && activePage && app) {
        try {
          existingSchema = serializeCanvasToSchema(
            { nodes, childMap, parentMap, rootId, selectedNodeId: null, hoveredNodeId: null, dragState: null },
            activePage,
            app,
            { dataSources, actions, forms, stateSlots },
          )
        } catch {
          // Canvas not serializable yet — send without existingSchema
        }
      }

      // Currently selected node for targeted edits
      const selectedNode = selectedNodeId && nodes[selectedNodeId]
        ? {
            id: selectedNodeId,
            type: nodes[selectedNodeId]!.type,
            props: nodes[selectedNodeId]!.props,
          }
        : null

      const body = {
        prompt: trimmed,
        appId,
        pageContext: {
          pageId: activePageId ?? 'new-page',
          pageTitle: activePage?.name ?? 'Untitled',
          pageSlug: activePage?.slug ?? 'untitled',
        },
        selectedNode,
        existingSchema,
        existingHeader: headerConfig ?? null,
        existingNav: navConfig ?? null,
        availableEndpoints,
        images: images?.length ? images : undefined,
      }

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json() as Record<string, unknown>

      if (!response.ok) {
        const errMsg = typeof data['error'] === 'string' ? data['error'] : 'AI generation failed'
        setMessages(prev => [...prev, { role: 'assistant', kind: 'error', content: errMsg }])
        setError(errMsg)
        return
      }

      // Clarifying question
      if (typeof data['askUser'] === 'string') {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', kind: 'askUser', content: data['askUser'] as string },
        ])
        return
      }

      // Schema result
      const result: AIResult = {}
      const sections: Array<'page' | 'header' | 'nav'> = []
      if (data['page']) { result.page = data['page'] as PageSchema; sections.push('page') }
      if (data['header']) { result.header = data['header'] as HeaderConfig; sections.push('header') }
      if (data['nav']) { result.nav = data['nav'] as NavConfig; sections.push('nav') }

      setLastResult(result)
      const sectionLabel = sections.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          kind: 'schema',
          content: `Generated: ${sectionLabel}`,
          sections,
          result,
        },
      ])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected error'
      setMessages(prev => [...prev, { role: 'assistant', kind: 'error', content: msg }])
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [
    isLoading, pages, activePageId, nodes, rootId, childMap, parentMap,
    selectedNodeId, app, headerConfig, navConfig, dataSources, actions,
    forms, stateSlots, availableEndpoints, appId,
  ])

  const clearMessages = useCallback(() => {
    setMessages([])
    setLastResult(null)
    setError(null)
    try { localStorage.removeItem(STORAGE_KEY(appId)) } catch { /* non-critical */ }
  }, [appId])

  return {
    messages,
    isLoading,
    error,
    lastResult,
    availableEndpoints,
    endpointsLoading,
    generate,
    clearMessages,
  }
}
