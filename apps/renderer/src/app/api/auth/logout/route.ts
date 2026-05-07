import { NextResponse, type NextRequest } from 'next/server'

const BACKEND_URL = process.env['BACKEND_INTERNAL_URL'] ?? 'http://localhost:3001'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get('portal_session')?.value

  if (token) {
    // Best-effort logout on Core Backend — don't fail if it errors
    try {
      await fetch(`${BACKEND_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ all: false }),
      })
    } catch {
      // Ignore errors — cookie will be cleared regardless
    }
  }

  const appSlug = request.nextUrl.searchParams.get('appSlug') ?? ''
  const loginPath = appSlug ? `/${appSlug}/login` : '/login'

  const response = NextResponse.redirect(new URL(loginPath, request.url))
  response.cookies.delete('portal_session')
  response.cookies.delete('portal_refresh_token')
  return response
}
