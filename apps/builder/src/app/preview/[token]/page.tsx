import React from 'react'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { PreviewShell } from '@/components/preview/PreviewShell'
import { PreviewRenderer } from '@/components/preview/PreviewRenderer'
import type { PreviewSession } from '@/app/api/preview/create/route'

const BASE_URL = process.env['NEXTAUTH_URL'] ?? 'http://localhost:3000'

interface PreviewPageProps {
  params: Promise<{ token: string }>
}

async function getPreviewSession(token: string, sessionCookie: string | undefined): Promise<PreviewSession | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/preview/${token}`, {
      headers: sessionCookie ? { Cookie: `session=${sessionCookie}` } : {},
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as { session: PreviewSession }
    return data.session
  } catch {
    return null
  }
}

export default async function PreviewPage({ params }: PreviewPageProps): Promise<React.ReactElement> {
  const { token } = await params
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value

  const previewSession = await getPreviewSession(token, sessionCookie)

  if (!previewSession) {
    // If no session found and no cookie, it might be a shared link
    // In that case try without auth cookie
    if (!sessionCookie) {
      redirect('/login?returnTo=/preview/' + token)
    }
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Preview session not found or expired.</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <PreviewShell token={token} isShared={previewSession.isShared} />
      <div className="flex-1 overflow-auto">
        <PreviewRenderer session={previewSession} />
      </div>
    </div>
  )
}
