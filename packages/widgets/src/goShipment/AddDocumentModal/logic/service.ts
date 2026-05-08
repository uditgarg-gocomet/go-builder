// ── Browser-side service ─────────────────────────────────────────────────────
// Orchestrates: fetchOptions (load) → uploadFiles (parallel) → attach.
// Phase A : mock with deterministic outcomes.
// Phase E : posts to the renderer-side proxy routes (see api/routes/*).

import {
  MOCK_DOCUMENT_OPTIONS,
  MOCK_MESSAGES,
  REAL_API_ROUTES,
} from '../shared/constants.js'
import type {
  AddDocumentSubmitPayload,
  AddDocumentSubmitResult,
  DocumentOption,
  SubmitOptions,
} from '../shared/types.js'

// ── Fetch options ────────────────────────────────────────────────────────────

export interface FetchOptionsResult {
  ok: boolean
  options?: DocumentOption[]
  error?: string
}

export async function fetchOptions(opts: SubmitOptions = {}): Promise<FetchOptionsResult> {
  if (opts.apiMode === 'real') return realFetchOptions()
  return mockFetchOptions(opts.mockDelayMs ?? 800)
}

async function mockFetchOptions(delay: number): Promise<FetchOptionsResult> {
  await new Promise(r => setTimeout(r, Math.min(delay, 400)))
  return { ok: true, options: [...MOCK_DOCUMENT_OPTIONS] }
}

interface ProxyOptionsResponse {
  ok: boolean
  options?: DocumentOption[]
  error?: string
}

async function realFetchOptions(): Promise<FetchOptionsResult> {
  let res: Response
  try {
    res = await fetch(REAL_API_ROUTES.options, { method: 'GET' })
  } catch (err) {
    return { ok: false, error: `Network error: ${(err as Error).message}` }
  }
  let json: ProxyOptionsResponse | null = null
  try {
    json = (await res.json()) as ProxyOptionsResponse
  } catch {
    /* fallthrough */
  }
  if (!res.ok || !json?.ok) {
    return { ok: false, error: json?.error ?? `Request failed (${res.status})` }
  }
  return { ok: true, options: json.options ?? [] }
}

// ── Submit (upload + attach) ────────────────────────────────────────────────

export async function submitAddDocument(
  payload: AddDocumentSubmitPayload,
  opts: SubmitOptions = {},
): Promise<AddDocumentSubmitResult> {
  if (opts.apiMode === 'real') return realSubmit(payload)
  return mockSubmit(payload, opts.mockDelayMs ?? 800)
}

async function mockSubmit(
  payload: AddDocumentSubmitPayload,
  delay: number,
): Promise<AddDocumentSubmitResult> {
  if (payload.files.length === 0) {
    return { ok: false, error: MOCK_MESSAGES.noFiles }
  }
  await new Promise(r => setTimeout(r, delay))
  // Generate fake ids — one per file.
  const uploadedDocumentIds = payload.files.map(
    (_, i) => `mock-doc-${Date.now()}-${i}`,
  )
  return {
    ok: true,
    message: MOCK_MESSAGES.success,
    uploadedDocumentIds,
  }
}

interface ProxyUploadResponse {
  ok: boolean
  documentId?: string
  filename?: string
  error?: string
}

interface ProxyAttachResponse {
  ok: boolean
  message?: string
  error?: string
}

async function realSubmit(
  payload: AddDocumentSubmitPayload,
): Promise<AddDocumentSubmitResult> {
  if (!payload.swaId) {
    return { ok: false, error: 'swaId is required for the real API path' }
  }
  if (payload.files.length === 0) {
    return { ok: false, error: MOCK_MESSAGES.noFiles }
  }

  // ── Step 1: per-file upload (parallel) ──────────────────────────────────
  const uploadResults = await Promise.all(
    payload.files.map(async file => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('document_type', payload.documentType.document_key)
      try {
        const res = await fetch(REAL_API_ROUTES.upload, { method: 'POST', body: fd })
        const json = (await res.json()) as ProxyUploadResponse
        if (!res.ok || !json.ok) {
          return { ok: false, error: json.error ?? `Upload ${res.status}` }
        }
        return { ok: true, documentId: json.documentId }
      } catch (err) {
        return { ok: false, error: `Network error during upload: ${(err as Error).message}` }
      }
    }),
  )

  const failed = uploadResults.find(r => !r.ok)
  if (failed) {
    return {
      ok: false,
      error: `${MOCK_MESSAGES.uploadFailure}${failed.error ? `: ${failed.error}` : ''}`,
    }
  }

  const documentIds = uploadResults
    .map(r => r.documentId)
    .filter((id): id is string => Boolean(id))

  if (documentIds.length === 0) {
    return { ok: false, error: 'No document_ids returned from upload step' }
  }

  // ── Step 2: attach ──────────────────────────────────────────────────────
  let attachJson: ProxyAttachResponse | null = null
  try {
    const res = await fetch(REAL_API_ROUTES.attach, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        swaId: payload.swaId,
        documentKey: payload.documentType.document_key,
        documentName: payload.documentType.document_name,
        documentType: payload.documentType.document_key,
        documentIds,
        milestoneId: payload.milestoneId,
        checklistId: payload.checklistId,
        source: payload.source,
      }),
    })
    attachJson = (await res.json()) as ProxyAttachResponse
    if (!res.ok || !attachJson.ok) {
      return {
        ok: false,
        error: attachJson?.error ?? `${MOCK_MESSAGES.attachFailure} (${res.status})`,
        uploadedDocumentIds: documentIds,
      }
    }
  } catch (err) {
    return {
      ok: false,
      error: `Network error during attach: ${(err as Error).message}`,
      uploadedDocumentIds: documentIds,
    }
  }

  return {
    ok: true,
    message: attachJson.message ?? MOCK_MESSAGES.success,
    uploadedDocumentIds: documentIds,
  }
}
