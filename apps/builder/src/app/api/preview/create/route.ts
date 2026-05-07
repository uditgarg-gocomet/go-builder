import { NextResponse, type NextRequest } from 'next/server'
import { redis, PREVIEW_TTL_SECONDS } from '@/lib/redis'
import { randomUUID } from 'crypto'

export interface PreviewSession {
  token: string
  appId: string
  pageId: string
  ownerId: string
  schema: unknown
  mockData: Record<string, unknown>
  isShared: boolean
  restrictTo: string[]
  createdAt: string
  updatedAt: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = request.headers.get('x-fde-user-id')
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    appId?: string
    pageId?: string
    schema?: unknown
    mockData?: Record<string, unknown>
    existingToken?: string
  }

  if (!body.appId || !body.pageId || !body.schema) {
    return NextResponse.json({ error: 'appId, pageId, and schema are required' }, { status: 400 })
  }

  // If updating an existing preview session, reuse token
  let token = body.existingToken ?? randomUUID()

  if (body.existingToken) {
    // Verify ownership before overwriting
    const existing = await redis.get(`preview:${body.existingToken}`)
    if (existing) {
      const parsed = JSON.parse(existing) as PreviewSession
      if (parsed.ownerId !== session) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      token = body.existingToken
    } else {
      token = randomUUID()
    }
  }

  const previewSession: PreviewSession = {
    token,
    appId: body.appId,
    pageId: body.pageId,
    ownerId: session,
    schema: body.schema,
    mockData: body.mockData ?? {},
    isShared: false,
    restrictTo: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  await redis.set(`preview:${token}`, JSON.stringify(previewSession), 'EX', PREVIEW_TTL_SECONDS)

  return NextResponse.json({ previewToken: token })
}
