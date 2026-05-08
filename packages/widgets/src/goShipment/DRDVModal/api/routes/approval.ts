import { readDRDVEnv } from '../env.js'
import { postApprovalToGocomet } from '../handlers/postApproval.js'
import type { ApprovalStatus } from '../../shared/types.js'

interface RequestBody {
  swaId?: unknown
  workflowDocumentComparisonId?: unknown
  approvalStatus?: unknown
  reason?: unknown
  remarks?: unknown
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
  const wdcId = typeof body.workflowDocumentComparisonId === 'string' ? body.workflowDocumentComparisonId : ''
  const status = typeof body.approvalStatus === 'string' ? (body.approvalStatus as ApprovalStatus) : null
  const reason = typeof body.reason === 'string' ? body.reason : undefined
  const remarks = typeof body.remarks === 'string' ? body.remarks : undefined

  if (!swaId) return jsonResponse({ ok: false, error: 'swaId is required' }, 400)
  if (!wdcId) return jsonResponse({ ok: false, error: 'workflowDocumentComparisonId is required' }, 400)
  if (!status) return jsonResponse({ ok: false, error: 'approvalStatus is required' }, 400)

  const config = readDRDVEnv()
  const result = await postApprovalToGocomet(
    { swaId, workflowDocumentComparisonId: wdcId, approvalStatus: status, reason, remarks },
    config,
  )

  if (!result.ok) {
    return jsonResponse({ ok: false, error: result.error ?? 'Failed' }, result.status ?? 502)
  }
  return jsonResponse({ ok: true, message: result.message ?? 'Approval status updated' })
}
