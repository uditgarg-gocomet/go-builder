import React from 'react'

/**
 * Component icon registry.
 *
 * Registry entries store an `icon` string (e.g. "table", "bar-chart-2"). The
 * builder's component picker looks that string up here to render a
 * domain-specific glyph. Falls back to a generic placeholder when the name
 * is unknown so new registry entries don't break the picker.
 *
 * Icons are hand-authored inline SVGs rather than a library (e.g. lucide)
 * to keep bundle size predictable and avoid a new workspace dependency. Add
 * entries as new primitives land.
 */

type IconRenderer = (props: { className?: string }) => React.ReactElement

const baseSvgProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function makeIcon(paths: React.ReactNode): IconRenderer {
  return function Icon({ className }): React.ReactElement {
    return (
      <svg {...baseSvgProps} className={className} aria-hidden="true">
        {paths}
      </svg>
    )
  }
}

const icons: Record<string, IconRenderer> = {
  // ── Layout ──
  'layout-stack': makeIcon(
    <>
      <rect x="4" y="4" width="16" height="4" rx="1" />
      <rect x="4" y="10" width="16" height="4" rx="1" />
      <rect x="4" y="16" width="16" height="4" rx="1" />
    </>
  ),
  'layout-grid': makeIcon(
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  'minus': makeIcon(<line x1="5" y1="12" x2="19" y2="12" />),
  'square': makeIcon(<rect x="4" y="4" width="16" height="16" rx="2" />),
  'square-dashed': makeIcon(
    <rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 2" />
  ),
  'panel-top': makeIcon(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
    </>
  ),
  'chevrons-up-down': makeIcon(
    <>
      <polyline points="7,15 12,20 17,15" />
      <polyline points="7,9 12,4 17,9" />
    </>
  ),
  'maximize-2': makeIcon(
    <>
      <polyline points="15,3 21,3 21,9" />
      <polyline points="9,21 3,21 3,15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </>
  ),

  // ── Data ──
  'table': makeIcon(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="10" y1="10" x2="10" y2="20" />
    </>
  ),
  'bar-chart-2': makeIcon(
    <>
      <line x1="6" y1="20" x2="6" y2="12" />
      <line x1="12" y1="20" x2="12" y2="6" />
      <line x1="18" y1="20" x2="18" y2="14" />
    </>
  ),
  'trending-up': makeIcon(
    <>
      <polyline points="3,17 9,11 13,15 21,7" />
      <polyline points="15,7 21,7 21,13" />
    </>
  ),
  'tag': makeIcon(
    <>
      <path d="M20 12l-8 8-8-8V4h8z" />
      <circle cx="8" cy="8" r="1.25" />
    </>
  ),
  'user-circle': makeIcon(
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.5 19a6 6 0 0 1 11 0" />
    </>
  ),

  // ── Input ──
  'type': makeIcon(
    <>
      <polyline points="4,7 4,4 20,4 20,7" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="9" y1="20" x2="15" y2="20" />
    </>
  ),
  'hash': makeIcon(
    <>
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </>
  ),
  'chevron-down-circle': makeIcon(
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="8,11 12,15 16,11" />
    </>
  ),
  'list-checks': makeIcon(
    <>
      <polyline points="3,6 4,7 6,5" />
      <polyline points="3,12 4,13 6,11" />
      <polyline points="3,18 4,19 6,17" />
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
    </>
  ),
  'calendar': makeIcon(
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <circle cx="12" cy="15" r="1.25" fill="currentColor" />
    </>
  ),
  'check-square': makeIcon(
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <polyline points="8,12 11,15 16,9" />
    </>
  ),
  'toggle-left': makeIcon(
    <>
      <rect x="2" y="7" width="20" height="10" rx="5" />
      <circle cx="8" cy="12" r="2.5" fill="currentColor" />
    </>
  ),
  'circle-dot': makeIcon(
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </>
  ),
  'align-left': makeIcon(
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="14" y2="12" />
      <line x1="4" y1="18" x2="18" y2="18" />
    </>
  ),
  'upload-cloud': makeIcon(
    <>
      <path d="M4 16a5 5 0 0 1 2-9.5A6 6 0 0 1 18 7a4.5 4.5 0 0 1 2 8.5" />
      <polyline points="9,14 12,11 15,14" />
      <line x1="12" y1="11" x2="12" y2="20" />
    </>
  ),

  // ── Action ──
  'circle': makeIcon(<circle cx="12" cy="12" r="8" />),
  'external-link': makeIcon(
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M18 14v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </>
  ),
  'menu': makeIcon(
    <>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </>
  ),

  // ── Feedback ──
  'alert-circle': makeIcon(
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="13" />
      <circle cx="12" cy="16.5" r="0.75" fill="currentColor" />
    </>
  ),
  'bell': makeIcon(
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  'loader': makeIcon(
    <>
      <line x1="12" y1="3" x2="12" y2="7" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="3" y1="12" x2="7" y2="12" />
      <line x1="17" y1="12" x2="21" y2="12" />
      <line x1="5.6" y1="5.6" x2="8.4" y2="8.4" />
      <line x1="15.6" y1="15.6" x2="18.4" y2="18.4" />
    </>
  ),
  'inbox': makeIcon(
    <>
      <polyline points="3,13 8,13 9,16 15,16 16,13 21,13" />
      <path d="M5 13l2-7h10l2 7v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
    </>
  ),
  'shield-alert': makeIcon(
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <circle cx="12" cy="16" r="0.75" fill="currentColor" />
    </>
  ),

  // ── Typography ──
  'heading': makeIcon(
    <>
      <line x1="6" y1="4" x2="6" y2="20" />
      <line x1="18" y1="4" x2="18" y2="20" />
      <line x1="6" y1="12" x2="18" y2="12" />
    </>
  ),
  'file-text': makeIcon(
    <>
      <path d="M7 3h8l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <polyline points="14,3 14,8 19,8" />
      <line x1="9" y1="13" x2="16" y2="13" />
      <line x1="9" y1="17" x2="16" y2="17" />
    </>
  ),
}

const fallback: IconRenderer = makeIcon(
  <rect x="5" y="5" width="14" height="14" rx="2" strokeDasharray="3 2" />
)

export interface ComponentIconProps {
  /** The icon key stored on the registry version (e.g. "table"). */
  name?: string | null
  className?: string
}

export function ComponentIcon({ name, className }: ComponentIconProps): React.ReactElement {
  const Icon = (name && icons[name]) || fallback
  return <Icon className={className} />
}

export function hasComponentIcon(name: string | null | undefined): boolean {
  return Boolean(name && icons[name])
}
