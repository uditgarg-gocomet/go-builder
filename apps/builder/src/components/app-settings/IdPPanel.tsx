'use client'

import React, { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { AppIdentityProvider } from '@/types/canvas'

const BACKEND_URL = typeof window !== 'undefined'
  ? (process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001')
  : 'http://localhost:3001'

const IDP_TYPES = ['OIDC', 'SAML', 'Google', 'Okta', 'Auth0']
type Environment = 'STAGING' | 'PRODUCTION'

interface AddIdPModalProps {
  appId: string
  environment: Environment
  onClose: () => void
  onAdded: (idp: AppIdentityProvider) => void
}

function AddIdPModal({ appId, environment, onClose, onAdded }: AddIdPModalProps): React.ReactElement {
  const [form, setForm] = useState({ displayName: '', protocol: 'OIDC' as 'OIDC' | 'SAML', clientId: '', clientSecret: '', issuerUrl: '' })
  const [saving, setSaving] = useState(false)

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      const res = await fetch(`${BACKEND_URL}/auth/portal-idps/${appId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, environment, enabled: true }),
      })
      if (res.ok) {
        const data = (await res.json()) as { idp: AppIdentityProvider }
        onAdded(data.idp)
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Add Identity Provider</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">×</button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Display name</span>
            <input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
              placeholder="Google SSO"
              className="rounded border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Type</span>
            <select value={form.protocol} onChange={e => setForm(f => ({ ...f, protocol: e.target.value as 'OIDC' | 'SAML' }))}
              className="rounded border border-input bg-background px-3 py-1.5 text-sm outline-none">
              {IDP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          {form.protocol === 'OIDC' && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Issuer URL</span>
                <input value={form.issuerUrl} onChange={e => setForm(f => ({ ...f, issuerUrl: e.target.value }))}
                  placeholder="https://accounts.google.com"
                  className="rounded border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Client ID</span>
                <input value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                  className="rounded border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Client Secret</span>
                <input type="password" value={form.clientSecret} onChange={e => setForm(f => ({ ...f, clientSecret: e.target.value }))}
                  className="rounded border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
              </label>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {saving ? 'Saving…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface IdPPanelProps {
  appId: string
}

export function IdPPanel({ appId }: IdPPanelProps): React.ReactElement {
  const idProviders = useAppStore(s => s.idProviders)
  const setIdProviders = useAppStore(s => s.setIdProviders)
  const [env, setEnv] = useState<Environment>('STAGING')
  const [showModal, setShowModal] = useState(false)

  const filtered = idProviders.filter(p => p.environment === env)

  const toggleEnabled = async (idp: AppIdentityProvider): Promise<void> => {
    const updated = idProviders.map(p =>
      p.id === idp.id ? { ...p, enabled: !p.enabled } : p
    )
    setIdProviders(updated)
    await fetch(`${BACKEND_URL}/auth/portal-idps/${appId}/${idp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ enabled: !idp.enabled }),
    }).catch(() => undefined)
  }

  const handleAdded = (idp: AppIdentityProvider): void => {
    setIdProviders([...idProviders, idp])
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">Identity Providers</h3>

      <div className="flex gap-1">
        {(['STAGING', 'PRODUCTION'] as Environment[]).map(e => (
          <button key={e} type="button" onClick={() => setEnv(e)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${env === e ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
            {e}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground">No IdPs configured for {env}.</p>
        ) : (
          filtered.map(idp => (
            <div key={idp.id} className="flex items-center justify-between rounded border border-border bg-background px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{idp.displayName}</p>
                <p className="text-xs text-muted-foreground">{idp.protocol}</p>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={idp.enabled} onChange={() => toggleEnabled(idp)} className="accent-primary" />
                {idp.enabled ? 'Enabled' : 'Disabled'}
              </label>
            </div>
          ))
        )}
      </div>

      <button type="button" onClick={() => setShowModal(true)}
        className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
        + Add IdP
      </button>

      {showModal && (
        <AddIdPModal appId={appId} environment={env} onClose={() => setShowModal(false)} onAdded={handleAdded} />
      )}
    </div>
  )
}
