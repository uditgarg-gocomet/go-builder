// ── Server-side gocomet submit ───────────────────────────────────────────────
// Pure async function: takes a payload + env config, returns a normalised
// result. No HTTP / framework concerns — those live in route.ts.
//
// This file is the only place the actual gocomet PUT happens. Long-term it
// moves to go-builder's /connector/execute proxy on apps/backend; until then,
// it runs server-side inside the consuming Next.js app via route.ts.

import type { CancelShipmentEnvConfig } from './env.js'

export interface CancelShipmentSubmitRequest {
  workflowId: string
  actionType?: 'archive' | 'unarchive'
}

export interface CancelShipmentSubmitResult {
  ok: boolean
  status?: number
  message?: string
  error?: string
}

// Real endpoint contract — kept here so the URL construction is in one place.
export const CANCEL_SHIPMENT_PATH = 'workflow/archive_unarchive'

export async function submitCancelShipmentToGocomet(
  request: CancelShipmentSubmitRequest,
  config: CancelShipmentEnvConfig,
): Promise<CancelShipmentSubmitResult> {
  if (!request.workflowId) {
    return { ok: false, error: 'workflowId is required' }
  }
  if (!config.token || !config.workflowApi) {
    return {
      ok: false,
      error:
        'Server is not configured. WIDGET_MOCK_TOKEN and WIDGET_MOCK_WORKFLOW_API must be set in the renderer env.',
    }
  }

  const base = config.workflowApi.replace(/\/$/, '')
  const url = `${base}/v1/${encodeURIComponent(config.userType)}/${CANCEL_SHIPMENT_PATH}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (config.schema) headers['Schema'] = config.schema

  let upstream: Response
  try {
    upstream = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        workflow_id: request.workflowId,
        action_type: request.actionType ?? 'archive',
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
    // Non-JSON response — leave body null and surface the status.
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
    message: ok?.message ?? 'Shipment cancelled successfully',
  }
}
