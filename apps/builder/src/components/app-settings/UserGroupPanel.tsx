'use client'

import React, { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { AppUserGroup } from '@/types/canvas'

import { clientFetch } from '@/lib/clientFetch'

interface Member { id: string; identifier: string }

interface GroupModalProps {
  appId: string
  initial?: AppUserGroup
  onClose: () => void
  onSaved: (group: AppUserGroup) => void
}

function GroupModal({ appId, initial, onClose, onSaved }: GroupModalProps): React.ReactElement {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [members, setMembers] = useState<Member[]>(
    (initial?.members ?? []).map(identifier => ({ id: crypto.randomUUID(), identifier })),
  )
  const [newMember, setNewMember] = useState('')
  const [saving, setSaving] = useState(false)

  const addMember = (): void => {
    if (!newMember.trim()) return
    setMembers(m => [...m, { id: crypto.randomUUID(), identifier: newMember.trim() }])
    setNewMember('')
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      const path = initial
        ? `/apps/${appId}/user-groups/${initial.id}`
        : `/apps/${appId}/user-groups`
      try {
        const data = await clientFetch<{ group: AppUserGroup }>(path, {
          method: initial ? 'PATCH' : 'POST',
          body: JSON.stringify({ name, description, members: members.map(m => m.identifier) }),
        })
        onSaved(data.group)
        onClose()
      } catch { /* show no error, just keep modal open */ }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">{initial ? 'Edit' : 'Add'} Group</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">×</button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Name</span>
            <input value={name} onChange={e => setName(e.target.value)}
              className="rounded border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Description</span>
            <input value={description} onChange={e => setDescription(e.target.value)}
              className="rounded border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
          </label>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Members</p>
            <div className="flex gap-2">
              <input value={newMember} onChange={e => setNewMember(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMember()}
                placeholder="user@example.com"
                className="flex-1 rounded border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
              <button type="button" onClick={addMember}
                className="rounded bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80">
                Add
              </button>
            </div>
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between rounded border border-border bg-background px-3 py-1.5">
                <span className="text-sm text-foreground">{m.identifier}</span>
                <button type="button" onClick={() => setMembers(ms => ms.filter(x => x.id !== m.id))}
                  className="text-xs text-destructive hover:opacity-70">Remove</button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface UserGroupPanelProps {
  appId: string
}

export function UserGroupPanel({ appId }: UserGroupPanelProps): React.ReactElement {
  const userGroups = useAppStore(s => s.userGroups)
  const setUserGroups = useAppStore(s => s.setUserGroups)
  const [modal, setModal] = useState<{ initial?: AppUserGroup } | null>(null)
  const [loading, setLoading] = useState(true)

  // Hydrate the store from the backend when the panel mounts. App settings
  // are loaded lazily (not as part of app bootstrap), so the store is empty
  // the first time the user opens this tab.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await clientFetch<{ groups: AppUserGroup[] }>(`/apps/${appId}/user-groups`)
        if (!cancelled) setUserGroups(data.groups ?? [])
      } catch {
        /* panel shows empty state on error */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [appId, setUserGroups])

  const handleSaved = (group: AppUserGroup): void => {
    if (userGroups.find(g => g.id === group.id)) {
      setUserGroups(userGroups.map(g => g.id === group.id ? group : g))
    } else {
      setUserGroups([...userGroups, group])
    }
  }

  const handleDelete = async (group: AppUserGroup): Promise<void> => {
    await clientFetch(`/apps/${appId}/user-groups/${group.id}`, { method: 'DELETE' }).catch(() => undefined)
    setUserGroups(userGroups.filter(g => g.id !== group.id))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">User Groups</h3>
        <button type="button" onClick={() => setModal({})}
          className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90">
          + Add
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : userGroups.length === 0 ? (
        <p className="text-xs text-muted-foreground">No groups configured.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {userGroups.map(g => (
            <div key={g.id} className="flex items-center justify-between rounded border border-border bg-background px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{g.name}</p>
                {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setModal({ initial: g })}
                  className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
                <button type="button" onClick={() => handleDelete(g)}
                  className="text-xs text-destructive hover:opacity-70">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <GroupModal appId={appId} initial={modal.initial} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
    </div>
  )
}
