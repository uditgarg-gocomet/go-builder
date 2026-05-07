const BACKEND_INTERNAL_URL = process.env['BACKEND_INTERNAL_URL'] ?? 'http://localhost:3001'
const BACKEND_PUBLIC_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001'

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  options?: { serverSide?: boolean; token?: string },
): Promise<T> {
  const baseUrl = options?.serverSide !== false ? BACKEND_INTERNAL_URL : BACKEND_PUBLIC_URL

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  }
  if (options?.token) headers['Authorization'] = `Bearer ${options.token}`

  const res = await fetch(`${baseUrl}${path}`, { ...init, headers })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API error ${res.status}: ${body}`)
  }

  return res.json() as Promise<T>
}

export const apiClient = {
  get: <T>(path: string, opts?: { token?: string; serverSide?: boolean }) =>
    apiFetch<T>(path, { method: 'GET' }, opts),

  post: <T>(path: string, body: unknown, opts?: { token?: string; serverSide?: boolean }) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }, opts),

  patch: <T>(path: string, body: unknown, opts?: { token?: string; serverSide?: boolean }) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, opts),
}
