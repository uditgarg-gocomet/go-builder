import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { PageSchemaZ, HeaderConfigSchema, NavConfigSchema } from '@portal/core'

// ── Request schema ─────────────────────────────────────────────────────────────

const AvailableEndpointSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  method: z.string(),
  path: z.string(),
  connectorId: z.string(),
  connectorName: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  responseSample: z.record(z.string(), z.unknown()).optional(),
})

const SUPPORTED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const

const AttachedImageSchema = z.object({
  data: z.string().min(1),
  mediaType: z.enum(SUPPORTED_MEDIA_TYPES),
  name: z.string(),
})

const RequestBodySchema = z.object({
  prompt: z.string().min(1),
  appId: z.string(),
  pageContext: z.object({
    pageId: z.string(),
    pageTitle: z.string(),
    pageSlug: z.string(),
  }),
  selectedNode: z.object({
    id: z.string(),
    type: z.string(),
    props: z.record(z.string(), z.unknown()),
  }).nullable().optional(),
  existingSchema: z.unknown().optional(),
  existingHeader: z.unknown().nullable().optional(),
  existingNav: z.unknown().nullable().optional(),
  availableEndpoints: z.array(AvailableEndpointSchema).optional(),
  images: z.array(AttachedImageSchema).max(4).optional(),
})

// ── Static system prompt (will be prompt-cached) ───────────────────────────────

