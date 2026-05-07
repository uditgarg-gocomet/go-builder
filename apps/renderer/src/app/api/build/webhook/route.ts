import { NextResponse, type NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'

const BUILD_WEBHOOK_SECRET = process.env['BUILD_WEBHOOK_SECRET'] ?? ''
const BACKEND_URL = process.env['BACKEND_INTERNAL_URL'] ?? 'http://localhost:3001'

interface BuildWebhookPayload {
  deploymentId: string
  appSlug: string
  pageVersionId?: string
  environment: 'STAGING' | 'PRODUCTION'
}

function verifySignature(body: string, signature: string): boolean {
  if (!BUILD_WEBHOOK_SECRET) {
    return false
  }

  const expected = createHmac('sha256', BUILD_WEBHOOK_SECRET)
    .update(body)
    .digest('hex')

  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    )
  } catch {
    return false
  }
}

async function updateDeploymentStatus(
  deploymentId: string,
  status: 'BUILDING' | 'SUCCESS' | 'FAILED',
  serviceToken: string,
): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/apps/deployments/${deploymentId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceToken}`,
      },
      body: JSON.stringify({ status }),
    })
  } catch {
    // Best-effort status update
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const signature = request.headers.get('x-build-signature') ?? ''
  const rawBody = await request.text()

  // Verify HMAC signature
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: BuildWebhookPayload
  try {
    payload = JSON.parse(rawBody) as BuildWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { deploymentId, appSlug, environment } = payload

  if (!deploymentId || !appSlug || !environment) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Respond immediately — build is async
  const response = NextResponse.json({ received: true })

  // Trigger revalidation of all pages for this app asynchronously
  setImmediate(async () => {
    try {
      // In a real deployment this would trigger `next build` via CI.
      // For POC: revalidate static paths using Next.js on-demand revalidation.
      // The revalidation token matches BUILD_WEBHOOK_SECRET for simplicity.
      const revalidateUrl = new URL(
        `/api/build/revalidate?appSlug=${encodeURIComponent(appSlug)}&deploymentId=${encodeURIComponent(deploymentId)}`,
        process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3002',
      )
      await fetch(revalidateUrl.toString(), {
        headers: { 'x-revalidate-token': BUILD_WEBHOOK_SECRET },
      })
    } catch {
      // Ignore revalidation errors
    }
  })

  return response
}
