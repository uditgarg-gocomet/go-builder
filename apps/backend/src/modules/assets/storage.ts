import fs from 'node:fs/promises'
import path from 'node:path'

export interface StoredAsset {
  key: string
  url: string
}

export interface StorageProvider {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<StoredAsset>
  delete(key: string): Promise<void>
  getUrl(key: string): string
  getFilePath(key: string): string | null
}

export class LocalStorageProvider implements StorageProvider {
  private readonly uploadDir: string
  private readonly backendUrl: string

  constructor() {
    this.uploadDir = process.env['UPLOAD_DIR'] ?? './uploads'
    this.backendUrl = process.env['CORE_BACKEND_URL'] ?? 'http://localhost:3001'
  }

  async upload(key: string, buffer: Buffer, _mimeType: string): Promise<StoredAsset> {
    const fullPath = path.join(this.uploadDir, key)
    const dir = path.dirname(fullPath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(fullPath, buffer)
    return { key, url: this.getUrl(key) }
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, key)
    try {
      await fs.unlink(fullPath)
    } catch (err) {
      const e = err as { code?: string }
      if (e.code !== 'ENOENT') throw err
    }
  }

  getUrl(key: string): string {
    return `${this.backendUrl}/assets/${key}`
  }

  getFilePath(key: string): string {
    return path.join(this.uploadDir, key)
  }
}

export function createStorageProvider(): StorageProvider {
  const provider = process.env['STORAGE_PROVIDER'] ?? 'local'
  if (provider === 'local') return new LocalStorageProvider()
  throw new Error(`Storage provider "${provider}" not implemented`)
}

export const storageProvider = createStorageProvider()
