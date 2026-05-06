'use client'

import React from 'react'

interface ComponentGhostProps {
  label: string
}

export function ComponentGhost({ label }: ComponentGhostProps): React.ReactElement {
  return (
    <div className="pointer-events-none flex items-center gap-2 rounded-md border border-primary bg-primary/10 px-3 py-2 text-sm font-medium text-primary opacity-90 shadow-lg">
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
      {label}
    </div>
  )
}
