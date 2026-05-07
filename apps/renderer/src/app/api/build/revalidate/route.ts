import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'

const BUILD_WEBHOOK_SECRET = process.env['BUILD_WEBHOOK_SECRET'] ?? ''

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.headers.get('x-revalidate-token') ?? ''
  if (!token || token !== BUILD_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appSlug = request.nextUrl.searchParams.get('appSlug')
  if (!appSlug) {
    return NextResponse.json({ error: 'Missing appSlug' }, { status: 400 })
  }

  // Revalidate all pages under the app slug
  revalidatePath(`/${appSlug}`, 'layout')

  return NextResponse.json({ revalidated: true, appSlug })
}
