import React from 'react'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import type { PageSchema, HeaderConfig, NavConfig } from '@portal/core'
import { ThemeProvider } from '@/lib/theme/themeInjector'
import { AuthProvider } from '@/lib/auth/authContext'
import { BindingProvider } from '@/lib/binding/bindingContext'
import { ActionProvider } from '@/lib/actions/actionContext'
import { SchemaRenderer } from '@/lib/renderer/schemaRenderer'
import { AppHeader } from '@/components/chrome/AppHeader'
import { AppNav } from '@/components/chrome/AppNav'

const BACKEND_INTERNAL_URL = process.env['BACKEND_INTERNAL_URL'] ?? 'http://localhost:3001'
const APP_ENVIRONMENT = (process.env['APP_ENVIRONMENT'] ?? 'STAGING') as 'STAGING' | 'PRODUCTION'
const APP_SLUG = process.env['APP_SLUG'] ?? ''

interface DeploymentPage {
  pageVersionId: string
  version: string
  status: string
  schema: unknown
  page: {
    id: string
    name: string
    slug: string
    order: number
  }
}

interface DeploymentResponse {
  deployment: {
    id: string
    appId: string
    appSlug: string
    environment: string
    buildStatus: string
    pages: DeploymentPage[]
    header: HeaderConfig | null
    nav: NavConfig | null
  }
}

async function fetchDeployment(appSlug: string): Promise<DeploymentResponse | null> {
  try {
    const res = await fetch(
      `${BACKEND_INTERNAL_URL}/apps/slug/${appSlug}/deployment/${APP_ENVIRONMENT}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return null
    return res.json() as Promise<DeploymentResponse>
  } catch {
    return null
  }
}

export async function generateStaticParams(): Promise<Array<{ appSlug: string; pageSlug: string }>> {
  const slug = APP_SLUG
  if (!slug) return []

  const data = await fetchDeployment(slug)
  if (!data) return []

  return data.deployment.pages.map(page => ({
    appSlug: slug,
    pageSlug: page.page.slug,
  }))
}

interface PageProps {
  params: Promise<{ appSlug: string; pageSlug: string }>
  // Next.js 15 delivers searchParams as a Promise of `string | string[] | undefined`
  // values. We need them so URL query strings (e.g. `?id=ABC`) flow into the
  // BindingContext as `params.id`, which schema bindings like
  // `{{params.id}}` (used by every detail-page data source) depend on.
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PortalPage({ params, searchParams }: PageProps): Promise<React.ReactElement> {
  const { appSlug, pageSlug } = await params
  const queryParams = await searchParams

  // Fetch deployment data
  const data = await fetchDeployment(appSlug)
  if (!data) notFound()

  // Find the matching page
  const deploymentPage = data.deployment.pages.find(p => p.page.slug === pageSlug)
  if (!deploymentPage) notFound()

  // Parse the schema
  let schema: PageSchema
  try {
    schema = deploymentPage.schema as PageSchema
  } catch {
    notFound()
  }

  // Note: custom widget preloading (CDN bundle imports) is a client-side
  // concern — the renderer's componentResolver pre-seeds built-in widgets
  // (DRDV, etc.) into its cache at module load. External CDN-delivered
  // widgets are loaded on-demand when their node renders.

  // Extract user info injected by middleware
  const headerStore = await headers()
  const userId = headerStore.get('x-portal-user-id') ?? undefined
  const userEmail = headerStore.get('x-portal-user-email') ?? undefined
  const userGroupsRaw = headerStore.get('x-portal-user-groups') ?? ''
  const userGroups = userGroupsRaw ? userGroupsRaw.split(',').filter(Boolean) : []
  const token = headerStore.get('x-portal-token') ?? undefined

  // URL params from the page route + query string (for binding resolution).
  // Query-string values are flattened — array values (e.g. `?tag=a&tag=b`)
  // collapse to the first one to keep the BindingContext shape `string` only.
  // Schema bindings like `{{params.id}}` read from this object.
  const urlParams: Record<string, string> = {
    appSlug,
    pageSlug,
  }
  for (const [key, value] of Object.entries(queryParams)) {
    if (typeof value === 'string') {
      urlParams[key] = value
    } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
      urlParams[key] = value[0]
    }
  }

  const themeTokens = schema.theme?.tokens
  const themeFonts = schema.theme?.fonts
  const headerConfig = data.deployment.header
  const navConfig = data.deployment.nav

  // Build a logo URL if the header references an asset. The assets module
  // serves content-addressed URLs from /assets/:key so this is a direct
  // construction rather than a per-request lookup.
  const logoUrl = headerConfig?.logoAssetId
    ? `${BACKEND_INTERNAL_URL}/assets/${headerConfig.logoAssetId}`
    : undefined

  return (
    <ThemeProvider tokens={themeTokens} fonts={themeFonts}>
      <AuthProvider
        initialToken={token}
        initialUserId={userId}
        initialUserEmail={userEmail}
        initialUserGroups={userGroups}
      >
        <BindingProvider
          schema={schema}
          urlParams={urlParams}
          sessionToken={token}
          userId={userId}
          userEmail={userEmail}
          userGroups={userGroups}
          appId={data.deployment.appId}
        >
          <ActionProvider
            schema={schema}
            sessionToken={token}
            appId={data.deployment.appId}
            pageId={deploymentPage.page.id}
            userId={userId}
          >
            <div className="min-h-screen flex flex-col">
              {headerConfig?.enabled && (
                <AppHeader config={headerConfig} appSlug={appSlug} logoUrl={logoUrl} />
              )}
              <div className="flex flex-1">
                {navConfig?.enabled && navConfig.position === 'side' && (
                  <AppNav config={navConfig} appSlug={appSlug} />
                )}
                <div className="flex-1 flex flex-col min-w-0">
                  {navConfig?.enabled && navConfig.position === 'top' && (
                    <AppNav config={navConfig} appSlug={appSlug} />
                  )}
                  <main className="flex-1">
                    <SchemaRenderer schema={schema} />
                  </main>
                </div>
              </div>
            </div>
          </ActionProvider>
        </BindingProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
