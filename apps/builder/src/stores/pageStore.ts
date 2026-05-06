'use client'

import { create } from 'zustand'
import { produce } from 'immer'
import type { PageMeta } from '@/types/canvas'

interface PageStore {
  pages: PageMeta[]
  activePageId: string | null
  setActivePage: (id: string) => void
  addPage: (page: PageMeta) => void
  updatePage: (id: string, updates: Partial<PageMeta>) => void
  deletePage: (id: string) => void
  reorderPages: (orderedIds: string[]) => void
  setPages: (pages: PageMeta[]) => void
}

export const usePageStore = create<PageStore>()((set) => ({
  pages: [],
  activePageId: null,

  setActivePage: (id) => set({ activePageId: id }),

  addPage: (page) => set(produce<PageStore>(state => {
    state.pages.push(page)
  })),

  updatePage: (id, updates) => set(produce<PageStore>(state => {
    const page = state.pages.find(p => p.id === id)
    if (page) Object.assign(page, updates)
  })),

  deletePage: (id) => set(produce<PageStore>(state => {
    state.pages = state.pages.filter(p => p.id !== id)
    if (state.activePageId === id) {
      state.activePageId = state.pages[0]?.id ?? null
    }
  })),

  reorderPages: (orderedIds) => set(produce<PageStore>(state => {
    state.pages.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id))
    state.pages.forEach((p, i) => { p.order = i })
  })),

  setPages: (pages) => set({ pages }),
}))
