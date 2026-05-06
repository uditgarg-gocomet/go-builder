import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

const BACKEND_URL = process.env['BACKEND_INTERNAL_URL'] ?? 'http://localhost:3001'

export async function POST(_request: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value

  if (token) {
    await fetch(`${BACKEND_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined)
  }

  const response = NextResponse.redirect(new URL('/login', _request.url))
  response.cookies.delete('session')
  return response
}
