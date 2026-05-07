import { NextResponse, type NextRequest } from 'next/server'

interface RouteParams {
  params: Promise<{ idpId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { idpId: _idpId } = await params
  const searchParams = request.nextUrl.searchParams

  const token = searchParams.get('token')
  const redirectTo = searchParams.get('redirectTo') ?? '/'

  if (!token || typeof token !== 'string') {
    const url = new URL(request.url)
    const segments = url.pathname.split('/').filter(Boolean)
    // pathname is /api/auth/callback/:idpId — get appSlug from redirectTo
    const fallback = redirectTo.startsWith('/') ? redirectTo.split('/')[1] ?? '' : ''
    return NextResponse.redirect(new URL(`/${fallback}/login`, request.url))
  }

  const response = NextResponse.redirect(new URL(redirectTo, request.url))
  response.cookies.set('portal_session', token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 hours
  })
  return response
}
