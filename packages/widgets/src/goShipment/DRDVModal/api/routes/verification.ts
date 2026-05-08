import { readDRDVEnv } from '../env.js'
import { fetchVerificationFromGocomet } from '../handlers/fetchVerification.js'

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const swaId = url.searchParams.get('swaId') ?? ''
  const documentBucketId = url.searchParams.get('documentBucketId') ?? ''
  const checklistId = url.searchParams.get('checklistId') ?? ''
  const checklistTags = url.searchParams.getAll('checklistTags')

  if (!swaId) return jsonResponse({ ok: false, error: 'swaId is required' }, 400)
  if (!documentBucketId) return jsonResponse({ ok: false, error: 'documentBucketId is required' }, 400)

  const config = readDRDVEnv()
  const result = await fetchVerificationFromGocomet(
    { swaId, documentBucketId, checklistTags, checklistId },
    config,
  )

  if (!result.ok) {
    return jsonResponse({ ok: false, error: result.error ?? 'Failed' }, result.status ?? 502)
  }
  return jsonResponse({ ok: true, data: result.data })
}
