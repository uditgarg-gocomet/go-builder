import { interpolate, resolveBinding } from '@portal/action-runtime'
import type { BindingContext, DataSourceDef } from '@portal/core'
import { applyTransform } from './transforms.js'

const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001'
const APP_ENVIRONMENT = (process.env['NEXT_PUBLIC_APP_ENVIRONMENT'] ?? 'STAGING').toLowerCase() as 'staging' | 'production'

export type UpdateCallback = (alias: string, data: unknown) => void
export type LoadingCallback = (alias: string, loading: boolean) => void

export class DataSourceResolver {
  resolvedData: Record<string, unknown> = {}
  loadingState: Record<string, boolean> = {}
  errorState: Record<string, Error> = {}

  private sessionToken: string
  private appId: string
  private onUpdate: UpdateCallback
  private onLoadingChange: LoadingCallback | undefined

  constructor(
    sessionToken: string,
    appId: string,
    onUpdate: UpdateCallback,
    onLoadingChange?: LoadingCallback,
  ) {
    this.sessionToken = sessionToken
    this.appId = appId
    this.onUpdate = onUpdate
    this.onLoadingChange = onLoadingChange
  }

  // ── Topological sort + batch resolve ────────────────────────────────────────

  async resolvePageDataSources(
    sources: DataSourceDef[],
    urlParams: Record<string, string>,
  ): Promise<void> {
    const order = topologicalSort(sources)
    for (const alias of order) {
      const source = sources.find(s => s.alias === alias)
      if (source) {
        await this.resolveSource(source, urlParams)
      }
    }
  }

  // ── Resolve a single source (called by polling + REFRESH_DATASOURCE) ────────

  async resolveSourceByAlias(
    alias: string,
    sources: DataSourceDef[],
    urlParams: Record<string, string>,
  ): Promise<void> {
    const source = sources.find(s => s.alias === alias)
    if (!source) return
    await this.resolveSource(source, urlParams)
  }

  private async resolveSource(
    source: DataSourceDef,
    urlParams: Record<string, string>,
  ): Promise<void> {
    if (source.useMock && source.mockData !== undefined) {
      this.resolvedData[source.alias] = source.mockData
      this.onUpdate(source.alias, source.mockData)
      return
    }

    this.loadingState[source.alias] = true
    this.onLoadingChange?.(source.alias, true)
    delete this.errorState[source.alias]

    // Build a partial BindingContext using current resolved data + url params
    const bindingCtx = buildPartialContext(this.resolvedData, urlParams)

    // Interpolate dynamic values in config using current context
    const interpolatedUrl = source.url
      ? String(interpolate(source.url, bindingCtx) ?? source.url)
      : undefined
    const interpolatedPathParams = source.pathParams
      ? (interpolate(source.pathParams, bindingCtx) as Record<string, string>)
      : undefined
    const interpolatedQueryParams = source.queryParams
      ? (interpolate(source.queryParams, bindingCtx) as Record<string, unknown>)
      : undefined
    const interpolatedBody = source.body !== undefined
      ? interpolate(source.body, bindingCtx)
      : undefined

    try {
      const result = await this.executeConnector(source, {
        url: interpolatedUrl,
        pathParams: interpolatedPathParams,
        queryParams: interpolatedQueryParams,
        body: interpolatedBody,
      })

      let data = result

      // Apply JSONata transform if defined
      if (source.transform) {
        try {
          data = await applyTransform(data, source.transform)
        } catch {
          // Transform error — use raw data, log warning
          console.warn(`[DataSourceResolver] transform failed for "${source.alias}"`)
        }
      }

      this.resolvedData[source.alias] = data
      this.loadingState[source.alias] = false
      this.onLoadingChange?.(source.alias, false)
      this.onUpdate(source.alias, data)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      this.errorState[source.alias] = error
      this.loadingState[source.alias] = false
      this.onLoadingChange?.(source.alias, false)

      const strategy = source.errorHandling?.strategy ?? 'show-error'
      if (strategy === 'use-fallback' && source.errorHandling?.fallback !== undefined) {
        this.resolvedData[source.alias] = source.errorHandling.fallback
        this.onUpdate(source.alias, source.errorHandling.fallback)
      } else if (strategy === 'show-empty') {
        this.resolvedData[source.alias] = null
        this.onUpdate(source.alias, null)
      }
      // 'show-error' — leave errorState set, consumers handle it
    }
  }

  private async executeConnector(
    source: DataSourceDef,
    overrides: {
      url?: string
      pathParams?: Record<string, string>
      queryParams?: Record<string, unknown>
      body?: unknown
    },
  ): Promise<unknown> {
    // `appId` is required by the connector router's request schema — it scopes
    // audit logs and rate-limit buckets to the app that issued the call.
    // Without it the backend rejects with `Validation error: appId Required`.
    const payload: Record<string, unknown> = {
      appId: this.appId,
      environment: APP_ENVIRONMENT,
      pathParams: overrides.pathParams,
      queryParams: overrides.queryParams,
      body: overrides.body,
    }

    if (source.mode === 'REGISTERED') {
      payload['mode'] = 'REGISTERED'
      payload['endpointId'] = source.endpointId
    } else if (source.mode === 'CUSTOM_CONNECTOR') {
      payload['mode'] = 'CUSTOM_CONNECTOR'
      payload['connectorId'] = source.connectorId
      payload['url'] = overrides.url ?? source.url
      payload['method'] = source.method
      payload['customHeaders'] = source.headers
    } else {
      payload['mode'] = 'CUSTOM_MANUAL'
      payload['url'] = overrides.url ?? source.url
      payload['method'] = source.method ?? 'GET'
      payload['customHeaders'] = source.headers
    }

    const res = await fetch(`${BACKEND_URL}/connector/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.sessionToken}`,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Connector error ${res.status}: ${text}`)
    }

    const json = (await res.json()) as { data: unknown }
    return json.data
  }
}

// ── Topological sort ──────────────────────────────────────────────────────────

function topologicalSort(sources: DataSourceDef[]): string[] {
  const visited = new Set<string>()
  const result: string[] = []

  function visit(alias: string, chain: Set<string>): void {
    if (visited.has(alias)) return
    if (chain.has(alias)) {
      console.warn(`[DataSourceResolver] circular dependency detected involving "${alias}"`)
      return
    }

    const source = sources.find(s => s.alias === alias)
    if (!source) return

    chain.add(alias)
    for (const dep of source.dependencies ?? []) {
      visit(dep, chain)
    }
    chain.delete(alias)

    visited.add(alias)
    result.push(alias)
  }

  for (const source of sources) {
    visit(source.alias, new Set())
  }

  return result
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPartialContext(
  resolvedData: Record<string, unknown>,
  urlParams: Record<string, string>,
): BindingContext {
  return {
    datasource: resolvedData,
    params: urlParams,
    user: undefined,
    env: undefined,
    state: {},
    form: {},
  }
}

// Re-export so callers can use it without importing resolveBinding separately
export { resolveBinding }
