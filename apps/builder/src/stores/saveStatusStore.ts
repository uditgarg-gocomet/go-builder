'use client'

import { create } from 'zustand'
import type { SaveStatus } from '@/hooks/useAutoSave'

// Shared save-status store so any autosaving surface (page canvas, app
// chrome, theme, etc.) can surface its status in the EditorShell's top-right
// save indicator. The page canvas's `useAutoSave` hook owns one slot; each
// form-driven autosave (HeaderPropsPanel, NavPropsPanel) owns its own keyed
// slot. `EditorShell` merges them into a single display signal.

export interface SaveSlot {
  status: SaveStatus
  lastSavedAt: Date | undefined
  warning: string | undefined
}

interface SaveStatusStore {
  slots: Record<string, SaveSlot>
  setSlot: (key: string, slot: SaveSlot) => void
  clearSlot: (key: string) => void
}

export const useSaveStatusStore = create<SaveStatusStore>((set) => ({
  slots: {},
  setSlot: (key, slot) => set(state => ({ slots: { ...state.slots, [key]: slot } })),
  clearSlot: (key) => set(state => {
    const next = { ...state.slots }
    delete next[key]
    return { slots: next }
  }),
}))

// Merge all slots into a single status + latest save time:
//   - if any slot is 'saving' → overall is 'saving'
//   - if any slot is 'error'  → overall is 'error'
//   - otherwise 'saved' with the newest lastSavedAt across slots
//   - if every slot is 'idle' (or no slots) → overall is 'idle'
export function mergeSlots(slots: Record<string, SaveSlot>): SaveSlot {
  const values = Object.values(slots)
  if (values.length === 0) {
    return { status: 'idle', lastSavedAt: undefined, warning: undefined }
  }

  const warning = values.map(v => v.warning).filter(Boolean)[0]

  if (values.some(v => v.status === 'saving')) {
    return { status: 'saving', lastSavedAt: undefined, warning }
  }
  if (values.some(v => v.status === 'error')) {
    return { status: 'error', lastSavedAt: undefined, warning }
  }

  const latest = values
    .map(v => v.lastSavedAt)
    .filter((d): d is Date => d !== undefined)
    .sort((a, b) => b.getTime() - a.getTime())[0]

  if (values.every(v => v.status === 'idle')) {
    return { status: 'idle', lastSavedAt: latest, warning }
  }

  return { status: 'saved', lastSavedAt: latest, warning }
}
