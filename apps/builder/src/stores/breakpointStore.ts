'use client'

import { create } from 'zustand'
import type { Breakpoint } from '@/types/canvas'

interface BreakpointStore {
  active: Breakpoint
  setActive: (bp: Breakpoint) => void
}

export const useBreakpointStore = create<BreakpointStore>()((set) => ({
  active: 'desktop',
  setActive: (bp) => set({ active: bp }),
}))
