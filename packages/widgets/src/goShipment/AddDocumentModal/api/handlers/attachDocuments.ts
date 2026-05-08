// ── Attach uploaded documents to the shipment workflow ──────────────────────
// POST ${WORKFLOW_API}v1/{user_type}/workflow/add-and-upload-document
// Body: { shipment_workflow_activity_id, milestone_id, checklist_id,
//         document_type, document_ids, source, document_key, document_name }
// Returns: { message }

import type { AddDocumentEnvConfig } from '../env.js'
import { authHeaders } from '../env.js'

export interface AttachDocumentsRequest {
  swaId: string
  documentKey: string
  documentName: string
  documentType: string
  documentIds: ReadonlyArray<string>
  milestoneId: string
  checklistId: string
  source: string
}

export interface AttachDocumentsResult {
  ok: boolean
  status?: number
  message?: string
  error?: string
}

export async function attachDocumentsToWorkflow(
  request: AttachDocumentsRequest,
  config: AddDocumentEnvConfig,
): Promise<AttachDocumentsResult> {
  if (!request.swaId) {
    return { ok: false, error: 'swaId is required' }
  }
  if (!request.documentIds.length) {
    return { ok: false, error: 'documentIds is empty — nothing to attach' }
  }
  if (!config.token || !config.workflowApi) {
    return {
      ok: false,
      error:
        'Server is not configured. WIDGET_MOCK_TOKEN and WIDGET_MOCK_WORKFLOW_API must be set.',
    }
  }

  const base = config.workflowApi.replace(/\/$/, '')
  const userType = encodeURIComponent(config.userType)
  const url = `${base}/v1/${userType}/workflow/add-and-upload-document`

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
        shipment_workflow_activity_id: request.swaId,
        milestone_id: request.milestoneId,
        checklist_id: request.checklistId,
        document_type: request.documentType,
        document_ids: request.documentIds,
        source: request.source,
        document_key: request.documentKey,
        document_name: request.documentName,
      }),
    })
  } catch (err) {
    return {
      ok: false,
      error: `Network error reaching workflow API: ${(err as Error).message}`,
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
        `Workflow API returned ${upstream.status}`,
    }
  }

  const ok = body as { message?: string } | null
  return {
    ok: true,
    status: upstream.status,
    message: ok?.message ?? 'Document uploaded successfully',
  }
}
