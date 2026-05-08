// ── Upload one file to gocomet's library ─────────────────────────────────────
// POST ${LIBRARY_API}v1/documents       (multipart/form-data)
// Form fields: document_type, file
// Returns: { id, type, document_id, filename, path }

import type { AddDocumentEnvConfig } from '../env.js'
import { authHeaders } from '../env.js'

export interface UploadFileResult {
  ok: boolean
  status?: number
  documentId?: string
  filename?: string
  error?: string
}

export async function uploadFileToLibrary(
  file: File,
  documentType: string,
  config: AddDocumentEnvConfig,
): Promise<UploadFileResult> {
  if (!config.token || !config.libraryApi) {
    return {
      ok: false,
      error:
        'Server is not configured. WIDGET_MOCK_TOKEN and WIDGET_MOCK_LIBRARY_API must be set.',
    }
  }

  const base = config.libraryApi.replace(/\/$/, '')
  const url = `${base}/v1/documents`

  // Build a fresh FormData server-side. Do not set Content-Type explicitly —
  // fetch will populate it with the correct multipart boundary.
  const formData = new FormData()
  formData.append('document_type', documentType)
  formData.append('file', file)

  let upstream: Response
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: authHeaders(config),
      body: formData,
    })
  } catch (err) {
    return {
      ok: false,
      error: `Network error reaching library: ${(err as Error).message}`,
    }
  }

  let body: unknown = null
  try {
    body = await upstream.json()
  } catch {
    // Non-JSON; surface status only.
  }

  if (!upstream.ok) {
    const e = body as { error?: string; message?: string } | null
    return {
      ok: false,
      status: upstream.status,
      error:
        e?.error ??
        e?.message ??
        `Library returned ${upstream.status}`,
    }
  }

  // Library response can be either at top level or nested under data.
  const flat = body as { document_id?: string; filename?: string } | null
  const wrapped = body as { data?: { document_id?: string; filename?: string } } | null
  const documentId = flat?.document_id ?? wrapped?.data?.document_id
  const filename = flat?.filename ?? wrapped?.data?.filename ?? file.name

  if (!documentId) {
    return {
      ok: false,
      status: upstream.status,
      error: 'Library response did not include document_id',
    }
  }

  return { ok: true, status: upstream.status, documentId, filename }
}
