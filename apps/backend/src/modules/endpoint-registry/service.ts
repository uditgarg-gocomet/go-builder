import { Prisma } from '@prisma/client'
import { db } from '../../lib/db.js'
import { secretsProvider } from '../../lib/secrets.js'
import { createChildLogger } from '../../lib/logger.js'
import { computeBindingPaths } from './lib/bindingPaths.js'
import { validateUrl } from './lib/ssrf.js'
import type {
  RegisterConnectorRequest,
  RegisterEndpointRequest,
  UpdateEndpointRequest,
  TestEndpointRequest,
} from './types.js'

const logger = createChildLogger('endpoint-registry')

const REQUEST_TIMEOUT_MS = 30_000

// ── Connectors ────────────────────────────────────────────────────────────────

export async function listConnectors() {
  return db.connector.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      baseUrl: true,
      authType: true,
      headers: true,
      isActive: true,
      createdBy: true,
      createdAt: true,
    },
    orderBy: { name: 'asc' },
  })
}

export async function registerConnector(request: RegisterConnectorRequest) {
  const { name, description, baseUrl, authType, authConfig, headers, createdBy } = request

  // Validate base URLs are not SSRF targets
  const urls = baseUrl as { staging: string; production: string }
  validateUrl(urls.staging)
  validateUrl(urls.production)

  // Encrypt auth config
  const encryptedAuthConfig = await secretsProvider.store(`connector:${name}`, authConfig)

  const connector = await db.connector.create({
    data: {
      name,
      description: description ?? null,
      baseUrl: baseUrl as object,
      authType,
      authConfig: encryptedAuthConfig,
      headers: headers as object,
      createdBy,
    },
  })

  logger.info({ connectorId: connector.id, name }, 'Connector registered')
  return connector
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export async function listConnectorEndpoints(connectorId: string) {
  const connector = await db.connector.findUnique({ where: { id: connectorId } })
  if (!connector) {
    throw Object.assign(new Error('Connector not found'), { statusCode: 404 })
  }

  return db.endpointDef.findMany({
    where: { connectorId, isActive: true },
    select: {
      id: true,
      connectorId: true,
      name: true,
      description: true,
      method: true,
      path: true,
      category: true,
      tags: true,
      pathParams: true,
      queryParams: true,
      headers: true,
      responseSchema: true,
      bindingPaths: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { name: 'asc' },
  })
}

export async function getEndpoint(id: string) {
  const endpoint = await db.endpointDef.findUnique({
    where: { id },
    include: { connector: { select: { id: true, name: true, authType: true } } },
  })
  if (!endpoint || !endpoint.isActive) {
    throw Object.assign(new Error('Endpoint not found'), { statusCode: 404 })
  }
  return endpoint
}

export async function registerEndpoint(request: RegisterEndpointRequest) {
  const {
    connectorId, name, description, method, path, category, tags,
    pathParams, queryParams, bodySchema, headers, responseSchema,
    responseSample, createdBy,
  } = request

  const connector = await db.connector.findUnique({ where: { id: connectorId } })
  if (!connector || !connector.isActive) {
    throw Object.assign(new Error('Connector not found'), { statusCode: 404 })
  }

  // Pre-compute binding paths from response schema
  const bindingPaths = computeBindingPaths(responseSchema as Parameters<typeof computeBindingPaths>[0])

  const endpoint = await db.endpointDef.create({
    data: {
      connectorId,
      name,
      description: description ?? null,
      method,
      path,
      category,
      tags,
      pathParams: pathParams as Prisma.InputJsonValue,
      queryParams: queryParams as Prisma.InputJsonValue,
      bodySchema: bodySchema !== undefined ? (bodySchema as Prisma.InputJsonValue) : Prisma.JsonNull,
      headers: headers as Prisma.InputJsonValue,
      responseSchema: responseSchema as Prisma.InputJsonValue,
      responseSample: responseSample !== undefined ? (responseSample as Prisma.InputJsonValue) : Prisma.JsonNull,
      bindingPaths: bindingPaths as unknown as Prisma.InputJsonValue,
      createdBy,
    },
  })

  logger.info({ endpointId: endpoint.id, connectorId, method, path }, 'Endpoint registered')
  return endpoint
}

export async function updateEndpoint(id: string, request: UpdateEndpointRequest) {
  const existing = await db.endpointDef.findUnique({ where: { id } })
  if (!existing || !existing.isActive) {
    throw Object.assign(new Error('Endpoint not found'), { statusCode: 404 })
  }

  const updateData: Record<string, unknown> = {}
  if (request.name !== undefined) updateData['name'] = request.name
  if (request.description !== undefined) updateData['description'] = request.description
  if (request.category !== undefined) updateData['category'] = request.category
  if (request.tags !== undefined) updateData['tags'] = request.tags
  if (request.queryParams !== undefined) updateData['queryParams'] = request.queryParams
  if (request.bodySchema !== undefined) updateData['bodySchema'] = request.bodySchema
  if (request.headers !== undefined) updateData['headers'] = request.headers
  if (request.responseSample !== undefined) updateData['responseSample'] = request.responseSample

  // Recompute binding paths if responseSchema changed
  if (request.responseSchema !== undefined) {
    updateData['responseSchema'] = request.responseSchema
    updateData['bindingPaths'] = computeBindingPaths(
      request.responseSchema as Parameters<typeof computeBindingPaths>[0]
    )
  }

  return db.endpointDef.update({ where: { id }, data: updateData })
}

export async function deactivateEndpoint(id: string) {
  const existing = await db.endpointDef.findUnique({ where: { id } })
  if (!existing) {
    throw Object.assign(new Error('Endpoint not found'), { statusCode: 404 })
  }

  return db.endpointDef.update({ where: { id }, data: { isActive: false } })
}

// ── Test endpoint ─────────────────────────────────────────────────────────────

export async function testEndpoint(request: TestEndpointRequest): Promise<{
  statusCode: number
  durationMs: number
  response: unknown
  bindingPaths: string[]
}> {
  const { mode, endpointId, connectorId, url, method, headers, pathParams, queryParams, body, environment, testedBy, appId, pageId, alias } = request

  let targetUrl: string
  let resolvedMethod: string = method ?? 'GET'
  let resolvedHeaders: Record<string, string> = headers ?? {}
  let inferredBindingPaths: string[] = []

  if (mode === 'REGISTERED') {
    if (!endpointId) {
      throw Object.assign(new Error('endpointId is required for REGISTERED mode'), { statusCode: 400 })
    }
    const endpoint = await db.endpointDef.findUnique({
      where: { id: endpointId },
      include: { connector: true },
    })
    if (!endpoint || !endpoint.isActive) {
      throw Object.assign(new Error('Endpoint not found'), { statusCode: 404 })
    }

    // Validate required path params
    const requiredParams = (endpoint.pathParams as Array<{ name: string; required: boolean }>)
      .filter(p => p.required)
      .map(p => p.name)
    const missingParams = requiredParams.filter(p => !pathParams?.[p])
    if (missingParams.length > 0) {
      throw Object.assign(
        new Error(`Missing required path params: ${missingParams.join(', ')}`),
        { statusCode: 400 }
      )
    }

    const baseUrl = (endpoint.connector.baseUrl as Record<string, string>)[environment]
    if (!baseUrl) {
      throw Object.assign(new Error(`No base URL configured for ${environment}`), { statusCode: 400 })
    }

    // Build URL with path param substitution
    let resolvedPath = endpoint.path
    for (const [key, val] of Object.entries(pathParams ?? {})) {
      resolvedPath = resolvedPath.replace(`{${key}}`, encodeURIComponent(val))
    }

    const urlObj = new URL(baseUrl + resolvedPath)
    for (const [key, val] of Object.entries(queryParams ?? {})) {
      urlObj.searchParams.set(key, String(val))
    }
    targetUrl = urlObj.toString()
    resolvedMethod = endpoint.method

    // Resolve auth headers from connector
    try {
      const authConfig = await secretsProvider.resolve(endpoint.connector.authConfig)
      resolvedHeaders = { ...resolveAuthHeaders(endpoint.connector.authType, authConfig), ...resolvedHeaders }
    } catch {
      logger.warn({ endpointId }, 'Failed to resolve connector auth — proceeding without auth')
    }

    inferredBindingPaths = endpoint.bindingPaths as unknown as string[]
  } else if (mode === 'CUSTOM_CONNECTOR') {
    if (!connectorId || !url) {
      throw Object.assign(new Error('connectorId and url are required for CUSTOM_CONNECTOR mode'), { statusCode: 400 })
    }
    validateUrl(url)
    targetUrl = url

    const connector = await db.connector.findUnique({ where: { id: connectorId } })
    if (!connector || !connector.isActive) {
      throw Object.assign(new Error('Connector not found'), { statusCode: 404 })
    }
    try {
      const authConfig = await secretsProvider.resolve(connector.authConfig)
      resolvedHeaders = { ...resolveAuthHeaders(connector.authType, authConfig), ...resolvedHeaders }
    } catch {
      logger.warn({ connectorId }, 'Failed to resolve connector auth — proceeding without auth')
    }
  } else {
    // CUSTOM_MANUAL
    if (!url) {
      throw Object.assign(new Error('url is required for CUSTOM_MANUAL mode'), { statusCode: 400 })
    }
    validateUrl(url)
    targetUrl = url
  }

  // Build request body
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(resolvedMethod)
  const requestBody = hasBody && body != null ? JSON.stringify(body) : undefined
  if (hasBody && requestBody) {
    resolvedHeaders['Content-Type'] = resolvedHeaders['Content-Type'] ?? 'application/json'
  }

  // Execute
  const startMs = Date.now()
  let response: unknown
  let statusCode: number

  try {
    const abortController = new AbortController()
    const timer = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS)

    try {
      const res = await fetch(targetUrl, {
        method: resolvedMethod,
        headers: resolvedHeaders,
        body: requestBody ?? null,
        signal: abortController.signal,
      })

      statusCode = res.status
      try {
        response = await (res as Response).json()
      } catch {
        response = await (res as Response).text()
      }
    } finally {
      clearTimeout(timer)
    }
  } catch (err: unknown) {
    const e = err as Error
    if (e.name === 'AbortError') {
      throw Object.assign(new Error('Request timed out after 30s'), { statusCode: 504 })
    }
    throw Object.assign(new Error(`Request failed: ${e.message}`), { statusCode: 502 })
  }

  const durationMs = Date.now() - startMs

  // Infer binding paths from actual response if not pre-computed
  if (inferredBindingPaths.length === 0 && response && typeof response === 'object') {
    inferredBindingPaths = inferPathsFromValue(response as Record<string, unknown>)
  }

  // Log custom endpoint usage
  if (mode !== 'REGISTERED' && appId && pageId && alias) {
    db.customEndpointUsage.create({
      data: {
        appId,
        pageId,
        alias,
        mode,
        url: targetUrl,
        method: resolvedMethod as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        usedBy: testedBy,
      },
    }).catch(err => logger.warn({ err }, 'Failed to log custom endpoint usage'))
  }

  return { statusCode, durationMs, response, bindingPaths: inferredBindingPaths }
}

function resolveAuthHeaders(
  authType: string,
  authConfig: object
): Record<string, string> {
  const config = authConfig as Record<string, string>
  switch (authType) {
    case 'BEARER':
      return config['token'] ? { Authorization: `Bearer ${config['token']}` } : {}
    case 'API_KEY': {
      const headerName = config['headerName'] ?? 'X-Api-Key'
      return config['key'] ? { [headerName]: config['key'] } : {}
    }
    default:
      return {}
  }
}

function inferPathsFromValue(obj: unknown, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return prefix ? [prefix] : []
  if (Array.isArray(obj)) {
    const paths: string[] = [prefix].filter(Boolean)
    if (obj.length > 0) {
      const itemPaths = inferPathsFromValue(obj[0], `${prefix}[]`)
      paths.push(...itemPaths)
    }
    return paths
  }
  const record = obj as Record<string, unknown>
  const paths: string[] = []
  for (const [key, val] of Object.entries(record)) {
    const fullPath = prefix ? `${prefix}.${key}` : key
    if (val && typeof val === 'object') {
      paths.push(...inferPathsFromValue(val, fullPath))
    } else {
      paths.push(fullPath)
    }
  }
  return paths
}
