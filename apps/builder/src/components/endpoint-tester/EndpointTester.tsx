'use client'

import React, { useState, useEffect } from 'react'

import { clientFetch } from '@/lib/clientFetch'

interface Connector {
  id: string
  name: string
}

interface Endpoint {
  id: string
  name: string
  method: string
  urlPattern: string
}

interface TestResult {
  status: number
  durationMs: number
  body: unknown
}

interface EndpointTesterProps {
  appId: string
  /** Called when "Use as mock" is clicked so MockDataEditor can receive the result */
  onImportMock?: (alias: string, data: unknown) => void
}

export function EndpointTester({ appId, onImportMock }: EndpointTesterProps): React.ReactElement {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [endpoints, setEndpoints] = useState<Endpoint[]>([])
  const [selectedConnectorId, setSelectedConnectorId] = useState('')
  const [selectedEndpointId, setSelectedEndpointId] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [method, setMethod] = useState('GET')
  const [pathParams, setPathParams] = useState('')
  const [queryParams, setQueryParams] = useState('')
  const [body, setBody] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importAlias, setImportAlias] = useState('')

  useEffect(() => {
    void clientFetch<{ connectors: Connector[] }>('/connectors')
      .then(data => setConnectors(data.connectors ?? []))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!selectedConnectorId) { setEndpoints([]); return }
    void clientFetch<{ endpoints: Endpoint[] }>(`/connectors/${selectedConnectorId}/endpoints`)
      .then(data => setEndpoints(data.endpoints ?? []))
      .catch(() => undefined)
  }, [selectedConnectorId])

  const handleRun = async (): Promise<void> => {
    setRunning(true)
    setError(null)
    setResult(null)

    try {
      const payload: Record<string, unknown> = {
        appId,
        environment: 'STAGING',
        mode: selectedEndpointId ? 'REGISTERED' : 'CUSTOM_MANUAL',
      }

      if (selectedEndpointId) {
        payload['endpointId'] = selectedEndpointId
        if (selectedConnectorId) payload['connectorId'] = selectedConnectorId
      } else {
        payload['customUrl'] = customUrl
        payload['method'] = method
      }

      if (pathParams.trim()) {
        try { payload['pathParams'] = JSON.parse(pathParams) as unknown } catch { /* ignore */ }
      }
      if (queryParams.trim()) {
        try { payload['queryParams'] = JSON.parse(queryParams) as unknown } catch { /* ignore */ }
      }
      if (body.trim() && ['POST', 'PUT', 'PATCH'].includes(method)) {
        try { payload['body'] = JSON.parse(body) as unknown } catch { /* ignore */ }
      }

      const data = await clientFetch<{ status?: number; durationMs?: number; body?: unknown }>(
        '/endpoints/test',
        { method: 'POST', body: JSON.stringify(payload) }
      )
      setResult({ status: data.status ?? 200, durationMs: data.durationMs ?? 0, body: data.body })
    } catch (e) {
      setError(String(e))
    } finally {
      setRunning(false)
    }
  }

  const handleImport = (): void => {
    if (!result || !importAlias.trim()) return
    onImportMock?.(importAlias.trim(), result.body)
  }

  const statusColor = result
    ? result.status < 300 ? 'text-green-600' : result.status < 500 ? 'text-amber-600' : 'text-destructive'
    : 'text-foreground'

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-foreground">Endpoint Tester</h3>

      {/* Connector selector */}
      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs text-muted-foreground">Connector</label>
          <select
            value={selectedConnectorId}
            onChange={e => { setSelectedConnectorId(e.target.value); setSelectedEndpointId('') }}
            className="rounded border border-input bg-background px-2 py-1.5 text-sm outline-none"
          >
            <option value="">Custom URL</option>
            {connectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {selectedConnectorId ? (
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs text-muted-foreground">Endpoint</label>
            <select
              value={selectedEndpointId}
              onChange={e => setSelectedEndpointId(e.target.value)}
              className="rounded border border-input bg-background px-2 py-1.5 text-sm outline-none"
            >
              <option value="">Select endpoint…</option>
              {endpoints.map(ep => (
                <option key={ep.id} value={ep.id}>{ep.method} {ep.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs text-muted-foreground">Method</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value)}
              className="rounded border border-input bg-background px-2 py-1.5 text-sm outline-none"
            >
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Custom URL */}
      {!selectedConnectorId && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">URL</span>
          <input
            value={customUrl}
            onChange={e => setCustomUrl(e.target.value)}
            placeholder="https://api.example.com/v1/resource"
            className="rounded border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
      )}

      {/* Params */}
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs text-muted-foreground">Path params (JSON)</span>
          <input
            value={pathParams}
            onChange={e => setPathParams(e.target.value)}
            placeholder='{"id": "123"}'
            className="rounded border border-input bg-background px-2 py-1.5 font-mono text-xs outline-none"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs text-muted-foreground">Query params (JSON)</span>
          <input
            value={queryParams}
            onChange={e => setQueryParams(e.target.value)}
            placeholder='{"page": 1}'
            className="rounded border border-input bg-background px-2 py-1.5 font-mono text-xs outline-none"
          />
        </label>
      </div>

      {/* Body (POST/PUT only) */}
      {['POST', 'PUT', 'PATCH'].includes(method) && !selectedEndpointId && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Request body (JSON)</span>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={4}
            className="rounded border border-input bg-background px-2 py-1.5 font-mono text-xs outline-none resize-none"
          />
        </label>
      )}

      {/* Run */}
      <button
        type="button"
        onClick={() => void handleRun()}
        disabled={running || (!selectedEndpointId && !customUrl.trim())}
        className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {running ? 'Running…' : '▶ Run'}
      </button>

      {/* Error */}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Result */}
      {result && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 text-xs">
            <span className={`font-mono font-medium ${statusColor}`}>{result.status}</span>
            <span className="text-muted-foreground">{result.durationMs}ms</span>
          </div>

          <pre className="max-h-60 overflow-auto rounded border border-border bg-muted/30 p-3 font-mono text-xs text-foreground">
            {JSON.stringify(result.body, null, 2)}
          </pre>

          {onImportMock && (
            <div className="flex items-center gap-2">
              <input
                value={importAlias}
                onChange={e => setImportAlias(e.target.value)}
                placeholder="data source alias"
                className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={handleImport}
                disabled={!importAlias.trim()}
                className="rounded bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
              >
                Use as mock
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
