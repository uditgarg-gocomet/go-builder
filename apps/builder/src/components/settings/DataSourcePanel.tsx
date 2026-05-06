'use client'

import React, { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { DataSourceDef } from '@portal/core'

const BACKEND_URL = typeof window !== 'undefined'
  ? (process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001')
  : 'http://localhost:3001'

function emptyDS(): Partial<DataSourceDef> {
  return {
    alias: '',
    mode: 'REGISTERED',
    endpointId: '',
    transform: undefined,
    polling: undefined,
    useMock: false,
    mockData: undefined,
  }
}

interface DataSourceModalProps {
  initial: Partial<DataSourceDef>
  onSave: (ds: DataSourceDef) => void
  onClose: () => void
}

function DataSourceModal({ initial, onSave, onClose }: DataSourceModalProps): React.ReactElement {
  const [form, setForm] = useState(initial)
  const [testResult, setTestResult] = useState<unknown>(null)
  const [testing, setTesting] = useState(false)
  const [mockText, setMockText] = useState(
    initial.mockData ? JSON.stringify(initial.mockData, null, 2) : ''
  )

  const patch = (updates: Partial<DataSourceDef>): void =>
    setForm(f => ({ ...f, ...updates }))

  const handleTest = async (): Promise<void> => {
    setTesting(true)
    try {
      const res = await fetch(`${BACKEND_URL}/endpoints/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ endpointId: form.endpointId, pathParams: form.pathParams }),
      })
      const data: unknown = await res.json()
      setTestResult(data)
    } catch (e) {
      setTestResult({ error: String(e) })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = (): void => {
    let mockData: unknown = undefined
    if (mockText.trim()) {
      try { mockData = JSON.parse(mockText) } catch { /* ignore invalid JSON */ }
    }
    onSave({ ...form, mockData } as DataSourceDef)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">{initial.alias ? 'Edit' : 'Add'} Data Source</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">×</button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Alias</span>
            <input value={form.alias ?? ''} onChange={e => patch({ alias: e.target.value })}
              className="rounded border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Mode</span>
            <select value={form.mode ?? 'REGISTERED'} onChange={e => patch({ mode: e.target.value as DataSourceDef['mode'] })}
              className="rounded border border-input bg-background px-3 py-1.5 text-sm outline-none">
              <option value="REGISTERED">Registered Endpoint</option>
              <option value="CUSTOM_CONNECTOR">Custom Connector</option>
              <option value="CUSTOM_MANUAL">Custom Manual</option>
            </select>
          </label>

          {form.mode === 'REGISTERED' && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Endpoint ID</span>
              <input value={form.endpointId ?? ''} onChange={e => patch({ endpointId: e.target.value })}
                placeholder="endpoint-id"
                className="rounded border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
            </label>
          )}

          {(form.mode === 'CUSTOM_CONNECTOR' || form.mode === 'CUSTOM_MANUAL') && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">URL</span>
              <input value={(form as Record<string, unknown>)['url'] as string ?? ''} onChange={e => patch({ url: e.target.value } as Partial<DataSourceDef>)}
                placeholder="https://api.example.com/data"
                className="rounded border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Transform (JSONata)</span>
            <input value={form.transform ?? ''} onChange={e => patch({ transform: e.target.value || undefined })}
              placeholder="result.data"
              className="rounded border border-input bg-background px-3 py-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-ring" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Polling interval (ms, 0 = off)</span>
            <input type="number" value={(form.polling as { intervalMs?: number } | undefined)?.intervalMs ?? 0}
              onChange={e => patch({ polling: { intervalMs: Number(e.target.value), pauseWhen: (form.polling as { pauseWhen?: string } | undefined)?.pauseWhen } })}
              className="rounded border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
          </label>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Mock Data (JSON)</span>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={form.useMock ?? false} onChange={e => patch({ useMock: e.target.checked })}
                  className="accent-primary" />
                Use mock
              </label>
            </div>
            <textarea value={mockText} onChange={e => setMockText(e.target.value)} rows={4}
              placeholder='{"data": []}'
              className="rounded border border-input bg-background px-3 py-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-ring resize-y" />
          </div>

          {/* Test */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleTest} disabled={testing}
              className="rounded bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50">
              {testing ? 'Testing…' : 'Test endpoint'}
            </button>
            {testResult !== null && (
              <button type="button"
                onClick={() => setMockText(JSON.stringify(testResult, null, 2))}
                className="text-xs text-primary underline hover:no-underline">
                Import as mock
              </button>
            )}
          </div>

          {testResult !== null && (
            <pre className="max-h-32 overflow-auto rounded border border-border bg-muted p-2 text-xs">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="button" onClick={handleSave}
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">Save</button>
        </div>
      </div>
    </div>
  )
}

export function DataSourcePanel(): React.ReactElement {
  const dataSources = useAppStore(s => s.dataSources)
  const addDataSource = useAppStore(s => s.addDataSource)
  const updateDataSource = useAppStore(s => s.updateDataSource)
  const removeDataSource = useAppStore(s => s.removeDataSource)
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; initial: Partial<DataSourceDef> } | null>(null)

  const handleSave = (ds: DataSourceDef): void => {
    if (modal?.mode === 'add') {
      addDataSource(ds)
    } else {
      updateDataSource(ds.alias, ds)
    }
    setModal(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Data Sources</h3>
        <button type="button" onClick={() => setModal({ mode: 'add', initial: emptyDS() })}
          className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90">
          + Add
        </button>
      </div>

      {dataSources.length === 0 ? (
        <p className="text-xs text-muted-foreground">No data sources configured.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {dataSources.map(ds => (
            <div key={ds.alias} className="flex items-center justify-between rounded border border-border bg-background px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{ds.alias}</p>
                <p className="text-xs text-muted-foreground">{ds.mode}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setModal({ mode: 'edit', initial: ds })}
                  className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
                <button type="button" onClick={() => removeDataSource(ds.alias)}
                  className="text-xs text-destructive hover:opacity-70">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <DataSourceModal initial={modal.initial} onSave={handleSave} onClose={() => setModal(null)} />
      )}
    </div>
  )
}
