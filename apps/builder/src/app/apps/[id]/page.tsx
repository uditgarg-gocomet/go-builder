import React from 'react'
import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import type { AppMeta, PageMeta } from '@/types/canvas'
import { EditorShell } from './EditorShell'

const BACKEND = process.env['BACKEND_INTERNAL_URL'] ?? 'http://localhost:3001'

async function fetchApp(id: string, token: string): Promise<AppMeta | null> {
  try {
    const res = await fetch(`${BACKEND}/apps/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (res.status === 401) return null
    if (!res.ok) return null
    return (await res.json()) as AppMeta
  } catch {
    return null
  }
}

async function fetchPages(appId: string, token: string): Promise<PageMeta[]> {
  try {
    const res = await fetch(`${BACKEND}/apps/${appId}/pages`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = (await res.json()) as { pages: PageMeta[] }
    return data.pages ?? []
  } catch {
    return []
  }
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditorPage({ params }: PageProps): Promise<React.ReactElement> {
  const { id } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value

  if (!token) redirect('/login')

  const [app, pages] = await Promise.all([
    fetchApp(id, token),
    fetchPages(id, token),
  ])

  if (!app) notFound()

  return <EditorShell app={app} initialPages={pages} token={token} />
}
