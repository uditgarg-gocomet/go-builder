'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavConfig, NavItem, NavGroupItem } from '@portal/core'
import { useBindingContext } from '@/lib/binding/bindingContext'

// Runtime app navigation. Reads the current user's groups from
// BindingContext to drop items with unmet visibility rules from the tree
// (not CSS-hidden) — same mechanism as NodeRenderer.

interface AppNavProps {
  config: NavConfig
  appSlug: string
}

export function AppNav({ config, appSlug }: AppNavProps): React.ReactElement | null {
  const { context } = useBindingContext()
  const userGroups = context.user?.groups ?? []
  const [collapsed, setCollapsed] = useState(false)

  if (!config.enabled) return null

  const visibleItems = filterItems(config.items, userGroups)
  if (visibleItems.length === 0) return null

  if (config.position === 'top') {
    return (
      <nav className="flex items-center gap-1 px-4 h-10 border-b bg-card">
        {visibleItems.map(item => (
          <NavItemLink key={item.id} item={item} appSlug={appSlug} style={config.style} inline />
        ))}
      </nav>
    )
  }

  return (
    <nav className={`shrink-0 border-r bg-card flex flex-col ${collapsed ? 'w-12' : 'w-52'} transition-all`}>
      <div className="flex items-center justify-between px-2 py-2">
        <span className={`text-[10px] font-medium uppercase tracking-wider text-muted-foreground transition-opacity ${
          collapsed ? 'opacity-0' : 'opacity-100'
        }`}>
          Navigation
        </span>
        {config.collapsible && (
          <button
            type="button"
            onClick={() => setCollapsed(c => !c)}
            className="text-muted-foreground hover:text-foreground text-xs px-1"
            aria-label={collapsed ? 'Expand nav' : 'Collapse nav'}
          >
            {collapsed ? '»' : '«'}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-2 pb-2">
        {visibleItems.map(item => (
          <NavItemLink
            key={item.id}
            item={item}
            appSlug={appSlug}
            style={config.style}
            iconOnly={collapsed}
          />
        ))}
      </div>
    </nav>
  )
}

// ── Item rendering ───────────────────────────────────────────────────────────

function NavItemLink({
  item,
  appSlug,
  style,
  inline,
  iconOnly,
}: {
  item: NavItem
  appSlug: string
  style: NavConfig['style']
  inline?: boolean
  iconOnly?: boolean
}): React.ReactElement {
  const pathname = usePathname() ?? ''

  if (item.kind === 'group') {
    return <NavGroup item={item} appSlug={appSlug} style={style} iconOnly={iconOnly} />
  }

  const href = resolveHref(item, appSlug)
  const isActive = pathname === href

  const showText = style !== 'icon' && !iconOnly
  const showIcon = style !== 'text'
  const icon = item.icon ?? defaultIcon(item)

  const className = [
    inline
      ? 'inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm'
      : 'flex items-center gap-2 px-2 py-1.5 rounded text-sm',
    isActive
      ? 'bg-primary/10 text-primary font-medium'
      : 'text-foreground hover:bg-accent',
  ].join(' ')

  if (item.kind === 'url' && item.external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} title={iconOnly ? item.label : undefined}>
        {showIcon && <span className="opacity-70 shrink-0">{icon}</span>}
        {showText && <span className="truncate">{item.label}</span>}
      </a>
    )
  }

  return (
    <Link href={href} className={className} title={iconOnly ? item.label : undefined}>
      {showIcon && <span className="opacity-70 shrink-0">{icon}</span>}
      {showText && <span className="truncate">{item.label}</span>}
    </Link>
  )
}

function NavGroup({
  item,
  appSlug,
  style,
  iconOnly,
}: {
  item: NavGroupItem
  appSlug: string
  style: NavConfig['style']
  iconOnly?: boolean
}): React.ReactElement {
  const [expanded, setExpanded] = useState(true)
  const showText = style !== 'icon' && !iconOnly
  const showIcon = style !== 'text'
  const icon = item.icon ?? '📁'

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-foreground hover:bg-accent"
      >
        {showIcon && <span className="opacity-70 shrink-0">{icon}</span>}
        {showText && <span className="flex-1 text-left truncate">{item.label}</span>}
        {showText && <span className="opacity-60">{expanded ? '▾' : '▸'}</span>}
      </button>
      {expanded && (
        <div className="flex flex-col pl-4">
          {item.children.map(child => (
            <NavItemLink key={child.id} item={child} appSlug={appSlug} style={style} iconOnly={iconOnly} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveHref(item: NavItem, appSlug: string): string {
  switch (item.kind) {
    case 'page':   return `/${appSlug}/${item.pageSlug}`
    case 'url':    return item.url
    case 'custom': return item.customRoute.startsWith('/') ? item.customRoute : `/${appSlug}/${item.customRoute}`
    case 'group':  return '#'
  }
}

function defaultIcon(item: NavItem): string {
  switch (item.kind) {
    case 'page':   return '📄'
    case 'url':    return '🔗'
    case 'custom': return '⚙'
    case 'group':  return '📁'
  }
}

function filterItems(items: NavItem[], userGroups: string[]): NavItem[] {
  const filtered: NavItem[] = []
  for (const item of items) {
    if (!visibleFor(item, userGroups)) continue
    if (item.kind === 'group') {
      const children = filterItems(item.children, userGroups)
      if (children.length === 0) continue
      filtered.push({ ...item, children })
    } else {
      filtered.push(item)
    }
  }
  return filtered
}

function visibleFor(item: NavItem, userGroups: string[]): boolean {
  const v = item.visibility
  if (!v) return true

  if (v.requireGroups && v.requireGroups.length > 0) {
    const hasAny = v.requireGroups.some(g => userGroups.includes(g))
    if (!hasAny) return false
  }
  if (v.hideForGroups && v.hideForGroups.length > 0) {
    const hasHidden = v.hideForGroups.some(g => userGroups.includes(g))
    if (hasHidden) return false
  }
  return true
}
