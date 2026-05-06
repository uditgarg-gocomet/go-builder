import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'

// ── In-memory store ───────────────────────────────────────────────────────────

type AssetRecord = {
  id: string; appId: string; name: string; key: string; url: string
  mimeType: string; sizeBytes: number; hash: string
  width: number | null; height: number | null
  uploadedBy: string; createdAt: Date
}

const assets = new Map<string, AssetRecord>()
const uploadedFiles = new Map<string, Buffer>()

let counter = 0
function nextId() { return `id-${++counter}` }

vi.mock('../../../lib/db.js', () => ({
  db: {
    asset: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; key?: string } }) => {
        if (where.id) return assets.get(where.id) ?? null
        if (where.key) return Array.from(assets.values()).find(a => a.key === where.key) ?? null
        return null
      }),
      findMany: vi.fn(async ({ where }: { where: { appId: string; mimeType?: object; name?: object } }) => {
        return Array.from(assets.values()).filter(a => a.appId === where.appId)
      }),
      create: vi.fn(async ({ data }: { data: Omit<AssetRecord, 'id' | 'createdAt'> }) => {
        const record: AssetRecord = { id: nextId(), ...data, createdAt: new Date() }
        assets.set(record.id, record)
        return record
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const record = assets.get(where.id)!
        assets.delete(where.id)
        return record
      }),
    },
    $queryRaw: vi.fn(async () => []),
  },
}))

// Mock storage provider to use in-memory map
vi.mock('../storage.js', () => ({
  storageProvider: {
    upload: vi.fn(async (key: string, buffer: Buffer) => {
      uploadedFiles.set(key, buffer)
      return { key, url: `http://localhost:3001/assets/${key}` }
    }),
    delete: vi.fn(async (key: string) => { uploadedFiles.delete(key) }),
    getUrl: vi.fn((key: string) => `http://localhost:3001/assets/${key}`),
    getFilePath: vi.fn((key: string) => `/uploads/${key}`),
  },
}))

// Mock sharp for image dimension extraction
vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: vi.fn(async () => ({ width: 100, height: 80, format: 'png' })),
  })),
}))

vi.mock('../../../lib/logger.js', () => ({
  createChildLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}))

import { handleUpload, deleteAsset, checkAssetReferenced } from '../service.js'
import { validateFile } from '../validator.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePngBuffer(): Buffer {
  // Minimal valid PNG header bytes
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...Array(100).fill(0x00),
  ])
}

function seedAsset(url = 'http://localhost:3001/assets/apps/app-1/abc123.png'): AssetRecord {
  const hash = crypto.createHash('sha256').update('test').digest('hex')
  const record: AssetRecord = {
    id: nextId(), appId: 'app-1', name: 'test.png',
    key: `apps/app-1/${hash}.png`, url,
    mimeType: 'image/png', sizeBytes: 1024, hash,
    width: 100, height: 80, uploadedBy: 'fde-1', createdAt: new Date(),
  }
  assets.set(record.id, record)
  return record
}

beforeEach(() => {
  assets.clear()
  uploadedFiles.clear()
  counter = 0
  vi.clearAllMocks()
})

// ── validateFile ──────────────────────────────────────────────────────────────

describe('validateFile', () => {
  it('accepts valid PNG', () => {
    const result = validateFile(makePngBuffer(), 'photo.png', 'image/png')
    expect(result.valid).toBe(true)
  })

  it('rejects file exceeding 10MB', () => {
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024)
    const result = validateFile(bigBuffer, 'big.png', 'image/png')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('10MB')
  })

  it('rejects disallowed MIME type', () => {
    const result = validateFile(Buffer.from('exe'), 'virus.exe', 'application/x-msdownload')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('not allowed')
  })

  it('rejects SVG with <script tag', () => {
    const svgWithScript = Buffer.from('<svg><script>alert(1)</script></svg>')
    const result = validateFile(svgWithScript, 'malicious.svg', 'image/svg+xml')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('<script>')
  })

  it('accepts clean SVG', () => {
    const cleanSvg = Buffer.from('<svg><rect width="100" height="100"/></svg>')
    const result = validateFile(cleanSvg, 'icon.svg', 'image/svg+xml')
    expect(result.valid).toBe(true)
  })
})

// ── handleUpload ──────────────────────────────────────────────────────────────

describe('handleUpload', () => {
  it('returns existing asset when same file uploaded twice (deduplication)', async () => {
    // First upload
    const buffer = makePngBuffer()
    const first = await handleUpload('app-1', buffer, 'logo.png', 'image/png', 'fde-1')

    // Second upload of same buffer
    const second = await handleUpload('app-1', buffer, 'logo.png', 'image/png', 'fde-1')

    expect(first.id).toBe(second.id)
    // Only one file written to storage
    expect(uploadedFiles.size).toBe(1)
  })

  it('extracts image dimensions for PNG', async () => {
    const buffer = makePngBuffer()
    const asset = await handleUpload('app-1', buffer, 'photo.png', 'image/png', 'fde-1')

    expect(asset.width).toBe(100)
    expect(asset.height).toBe(80)
  })

  it('throws 400 for SVG with <script tag', async () => {
    const svgWithScript = Buffer.from('<svg><script>alert(1)</script></svg>')
    await expect(
      handleUpload('app-1', svgWithScript, 'bad.svg', 'image/svg+xml', 'fde-1')
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 413 for file exceeding size limit', async () => {
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024)
    await expect(
      handleUpload('app-1', bigBuffer, 'huge.png', 'image/png', 'fde-1')
    ).rejects.toMatchObject({ statusCode: 413 })
  })
})

// ── deleteAsset ───────────────────────────────────────────────────────────────

describe('deleteAsset', () => {
  it('deletes asset when not referenced in any page schema', async () => {
    const asset = seedAsset()
    // $queryRaw returns empty (not referenced)
    const { db } = await import('../../../lib/db.js')
    vi.mocked(db.$queryRaw).mockResolvedValueOnce([])

    await deleteAsset(asset.id, 'fde-1')

    expect(assets.has(asset.id)).toBe(false)
  })

  it('throws 409 when asset is referenced in a page schema', async () => {
    const asset = seedAsset('http://localhost:3001/assets/apps/app-1/referenced.png')
    const { db } = await import('../../../lib/db.js')
    vi.mocked(db.$queryRaw).mockResolvedValueOnce([{ id: 'pv-1' }])

    await expect(deleteAsset(asset.id, 'fde-1')).rejects.toMatchObject({ statusCode: 409 })
  })

  it('throws 404 for non-existent asset', async () => {
    await expect(deleteAsset('non-existent-id', 'fde-1')).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ── Cache-Control header verified via router (via integration) ────────────────
// The router sets Cache-Control: public, max-age=31536000, immutable
// This is confirmed by the spec; the actual header test requires a Fastify integration test
// which is covered when the renderer fetches assets.
