'use client'

import { create } from 'zustand'
import type { RegistryEntry } from '@portal/core'

const BACKEND_URL = typeof window !== 'undefined'
  ? (process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001')
  : 'http://localhost:3001'

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
      const res = await fetch(`${BACKEND_URL}/registry/entries?appId=${encodeURIComponent(appId)}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`Registry fetch failed: ${res.status}`)
      const data = (await res.json()) as { entries: RegistryEntry[] }
      set({ entries: data.entries ?? [] })
    } catch {
      set({ entries: [] })
    } finally {
      set({ isLoading: false })
    }
  },
}))
