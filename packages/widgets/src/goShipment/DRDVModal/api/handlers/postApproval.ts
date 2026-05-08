// POST ${WORKFLOW_API}v1/{user_type}/workflow/document/approval-status

import type { DRDVEnvConfig } from '../env.js'
import { authHeaders, buildWorkflowUrl } from '../env.js'
import type { ApprovalStatus } from '../../shared/types.js'

export interface ApprovalRequest {
  swaId: string
  workflowDocumentComparisonId: string
  approvalStatus: ApprovalStatus
  reason?: string
  remarks?: string
}

export interface ApprovalResult {
  ok: boolean
  status?: number
  message?: string
  error?: string
}

export async function postApprovalToGocomet(
  request: ApprovalRequest,
  config: DRDVEnvConfig,
): Promise<ApprovalResult> {
  if (!request.swaId) return { ok: false, error: 'swaId is required' }
  if (!request.workflowDocumentComparisonId) {
    return { ok: false, error: 'workflowDocumentComparisonId is required' }
  }
  if (!config.token || !config.workflowApi) {
    return { ok: false, error: 'Server is not configured.' }
  }

  const url = buildWorkflowUrl(config, 'workflow/document/approval-status')

  let upstream: Response
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: {
        ...authHeaders(config),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        workflow_document_comparison_id: request.workflowDocumentComparisonId,
        approval_status: request.approvalStatus,
        shipment_workflow_activity_id: request.swaId,
        remarks: request.remarks,
        reason: request.reason,
      }),
    })
  } catch (err) {
    return { ok: false, error: `Network error: ${(err as Error).message}` }
  }

  let body: unknown = null
  try { body = await upstream.json() } catch { /* non-JSON */ }

  if (!upstream.ok) {
    const e = body as { error?: string; message?: string } | null
    return {
      ok: false,
      status: upstream.status,
      error: e?.error ?? e?.message ?? `Workflow API returned ${upstream.status}`,
    }
  }

  const ok = body as { message?: string } | null
  return { ok: true, status: upstream.status, message: ok?.message ?? 'Approval status updated' }
}
