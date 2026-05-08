// POST ${WORKFLOW_API}v1/client/workflow/retry-extraction
// Note: this endpoint hardcodes /client/ in the legacy code regardless of
// user_type, but we still build the URL with the configured user_type to
// stay consistent. If the server requires hardcoded /client/, override
// `userType` to 'client' via WIDGET_DRDV_USER_TYPE.

import type { DRDVEnvConfig } from '../env.js'
import { authHeaders, buildWorkflowUrl } from '../env.js'

export interface RetryRequest {
  swaId: string
  documentBucketId: string
}

export interface RetryResult {
  ok: boolean
  status?: number
  triggeredCount?: number
  message?: string
  error?: string
}

export async function postRetryToGocomet(
  request: RetryRequest,
  config: DRDVEnvConfig,
): Promise<RetryResult> {
  if (!request.swaId) return { ok: false, error: 'swaId is required' }
  if (!request.documentBucketId) return { ok: false, error: 'documentBucketId is required' }
  if (!config.token || !config.workflowApi) {
    return { ok: false, error: 'Server is not configured.' }
  }

  const url = buildWorkflowUrl(config, 'workflow/retry-extraction')

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
        document_type: request.documentBucketId,
        schema: config.schema,
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

  const ok = body as { triggered_count?: number; message?: string } | null
  return {
    ok: true,
    status: upstream.status,
    triggeredCount: ok?.triggered_count,
    message: ok?.message ?? 'Retry triggered',
  }
}
