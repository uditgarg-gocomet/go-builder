import { readDRDVEnv } from '../env.js'
import { postRetryToGocomet } from '../handlers/postRetry.js'

interface RequestBody {
  swaId?: unknown
  documentBucketId?: unknown
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(request: Request): Promise<Response> {
  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400)
  }

  const swaId = typeof body.swaId === 'string' ? body.swaId : ''
  const documentBucketId = typeof body.documentBucketId === 'string' ? body.documentBucketId : ''

  if (!swaId) return jsonResponse({ ok: false, error: 'swaId is required' }, 400)
  if (!documentBucketId) return jsonResponse({ ok: false, error: 'documentBucketId is required' }, 400)

  const config = readDRDVEnv()
  const result = await postRetryToGocomet({ swaId, documentBucketId }, config)

  if (!result.ok) {
    return jsonResponse({ ok: false, error: result.error ?? 'Failed' }, result.status ?? 502)
  }
  return jsonResponse({
    ok: true,
    triggeredCount: result.triggeredCount,
    message: result.message ?? 'Retry triggered',
  })
}
