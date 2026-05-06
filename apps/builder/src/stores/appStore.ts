'use client'

import { create } from 'zustand'
import { produce } from 'immer'
import type { DataSourceDef, ActionDef, FormDef, StateSlotDef, ThemeOverride } from '@portal/core'
import type { AppMeta, AppIdentityProvider, AppUserGroup } from '@/types/canvas'

interface AppStore {
  app: AppMeta | null
  theme: ThemeOverride
  dataSources: DataSourceDef[]
  actions: ActionDef[]
  forms: FormDef[]
  stateSlots: StateSlotDef[]
  idProviders: AppIdentityProvider[]
  userGroups: AppUserGroup[]

  setApp: (app: AppMeta) => void
  setTheme: (theme: ThemeOverride) => void

  addDataSource: (ds: DataSourceDef) => void
  updateDataSource: (alias: string, updates: Partial<DataSourceDef>) => void
  removeDataSource: (alias: string) => void

  addAction: (action: ActionDef) => void
  updateAction: (id: string, updates: Partial<ActionDef>) => void
  removeAction: (id: string) => void

  addForm: (form: FormDef) => void
  updateForm: (id: string, updates: Partial<FormDef>) => void
  removeForm: (id: string) => void

  addStateSlot: (slot: StateSlotDef) => void
  removeStateSlot: (name: string) => void

  setIdProviders: (providers: AppIdentityProvider[]) => void
  setUserGroups: (groups: AppUserGroup[]) => void
}

export const useAppStore = create<AppStore>()((set) => ({
  app: null,
  theme: {},
  dataSources: [],
  actions: [],
  forms: [],
  stateSlots: [],
  idProviders: [],
  userGroups: [],

  setApp: (app) => set({ app }),
  setTheme: (theme) => set({ theme }),

  addDataSource: (ds) => set(produce<AppStore>(s => { s.dataSources.push(ds) })),
  updateDataSource: (alias, updates) => set(produce<AppStore>(s => {
    const ds = s.dataSources.find(d => d.alias === alias)
    if (ds) Object.assign(ds, updates)
  })),
  removeDataSource: (alias) => set(produce<AppStore>(s => {
    s.dataSources = s.dataSources.filter(d => d.alias !== alias)
  })),

  addAction: (action) => set(produce<AppStore>(s => { s.actions.push(action) })),
  updateAction: (id, updates) => set(produce<AppStore>(s => {
    const a = s.actions.find(x => x.id === id)
    if (a) Object.assign(a, updates)
  })),
  removeAction: (id) => set(produce<AppStore>(s => {
    s.actions = s.actions.filter(a => a.id !== id)
  })),

  addForm: (form) => set(produce<AppStore>(s => { s.forms.push(form) })),
  updateForm: (id, updates) => set(produce<AppStore>(s => {
    const f = s.forms.find(x => x.id === id)
    if (f) Object.assign(f, updates)
  })),
  removeForm: (id) => set(produce<AppStore>(s => {
    s.forms = s.forms.filter(f => f.id !== id)
  })),

  addStateSlot: (slot) => set(produce<AppStore>(s => { s.stateSlots.push(slot) })),
  removeStateSlot: (name) => set(produce<AppStore>(s => {
    s.stateSlots = s.stateSlots.filter(sl => sl.name !== name)
  })),

  setIdProviders: (providers) => set({ idProviders: providers }),
  setUserGroups: (groups) => set({ userGroups: groups }),
}))
