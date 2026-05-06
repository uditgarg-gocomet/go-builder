'use client'

import { useMemo } from 'react'

export interface FDESession {
  userId: string
  email: string
  role: 'ADMIN' | 'FDE'
  exp: number
}

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

export function useSession(): FDESession | null {
  return useMemo(() => {
    const token = getCookie('session')
    if (!token) return null
    const payload = parseJwt(token)
    if (!payload) return null
    return {
      userId: String(payload['sub'] ?? ''),
      email: String(payload['email'] ?? ''),
      role: (payload['role'] as 'ADMIN' | 'FDE') ?? 'FDE',
      exp: Number(payload['exp'] ?? 0),
    }
  }, [])
}
