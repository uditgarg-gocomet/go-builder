// ── Submit service — the only file that changes between Phase A and Phase E ──
// Phase A : mock with deterministic success / failure.
// Phase E : real call through go-builder's connector proxy. The widget hook
//           already passes everything needed; only the implementation below
//           changes.

import { MOCK_MESSAGES, REAL_API_ROUTE } from '../shared/constants.js'
import type {
  CancelShipmentPayload,
  CancelShipmentResult,
  SubmitOptions,
} from '../shared/types.js'

// ── Real endpoint contract (for Phase E reference) ──────────────────────────
// PUT {WORKFLOW_API}/v1/{user_type}/workflow/archive_unarchive
//   body: { workflow_id, action_type: 'archive', successDescription? }
//
// Auth: Gocomet `user` cookie (raw JWT). Routed via go-builder's
// /connector/execute proxy so the token never reaches the browser.
export const CANCEL_SHIPMENT_ENDPOINT = {
  method: 'PUT',
  path: 'workflow/archive_unarchive',
  connectorEndpointId: 'workflow-archive-unarchive',
} as const

// ── Mock implementation ──────────────────────────────────────────────────────

async function mockSubmit(
  _payload: CancelShipmentPayload,
  opts: SubmitOptions,
): Promise<CancelShipmentResult> {
  const delay = opts.mockDelayMs ?? 800
  await new Promise(resolve => setTimeout(resolve, delay))

  if (opts.mockMode === 'failure') {
    return { ok: false, message: '', error: MOCK_MESSAGES.failure }
  }
  return { ok: true, message: MOCK_MESSAGES.success }
}

// ── Real implementation ──────────────────────────────────────────────────────
// Posts to the renderer's same-origin proxy route. The route attaches the
// gocomet token + schema server-side and returns a normalised result.

interface ProxyResponse {
  ok: boolean
  message?: string
  error?: string
  status?: number
}

async function realSubmit(
  payload: CancelShipmentPayload,
): Promise<CancelShipmentResult> {
  if (!payload.workflowId) {
    return { ok: false, message: '', error: 'workflowId is required for real API call' }
  }

  let res: Response
  try {
    res = await fetch(REAL_API_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflowId: payload.workflowId,
        actionType: 'archive',
      }),
    })
  } catch (err) {
    return { ok: false, message: '', error: `Network error: ${(err as Error).message}` }
  }

  let json: ProxyResponse | null = null
  try {
    json = (await res.json()) as ProxyResponse
  } catch {
    // Non-JSON response — fall through.
  }

  if (!res.ok || !json?.ok) {
    return {
      ok: false,
      message: '',
      error: json?.error ?? `Request failed with status ${res.status}`,
    }
  }

  return { ok: true, message: json.message ?? 'Shipment cancelled successfully' }
}

// ── Public service entrypoint ────────────────────────────────────────────────
// Hook calls this. Branches on apiMode — `mock` runs locally, `real` proxies
// through /api/widgets/cancel-shipment.

export async function submitCancellation(
  payload: CancelShipmentPayload,
  opts: SubmitOptions = {},
): Promise<CancelShipmentResult> {
  if (opts.apiMode === 'real') {
    return realSubmit(payload)
  }
  return mockSubmit(payload, opts)
}
