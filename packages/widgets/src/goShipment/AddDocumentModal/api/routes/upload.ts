// Next.js POST handler — accepts a single file (multipart/form-data) +
// document_type, forwards to gocomet's library, returns { ok, documentId }.

import { readAddDocumentEnv } from '../env.js'
import { uploadFileToLibrary } from '../handlers/uploadFile.js'

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(request: Request): Promise<Response> {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return jsonResponse({ ok: false, error: 'Expected multipart/form-data body' }, 400)
  }

  const file = formData.get('file')
  const documentType = formData.get('document_type')

  if (!(file instanceof File)) {
    return jsonResponse({ ok: false, error: 'file (Blob) is required' }, 400)
  }
  if (typeof documentType !== 'string' || !documentType) {
    return jsonResponse({ ok: false, error: 'document_type is required' }, 400)
  }

  const config = readAddDocumentEnv()
  const result = await uploadFileToLibrary(file, documentType, config)

  if (!result.ok) {
    return jsonResponse(
      { ok: false, error: result.error ?? 'Upload failed' },
      result.status ?? 502,
    )
  }
  return jsonResponse({
    ok: true,
    documentId: result.documentId,
    filename: result.filename,
  })
}
