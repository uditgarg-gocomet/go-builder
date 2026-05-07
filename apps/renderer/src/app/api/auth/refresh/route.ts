import { NextResponse, type NextRequest } from 'next/server'

const BACKEND_URL = process.env['BACKEND_INTERNAL_URL'] ?? 'http://localhost:3001'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const refreshToken = request.cookies.get('portal_refresh_token')?.value

  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 })
  }

  try {
    const res = await fetch(`${BACKEND_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!res.ok) {
      const response = NextResponse.json({ error: 'Refresh failed' }, { status: 401 })
      response.cookies.delete('portal_session')
      response.cookies.delete('portal_refresh_token')
      return response
    }

    const data = (await res.json()) as { accessToken?: string; refreshToken?: string }

    if (!data.accessToken) {
      return NextResponse.json({ error: 'No access token in response' }, { status: 401 })
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.set('portal_session', data.accessToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 8,
    })

    if (data.refreshToken) {
      response.cookies.set('portal_refresh_token', data.refreshToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      })
    }

    return response
  } catch {
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 })
  }
}
