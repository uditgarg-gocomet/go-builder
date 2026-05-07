'use client'

import { create } from 'zustand'
import type { RegistryEntry } from '@portal/core'
import { clientFetch } from '@/lib/clientFetch'

interface RegistryStore {
  entries: RegistryEntry[]
  isLoading: boolean
  fetchEntries: (appId: string) => Promise<void>
}

export const useRegistryStore = create<RegistryStore>()((set) => ({
  entries: [],
  isLoading: false,

  fetchEntries: async (appId) => {
    set({ isLoading: true })
    try {
      const data = await clientFetch<{ entries: RegistryEntry[] }>(`/registry/entries?appId=${encodeURIComponent(appId)}`)
      set({ entries: data.entries ?? [] })
    } catch {
      set({ entries: [] })
    } finally {
      set({ isLoading: false })
    }
  },
}))
