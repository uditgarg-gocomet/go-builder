'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { clientFetch } from '@/lib/clientFetch'
import { useSession } from '@/hooks/useSession'
import {
  STARTER_PAGES,
  buildStarterDraft,
  type StarterPageId,
} from '@/lib/starterPages'

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

type StartMode = 'scratch' | 'starter'

interface CreatedPage { id: string }
interface CreatedApp { id: string; createdBy: string }

export default function NewAppPage(): React.ReactElement {
  const router = useRouter()
  const session = useSession()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Default: include all three starter pages so the new app isn't a blank
  // canvas on first open. Switching to "Build from scratch" disables the
  // checkbox group entirely.
  const [startMode, setStartMode] = useState<StartMode>('starter')
  const [enabled, setEnabled] = useState<Record<StarterPageId, boolean>>({
    home: true,
    shipments: true,
    settings: true,
  })

  const handleNameChange = (v: string): void => {
    setName(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  const toggle = (id: StarterPageId): void =>
    setEnabled(prev => ({ ...prev, [id]: !prev[id] }))

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) return
    setLoading(true)
    setError(null)

    try {
      // 1. Create the app
      const app = await clientFetch<CreatedApp>('/apps', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
      })

      // 2. If the FDE asked for starter pages, create each one + a draft
      //    schema. Failures here are non-fatal — the app already exists, so
      //    we surface the warning but still navigate the user into the
      //    builder.
      if (startMode === 'starter') {
        const userId = session?.userId ?? app.createdBy
        const selected = STARTER_PAGES.filter(p => enabled[p.id])

        // Sequential, not parallel — pages have an `order` field and back-end
        // ordering is currently best-effort by insert time.
        for (const starter of selected) {
          try {
            const page = await clientFetch<CreatedPage>(
              `/apps/${app.id}/pages`,
              {
                method: 'POST',
                body: JSON.stringify({
                  name: starter.name,
                  slug: starter.slug,
                  order: starter.order,
                  createdBy: userId,
                }),
              },
            )
            await clientFetch('/schema/draft', {
              method: 'POST',
              body: JSON.stringify(
                buildStarterDraft(starter, app.id, page.id, userId),
              ),
            })
          } catch (perPageErr) {
            // Don't block the whole creation flow — one bad starter shouldn't
            // strand the user. Log and continue; missing pages can be added
            // from inside the builder.
            // eslint-disable-next-line no-console
            console.warn(`Starter "${starter.id}" failed:`, perPageErr)
          }
        }
      }

      router.push(`/apps/${app.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create app')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">New App</h1>
          <p className="text-sm text-muted-foreground">Create a new client portal app</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="name">App name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="My Client Portal"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="slug">
              URL slug
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">used in the portal URL</span>
            </label>
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={e => { setSlugTouched(true); setSlug(e.target.value) }}
              placeholder="my-client-portal"
              pattern="[a-z0-9-]+"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* ── Starting point ────────────────────────────────────────────── */}
          <fieldset className="space-y-3 rounded-md border border-border p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Starting point
            </legend>

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-transparent p-2 hover:border-border hover:bg-accent/30">
              <input
                type="radio"
                name="startMode"
                value="scratch"
                checked={startMode === 'scratch'}
                onChange={() => setStartMode('scratch')}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">Build from scratch</div>
                <div className="text-xs text-muted-foreground">Empty app — add pages and components yourself</div>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-transparent p-2 hover:border-border hover:bg-accent/30">
              <input
                type="radio"
                name="startMode"
                value="starter"
                checked={startMode === 'starter'}
                onChange={() => setStartMode('starter')}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">Start with default pages</div>
                <div className="text-xs text-muted-foreground">Pre-configured pages you can edit</div>
              </div>
            </label>

            {/* Starter toggles — disabled when "scratch" is selected. We
                deliberately keep them visible (not hidden) so the FDE can
                see what they'd get without flipping the radio first. */}
            <div
              className={`space-y-2 rounded-md border border-border bg-muted/30 p-3 ${
                startMode === 'starter' ? '' : 'pointer-events-none opacity-50'
              }`}
              aria-disabled={startMode !== 'starter'}
            >
              {STARTER_PAGES.map(p => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-start gap-3"
                >
                  <input
                    type="checkbox"
                    checked={enabled[p.id]}
                    onChange={() => toggle(p.id)}
                    disabled={startMode !== 'starter'}
                    className="mt-0.5 h-4 w-4 accent-primary"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Link
              href="/apps"
              className="flex-1 rounded-md border border-input px-4 py-2 text-center text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || !name.trim() || !slug.trim()}
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? 'Creating…' : 'Create App'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
