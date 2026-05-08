'use client'

import React, { useState, useRef, useEffect } from 'react'
import { usePageStore } from '@/stores/pageStore'
import { clientFetch, getCookieToken } from '@/lib/clientFetch'
import type { PageMeta } from '@/types/canvas'

interface PageMenuProps {
  appId: string
  userId: string
}

export function PageMenu({ appId, userId }: PageMenuProps): React.ReactElement {
  const pages = usePageStore(s => s.pages)
  const activePageId = usePageStore(s => s.activePageId)
  const setActivePage = usePageStore(s => s.setActivePage)
  const addPageToStore = usePageStore(s => s.addPage)
  const updatePageInStore = usePageStore(s => s.updatePage)
  const deletePageInStore = usePageStore(s => s.deletePage)

  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setAdding(false)
        setRenamingId(null)
        setNewName('')
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const activePage = pages.find(p => p.id === activePageId)

  const handleSelect = (id: string): void => {
    setActivePage(id)
    setOpen(false)
  }

  const handleAdd = async (): Promise<void> => {
    const name = newName.trim()
    if (!name) return
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    try {
      const page = await clientFetch<PageMeta>(
        `/apps/${appId}/pages`,
        { method: 'POST', body: JSON.stringify({ name, slug, order: pages.length, createdBy: userId }) },
        getCookieToken(),
      )
      if (!page?.id) return
      addPageToStore(page)
      setActivePage(page.id)
      setNewName('')
      setAdding(false)
      setOpen(false)
    } catch { /* non-critical */ }
  }

  const startRename = (page: PageMeta): void => {
    setRenamingId(page.id)
    setRenameValue(page.name)
  }

  const cancelRename = (): void => {
    setRenamingId(null)
    setRenameValue('')
  }

  const commitRename = async (): Promise<void> => {
    if (!renamingId) return
    const name = renameValue.trim()
    const original = pages.find(p => p.id === renamingId)
    if (!name || !original || name === original.name) {
      cancelRename()
      return
    }
    try {
      const updated = await clientFetch<PageMeta>(
        `/apps/${appId}/pages/${renamingId}`,
        { method: 'PATCH', body: JSON.stringify({ name }) },
        getCookieToken(),
      )
      updatePageInStore(renamingId, { name: updated?.name ?? name })
    } catch { /* non-critical */ }
    cancelRename()
  }

  const handleDelete = async (page: PageMeta): Promise<void> => {
    if (pages.length <= 1) {
      window.alert('Cannot delete the only page. Add another page first.')
      return
    }
    if (!window.confirm(`Delete page "${page.name}"? This cannot be undone.`)) return
    await clientFetch(`/apps/${appId}/pages/${page.id}`, { method: 'DELETE' }).catch(() => undefined)
    deletePageInStore(page.id)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Pages"
      >
        <span className="max-w-[160px] truncate">{activePage?.name ?? 'No page'}</span>
        <svg
          className={`h-3 w-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <polyline strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-card shadow-lg"
          role="menu"
        >
          <div className="max-h-72 overflow-y-auto py-1">
            {pages.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No pages yet</p>
            ) : (
              pages.map(page => {
                const isActive = page.id === activePageId
                const isRenaming = renamingId === page.id
                return (
                  <div
                    key={page.id}
                    className={`group flex items-center gap-1 px-2 py-1 text-xs ${
                      isActive ? 'bg-primary/10' : 'hover:bg-accent'
                    }`}
                  >
                    {isRenaming ? (
                      <input
                        autoFocus
                        type="text"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') void commitRename()
                          if (e.key === 'Escape') cancelRename()
                        }}
                        onBlur={() => void commitRename()}
                        className="flex-1 rounded border border-input bg-background px-2 py-0.5 text-xs outline-none focus:ring-1 focus:ring-ring"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelect(page.id)}
                        className={`flex-1 truncate py-0.5 text-left ${
                          isActive ? 'font-medium text-primary' : 'text-foreground'
                        }`}
                      >
                        {page.name}
                      </button>
                    )}
                    {!isRenaming ? (
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={() => startRename(page)}
                          title="Rename page"
                          aria-label={`Rename ${page.name}`}
                          className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(page)}
                          title="Delete page"
                          aria-label={`Delete ${page.name}`}
                          className="rounded p-1 text-muted-foreground hover:bg-background hover:text-destructive"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M3 7h18M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                          </svg>
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>

          <div className="border-t border-border p-1.5">
            {adding ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') void handleAdd()
                    if (e.key === 'Escape') {
                      setAdding(false)
                      setNewName('')
                    }
                  }}
                  placeholder="Page name"
                  className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => void handleAdd()}
                  className="rounded px-2 py-1 text-xs text-primary hover:bg-primary/10"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false)
                    setNewName('')
                  }}
                  className="rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent"
                  aria-label="Cancel add page"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add page
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
