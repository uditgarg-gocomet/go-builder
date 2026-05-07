import React from 'react'
import { DevLoginForm } from './DevLoginForm'

const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001'

interface IdP {
  id: string
  displayName: string
  protocol: 'OIDC' | 'SAML'
}

async function fetchBuilderIdPs(): Promise<IdP[]> {
  try {
    const res = await fetch(`${process.env['BACKEND_INTERNAL_URL'] ?? BACKEND_URL}/auth/builder/idps`, {
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = (await res.json()) as { idps: IdP[] }
    return data.idps ?? []
  } catch {
    return []
  }
}

const IS_DEV = process.env['NODE_ENV'] !== 'production'

export default async function LoginPage(): Promise<React.ReactElement> {
  const idps = await fetchBuilderIdPs()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Portal Builder</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>

        <div className="space-y-3">
          {idps.map(idp => (
            <a
              key={idp.id}
              href={`${BACKEND_URL}/auth/init/${idp.id}?context=BUILDER`}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Sign in with {idp.displayName}
            </a>
          ))}

          {IS_DEV && (
            <>
              {idps.length > 0 && (
                <div className="relative flex items-center">
                  <div className="flex-1 border-t border-border" />
                  <span className="mx-3 text-xs text-muted-foreground">or</span>
                  <div className="flex-1 border-t border-border" />
                </div>
              )}
              <DevLoginForm />
            </>
          )}

          {idps.length === 0 && !IS_DEV && (
            <p className="text-center text-sm text-muted-foreground">
              No identity providers configured. Contact your administrator.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
