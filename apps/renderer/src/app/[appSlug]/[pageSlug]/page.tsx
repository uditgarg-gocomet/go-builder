import React from 'react'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import type { PageSchema } from '@portal/core'
import { ThemeProvider } from '@/lib/theme/themeInjector'
import { AuthProvider } from '@/lib/auth/authContext'
import { BindingProvider } from '@/lib/binding/bindingContext'
import { ActionProvider } from '@/lib/actions/actionContext'
import { SchemaRenderer } from '@/lib/renderer/schemaRenderer'
import { preloadCustomWidgets } from '@/lib/resolver/componentResolver'

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
}

export default async function PortalPage({ params }: PageProps): Promise<React.ReactElement> {
  const { appSlug, pageSlug } = await params

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

  // Preload any custom widget bundles
  await preloadCustomWidgets([schema.layout])

  // Extract user info injected by middleware
  const headerStore = await headers()
  const userId = headerStore.get('x-portal-user-id') ?? undefined
  const token = headerStore.get('x-portal-token') ?? undefined

  // URL params from the page route (for binding resolution)
  const urlParams: Record<string, string> = {
    appSlug,
    pageSlug,
  }

  const themeTokens = schema.theme?.tokens
  const themeFonts = schema.theme?.fonts

  return (
    <ThemeProvider tokens={themeTokens} fonts={themeFonts}>
      <AuthProvider
        initialToken={token}
        initialUserId={userId}
      >
        <BindingProvider
          schema={schema}
          urlParams={urlParams}
          sessionToken={token}
          userId={userId}
          appId={data.deployment.appId}
        >
          <ActionProvider
            schema={schema}
            sessionToken={token}
            appId={data.deployment.appId}
            pageId={deploymentPage.page.id}
            userId={userId}
          >
            <SchemaRenderer schema={schema} />
          </ActionProvider>
        </BindingProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
