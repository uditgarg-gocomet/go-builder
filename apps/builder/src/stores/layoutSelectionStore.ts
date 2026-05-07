'use client'

import { create } from 'zustand'

// When a chrome slot (header or nav) is selected, the right panel shows the
// layout props editor instead of the node PropsEditor. Nav item selection
// drills one level deeper — shows the single-item form overlaid on the nav
// list (per Retool pattern).

export type LayoutSelection =
  | { kind: 'none' }
  | { kind: 'header' }
  | { kind: 'nav' }
  | { kind: 'nav-item'; itemId: string }

interface LayoutSelectionStore {
  selection: LayoutSelection
  selectHeader: () => void
  selectNav: () => void
  selectNavItem: (itemId: string) => void
  clear: () => void
}

export const useLayoutSelectionStore = create<LayoutSelectionStore>((set) => ({
  selection: { kind: 'none' },
  selectHeader: () => set({ selection: { kind: 'header' } }),
  selectNav: () => set({ selection: { kind: 'nav' } }),
  selectNavItem: (itemId) => set({ selection: { kind: 'nav-item', itemId } }),
  clear: () => set({ selection: { kind: 'none' } }),
}))
