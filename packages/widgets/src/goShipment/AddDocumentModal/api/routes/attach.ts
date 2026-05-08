// Next.js POST handler — JSON body with the uploaded documentIds + metadata,
// forwards to the workflow add-and-upload-document endpoint.

import { readAddDocumentEnv } from '../env.js'
import { attachDocumentsToWorkflow } from '../handlers/attachDocuments.js'

interface RequestBody {
  swaId?: unknown
  documentKey?: unknown
  documentName?: unknown
  documentType?: unknown
  documentIds?: unknown
  milestoneId?: unknown
  checklistId?: unknown
  source?: unknown
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

export async function POST(request: Request): Promise<Response> {
  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400)
  }

  const swaId = asString(body.swaId)
  const documentKey = asString(body.documentKey)
  const documentName = asString(body.documentName)
  const documentType = asString(body.documentType)
  const documentIds = asStringArray(body.documentIds)
  const milestoneId = asString(body.milestoneId)
  const checklistId = asString(body.checklistId)
  const source = asString(body.source)

  if (!swaId) return jsonResponse({ ok: false, error: 'swaId is required' }, 400)
  if (!documentKey) return jsonResponse({ ok: false, error: 'documentKey is required' }, 400)
  if (!documentName) return jsonResponse({ ok: false, error: 'documentName is required' }, 400)
  if (!documentType) return jsonResponse({ ok: false, error: 'documentType is required' }, 400)
  if (documentIds.length === 0) {
    return jsonResponse({ ok: false, error: 'documentIds must be a non-empty string array' }, 400)
  }

  const config = readAddDocumentEnv()
  const result = await attachDocumentsToWorkflow(
    {
      swaId,
      documentKey,
      documentName,
      documentType,
      documentIds,
      milestoneId,
      checklistId,
      source,
    },
    config,
  )

  if (!result.ok) {
    return jsonResponse(
      { ok: false, error: result.error ?? 'Attach failed' },
      result.status ?? 502,
    )
  }
  return jsonResponse({ ok: true, message: result.message ?? 'Document uploaded successfully' })
}
