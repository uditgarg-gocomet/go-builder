'use client'

import { create } from 'zustand'
import { produce } from 'immer'
import type {
  DataSourceDef, ActionDef, FormDef, StateSlotDef, ThemeOverride,
  HeaderConfig, NavConfig, NavItem,
} from '@portal/core'
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
  // Chrome — header + nav config fetched alongside the app. null = not
  // configured; the Renderer won't render anything for that slot.
  headerConfig: HeaderConfig | null
  navConfig: NavConfig | null

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

  // Bulk setters — used when loading a page's full schema into the store.
  // Replace the whole list in one shot to avoid race conditions with
  // auto-save while switching pages.
  setDataSources: (ds: DataSourceDef[]) => void
  setActions: (actions: ActionDef[]) => void
  setForms: (forms: FormDef[]) => void
  setStateSlots: (slots: StateSlotDef[]) => void

  // Chrome setters
  setHeaderConfig: (header: HeaderConfig | null) => void
  updateHeaderConfig: (updates: Partial<HeaderConfig>) => void
  setNavConfig: (nav: NavConfig | null) => void
  updateNavConfig: (updates: Partial<NavConfig>) => void
  setNavItems: (items: NavItem[]) => void
}

const DEFAULT_HEADER: HeaderConfig = {
  enabled: true,
  showAppTitle: true,
  showLogo: false,
  title: '',
  globalSearch: { enabled: false },
  showUserMenu: true,
}

const DEFAULT_NAV: NavConfig = {
  enabled: true,
  position: 'side',
  style: 'text-and-icon',
  collapsible: true,
  items: [],
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
  headerConfig: null,
  navConfig: null,

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

  setDataSources: (ds) => set({ dataSources: ds }),
  setActions: (actions) => set({ actions }),
  setForms: (forms) => set({ forms }),
  setStateSlots: (slots) => set({ stateSlots: slots }),

  setHeaderConfig: (header) => set({ headerConfig: header }),
  updateHeaderConfig: (updates) => set(produce<AppStore>(s => {
    s.headerConfig = { ...(s.headerConfig ?? DEFAULT_HEADER), ...updates }
  })),
  setNavConfig: (nav) => set({ navConfig: nav }),
  updateNavConfig: (updates) => set(produce<AppStore>(s => {
    s.navConfig = { ...(s.navConfig ?? DEFAULT_NAV), ...updates }
  })),
  setNavItems: (items) => set(produce<AppStore>(s => {
    s.navConfig = { ...(s.navConfig ?? DEFAULT_NAV), items }
  })),
}))

// Default exports so consumers (HeaderPropsPanel / NavPropsPanel) can seed
// the store when the FDE first enables a chrome slot.
export const DEFAULT_HEADER_CONFIG = DEFAULT_HEADER
export const DEFAULT_NAV_CONFIG = DEFAULT_NAV
