'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { clientFetch } from '@/lib/clientFetch'

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export default function NewAppPage(): React.ReactElement {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleNameChange = (v: string): void => {
    setName(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) return
    setLoading(true)
    setError(null)

    try {
      const data = await clientFetch<{ id: string }>(
        '/apps',
        { method: 'POST', body: JSON.stringify({ name: name.trim(), slug: slug.trim() }) },
      )
      router.push(`/apps/${data.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create app')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">New App</h1>
          <p className="text-sm text-muted-foreground">Create a new client portal app</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
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
