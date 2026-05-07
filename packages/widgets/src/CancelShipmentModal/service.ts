// ── Submit service — the only file that changes between Phase A and Phase E ──
// Phase A : mock with deterministic success / failure.
// Phase E : real call through go-builder's connector proxy. The widget hook
//           already passes everything needed; only the implementation below
//           changes.

import { MOCK_MESSAGES } from './constants.js'
import type {
  CancelShipmentPayload,
  CancelShipmentResult,
  SubmitOptions,
} from './types.js'

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

// ── Mock implementation (Phase A) ────────────────────────────────────────────

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

// ── Public service entrypoint ────────────────────────────────────────────────
// Hook calls this. Swap the body in Phase E:
//
//   const widgetApi = useWidgetApi()
//   const res = await widgetApi.executeConnector({
//     mode: 'REGISTERED',
//     endpointId: CANCEL_SHIPMENT_ENDPOINT.connectorEndpointId,
//     body: { workflow_id: payload.workflowId, action_type: 'archive' },
//   })
//   return { ok: res.success, message: res.data?.message ?? '', error: res.error }
//
// (and remove `opts` from the signature once mocks are gone).

export async function submitCancellation(
  payload: CancelShipmentPayload,
  opts: SubmitOptions = {},
): Promise<CancelShipmentResult> {
  return mockSubmit(payload, opts)
}
