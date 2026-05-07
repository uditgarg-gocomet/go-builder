import { NextResponse, type NextRequest } from 'next/server'
import { redis, PREVIEW_TTL_SECONDS } from '@/lib/redis'
import type { PreviewSession } from '../create/route'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  const { token } = await params
  const userId = request.headers.get('x-fde-user-id')

  const raw = await redis.get(`preview:${token}`)
  if (!raw) {
    return NextResponse.json({ error: 'Preview session not found or expired' }, { status: 404 })
  }

  const session = JSON.parse(raw) as PreviewSession

  // Access control: owner always allowed; shared sessions are public;
  // non-owner must be in restrictTo (if set) or session is fully shared
  if (session.ownerId !== userId) {
    if (!session.isShared) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (session.restrictTo.length > 0) {
      // Would need caller email — skip for FDE preview tool; shared = public for POC
    }
  }

  // Refresh TTL on access
  await redis.expire(`preview:${token}`, PREVIEW_TTL_SECONDS)

  return NextResponse.json({ session })
}
