import mime from 'mime-types'

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'image/webp',
  'image/gif',
  'font/woff2',
  'font/woff',
  'application/pdf',
])

// Map of mime type → expected file extensions
const MIME_EXTENSIONS: Record<string, Set<string>> = {
  'image/png': new Set(['.png']),
  'image/jpeg': new Set(['.jpg', '.jpeg']),
  'image/svg+xml': new Set(['.svg']),
  'image/webp': new Set(['.webp']),
  'image/gif': new Set(['.gif']),
  'font/woff2': new Set(['.woff2']),
  'font/woff': new Set(['.woff']),
  'application/pdf': new Set(['.pdf']),
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): ValidationResult {
  // Check allowed MIME type
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { valid: false, error: `File type "${mimeType}" is not allowed` }
  }

  // Check file size
  if (buffer.byteLength > MAX_SIZE_BYTES) {
    return { valid: false, error: `File exceeds maximum size of 10MB` }
  }

  // Check extension matches MIME type
  const ext = filename.toLowerCase().match(/\.[^.]+$/)
  const fileExt = ext?.[0] ?? ''
  const allowedExts = MIME_EXTENSIONS[mimeType]
  if (allowedExts && !allowedExts.has(fileExt)) {
    const guessedMime = mime.lookup(filename)
    if (guessedMime && guessedMime !== mimeType) {
      return { valid: false, error: `File extension "${fileExt}" does not match MIME type "${mimeType}"` }
    }
  }

  // SVG: reject if contains <script
  if (mimeType === 'image/svg+xml') {
    const content = buffer.toString('utf8')
    if (/<script/i.test(content)) {
      return { valid: false, error: 'SVG files containing <script> tags are not allowed' }
    }
  }

  return { valid: true }
}
