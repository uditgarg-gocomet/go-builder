'use client'

import React, { useState } from 'react'
import { useAppStore } from '@/stores/appStore'

const BACKEND_URL = typeof window !== 'undefined'
  ? (process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001')
  : 'http://localhost:3001'

interface MockDataEditorProps {
  /** Called when mock data changes so the preview token can be updated */
  onMockDataChange?: (alias: string, data: unknown) => void
  /** Last test result per alias, so "Import from last test" can work */
  lastTestResults?: Record<string, unknown>
}

interface AliasEditorProps {
  alias: string
  useMock: boolean
  mockJson: string
  onToggle: () => void
  onJsonChange: (value: string) => void
  onImport: () => void
  jsonError: string | null
}

function AliasEditor({ alias, useMock, mockJson, onToggle, onJsonChange, onImport, jsonError }: AliasEditorProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-2 rounded border border-border bg-background p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-medium text-foreground">{alias}</span>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={useMock}
            onChange={onToggle}
            className="accent-primary"
          />
          Use mock
        </label>
      </div>

      {useMock && (
        <>
          <textarea
            value={mockJson}
            onChange={e => onJsonChange(e.target.value)}
            rows={5}
            spellCheck={false}
            className={`w-full rounded border bg-muted/30 px-2 py-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-ring resize-none ${jsonError ? 'border-destructive' : 'border-input'}`}
          />
          {jsonError && <p className="text-[10px] text-destructive">{jsonError}</p>}
          <button
            type="button"
            onClick={onImport}
            className="self-start text-xs text-muted-foreground hover:text-foreground"
          >
            ↓ Import from last test
          </button>
        </>
      )}
    </div>
  )
}

export function MockDataEditor({ onMockDataChange, lastTestResults = {} }: MockDataEditorProps): React.ReactElement {
  const dataSources = useAppStore(s => s.dataSources)

  const [useMock, setUseMock] = useState<Record<string, boolean>>({})
  const [mockJsons, setMockJsons] = useState<Record<string, string>>({})
  const [jsonErrors, setJsonErrors] = useState<Record<string, string | null>>({})

  const handleToggle = (alias: string): void => {
    setUseMock(prev => ({ ...prev, [alias]: !prev[alias] }))
  }

  const handleJsonChange = (alias: string, value: string): void => {
    setMockJsons(prev => ({ ...prev, [alias]: value }))
    try {
      const parsed: unknown = JSON.parse(value)
      setJsonErrors(prev => ({ ...prev, [alias]: null }))
      onMockDataChange?.(alias, parsed)
    } catch {
      setJsonErrors(prev => ({ ...prev, [alias]: 'Invalid JSON' }))
    }
  }

  const handleImport = (alias: string): void => {
    const result = lastTestResults[alias]
    if (result === undefined) return
    const json = JSON.stringify(result, null, 2)
    setMockJsons(prev => ({ ...prev, [alias]: json }))
    setJsonErrors(prev => ({ ...prev, [alias]: null }))
    onMockDataChange?.(alias, result)
  }

  if (dataSources.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Mock Data</h3>
        <p className="text-xs text-muted-foreground">No data sources configured.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">Mock Data</h3>
      <p className="text-[10px] text-muted-foreground">
        Enable mock data to preview with static responses. Disable to use live endpoint data.
      </p>

      {dataSources.map(ds => (
        <AliasEditor
          key={ds.alias}
          alias={ds.alias}
          useMock={useMock[ds.alias] ?? false}
          mockJson={mockJsons[ds.alias] ?? '{}'}
          onToggle={() => handleToggle(ds.alias)}
          onJsonChange={v => handleJsonChange(ds.alias, v)}
          onImport={() => handleImport(ds.alias)}
          jsonError={jsonErrors[ds.alias] ?? null}
        />
      ))}
    </div>
  )
}
