'use client'

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface PortalUser {
  id: string
  email: string
  groups: string[]
}

interface AuthContextValue {
  sessionToken: string | null
  user: PortalUser | null
  refresh: () => Promise<boolean>
  logout: (appSlug?: string) => Promise<void>
}

const AuthCtx = createContext<AuthContextValue>({
  sessionToken: null,
  user: null,
  refresh: async () => false,
  logout: async () => undefined,
})

// Decode JWT payload without signature verification
// (middleware already verified the signature — this is client-side only)
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    if (!payload) return null
    // Base64url decode
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(
      payload.length + ((4 - (payload.length % 4)) % 4),
      '=',
    )
    const json = atob(padded)
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

function readPortalSessionCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)portal_session=([^;]+)/)
  return match?.[1] ?? null
}

function parseUser(payload: Record<string, unknown> | null): PortalUser | null {
  if (!payload) return null
  const sub = payload['sub']
  if (typeof sub !== 'string') return null
  return {
    id: sub,
    email: typeof payload['email'] === 'string' ? payload['email'] : '',
    groups: Array.isArray(payload['groups'])
      ? (payload['groups'] as unknown[]).map(String)
      : [],
  }
}

interface AuthProviderProps {
  children: ReactNode
  // Server can pre-populate token + user from middleware headers
  initialToken?: string
  initialUserId?: string
  initialUserEmail?: string
  initialUserGroups?: string[]
}

export function AuthProvider({
  children,
  initialToken,
  initialUserId,
  initialUserEmail,
  initialUserGroups,
}: AuthProviderProps): React.ReactElement {
  const [sessionToken, setSessionToken] = useState<string | null>(
    initialToken ?? null,
  )
  const [user, setUser] = useState<PortalUser | null>(
    initialUserId
      ? { id: initialUserId, email: initialUserEmail ?? '', groups: initialUserGroups ?? [] }
      : null,
  )

  // On mount, read cookie client-side (in case server props weren't available)
  useEffect(() => {
    if (!sessionToken) {
      const token = readPortalSessionCookie()
      if (token) {
        setSessionToken(token)
        const payload = decodeJwtPayload(token)
        setUser(parseUser(payload))
      }
    }
  }, [sessionToken])

  async function refresh(): Promise<boolean> {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST' })
      if (!res.ok) return false
      // Cookie updated server-side; re-read from document
      const token = readPortalSessionCookie()
      if (token) {
        setSessionToken(token)
        const payload = decodeJwtPayload(token)
        setUser(parseUser(payload))
      }
      return true
    } catch {
      return false
    }
  }

  async function logout(appSlug?: string): Promise<void> {
    const url = appSlug
      ? `/api/auth/logout?appSlug=${encodeURIComponent(appSlug)}`
      : '/api/auth/logout'
    await fetch(url, { method: 'POST' })
    setSessionToken(null)
    setUser(null)
  }

  return (
    <AuthCtx.Provider value={{ sessionToken, user, refresh, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth(): AuthContextValue {
  return useContext(AuthCtx)
}
