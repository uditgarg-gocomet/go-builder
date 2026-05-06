import { type NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/auth/callback', '/auth/refresh', '/api/auth']

const BACKEND_URL = process.env['BACKEND_INTERNAL_URL'] ?? 'http://localhost:3001'

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = request.cookies.get('session')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const res = await fetch(`${BACKEND_URL}/auth/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    if (!res.ok) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const data = (await res.json()) as { userId?: string; role?: string }
    const response = NextResponse.next()
    if (data.userId) response.headers.set('x-fde-user-id', data.userId)
    if (data.role) response.headers.set('x-fde-role', data.role)
    return response
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
