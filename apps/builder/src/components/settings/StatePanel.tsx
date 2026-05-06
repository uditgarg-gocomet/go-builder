'use client'

import React, { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { StateSlotDef } from '@portal/core'

const SLOT_TYPES: NonNullable<StateSlotDef['type']>[] = ['string', 'number', 'boolean', 'object', 'array']

function emptySlot(): StateSlotDef {
  return { name: '', type: 'string', defaultValue: '' }
}

interface SlotRowProps {
  slot: StateSlotDef
  onRemove: () => void
}

function SlotRow({ slot, onRemove }: SlotRowProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between rounded border border-border bg-background px-3 py-2">
      <div>
        <p className="text-sm font-medium text-foreground">{slot.name}</p>
        <p className="text-xs text-muted-foreground">
          {slot.type ?? 'string'} · default: {JSON.stringify(slot.defaultValue)}
        </p>
      </div>
      <button type="button" onClick={onRemove} className="text-xs text-destructive hover:opacity-70">Delete</button>
    </div>
  )
}

export function StatePanel(): React.ReactElement {
  const stateSlots = useAppStore(s => s.stateSlots)
  const addStateSlot = useAppStore(s => s.addStateSlot)
  const removeStateSlot = useAppStore(s => s.removeStateSlot)
  const [draft, setDraft] = useState<StateSlotDef>(emptySlot())
  const [adding, setAdding] = useState(false)

  const handleAdd = (): void => {
    if (!draft.name.trim()) return
    addStateSlot(draft)
    setDraft(emptySlot())
    setAdding(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">State Slots</h3>
        <button type="button" onClick={() => setAdding(o => !o)}
          className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90">
          {adding ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {adding && (
        <div className="flex flex-col gap-2 rounded border border-border bg-background p-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground">Name</span>
            <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
              placeholder="isVisible"
              className="rounded border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground">Type</span>
            <select value={draft.type ?? 'string'} onChange={e => setDraft(d => ({ ...d, type: e.target.value as StateSlotDef['type'] }))}
              className="rounded border border-input bg-background px-2.5 py-1.5 text-sm outline-none">
              {SLOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground">Default value</span>
            <input value={String(draft.defaultValue ?? '')} onChange={e => setDraft(d => ({ ...d, defaultValue: e.target.value }))}
              placeholder="false"
              className="rounded border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
          </label>
          <button type="button" onClick={handleAdd}
            className="self-end rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
            Add slot
          </button>
        </div>
      )}

      {stateSlots.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground">No state slots defined.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {stateSlots.map(slot => (
            <SlotRow key={slot.name} slot={slot} onRemove={() => removeStateSlot(slot.name)} />
          ))}
        </div>
      )}
    </div>
  )
}
