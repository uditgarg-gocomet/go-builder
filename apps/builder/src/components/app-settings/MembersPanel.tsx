'use client'

import React, { useState } from 'react'

const BACKEND_URL = typeof window !== 'undefined'
  ? (process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001')
  : 'http://localhost:3001'

type AppRole = 'OWNER' | 'EDITOR' | 'VIEWER'
const ROLES: AppRole[] = ['OWNER', 'EDITOR', 'VIEWER']

interface AppMember {
  id: string
  email: string
  role: AppRole
}

interface MembersPanelProps {
  appId: string
}

export function MembersPanel({ appId }: MembersPanelProps): React.ReactElement {
  const [members, setMembers] = useState<AppMember[]>([])
  const [loaded, setLoaded] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState<AppRole>('EDITOR')
  const [adding, setAdding] = useState(false)

  const fetchMembers = async (): Promise<void> => {
    const res = await fetch(`${BACKEND_URL}/apps/${appId}/members`, { credentials: 'include' })
    if (res.ok) {
      const data = (await res.json()) as { members: AppMember[] }
      setMembers(data.members ?? [])
    }
    setLoaded(true)
  }

  // Lazy load on first render
  if (!loaded) { void fetchMembers() }

  const ownerCount = members.filter(m => m.role === 'OWNER').length

  const handleAdd = async (): Promise<void> => {
    if (!addEmail.trim()) return
    setAdding(true)
    try {
      const res = await fetch(`${BACKEND_URL}/apps/${appId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: addEmail.trim(), role: addRole }),
      })
      if (res.ok) {
        const data = (await res.json()) as { member: AppMember }
        setMembers(m => [...m, data.member])
        setAddEmail('')
      }
    } finally {
      setAdding(false)
    }
  }

  const handleRoleChange = async (member: AppMember, role: AppRole): Promise<void> => {
    setMembers(ms => ms.map(m => m.id === member.id ? { ...m, role } : m))
    await fetch(`${BACKEND_URL}/apps/${appId}/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role }),
    }).catch(() => undefined)
  }

  const handleRemove = async (member: AppMember): Promise<void> => {
    if (member.role === 'OWNER' && ownerCount <= 1) return
    await fetch(`${BACKEND_URL}/apps/${appId}/members/${member.id}`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => undefined)
    setMembers(ms => ms.filter(m => m.id !== member.id))
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">Members</h3>

      {/* Add member */}
      <div className="flex gap-2">
        <input
          type="email"
          value={addEmail}
          onChange={e => setAddEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void handleAdd()}
          placeholder="colleague@example.com"
          className="flex-1 rounded border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <select
          value={addRole}
          onChange={e => setAddRole(e.target.value as AppRole)}
          className="rounded border border-input bg-background px-2 py-1.5 text-sm outline-none"
        >
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={adding || !addEmail.trim()}
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {adding ? '…' : 'Invite'}
        </button>
      </div>

      {/* Member list */}
      {members.length === 0 ? (
        <p className="text-xs text-muted-foreground">{loaded ? 'No members yet.' : 'Loading…'}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {members.map(member => {
            const isLastOwner = member.role === 'OWNER' && ownerCount <= 1
            return (
              <div key={member.id} className="flex items-center justify-between rounded border border-border bg-background px-3 py-2">
                <p className="text-sm text-foreground">{member.email}</p>
                <div className="flex items-center gap-2">
                  <select
                    value={member.role}
                    onChange={e => void handleRoleChange(member, e.target.value as AppRole)}
                    className="rounded border border-input bg-background px-2 py-1 text-xs outline-none"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleRemove(member)}
                    disabled={isLastOwner}
                    title={isLastOwner ? 'Cannot remove the last owner' : 'Remove member'}
                    className="text-xs text-destructive hover:opacity-70 disabled:opacity-30"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
