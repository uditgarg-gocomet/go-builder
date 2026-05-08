'use client'

import React from 'react'
import type { DocumentInfo } from '../../shared/types.js'
import { COPY } from '../../shared/constants.js'

export interface DocumentPreviewProps {
  documents: ReadonlyArray<DocumentInfo>
}

export function DocumentPreview({
  documents,
}: DocumentPreviewProps): React.ReactElement {
  const [activeIdx, setActiveIdx] = React.useState(0)
  const active = documents[activeIdx]

  if (!active) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
        No document attached
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 h-full">
      {documents.length > 1 && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {documents.map((d, i) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={[
                'shrink-0 rounded px-2 py-1 text-[11px] font-medium transition-colors',
                i === activeIdx
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent',
              ].join(' ')}
              title={d.name}
            >
              {d.name.length > 24 ? `${d.name.slice(0, 22)}…` : d.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium truncate">{active.name}</span>
        <a
          href={active.link}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 ml-2 text-primary hover:underline"
        >
          {COPY.documentLink} ↗
        </a>
      </div>
      <iframe
        key={active.id}
        src={active.link}
        title={active.name}
        className="flex-1 min-h-[400px] w-full rounded border border-border bg-background"
      />
    </div>
  )
}
