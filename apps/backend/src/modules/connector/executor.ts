import { db } from '../../lib/db.js'
import { secretsProvider } from '../../lib/secrets.js'
import { createChildLogger } from '../../lib/logger.js'
import { validateUrl } from '../endpoint-registry/lib/ssrf.js'

const logger = createChildLogger('connector:executor')

const REQUEST_TIMEOUT_MS = 30_000

export interface ExecuteParams {
  mode: 'REGISTERED' | 'CUSTOM_CONNECTOR' | 'CUSTOM_MANUAL'
  // REGISTERED
  endpointId?: string
  // CUSTOM_CONNECTOR
  connectorId?: string
  url?: string
  // CUSTOM_MANUAL
  method?: string
  customHeaders?: Record<string, string>
  // Common
  pathParams?: Record<string, string>
  queryParams?: Record<string, unknown>
  body?: unknown
  environment: 'staging' | 'production'
}

export interface ExecuteResult {
  data: unknown
  statusCode: number
  durationMs: number
  urlPattern: string
  method: string
  connectorId?: string
  endpointId?: string
}

export async function executeRequest(params: ExecuteParams): Promise<ExecuteResult> {
  const { mode, pathParams, queryParams, body, environment } = params

  let targetUrl: string
  let resolvedMethod: string
  let resolvedHeaders: Record<string, string> = {}
  let connectorId: string | undefined
  let endpointId: string | undefined
  let urlPattern: string

  if (mode === 'REGISTERED') {
    if (!params.endpointId) {
      throw Object.assign(new Error('endpointId required for REGISTERED mode'), { statusCode: 400 })
    }
    endpointId = params.endpointId
    const endpoint = await db.endpointDef.findUnique({
      where: { id: endpointId },
      include: { connector: true },
    })
    if (!endpoint || !endpoint.isActive) {
      throw Object.assign(new Error('Endpoint not found or deactivated'), { statusCode: 410 })
    }

    connectorId = endpoint.connectorId

    // Validate required path params
    const requiredParams = (endpoint.pathParams as Array<{ name: string; required: boolean }>)
      .filter(p => p.required).map(p => p.name)
    const missing = requiredParams.filter(p => !pathParams?.[p])
    if (missing.length > 0) {
      throw Object.assign(
        new Error(`Missing required path params: ${missing.join(', ')}`),
        { statusCode: 400 }
      )
    }

    const baseUrl = (endpoint.connector.baseUrl as Record<string, string>)[environment]
    if (!baseUrl) {
      throw Object.assign(new Error(`No base URL for environment: ${environment}`), { statusCode: 400 })
    }

    let resolvedPath = endpoint.path
    for (const [k, v] of Object.entries(pathParams ?? {})) {
      resolvedPath = resolvedPath.replace(`{${k}}`, encodeURIComponent(v))
    }
    urlPattern = endpoint.path
    targetUrl = buildUrlWithQuery(baseUrl + resolvedPath, queryParams ?? {})
    resolvedMethod = endpoint.method

    resolvedHeaders = await resolveConnectorAuth(endpoint.connector)
  } else if (mode === 'CUSTOM_CONNECTOR') {
    if (!params.connectorId || !params.url) {
      throw Object.assign(new Error('connectorId and url required for CUSTOM_CONNECTOR mode'), { statusCode: 400 })
    }
    validateUrl(params.url)
    connectorId = params.connectorId
    urlPattern = params.url

    const connector = await db.connector.findUnique({ where: { id: connectorId } })
    if (!connector || !connector.isActive) {
      throw Object.assign(new Error('Connector not found'), { statusCode: 404 })
    }

    resolvedHeaders = await resolveConnectorAuth(connector)
    targetUrl = buildUrlWithQuery(interpolate(params.url, pathParams ?? {}), queryParams ?? {})
    resolvedMethod = params.method ?? 'GET'
  } else {
    // CUSTOM_MANUAL
    if (!params.url) {
      throw Object.assign(new Error('url required for CUSTOM_MANUAL mode'), { statusCode: 400 })
    }
    validateUrl(params.url)
    urlPattern = params.url
    targetUrl = buildUrlWithQuery(interpolate(params.url, pathParams ?? {}), queryParams ?? {})
    resolvedMethod = params.method ?? 'GET'
    resolvedHeaders = params.customHeaders ?? {}
  }

  // Merge extra headers for custom modes
  if (params.customHeaders) {
    resolvedHeaders = { ...resolvedHeaders, ...params.customHeaders }
  }

  // Serialize body
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(resolvedMethod)
  const requestBody = hasBody && body != null ? JSON.stringify(body) : undefined
  if (hasBody && requestBody) {
    resolvedHeaders['Content-Type'] ??= 'application/json'
  }

  return fetchWithLimits(targetUrl, resolvedMethod, resolvedHeaders, requestBody, {
    urlPattern, connectorId, endpointId,
  })
}

