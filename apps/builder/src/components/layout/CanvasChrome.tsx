'use client'

import React from 'react'
import type { HeaderConfig, NavConfig, NavItem } from '@portal/core'
import { useAppStore } from '@/stores/appStore'
import { useLayoutSelectionStore } from '@/stores/layoutSelectionStore'

// Non-interactive preview of the app's header and nav, rendered in the
// Builder canvas frame around the page canvas. Clicking opens the right-side
// props panel (HeaderPropsPanel / NavPropsPanel) instead of the normal
// component PropsEditor.
//
// Layout:
//   ┌──────────────────────────────────────────────┐
//   │  AppHeaderBar (if enabled)                   │
//   ├──────────────────────────────────────────────┤
//   │  AppNavTop (if nav.position === 'top')       │
//   ├────────────┬─────────────────────────────────┤
//   │  AppNavSide│  children (page canvas)         │
//   │  (if side) │                                 │
//   │            │                                 │
//   └────────────┴─────────────────────────────────┘

interface CanvasChromeProps {
  children: React.ReactNode
}

export function CanvasChrome({ children }: CanvasChromeProps): React.ReactElement {
  const header = useAppStore(s => s.headerConfig)
  const nav = useAppStore(s => s.navConfig)
  const selection = useLayoutSelectionStore(s => s.selection)
  const selectHeader = useLayoutSelectionStore(s => s.selectHeader)
  const selectNav = useLayoutSelectionStore(s => s.selectNav)

  const headerActive = selection.kind === 'header'
  const navActive = selection.kind === 'nav' || selection.kind === 'nav-item'

  const showHeader = header?.enabled ?? false
  const showNav = nav?.enabled ?? false
  const navPos = nav?.position ?? 'side'

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {showHeader && header ? (
        <AppHeaderBar
          header={header}
          active={headerActive}
          onClick={selectHeader}
        />
      ) : (
        <AppHeaderEmpty active={headerActive} onClick={selectHeader} />
      )}

      <div className="flex flex-1 overflow-hidden">
        {showNav && nav && navPos === 'side' ? (
          <AppNavSide nav={nav} active={navActive} onClick={selectNav} />
        ) : !showNav ? (
          <AppNavEmpty orientation="side" active={navActive} onClick={selectNav} />
        ) : null}

        <div className="flex-1 flex flex-col overflow-hidden">
          {showNav && nav && navPos === 'top' ? (
            <AppNavTop nav={nav} active={navActive} onClick={selectNav} />
          ) : null}
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Header bar ──────────────────────────────────────────────────────────────

function AppHeaderBar({ header, active, onClick }: { header: HeaderConfig; active: boolean; onClick: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 px-4 h-12 border-b bg-card text-left transition-colors ${
        active ? 'ring-2 ring-inset ring-primary/60 bg-primary/5' : 'hover:bg-accent/30'
      }`}
      title="Click to edit header"
    >
      {header.showLogo && (
        <div className="h-6 w-6 rounded bg-muted shrink-0" aria-hidden />
      )}
      {header.showAppTitle && (
        <span className="text-sm font-semibold text-foreground truncate">
          {header.title || 'My App'}
        </span>
      )}
      {header.globalSearch.enabled && (
        <div className="mx-4 max-w-sm flex-1 rounded border border-input bg-background px-3 py-1 text-xs text-muted-foreground">
          🔍 {header.globalSearch.placeholder || 'Search…'}
        </div>
      )}
      <div className="flex-1" />
      {header.showUserMenu && (
        <div className="h-7 w-7 rounded-full bg-muted shrink-0" aria-hidden />
      )}
      <span className="text-[10px] text-primary font-medium opacity-0 group-hover:opacity-100">header</span>
    </button>
  )
}

function AppHeaderEmpty({ active, onClick }: { active: boolean; onClick: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center px-4 h-8 border-b border-dashed text-xs text-muted-foreground transition-colors ${
        active ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40 hover:text-foreground'
      }`}
      title="Click to configure the app header"
    >
      + App header
    </button>
  )
}

// ── Side nav ────────────────────────────────────────────────────────────────

function AppNavSide({ nav, active, onClick }: { nav: NavConfig; active: boolean; onClick: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-stretch gap-1 shrink-0 border-r bg-card text-left transition-colors ${
        nav.collapsible ? 'w-44' : 'w-52'
      } ${active ? 'ring-2 ring-inset ring-primary/60 bg-primary/5' : 'hover:bg-accent/30'}`}
      title="Click to edit navigation"
    >
      <div className="px-3 pt-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Nav</div>
      <div className="flex flex-col px-2 pb-2">
        {nav.items.length === 0 ? (
          <span className="text-xs text-muted-foreground italic px-2 py-2">No items</span>
        ) : (
          nav.items.slice(0, 8).map(item => (
            <NavItemRow key={item.id} item={item} style={nav.style} />
          ))
        )}
        {nav.items.length > 8 && (
          <span className="text-[10px] text-muted-foreground italic px-2 py-1">+{nav.items.length - 8} more</span>
        )}
      </div>
    </button>
  )
}

// ── Top nav ─────────────────────────────────────────────────────────────────

function AppNavTop({ nav, active, onClick }: { nav: NavConfig; active: boolean; onClick: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 h-10 border-b bg-card text-left transition-colors ${
        active ? 'ring-2 ring-inset ring-primary/60 bg-primary/5' : 'hover:bg-accent/30'
      }`}
      title="Click to edit navigation"
    >
      {nav.items.length === 0 ? (
        <span className="text-xs text-muted-foreground italic">No items</span>
      ) : (
        nav.items.slice(0, 8).map(item => (
          <NavItemRow key={item.id} item={item} style={nav.style} inline />
        ))
      )}
    </button>
  )
}

function AppNavEmpty({ orientation, active, onClick }: { orientation: 'side' | 'top'; active: boolean; onClick: () => void }): React.ReactElement {
  if (orientation === 'side') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-10 shrink-0 border-r border-dashed text-xs text-muted-foreground transition-colors flex items-center justify-center ${
          active ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40 hover:text-foreground'
        }`}
        title="Click to configure navigation"
      >
        +
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center px-3 h-8 border-b border-dashed text-xs text-muted-foreground transition-colors ${
        active ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40 hover:text-foreground'
      }`}
      title="Click to configure navigation"
    >
      + Navigation
    </button>
  )
}

// ── Item preview ─────────────────────────────────────────────────────────────

function NavItemRow({ item, style, inline }: { item: NavItem; style: NavConfig['style']; inline?: boolean }): React.ReactElement {
  const showText = style !== 'icon'
  const showIcon = style !== 'text'

  const label = item.label || 'Untitled'
  const icon = item.icon ?? defaultIconFor(item)

  if (inline) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-foreground">
        {showIcon && <span className="opacity-70">{icon}</span>}
        {showText && <span>{label}</span>}
      </span>
    )
  }

  return (
    <span className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-foreground">
      {showIcon && <span className="opacity-70">{icon}</span>}
      {showText && <span className="truncate">{label}</span>}
    </span>
  )
}

function defaultIconFor(item: NavItem): string {
  switch (item.kind) {
    case 'page': return '📄'
    case 'url': return '🔗'
    case 'custom': return '⚙'
    case 'group': return '📁'
  }
}
