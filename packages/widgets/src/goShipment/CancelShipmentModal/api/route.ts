// ── Next.js POST handler ─────────────────────────────────────────────────────
// Wraps the pure submit function in a Web-Request → Web-Response shape so it
// drops directly into a Next.js App Router route file. Consuming app:
//
//   // apps/renderer/src/app/api/widgets/cancel-shipment/route.ts
//   export { POST } from '@portal/widgets/api'
//
// Uses the standard Web `Response` API rather than `next/server` so the
// package stays framework-agnostic. Any handler-supporting runtime works
// (Next.js App Router, Vercel functions, Cloudflare Workers, Bun, etc.).

import { readCancelShipmentEnv } from './env.js'
import { submitCancelShipmentToGocomet } from './handler.js'

interface RequestBody {
  workflowId?: unknown
  actionType?: unknown
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(request: Request): Promise<Response> {
  // ── 1. Parse + validate body ───────────────────────────────────────────────
  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400)
  }

  const workflowId = typeof body.workflowId === 'string' ? body.workflowId : null
  if (!workflowId) {
    return jsonResponse({ ok: false, error: 'workflowId is required' }, 400)
  }
  const actionType =
    body.actionType === 'unarchive' ? 'unarchive' : 'archive'

  // ── 2. Read env-driven config ──────────────────────────────────────────────
  const config = readCancelShipmentEnv()

  // ── 3. Submit + normalise ──────────────────────────────────────────────────
  const result = await submitCancelShipmentToGocomet(
    { workflowId, actionType },
    config,
  )

  if (!result.ok) {
    return jsonResponse(result, result.status ?? 502)
  }
  return jsonResponse(result, 200)
}
