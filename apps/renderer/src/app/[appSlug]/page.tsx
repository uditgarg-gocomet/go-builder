import { notFound, redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ appSlug: string }>
}

interface DeploymentPage {
  page: { id: string; name: string; slug: string; order: number }
}
interface DeploymentResponse {
  deployment?: { pages?: DeploymentPage[] }
}

// Server-side: hits the same deployment endpoint the [pageSlug] route uses
// and redirects to whichever page has the lowest `order`. Avoids hardcoding
// a /home slug that most apps don't have.
async function resolveFirstPageSlug(appSlug: string): Promise<string | null> {
  const backendUrl = process.env['BACKEND_INTERNAL_URL'] ?? 'http://localhost:3001'
  const env = process.env['APP_ENVIRONMENT'] ?? 'STAGING'
  try {
    const res = await fetch(
      `${backendUrl}/apps/slug/${encodeURIComponent(appSlug)}/deployment/${env}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return null
    const data = (await res.json()) as DeploymentResponse
    const pages = data.deployment?.pages ?? []
    if (pages.length === 0) return null
    // Sort by order ascending and fall back to the first entry's slug
    const sorted = [...pages].sort((a, b) => a.page.order - b.page.order)
    return sorted[0]?.page.slug ?? null
  } catch {
    return null
  }
}

export default async function AppHomePage({ params }: PageProps): Promise<never> {
  const { appSlug } = await params
  const firstSlug = await resolveFirstPageSlug(appSlug)
  if (!firstSlug) notFound()
  redirect(`/${appSlug}/${firstSlug}`)
}
