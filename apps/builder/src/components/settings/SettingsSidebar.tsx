'use client'

import React, { useState } from 'react'
import { DataSourcePanel } from './DataSourcePanel'
import { ActionPanel } from './ActionPanel'
import { FormPanel } from './FormPanel'
import { StatePanel } from './StatePanel'
import { PageMetaPanel } from './PageMetaPanel'

const TABS = [
  { id: 'datasources', label: 'Data' },
  { id: 'actions', label: 'Actions' },
  { id: 'forms', label: 'Forms' },
  { id: 'state', label: 'State' },
  { id: 'page', label: 'Page' },
] as const

type TabId = (typeof TABS)[number]['id']

interface SettingsSidebarProps {
  open: boolean
  onClose: () => void
}

export function SettingsSidebar({ open, onClose }: SettingsSidebarProps): React.ReactElement | null {
  const [activeTab, setActiveTab] = useState<TabId>('datasources')

  if (!open) return null

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Page Settings</h2>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">×</button>
      </div>

      <div className="flex gap-px overflow-x-auto border-b border-border bg-muted/30 px-2 pt-2">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-t px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'datasources' && <DataSourcePanel />}
        {activeTab === 'actions' && <ActionPanel />}
        {activeTab === 'forms' && <FormPanel />}
        {activeTab === 'state' && <StatePanel />}
        {activeTab === 'page' && <PageMetaPanel />}
      </div>
    </div>
  )
}
