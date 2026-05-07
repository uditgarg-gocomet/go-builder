import { NextResponse, type NextRequest } from 'next/server'
import { redis, PREVIEW_TTL_SECONDS } from '@/lib/redis'
import type { PreviewSession } from '../create/route'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = request.headers.get('x-fde-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    token?: string
    restrictTo?: string[]
  }

  if (!body.token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }

  const raw = await redis.get(`preview:${body.token}`)
  if (!raw) {
    return NextResponse.json({ error: 'Preview session not found' }, { status: 404 })
  }

  const session = JSON.parse(raw) as PreviewSession

  if (session.ownerId !== userId) {
    return NextResponse.json({ error: 'Forbidden — only the owner can share a preview' }, { status: 403 })
  }

  const updated: PreviewSession = {
    ...session,
    isShared: true,
    restrictTo: body.restrictTo ?? [],
    updatedAt: new Date().toISOString(),
  }

  await redis.set(`preview:${body.token}`, JSON.stringify(updated), 'EX', PREVIEW_TTL_SECONDS)

  const baseUrl = process.env['NEXTAUTH_URL'] ?? 'http://localhost:3000'
  const shareUrl = `${baseUrl}/preview/${body.token}`

  return NextResponse.json({ shareUrl })
}
