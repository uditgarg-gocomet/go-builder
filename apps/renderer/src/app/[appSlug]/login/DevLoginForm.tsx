'use client'

import React, { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001'
const ENV = (process.env['NEXT_PUBLIC_APP_ENVIRONMENT'] ?? 'STAGING') as 'STAGING' | 'PRODUCTION'

export interface GroupOption {
  id: string
  name: string
  description: string | null
}

interface DevLoginFormProps {
  appSlug: string
  appId?: string
  // Groups configured for this app (from the Builder's App Settings → User
  // Groups panel). When empty the form falls back to free-form group entry.
  groups: GroupOption[]
}

export function DevLoginForm({ appSlug, appId, groups }: DevLoginFormProps): React.ReactElement {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams?.get('redirectTo') ?? `/${appSlug}`

  const [email, setEmail] = useState('dev@portal.local')
  const [selectedGroup, setSelectedGroup] = useState<string>(groups[0]?.name ?? '')
  const [customGroups, setCustomGroups] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasConfiguredGroups = groups.length > 0

  const resolveGroups = (): string[] => {
    if (hasConfiguredGroups) {
      return selectedGroup ? [selectedGroup] : []
    }
    return customGroups
      .split(',')
      .map(g => g.trim())
      .filter(Boolean)
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const groupClaims = resolveGroups()

    try {
      // Mint a PORTAL-context JWT with the selected groups baked in. Backend
      // endpoint is dev-only (NODE_ENV check at the router level).
      const res = await fetch(`${BACKEND_URL}/auth/dev-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          context: 'PORTAL',
          appId: appId ?? '',
          environment: ENV,
          groups: groupClaims,
        }),
      })

      if (!res.ok) {
        setError('Dev login failed')
        return
      }

      const { token } = (await res.json()) as { token: string }

      // Persist the token as the portal_session cookie so middleware will
      // recognise subsequent requests as authenticated.
      const sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      if (!sessionRes.ok) {
        setError('Failed to set session')
        return
      }

      router.push(redirectTo.startsWith('/') ? redirectTo : `/${appSlug}`)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const selected = groups.find(g => g.name === selectedGroup)

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
      <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Dev mode — no IdP required
      </div>

      <label className="block text-xs font-medium text-muted-foreground">
        Email
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
        />
      </label>

      {hasConfiguredGroups ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Role</p>
          <div className="flex flex-col gap-1.5">
            {groups.map(group => (
              <label
                key={group.id}
                className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 transition-colors ${
                  selectedGroup === group.name
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <input
                  type="radio"
                  name="group"
                  value={group.name}
                  checked={selectedGroup === group.name}
                  onChange={() => setSelectedGroup(group.name)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{group.name}</div>
                  {group.description && (
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      {group.description}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground/70">
            Groups are configured in the Builder under App Settings → User Groups.
          </p>
        </div>
      ) : (
        <label className="block text-xs font-medium text-muted-foreground">
          Groups
          <input
            type="text"
            value={customGroups}
            onChange={e => setCustomGroups(e.target.value)}
            placeholder="ops_admin, ops_viewer"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="mt-1 block text-[10px] font-normal text-muted-foreground/70">
            Comma-separated. No groups configured for this app yet — add them in the Builder for a richer role picker.
          </span>
        </label>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {loading ? 'Signing in…' : hasConfiguredGroups
          ? `Dev Sign In${selected ? ` as ${selected.name}` : ''}`
          : 'Dev Sign In'}
      </button>
    </form>
  )
}
