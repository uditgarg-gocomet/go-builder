import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001'

async function getToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    return cookieStore.get('session')?.value ?? null
  } catch {
    return null
  }
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  options?: { serverSide?: boolean },
): Promise<T> {
  const baseUrl = options?.serverSide
    ? (process.env['BACKEND_INTERNAL_URL'] ?? BACKEND_URL)
    : BACKEND_URL

  const token = await getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${baseUrl}${path}`, { ...init, headers })

  if (res.status === 401) {
    redirect('/login')
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API error ${res.status}: ${body}`)
  }

  return res.json() as Promise<T>
}

export const apiClient = {
  get: <T>(path: string, opts?: { serverSide?: boolean }) =>
    apiFetch<T>(path, { method: 'GET' }, opts),

  post: <T>(path: string, body: unknown, opts?: { serverSide?: boolean }) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }, opts),

  patch: <T>(path: string, body: unknown, opts?: { serverSide?: boolean }) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, opts),

  delete: <T>(path: string, opts?: { serverSide?: boolean }) =>
    apiFetch<T>(path, { method: 'DELETE' }, opts),
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
  if (token) headers['Authorization'] = `Bearer ${token}`

  return fetch(`${BACKEND_URL}${path}`, { ...init, headers }).then(async res => {
    if (res.status === 401) {
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`API error ${res.status}: ${body}`)
    }
    return res.json() as Promise<T>
  })
}
