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
