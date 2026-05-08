// ── Fetch document type options from gocomet's implementation-hub ────────────
// GET ${IMPLEMENTATION_HUB_API}{tenantSlug}/custom-shipment-documents
// Returns: DocumentOption[]   ({ document_name, document_key }[])

import type { AddDocumentEnvConfig } from '../env.js'
import { authHeaders } from '../env.js'
import type { DocumentOption } from '../../shared/types.js'

export interface FetchOptionsResult {
  ok: boolean
  status?: number
  options?: DocumentOption[]
  error?: string
}

export async function fetchDocumentOptionsFromGocomet(
  config: AddDocumentEnvConfig,
): Promise<FetchOptionsResult> {
  if (!config.token || !config.implementationHubApi) {
    return {
      ok: false,
      error:
        'Server is not configured. WIDGET_MOCK_TOKEN and WIDGET_MOCK_IMPLEMENTATION_HUB_API must be set.',
    }
  }

  const base = config.implementationHubApi.replace(/\/$/, '')
  const tenant = encodeURIComponent(config.tenantSlug)
  const url = `${base}/${tenant}/custom-shipment-documents`

  let upstream: Response
  try {
    upstream = await fetch(url, {
      method: 'GET',
      headers: {
        ...authHeaders(config),
        Accept: 'application/json',
      },
    })
  } catch (err) {
    return {
      ok: false,
      error: `Network error reaching implementation-hub: ${(err as Error).message}`,
    }
  }

  let body: unknown = null
  try {
    body = await upstream.json()
  } catch {
    // Non-JSON; surface status only.
  }

  if (!upstream.ok) {
    const e = body as { error?: string; message?: string } | null
    return {
      ok: false,
      status: upstream.status,
      error:
        e?.error ??
        e?.message ??
        `Implementation-hub returned ${upstream.status}`,
    }
  }

  if (!Array.isArray(body)) {
    return {
      ok: false,
      status: upstream.status,
      error: 'Implementation-hub did not return an array',
    }
  }

  return { ok: true, status: upstream.status, options: body as DocumentOption[] }
}