const SYSTEM_PROMPT = `You are an AI assistant embedded in a no-code portal builder. Your ONLY job is to generate or modify page, header, and nav schemas for the builder canvas.

STRICT RULES:
1. If the user asks anything unrelated to generating/modifying a page, header, or nav, respond with: {"error":"I can only help with generating or modifying portal pages, headers, and nav configurations."}
2. Output ONLY a raw JSON object — no explanation, no markdown fences, no prose
   When design images are provided: analyse the layout, component types, text content, and data shown in the image and reproduce them faithfully as a PageSchema. Use the image as the source of truth for structure and content.
3. The output is a composite object: { page?: PageSchema, header?: HeaderConfig, nav?: NavConfig }
   — include only the keys relevant to the user's request
   — if the user only asks about the page, include only "page"; include all three only when the user wants the full app structure
4. Every ComponentNode must include: id (unique string like "n_abc123"), type, source, props, bindings, actions, style, responsive, children
5. For dataSources — ALWAYS populate the mockData field (used by preview mode):
   - FIRST check the "Available registered endpoints" list in context
   - If a matching endpoint is found: use mode "REGISTERED" with the exact endpointId. Set useMock: false. Populate mockData based on the endpoint's responseSample if available, else generate domain-realistic sample data
   - If no matching endpoint: use mode "CUSTOM_MANUAL" with a descriptive placeholder URL (e.g. "/api/shipments"), set useMock: true, generate realistic domain-appropriate mockData (e.g. for shipments: { items: [{ id: "SHP-001", status: "IN_TRANSIT", origin: "Shanghai", destination: "Rotterdam", eta: "2026-05-15" }], total: 42, page: 1, pageSize: 20 })
   - If a data-dependent component is needed but the source is completely ambiguous: respond with {"askUser":"I need an API endpoint for [describe what's needed]. Please provide the URL or endpoint ID."} instead of a schema
   - mockData must match the expected API response shape; the transform expression (if any) must correctly extract the list/value from it
6. For bindings: use syntax "{{datasource.<alias>.<field>}}" or "{{state.<key>}}"
7. Wire DataTable/List/Chart/KPICard components to dataSources via the node's dataSource field (alias must match a dataSources entry)
8. Generate meaningful state slots for filter values, selected rows, modal open/close flags, etc.
9. Generate actions for interactive elements: API_CALL for form submits, REFRESH_DATASOURCE after mutations, SET_STATE for UI state, SHOW_TOAST for feedback
10. Modifications targeting a selected widget should affect that widget's subtree, leaving the rest of the page intact

TYPE DEFINITIONS (your output must conform exactly to these):

interface ComponentNode {
  id: string
  type: string
  source: "primitive" | "custom_widget" | "prebuilt_view"
  props: Record<string, unknown>
  bindings: Record<string, string>
  actions: Array<{ trigger: string; actionId: string; params?: Record<string, unknown> }>
  style: Record<string, unknown>
  responsive: { tablet?: Record<string, unknown>; mobile?: Record<string, unknown> }
  children: ComponentNode[]
  dataSource?: {
    alias: string
    pagination?: { enabled: boolean; pageParam?: string; pageSizeParam?: string; defaultPageSize?: number }
    sorting?: { enabled: boolean; fieldParam?: string; directionParam?: string }
    filtering?: { enabled: boolean; params?: Record<string, string> }
  }
  visibility?: { requireGroups?: string[]; hideForGroups?: string[] }
}

interface DataSourceDef {
  alias: string
  mode: "REGISTERED" | "CUSTOM_CONNECTOR" | "CUSTOM_MANUAL"
  endpointId?: string
  connectorId?: string
  url?: string
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  headers?: Record<string, string>
  queryParams?: Record<string, unknown>
  body?: unknown
  transform?: string
  polling?: { intervalMs: number; pauseWhen?: string }
  errorHandling?: { strategy: "show-error" | "show-empty" | "use-fallback"; fallback?: unknown; retries?: number }
  dependencies?: string[]
  mockData?: unknown
  useMock: boolean
}

interface ActionDef {
  id: string
  name: string
  type: "API_CALL" | "REFRESH_DATASOURCE" | "NAVIGATE" | "OPEN_URL" | "SET_STATE" | "RESET_STATE" | "TOGGLE_STATE" | "SHOW_MODAL" | "CLOSE_MODAL" | "SHOW_TOAST" | "SHOW_CONFIRM" | "SUBMIT_FORM" | "RESET_FORM" | "SET_FORM_VALUE" | "TRIGGER_WEBHOOK" | "RUN_SEQUENCE" | "RUN_PARALLEL" | "CONDITIONAL" | "DELAY"
  config: Record<string, unknown>
  outcomes?: { onSuccess?: string[]; onError?: string[] }
  requireGroups?: string[]
}

interface FormDef {
  id: string
  name?: string
  fields: Array<{
    name: string; label: string
    type: "text" | "email" | "number" | "select" | "multiselect" | "checkbox" | "textarea" | "date" | "file"
    required: boolean
    defaultValue?: unknown
    placeholder?: string
    options?: Array<{ label: string; value: string }>
    validations?: Array<{ type: string; value?: unknown; message?: string }>
  }>
  submitActionId?: string
  resetOnSubmit: boolean
}

interface StateSlotDef {
  name: string
  type?: "string" | "number" | "boolean" | "object" | "array"
  defaultValue: unknown
}

interface PageSchema {
  pageId: string
  appId: string
  version: string
  meta: { title: string; slug: string; order: number; auth: { required: boolean; groups: string[] } }
  layout: ComponentNode
  dataSources: DataSourceDef[]
  actions: ActionDef[]
  forms: FormDef[]
  state: StateSlotDef[]
  params?: Array<{ name: string; type: "string" | "number" | "boolean"; required: boolean; defaultValue?: unknown }>
}

interface HeaderConfig {
  enabled: boolean
  showAppTitle: boolean
  showLogo: boolean
  logoAssetId?: string
  title?: string
  globalSearch: { enabled: boolean; placeholder?: string }
  showUserMenu: boolean
}

type NavItem =
  | { id: string; label: string; icon?: string; kind: "page"; pageSlug: string; visibility?: { requireGroups?: string[]; hideForGroups?: string[] } }
  | { id: string; label: string; icon?: string; kind: "url"; url: string; external: boolean }
  | { id: string; label: string; icon?: string; kind: "custom"; customRoute: string }
  | { id: string; label: string; icon?: string; kind: "group"; children: NavItem[] }

interface NavConfig {
  enabled: boolean
  position: "top" | "side"
  style: "text-and-icon" | "text" | "icon"
  collapsible: boolean
  items: NavItem[]
}

interface AIOutput {
  error?: string
  askUser?: string
  page?: PageSchema
  header?: HeaderConfig
  nav?: NavConfig
}

AVAILABLE PRIMITIVE COMPONENT TYPES (source: "primitive"):
Use ONLY these exact type names — anything else will fall back to a placeholder div on the canvas.

Layout:     Stack, Grid, Card, Divider, Modal
Text:       Heading, Text, RichText, Badge, Avatar, Tag, Alert
Input:      TextInput, NumberInput, Select, MultiSelect, Checkbox, Toggle, RadioGroup, DatePicker, Textarea, FileUpload
Data:       DataTable, StatCard, Chart
Action:     Button, IconButton, Link, DropdownMenu
Feedback:   Spinner, Skeleton, EmptyState, ErrorBoundary

LAYOUT GUIDANCE:
- Use Stack  (props: direction "vertical"|"horizontal", gap "none"|"xs"|"sm"|"md"|"lg"|"xl") as the primary layout container
- Use Grid   (props: cols number, gap string) for multi-column layouts
- Use Card   as a surface / panel wrapper
- Root layout node must be Stack or Grid

IMPORTANT PROP TYPES (use these exact string values — never numeric):
- Heading:   level MUST be a string: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"  (not 1, 2, 3…)
- Stack:     direction "vertical"|"horizontal", gap "none"|"xs"|"sm"|"md"|"lg"|"xl"
- DataTable: columns (Array<{key: string, label: string, sortable: boolean}>), pageSize number, striped boolean, searchable boolean
- StatCard:  value (string|number), label string, trend "up"|"down"|"neutral"
- Chart:     type "line"|"bar"|"area"|"pie", xKey string, yKeys string[], height number, title string, showLegend boolean

Generate realistic, complete, functional schemas. For any component that displays dynamic data, always create corresponding dataSources entries with realistic mockData.`

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) {
    return NextResponse.json({ error: 'AI generation is not configured' }, { status: 503 })
  }

  let body: z.infer<typeof RequestBodySchema>
  try {
    const raw = await request.json() as unknown
    const parsed = RequestBodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 })
    }
    body = parsed.data
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.prompt.trim()) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
  }

  const client = new Anthropic({ apiKey })

  // Build user messages
  const userMessages: Anthropic.MessageParam[] = []

  // Context: existing state (schema, header, nav)
  const contextParts: string[] = []
  if (body.existingSchema) {
    contextParts.push(`Current page schema:\n${JSON.stringify(body.existingSchema, null, 2)}`)
  }
  if (body.existingHeader) {
    contextParts.push(`Current header config:\n${JSON.stringify(body.existingHeader, null, 2)}`)
  }
  if (body.existingNav) {
    contextParts.push(`Current nav config:\n${JSON.stringify(body.existingNav, null, 2)}`)
  }
  if (contextParts.length > 0) {
    userMessages.push({ role: 'user', content: contextParts.join('\n\n') })
    userMessages.push({ role: 'assistant', content: 'Understood. I have the current state. What would you like me to change?' })
  }

  // Context: available endpoints
  if (body.availableEndpoints && body.availableEndpoints.length > 0) {
    const endpointSummary = body.availableEndpoints.map(ep => ({
      id: ep.id,
      name: ep.name,
      description: ep.description,
      method: ep.method,
      path: ep.path,
      connectorName: ep.connectorName,
      category: ep.category,
      tags: ep.tags,
      responseSample: ep.responseSample,
    }))
    userMessages.push({
      role: 'user',
      content: `Available registered endpoints:\n${JSON.stringify(endpointSummary, null, 2)}`,
    })
    userMessages.push({
      role: 'assistant',
      content: 'Got it. I will use these registered endpoints for matching data sources.',
    })
  }

  // Context: page + selected node
  const pageParts: string[] = [
    `Page context: pageId="${body.pageContext.pageId}", title="${body.pageContext.pageTitle}", slug="${body.pageContext.pageSlug}"`,
  ]
  if (body.selectedNode) {
    pageParts.push(
      `Currently selected widget: type="${body.selectedNode.type}", id="${body.selectedNode.id}", props=${JSON.stringify(body.selectedNode.props)}`,
    )
  }
  userMessages.push({ role: 'user', content: pageParts.join('\n') })
  userMessages.push({ role: 'assistant', content: 'Understood. What would you like me to generate or modify?' })

  // Final user prompt — multimodal when images are attached
  if (body.images && body.images.length > 0) {
    const imageBlocks: Anthropic.ImageBlockParam[] = body.images.map(img => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mediaType,
        data: img.data,
      },
    }))
    userMessages.push({
      role: 'user',
      content: [
        ...imageBlocks,
        { type: 'text', text: body.prompt },
      ],
    })
  } else {
    userMessages.push({ role: 'user', content: body.prompt })
  }

  try {
    // Use streaming to avoid HTTP timeouts on large schema responses (32K tokens)
    // Adaptive thinking improves schema generation quality on complex layouts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = client.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 32000,
      thinking: { type: 'adaptive' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      output_config: { effort: 'high' } as any,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          cache_control: { type: 'ephemeral' } as any,
        },
      ],
      messages: userMessages,
    } as Parameters<typeof client.messages.stream>[0])

    const response = await stream.finalMessage()

    // Log cache metrics in development to verify prompt caching is working
    if (process.env.NODE_ENV === 'development') {
      console.log('[Nova cache]', {
        cacheWrite: response.usage.cache_creation_input_tokens,
        cacheRead: response.usage.cache_read_input_tokens,
        uncachedInput: response.usage.input_tokens,
        output: response.usage.output_tokens,
      })
    }

    // Detect truncation before trying to parse — streaming still surfaces stop_reason
    if (response.stop_reason === 'max_tokens') {
      return NextResponse.json(
        { error: 'The generated schema was too large. Try a simpler request or split it into separate prompts (e.g. page only, then nav).' },
        { status: 500 },
      )
    }

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    let parsed: Record<string, unknown>
    try {
      // Strip markdown fences if present (model occasionally ignores the no-fences instruction)
      let text = textBlock.text.trim()
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

      // If there's leading/trailing prose, find the outermost JSON object
      if (!text.startsWith('{')) {
        const start = text.indexOf('{')
        const end = text.lastIndexOf('}')
        if (start !== -1 && end !== -1) text = text.slice(start, end + 1)
      }

      parsed = JSON.parse(text) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON — try rephrasing or splitting the request into smaller parts.' }, { status: 500 })
    }

    // Off-topic guardrail
    if (typeof parsed['error'] === 'string') {
      return NextResponse.json({ error: parsed['error'] }, { status: 400 })
    }

    // Clarifying question
    if (typeof parsed['askUser'] === 'string') {
      return NextResponse.json({ askUser: parsed['askUser'] }, { status: 200 })
    }

    // Validate each present section
    const result: { page?: unknown; header?: unknown; nav?: unknown } = {}

    if (parsed['page'] !== undefined) {
      const pageValidation = PageSchemaZ.safeParse(parsed['page'])
      if (!pageValidation.success) {
        return NextResponse.json(
          { error: 'Generated page schema is invalid', issues: pageValidation.error.issues },
          { status: 422 },
        )
      }
      result.page = pageValidation.data
    }

    if (parsed['header'] !== undefined) {
      const headerValidation = HeaderConfigSchema.safeParse(parsed['header'])
      if (!headerValidation.success) {
        return NextResponse.json(
          { error: 'Generated header config is invalid', issues: headerValidation.error.issues },
          { status: 422 },
        )
      }
      result.header = headerValidation.data
    }

    if (parsed['nav'] !== undefined) {
      const navValidation = NavConfigSchema.safeParse(parsed['nav'])
      if (!navValidation.success) {
        return NextResponse.json(
          { error: 'Generated nav config is invalid', issues: navValidation.error.issues },
          { status: 422 },
        )
      }
      result.nav = navValidation.data
    }

    if (Object.keys(result).length === 0) {
      return NextResponse.json({ error: 'AI returned no usable schema sections' }, { status: 500 })
    }

    return NextResponse.json(result, { status: 200 })
  } catch (err: unknown) {
    // Handle typed SDK exceptions for actionable user-facing messages
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Rate limited — please wait a moment and try again.' }, { status: 429 })
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: 'AI generation is not configured correctly.' }, { status: 503 })
    }
    if (err instanceof Anthropic.PermissionDeniedError) {
      return NextResponse.json({ error: 'AI generation is not permitted — check API key permissions.' }, { status: 503 })
    }
    if (err instanceof Anthropic.NotFoundError) {
      return NextResponse.json({ error: 'AI model not found — contact support.' }, { status: 503 })
    }
    if (err instanceof Anthropic.UnprocessableEntityError) {
      return NextResponse.json({ error: 'Request was rejected by AI — try rephrasing your prompt.' }, { status: 422 })
    }
    if (err instanceof Anthropic.InternalServerError) {
      return NextResponse.json({ error: 'Claude encountered an internal error — try again in a moment.' }, { status: 502 })
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `AI request failed: ${message}` }, { status: 500 })
  }
}
