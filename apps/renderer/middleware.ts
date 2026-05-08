import { type NextRequest, NextResponse } from 'next/server'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'

const BACKEND_URL = process.env['BACKEND_INTERNAL_URL'] ?? 'http://localhost:3001'
const JWKS_URL = process.env['JWKS_URL'] ?? `${BACKEND_URL}/.well-known/jwks.json`
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
const OPENFGA_API_URL = process.env['OPENFGA_API_URL'] ?? 'http://localhost:8080'
const OPENFGA_STORE_ID = process.env['OPENFGA_STORE_ID'] ?? ''

// Edge middleware cannot use node:crypto — use Web Crypto via jose instead
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
function getJWKS(): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(JWKS_URL))
  }
  return jwks
}

const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/unauthorized',
  '/api/auth',
  '/api/build',
  '/_next',
  '/favicon.ico',
]

function isPublicPath(pathname: string, appSlug: string): boolean {
  // Strip the appSlug prefix to get the relative path
  const relative = pathname.startsWith(`/${appSlug}`)
    ? pathname.slice(appSlug.length + 1) || '/'
    : pathname

  return PUBLIC_PATH_PREFIXES.some(prefix =>
    relative === prefix || relative.startsWith(`${prefix}/`),
  )
}

interface PortalToken extends JWTPayload {
  sub: string
  email?: string
  groups?: string[]
  tokenFamily?: string
  appId?: string
  context?: string
}

async function checkRedisRevocation(tokenFamily: string): Promise<boolean> {
  // Edge runtime cannot use ioredis — use Redis HTTP or fall back to Core Backend validate endpoint
  // For POC: delegate revocation check to Core Backend /auth/validate (which checks Redis itself)
  // This avoids needing ioredis in the edge runtime
  return false // placeholder — actual check done via /auth/validate below
}

async function checkOpenFGA(
  userId: string,
  appSlug: string,
  pageSlug: string,
): Promise<boolean> {
  if (!OPENFGA_STORE_ID) {
    // OpenFGA not configured — allow access (POC default)
    return true
  }

  try {
    const res = await fetch(
      `${OPENFGA_API_URL}/stores/${OPENFGA_STORE_ID}/check`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tuple_key: {
            user: `user:${userId}`,
            relation: 'viewer',
            object: `page:${appSlug}/${pageSlug}`,
          },
        }),
      },
    )

    if (!res.ok) {
      // Fail closed on OpenFGA error
      return false
    }

    const data = (await res.json()) as { allowed?: boolean }
    return data.allowed === true
  } catch {
    // Fail closed on network error
    return false
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Extract appSlug from first path segment: /appSlug/...
  const segments = pathname.split('/').filter(Boolean)
  const appSlug = segments[0] ?? ''
  const pageSlug = segments[1] ?? ''

  if (!appSlug) {
    return NextResponse.next()
  }

  // Allow public paths
  if (isPublicPath(pathname, appSlug)) {
    return NextResponse.next()
  }

  const loginUrl = new URL(`/${appSlug}/login`, request.url)
  const unauthorizedUrl = new URL(`/${appSlug}/unauthorized`, request.url)

  // Preserve the original URL so the login page can send the user back
  // after a successful sign-in. Includes pathname + any query string.
  const originalPath = pathname + (request.nextUrl.search ?? '')
  const addRedirectTo = (url: URL): URL => {
    url.searchParams.set('redirectTo', originalPath)
    return url
  }

  // Extract portal_session cookie
  const token = request.cookies.get('portal_session')?.value
  if (!token) {
    return NextResponse.redirect(addRedirectTo(loginUrl))
  }

  let payload: PortalToken
  try {
    // Verify JWT signature using JWKS from Core Backend
    const { payload: verified } = await jwtVerify<PortalToken>(token, getJWKS())
    payload = verified
  } catch {
    return NextResponse.redirect(addRedirectTo(loginUrl))
  }

  // Validate token via Core Backend (includes Redis revocation check)
  try {
    const validateRes = await fetch(`${BACKEND_URL}/auth/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    if (!validateRes.ok) {
      return NextResponse.redirect(addRedirectTo(loginUrl))
    }

    const validateData = (await validateRes.json()) as { valid?: boolean }
    if (!validateData.valid) {
      return NextResponse.redirect(addRedirectTo(loginUrl))
    }
  } catch {
    // Fail closed — deny access if Core Backend is unreachable
    return NextResponse.redirect(addRedirectTo(loginUrl))
  }

  // Check OpenFGA page access if a page slug is present
  if (pageSlug && payload.sub) {
    const allowed = await checkOpenFGA(payload.sub, appSlug, pageSlug)
    if (!allowed) {
      return NextResponse.redirect(unauthorizedUrl)
    }
  }

  // Inject user context into request headers for server components.
  //
  // Next.js gotcha: `response.headers.set(...)` alone only affects response
  // headers returned to the client — it does NOT forward them into the
  // request the downstream Server Component sees via `headers()`. To mutate
  // request headers the middleware has to build a new Headers object and
  // pass it via `NextResponse.next({ request: { headers } })`.
  const forwardedHeaders = new Headers(request.headers)
  if (payload.sub) forwardedHeaders.set('x-portal-user-id', payload.sub)
  if (payload.appId) forwardedHeaders.set('x-portal-app-id', payload.appId)
  if (payload.email) forwardedHeaders.set('x-portal-user-email', String(payload.email))
  if (Array.isArray(payload.groups)) {
    forwardedHeaders.set('x-portal-user-groups', payload.groups.join(','))
  }
  forwardedHeaders.set('x-portal-token', token)

  // DEBUG — temporary
  console.log('[middleware]', {
    path: pathname,
    sub: payload.sub,
    email: payload.email,
    groups: payload.groups,
    setHeaders: {
      'x-portal-user-id': payload.sub,
      'x-portal-user-email': payload.email,
      'x-portal-user-groups': Array.isArray(payload.groups) ? payload.groups.join(',') : '(none)',
    },
  })

  return NextResponse.next({ request: { headers: forwardedHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
