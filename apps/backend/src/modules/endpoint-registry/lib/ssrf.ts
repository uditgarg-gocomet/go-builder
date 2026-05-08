// SSRF protection — blocks requests to localhost, private IP ranges, and metadata endpoints.

const PRIVATE_IP_PATTERNS = [
  /^127\.\d+\.\d+\.\d+$/,        // 127.0.0.0/8 (loopback)
  /^10\.\d+\.\d+\.\d+$/,         // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/, // 172.16.0.0/12
  /^192\.168\.\d+\.\d+$/,        // 192.168.0.0/16
  /^169\.254\.169\.254$/,        // AWS metadata endpoint
  /^::1$/,                        // IPv6 loopback
  /^fc00:/i,                      // IPv6 unique local
  /^fd[0-9a-f]{2}:/i,            // IPv6 unique local
]

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',     // GCP metadata
])

/**
 * Comma-separated hostnames that bypass the SSRF checks. Intended for dev
 * setups where the renderer's CUSTOM_MANUAL data sources legitimately point at
 * an internal mock API on the same host (e.g. the GoComet V2 demo, where the
 * builder-managed schema declares URLs like `http://localhost:3001/mock/v2/…`).
 *
 * Production should leave this empty. Set via `SSRF_ALLOWED_HOSTS=localhost`
 * (or `localhost,127.0.0.1`) in the dev `.env` only.
 */
function readAllowlist(): Set<string> {
  const raw = process.env['SSRF_ALLOWED_HOSTS'] ?? ''
  return new Set(
    raw
      .split(',')
      .map(h => h.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function validateUrl(rawUrl: string): void {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw Object.assign(new Error(`Invalid URL: ${rawUrl}`), { statusCode: 400 })
  }

  const protocol = parsed.protocol
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw Object.assign(
      new Error(`Protocol not allowed: ${protocol} — only http and https are permitted`),
      { statusCode: 403 }
    )
  }

  const hostname = parsed.hostname.toLowerCase()

  // Per-environment allowlist short-circuit. Read on every call so test/dev
  // can flip the env var without restarting (handy for the GoComet V2 mock
  // setup). Cost is trivial relative to the network round-trip that follows.
  const allowlist = readAllowlist()
  if (allowlist.has(hostname)) {
    return
  }

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw Object.assign(
      new Error(`SSRF protection: requests to "${hostname}" are not allowed`),
      { statusCode: 403 }
    )
  }

  if (hostname === '0.0.0.0') {
    throw Object.assign(
      new Error(`SSRF protection: requests to "0.0.0.0" are not allowed`),
      { statusCode: 403 }
    )
  }

  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      throw Object.assign(
        new Error(`SSRF protection: requests to private IP ranges are not allowed (${hostname})`),
        { statusCode: 403 }
      )
    }
  }
}
