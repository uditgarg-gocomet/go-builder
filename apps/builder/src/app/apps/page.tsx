import React from 'react'
import Link from 'next/link'
import { cookies } from 'next/headers'

const BACKEND_URL = process.env['BACKEND_INTERNAL_URL'] ?? 'http://localhost:3001'

interface App {
  id: string
  name: string
  slug: string
  createdAt: string
}

async function fetchApps(token: string): Promise<App[]> {
  const res = await fetch(`${BACKEND_URL}/apps`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = (await res.json()) as { apps: App[] }
  return data.apps ?? []
}

export default async function AppsPage(): Promise<React.ReactElement> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''
  const apps = await fetchApps(token)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Portal Builder</h1>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-medium text-foreground">Your Apps</h2>
          <Link
            href="/apps/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            New App
          </Link>
        </div>

        {apps.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">No apps yet.</p>
            <Link
              href="/apps/new"
              className="mt-3 text-sm font-medium text-primary hover:underline"
            >
              Create your first app
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map(app => (
              <Link
                key={app.id}
                href={`/apps/${app.id}`}
                className="group rounded-lg border border-border bg-card p-5 hover:border-primary/50 hover:shadow-sm transition-all"
              >
                <h3 className="font-medium text-foreground group-hover:text-primary">{app.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{app.slug}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Created {new Date(app.createdAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
