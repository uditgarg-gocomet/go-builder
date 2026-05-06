import crypto from 'node:crypto'
import path from 'node:path'
import sharp from 'sharp'
import { db } from '../../lib/db.js'
import { createChildLogger } from '../../lib/logger.js'
import { validateFile } from './validator.js'
import { storageProvider } from './storage.js'

const logger = createChildLogger('assets')

// ── handleUpload ──────────────────────────────────────────────────────────────

export async function handleUpload(
  appId: string,
  buffer: Buffer,
  filename: string,
  mimeType: string,
  uploadedBy: string
) {
  // Validate
  const validation = validateFile(buffer, filename, mimeType)
  if (!validation.valid) {
    const statusCode = buffer.byteLength > 10 * 1024 * 1024 ? 413 : 400
    throw Object.assign(new Error(validation.error!), { statusCode })
  }

  // SHA-256 hash for deduplication
  const hash = crypto.createHash('sha256').update(buffer).digest('hex')
  const ext = path.extname(filename).toLowerCase()
  const key = `apps/${appId}/${hash}${ext}`

  // Check for duplicate
  const existing = await db.asset.findUnique({ where: { key } })
  if (existing) {
    logger.info({ assetId: existing.id, key }, 'Duplicate file upload — returning existing asset')
    return existing
  }

  // Extract image dimensions
  let width: number | null = null
  let height: number | null = null
  if (mimeType.startsWith('image/') && mimeType !== 'image/svg+xml') {
    try {
      const metadata = await sharp(buffer).metadata()
      width = metadata.width ?? null
      height = metadata.height ?? null
    } catch {
      // Non-critical — proceed without dimensions
    }
  }

  // Upload to storage
  const { url } = await storageProvider.upload(key, buffer, mimeType)

  // Create Asset record
  const asset = await db.asset.create({
    data: {
      appId,
      name: filename,
      key,
      url,
      mimeType,
      sizeBytes: buffer.byteLength,
      hash,
      width,
      height,
      uploadedBy,
    },
  })

  logger.info({ assetId: asset.id, key, mimeType }, 'Asset uploaded')
  return asset
}

// ── listAssets ────────────────────────────────────────────────────────────────

export async function listAssets(
  appId: string,
  filters: { mimeType?: string; search?: string } = {}
) {
  return db.asset.findMany({
    where: {
      appId,
      ...(filters.mimeType ? { mimeType: { contains: filters.mimeType } } : {}),
      ...(filters.search ? { name: { contains: filters.search, mode: 'insensitive' } } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })
}

// ── checkAssetReferenced ──────────────────────────────────────────────────────

export async function checkAssetReferenced(assetUrl: string): Promise<boolean> {
  // Raw query: search jsonb schema column for URL string
  const results = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "PageVersion"
    WHERE status IN ('DRAFT', 'STAGED', 'PUBLISHED')
    AND schema::text LIKE ${`%${assetUrl}%`}
    LIMIT 1
  `
  return results.length > 0
}

// ── deleteAsset ───────────────────────────────────────────────────────────────

export async function deleteAsset(id: string, _userId: string): Promise<void> {
  const asset = await db.asset.findUnique({ where: { id } })
  if (!asset) {
    throw Object.assign(new Error('Asset not found'), { statusCode: 404 })
  }

  // Reference check
  const referenced = await checkAssetReferenced(asset.url)
  if (referenced) {
    throw Object.assign(
      new Error('Asset is referenced in one or more page schemas — cannot delete'),
      { statusCode: 409 }
    )
  }

  // Delete from storage
  await storageProvider.delete(asset.key)

  // Delete record
  await db.asset.delete({ where: { id } })

  logger.info({ assetId: id, key: asset.key }, 'Asset deleted')
}
