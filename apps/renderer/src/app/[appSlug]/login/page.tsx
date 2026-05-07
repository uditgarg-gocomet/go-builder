import React from 'react'
import { DevLoginForm, type GroupOption } from './DevLoginForm'

interface IdP {
  id: string
  displayName: string
  protocol: 'OIDC' | 'SAML'
}

interface PageProps {
  params: Promise<{ appSlug: string }>
  searchParams: Promise<{ redirectTo?: string }>
}

const IS_DEV = process.env['NODE_ENV'] !== 'production'

async function fetchPortalIdPs(appSlug: string): Promise<IdP[]> {
  const backendUrl = process.env['BACKEND_INTERNAL_URL'] ?? 'http://localhost:3001'
  const env = process.env['APP_ENVIRONMENT'] ?? 'STAGING'
  try {
    const res = await fetch(
      `${backendUrl}/auth/portal/idps?appSlug=${encodeURIComponent(appSlug)}&env=${env}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return []
    const data = (await res.json()) as { idps?: IdP[] }
    return data.idps ?? []
  } catch {
    return []
  }
}

async function fetchAppId(appSlug: string): Promise<string | undefined> {
  // Looked up via the deployment endpoint (returns appId alongside the pages).
  // Used by the dev-login form so the minted PORTAL token carries a real
  // appId claim. Falls back to undefined if no deployment exists yet —
  // dev-login will still work, the token just won't have the appId bound.
  const backendUrl = process.env['BACKEND_INTERNAL_URL'] ?? 'http://localhost:3001'
  const env = process.env['APP_ENVIRONMENT'] ?? 'STAGING'
  try {
    const res = await fetch(
      `${backendUrl}/apps/slug/${encodeURIComponent(appSlug)}/deployment/${env}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return undefined
    const data = (await res.json()) as { deployment?: { appId?: string } }
    return data.deployment?.appId
  } catch {
    return undefined
  }
}

async function fetchUserGroups(appSlug: string): Promise<GroupOption[]> {
  // Fetched from the public slug endpoint — returns group metadata only
  // (id, name, description), no member identifiers. Safe to call before the
  // user has authenticated.
  const backendUrl = process.env['BACKEND_INTERNAL_URL'] ?? 'http://localhost:3001'
  try {
    const res = await fetch(
      `${backendUrl}/apps/slug/${encodeURIComponent(appSlug)}/user-groups`,
      { cache: 'no-store' },
    )
    if (!res.ok) return []
    const data = (await res.json()) as { groups?: GroupOption[] }
    return data.groups ?? []
  } catch {
    return []
  }
}

export default async function LoginPage({ params, searchParams }: PageProps): Promise<React.ReactElement> {
  const { appSlug } = await params
  const { redirectTo } = await searchParams
  const [idps, appId, groups] = await Promise.all([
    fetchPortalIdPs(appSlug),
    IS_DEV ? fetchAppId(appSlug) : Promise.resolve(undefined),
    IS_DEV ? fetchUserGroups(appSlug) : Promise.resolve([] as GroupOption[]),
  ])

  const backendUrl = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001'
  const env = process.env['APP_ENVIRONMENT'] ?? 'STAGING'
  const callbackBase = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3002'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground capitalize">
            {appSlug.replace(/-/g, ' ')}
          </h1>
          <p className="text-sm text-muted-foreground">Sign in to access the portal</p>
        </div>

        <div className="space-y-3">
          {idps.length > 0 &&
            idps.map(idp => {
              const initUrl = new URL(`${backendUrl}/auth/init/${idp.id}`)
              initUrl.searchParams.set('context', 'PORTAL')
              initUrl.searchParams.set('appSlug', appSlug)
              initUrl.searchParams.set('env', env)
              initUrl.searchParams.set(
                'redirectTo',
                redirectTo ?? `${callbackBase}/${appSlug}`,
              )

              return (
                <a
                  key={idp.id}
                  href={initUrl.toString()}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  Sign in with {idp.displayName}
                </a>
              )
            })}

          {IS_DEV ? (
            <>
              {idps.length > 0 && (
                <div className="relative flex items-center">
                  <div className="flex-1 border-t border-border" />
                  <span className="mx-3 text-xs text-muted-foreground">or</span>
                  <div className="flex-1 border-t border-border" />
                </div>
              )}
              <DevLoginForm appSlug={appSlug} appId={appId} groups={groups} />
            </>
          ) : (
            idps.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Login is not configured for this portal. Contact your administrator.
              </p>
            )
          )}
        </div>
      </div>
    </div>
  )
}
