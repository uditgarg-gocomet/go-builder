import { NextResponse, type NextRequest } from 'next/server'

// POST /api/auth/session
// Sets the portal_session cookie from a JWT supplied in the body. Used by the
// renderer's dev-login flow to persist a session after calling the backend's
// /auth/dev-login endpoint.
//
// Accepts: { token: string, redirectTo?: string }
// Returns: { ok: true }

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { token?: string; redirectTo?: string }
  try {
    body = (await request.json()) as { token?: string; redirectTo?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { token } = body
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('portal_session', token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 hours
  })
  return response
}
