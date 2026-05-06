import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16
const KEY_LENGTH = 32

interface SecretsProvider {
  store(key: string, value: object): Promise<string>
  resolve(ref: string): Promise<object>
}

function getEncryptionKey(): Buffer {
  const raw = process.env['SECRETS_ENCRYPTION_KEY']
  if (!raw) throw new Error('SECRETS_ENCRYPTION_KEY environment variable is required')
  const buf = Buffer.from(raw, 'hex')
  if (buf.length !== KEY_LENGTH) {
    throw new Error(`SECRETS_ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes)`)
  }
  return buf
}

function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64url')
}

function decrypt(ciphertext: string): string {
  const key = getEncryptionKey()
  const buf = Buffer.from(ciphertext, 'base64url')
  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv) as crypto.DecipherGCM
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}

// AES-256-GCM implementation — swap to VaultProvider post-POC without changing callers
export const secretsProvider: SecretsProvider = {
  async store(_key: string, value: object): Promise<string> {
    const plaintext = JSON.stringify(value)
    return encrypt(plaintext)
  },

  async resolve(ref: string): Promise<object> {
    const plaintext = decrypt(ref)
    return JSON.parse(plaintext) as object
  },
}
