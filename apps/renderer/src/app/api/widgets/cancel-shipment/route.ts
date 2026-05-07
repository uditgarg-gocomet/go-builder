// ── Cancel Shipment proxy ────────────────────────────────────────────────────
// Browser → this route (same-origin, no CORS) → gocomet workflow API.
// Token + schema stay server-side; the browser never sees them.
//
// Stop-gap implementation. Long-term this moves to go-builder's
// /connector/execute proxy on apps/backend (see Phase E in
// docs/part-3-gocomet-auth-integration.md).

import { NextResponse } from 'next/server'

interface RequestBody {
  workflowId?: unknown
  actionType?: unknown
}

interface GocometSuccess {
  message?: string
}

interface GocometError {
  message?: string
  error?: string
}

export async function POST(request: Request): Promise<NextResponse> {
  // ── 1. Read + validate body ────────────────────────────────────────────────
  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const workflowId = typeof body.workflowId === 'string' ? body.workflowId : null
  if (!workflowId) {
    return NextResponse.json(
      { ok: false, error: 'workflowId is required' },
      { status: 400 },
    )
  }
  const actionType =
    body.actionType === 'unarchive' ? 'unarchive' : 'archive'

  // ── 2. Read server-side config ─────────────────────────────────────────────
  const token = process.env['WIDGET_MOCK_TOKEN'] ?? ''
  const userType = process.env['WIDGET_MOCK_USER_TYPE'] ?? 'public'
  const workflowApi = process.env['WIDGET_MOCK_WORKFLOW_API'] ?? ''
  const schema = process.env['WIDGET_MOCK_SCHEMA'] ?? ''

  if (!token || !workflowApi) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Server is not configured: WIDGET_MOCK_TOKEN and WIDGET_MOCK_WORKFLOW_API must be set in apps/renderer/.env.local',
      },
      { status: 500 },
    )
  }

  // ── 3. Build outgoing request ──────────────────────────────────────────────
  // Matches frontend-service/helpers/api.ts contract:
  //   Authorization: Bearer <raw-jwt>
  //   Schema: <schema_name>
  // The path follows /v1/{user_type}/workflow/archive_unarchive, exactly as
  // the legacy `archiveUnarchiveWorkflow` action constructs it.
  const url = `${workflowApi.replace(/\/$/, '')}/v1/${encodeURIComponent(userType)}/workflow/archive_unarchive`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (schema) {
    headers['Schema'] = schema
  }

  // ── 4. Call gocomet ────────────────────────────────────────────────────────
  let upstream: Response
  try {
    upstream = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ workflow_id: workflowId, action_type: actionType }),
      // No timeout in the standard fetch API; rely on the platform's default.
    })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: `Network error reaching workflow API: ${(err as Error).message}`,
      },
      { status: 502 },
    )
  }

  // ── 5. Normalize response ──────────────────────────────────────────────────
  let upstreamBody: unknown = null
  try {
    upstreamBody = await upstream.json()
  } catch {
    // Non-JSON response — surface status anyway.
  }

  if (!upstream.ok) {
    const err = upstreamBody as GocometError | null
    return NextResponse.json(
      {
        ok: false,
        status: upstream.status,
        error:
          err?.error ??
          err?.message ??
          `Workflow API returned ${upstream.status}`,
      },
      { status: upstream.status },
    )
  }

  const ok = upstreamBody as GocometSuccess | null
  return NextResponse.json({
    ok: true,
    message: ok?.message ?? 'Shipment cancelled successfully',
  })
}
