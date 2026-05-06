'use client'

import React from 'react'
import { usePageStore } from '@/stores/pageStore'
import { useAppStore } from '@/stores/appStore'

export function PageMetaPanel(): React.ReactElement {
  const pages = usePageStore(s => s.pages)
  const activePageId = usePageStore(s => s.activePageId)
  const updatePage = usePageStore(s => s.updatePage)
  const userGroups = useAppStore(s => s.userGroups)

  const page = pages.find(p => p.id === activePageId)
  if (!page) {
    return <p className="text-xs text-muted-foreground">No page selected.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">Page Settings</h3>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Page name</span>
        <input value={page.name} onChange={e => updatePage(page.id, { name: e.target.value })}
          className="rounded border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Slug</span>
        <input value={page.slug} onChange={e => updatePage(page.id, { slug: e.target.value })}
          className="rounded border border-input bg-background px-3 py-1.5 text-sm font-mono outline-none focus:ring-1 focus:ring-ring" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Order</span>
        <input type="number" value={page.order} onChange={e => updatePage(page.id, { order: Number(e.target.value) })}
          className="rounded border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
      </label>

      {userGroups.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Allowed groups</span>
          <div className="flex flex-col gap-1">
            {userGroups.map(g => (
              <label key={g.id} className="flex items-center gap-2 text-xs text-foreground">
                <input type="checkbox" className="accent-primary" />
                {g.name}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
