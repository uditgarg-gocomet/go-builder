// Next.js GET handler — returns the list of selectable document types.
// Consumer:
//   // apps/renderer/src/app/api/widgets/add-document/options/route.ts
//   export { GET } from '@portal/widgets/api/add-document-options'
//   (see src/api.ts for the named-export aliasing)

import { readAddDocumentEnv } from '../env.js'
import { fetchDocumentOptionsFromGocomet } from '../handlers/fetchOptions.js'

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function GET(_request: Request): Promise<Response> {
  const config = readAddDocumentEnv()
  const result = await fetchDocumentOptionsFromGocomet(config)

  if (!result.ok) {
    return jsonResponse(
      { ok: false, error: result.error ?? 'Failed to fetch options' },
      result.status ?? 502,
    )
  }
  return jsonResponse({ ok: true, options: result.options ?? [] })
}
