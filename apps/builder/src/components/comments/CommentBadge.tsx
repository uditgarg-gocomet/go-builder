'use client'

import React from 'react'

interface CommentBadgeProps {
  count: number
  onClick: () => void
}

export function CommentBadge({ count, onClick }: CommentBadgeProps): React.ReactElement | null {
  if (count === 0) return null

  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick() }}
      className="absolute -right-1.5 -top-1.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-white shadow-sm hover:bg-amber-500"
      title={`${count} unresolved comment${count !== 1 ? 's' : ''}`}
    >
      {count > 9 ? '9+' : count}
    </button>
  )
}