async function resolveConnectorAuth(
  connector: { authType: string; authConfig: string; headers: unknown }
): Promise<Record<string, string>> {
  const baseHeaders = (connector.headers ?? {}) as Record<string, string>

  try {
    const authConfig = await secretsProvider.resolve(connector.authConfig)
    const config = authConfig as Record<string, string>

    switch (connector.authType) {
      case 'BEARER':
        return { ...baseHeaders, ...(config['token'] ? { Authorization: `Bearer ${config['token']}` } : {}) }
      case 'API_KEY': {
        const headerName = config['headerName'] ?? 'X-Api-Key'
        return { ...baseHeaders, ...(config['key'] ? { [headerName]: config['key'] } : {}) }
      }
      default:
        return baseHeaders
    }
  } catch {
    logger.warn({ connectorId: 'unknown' }, 'Failed to resolve connector auth')
    return baseHeaders
  }
}

async function fetchWithLimits(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  meta: { urlPattern: string; connectorId?: string; endpointId?: string }
): Promise<ExecuteResult> {
  const startMs = Date.now()
  const abortController = new AbortController()
  const timer = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: abortController.signal,
    })

    const statusCode = (res as Response & { statusCode?: number }).statusCode ?? res.status
    const contentLength = res.headers.get('content-length')

    // Check Content-Length as fast path for size limit
    const connector = meta.connectorId
      ? await db.connector.findUnique({ where: { id: meta.connectorId } }).then(c => c)
      : null
    const maxSizeKb = 5120 // default 5MB — would fetch from ConnectorRateLimit if connector known
    if (contentLength && parseInt(contentLength) > maxSizeKb * 1024) {
      throw Object.assign(new Error(`Response exceeds ${maxSizeKb}KB limit`), { statusCode: 413 })
    }

    let data: unknown
    try {
      const text = await (res as Response).text()
      // Size check on actual response body
      if (text.length > maxSizeKb * 1024) {
        throw Object.assign(new Error(`Response exceeds ${maxSizeKb}KB limit`), { statusCode: 413 })
      }
      data = JSON.parse(text)
    } catch (parseErr) {
      const e = parseErr as { statusCode?: number }
      if (e.statusCode === 413) throw parseErr
      data = null
    }

    return {
      data,
      statusCode,
      durationMs: Date.now() - startMs,
      ...meta,
      method,
    }
  } catch (err: unknown) {
    const e = err as Error & { statusCode?: number }
    if (e.statusCode) throw err
    if (e.name === 'AbortError') {
      throw Object.assign(new Error('Request timed out after 30s'), { statusCode: 504 })
    }
    throw Object.assign(new Error(`Request failed: ${e.message}`), { statusCode: 502 })
  } finally {
    clearTimeout(timer)
  }
}

function buildUrlWithQuery(base: string, queryParams: Record<string, unknown>): string {
  const url = new URL(base)
  for (const [key, val] of Object.entries(queryParams)) {
    url.searchParams.set(key, String(val))
  }
  return url.toString()
}

function interpolate(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => encodeURIComponent(params[key] ?? `{${key}}`))
}
