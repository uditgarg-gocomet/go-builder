// GET ${WORKFLOW_API}v1/{user_type}/workflow/document-upload/extraction-details

import type { DRDVEnvConfig } from '../env.js'
import { authHeaders, buildWorkflowUrl } from '../env.js'
import type { ExtractionDetailsResponse } from '../../shared/types.js'

export interface FetchExtractionRequest {
  swaId: string
  documentBucketId: string
  checklistTags: ReadonlyArray<string>
  checklistId: string
}

export interface FetchExtractionResult {
  ok: boolean
  status?: number
  data?: ExtractionDetailsResponse
  error?: string
}

export async function fetchExtractionFromGocomet(
  request: FetchExtractionRequest,
  config: DRDVEnvConfig,
): Promise<FetchExtractionResult> {
  if (!request.swaId) return { ok: false, error: 'swaId is required' }
  if (!request.documentBucketId) return { ok: false, error: 'documentBucketId is required' }
  if (!config.token || !config.workflowApi) {
    return { ok: false, error: 'Server is not configured. WIDGET_DRDV_TOKEN and WIDGET_DRDV_WORKFLOW_API must be set.' }
  }

  const url = new URL(buildWorkflowUrl(config, 'workflow/document-upload/extraction-details'))
  url.searchParams.set('shipment_workflow_activity_id', request.swaId)
  url.searchParams.set('document_type', request.documentBucketId)
  url.searchParams.set('checklist_id', request.checklistId)
  for (const tag of request.checklistTags) {
    url.searchParams.append('checklist_tags[]', tag)
  }

  let upstream: Response
  try {
    upstream = await fetch(url.toString(), {
      method: 'GET',
      headers: { ...authHeaders(config), Accept: 'application/json' },
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

  return { ok: true, status: upstream.status, data: body as ExtractionDetailsResponse }
}
