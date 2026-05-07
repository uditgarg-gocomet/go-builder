'use client'

const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001'

export function getCookieToken(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(/(?:^|; )session=([^;]*)/)
  return match?.[1] ? decodeURIComponent(match[1]) : undefined
}

export function clientFetch<T>(
  path: string,
  init?: RequestInit,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  }
  const tok = token ?? getCookieToken()
  if (tok) headers['Authorization'] = `Bearer ${tok}`

  return fetch(`${BACKEND_URL}${path}`, { ...init, headers }).then(async res => {
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        const next = encodeURIComponent(window.location.pathname + window.location.search)
        window.location.href = `/login?next=${next}`
      }
      throw new Error('Unauthorized')
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`API error ${res.status}: ${body}`)
    }
    return res.json() as Promise<T>
  })
}
