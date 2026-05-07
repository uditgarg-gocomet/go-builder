'use client'

import { useEffect, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export interface FDESession {
  userId: string
  email: string
  role: 'ADMIN' | 'FDE'
  exp: number
}

const PUBLIC_PATHS = ['/login', '/auth/callback', '/auth/refresh']

function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded) as Record<string, unknown>
  } catch {
    return null
  }
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match?.[1] != null ? decodeURIComponent(match[1]) : null
}

function readSession(): FDESession | null {
  const token = getCookie('session')
  if (!token) return null
  const payload = parseJwt(token)
  if (!payload) return null
  const exp = Number(payload['exp'] ?? 0)
  // exp is unix seconds; treat 0/missing as no-expiry (dev tokens)
  if (exp > 0 && exp * 1000 < Date.now()) return null
  return {
    userId: String(payload['sub'] ?? ''),
    email: String(payload['email'] ?? ''),
    role: (payload['role'] as 'ADMIN' | 'FDE') ?? 'FDE',
    exp,
  }
}

export function useSession(): FDESession | null {
  const router = useRouter()
  const pathname = usePathname()

  const session = useMemo(() => readSession(), [])

  useEffect(() => {
    if (PUBLIC_PATHS.some(p => pathname?.startsWith(p))) return
    if (session) return
    const next = pathname ? `?next=${encodeURIComponent(pathname)}` : ''
    router.replace(`/login${next}`)
  }, [session, pathname, router])

  return session
}
