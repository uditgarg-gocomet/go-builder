import { describe, it, expect, beforeAll, vi } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'

// ── Generate test RS256 key pair ───────────────────────────────────────────────

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string

// Set env vars before importing the modules under test
process.env['JWT_PRIVATE_KEY'] = privateKeyPem.replace(/\n/g, '\\n')
process.env['JWT_PUBLIC_KEY'] = publicKeyPem.replace(/\n/g, '\\n')
process.env['JWT_KEY_ID'] = 'test-key-1'

// ── Mock db + redis ────────────────────────────────────────────────────────────

const mockRefreshTokens: Record<string, {
  tokenFamily: string
  tokenHash: string
  userId: string
  appId: string | null
  context: string
  environment: string | null
  isRevoked: boolean
  revokedAt: Date | null
  expiresAt: Date
  createdAt: Date
}[]> = {}

const mockRevocationSet = new Set<string>()

vi.mock('../../../lib/db.js', () => ({
  db: {
    refreshToken: {
      create: vi.fn(async ({ data }: { data: {
        tokenFamily: string; tokenHash: string; userId: string;
        appId?: string | null; context: string; environment?: string | null; expiresAt: Date
      } }) => {
        if (!mockRefreshTokens[data.tokenFamily]) mockRefreshTokens[data.tokenFamily] = []
        const record = { ...data, isRevoked: false, revokedAt: null, createdAt: new Date() }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        mockRefreshTokens[data.tokenFamily]!.push(record as typeof record & { appId: string | null; environment: string | null })
        return record
      }),
      findFirst: vi.fn(async ({ where }: { where: { tokenFamily: string; isRevoked: boolean } }) => {
        const entries = mockRefreshTokens[where.tokenFamily] ?? []
        return entries.find(e => e.isRevoked === where.isRevoked) ?? null
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { tokenFamily?: string; userId?: string; isRevoked?: boolean }; data: Partial<{ isRevoked: boolean; revokedAt: Date }> }) => {
        if (where.tokenFamily) {
          const entries = mockRefreshTokens[where.tokenFamily] ?? []
          entries.forEach(e => Object.assign(e, data))
        }
      }),
      findMany: vi.fn(async ({ where }: { where: { tokenFamily?: string; userId?: string; isRevoked?: boolean } }) => {
        const all = Object.values(mockRefreshTokens).flat()
        return all.filter(e =>
          (where.userId == null || e.userId === where.userId) &&
          (where.isRevoked == null || e.isRevoked === where.isRevoked)
        )
      }),
      count: vi.fn(async ({ where }: { where: { tokenFamily: string; isRevoked: boolean } }) => {
        const entries = mockRefreshTokens[where.tokenFamily] ?? []
        return entries.filter(e => e.isRevoked === where.isRevoked).length
      }),
    },
    fDEUser: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        email: 'fde@example.com',
        role: 'FDE',
      })),
    },
  },
}))

vi.mock('../../../lib/redis.js', () => {
  const store = new Map<string, string>()
  return {
    redis: {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      setex: vi.fn(async (key: string, _ttl: number, value: string) => {
        store.set(key, value)
        return 'OK'
      }),
      pipeline: vi.fn(() => {
        const ops: Array<[string, number, string]> = []
        const pipe = {
          setex: vi.fn((key: string, ttl: number, value: string) => {
            ops.push([key, ttl, value])
            return pipe
          }),
          exec: vi.fn(async () => {
            for (const [key, , value] of ops) store.set(key, value)
            return []
          }),
        }
        return pipe
      }),
    },
  }
})

// ── Import modules under test AFTER mocks ─────────────────────────────────────

import { signToken, verifyToken, getJWKS } from '../lib/tokenSigner.js'
import {
  issueSessionTokens,
  rotateRefreshToken,
  revokeTokenFamily,
  revokeAllSessions,
  isRevoked,
} from '../lib/sessionManager.js'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('tokenSigner', () => {
  it('signs and verifies a BUILDER token round trip', async () => {
    const token = await signToken({
      sub: 'user-1',
      email: 'fde@example.com',
      context: 'BUILDER',
      role: 'FDE',
      idpType: 'GOOGLE',
      tokenFamily: 'family-1',
    })

    expect(typeof token).toBe('string')
    expect(token.split('.').length).toBe(3)

    const payload = await verifyToken(token)
    expect(payload.sub).toBe('user-1')
    expect(payload.context).toBe('BUILDER')
    expect(payload.tokenFamily).toBe('family-1')
  })

  it('signs and verifies a PORTAL token round trip', async () => {
    const token = await signToken({
      sub: 'portal-user-1',
      email: 'user@client.com',
      context: 'PORTAL',
      appId: 'app-1',
      environment: 'STAGING',
      groups: ['admins'],
      idpType: 'GOOGLE',
      tokenFamily: 'family-2',
    })

    const payload = await verifyToken(token) as { context: string; appId: string; groups: string[] }
    expect(payload.context).toBe('PORTAL')
    expect(payload.appId).toBe('app-1')
    expect(payload.groups).toEqual(['admins'])
  })

  it('rejects a tampered token', async () => {
    const token = await signToken({
      sub: 'user-1',
      email: 'fde@example.com',
      context: 'BUILDER',
      role: 'FDE',
      idpType: 'GOOGLE',
      tokenFamily: 'family-3',
    })

    const parts = token.split('.')
    parts[1] = Buffer.from(JSON.stringify({ sub: 'attacker', context: 'BUILDER' })).toString('base64url')
    const tampered = parts.join('.')

    await expect(verifyToken(tampered)).rejects.toThrow()
  })

  it('getJWKS returns a valid JWK with RS256 alg', async () => {
    const jwks = await getJWKS()
    expect(jwks.keys).toHaveLength(1)
    expect(jwks.keys[0]!.alg).toBe('RS256')
    expect(jwks.keys[0]!.use).toBe('sig')
    expect(jwks.keys[0]!.kty).toBe('RSA')
  })
})

describe('sessionManager', () => {
  it('issues a token pair — happy path', async () => {
    const result = await issueSessionTokens({
      userId: 'user-100',
      email: 'test@example.com',
      context: 'BUILDER',
      role: 'FDE',
      idpType: 'GOOGLE',
    })

    expect(result.accessToken).toBeTruthy()
    expect(result.refreshToken).toBeTruthy()
    expect(result.tokenFamily).toBeTruthy()

    const payload = await verifyToken(result.accessToken)
    expect(payload.sub).toBe('user-100')
    expect(payload.tokenFamily).toBe(result.tokenFamily)
  })

  it('rotates refresh token — happy path', async () => {
    const issued = await issueSessionTokens({
      userId: 'user-200',
      email: 'rotate@example.com',
      context: 'BUILDER',
      role: 'FDE',
      idpType: 'GOOGLE',
    })

    const rotated = await rotateRefreshToken(issued.tokenFamily, issued.refreshToken)
    expect(rotated.accessToken).toBeTruthy()
    expect(rotated.refreshToken).toBeTruthy()
    // Same family, new tokens
    expect(rotated.tokenFamily).toBe(issued.tokenFamily)
    expect(rotated.refreshToken).not.toBe(issued.refreshToken)
  })

  it('detects refresh token reuse and revokes family', async () => {
    const issued = await issueSessionTokens({
      userId: 'user-300',
      email: 'reuse@example.com',
      context: 'BUILDER',
      role: 'FDE',
      idpType: 'GOOGLE',
    })

    // First rotation — legitimate
    await rotateRefreshToken(issued.tokenFamily, issued.refreshToken)

    // Second rotation with old token — reuse attack
    await expect(
      rotateRefreshToken(issued.tokenFamily, issued.refreshToken)
    ).rejects.toMatchObject({ message: expect.stringContaining('reuse') })

    // Family must now be revoked
    expect(await isRevoked(issued.tokenFamily)).toBe(true)
  })

  it('revokeTokenFamily marks family revoked', async () => {
    const issued = await issueSessionTokens({
      userId: 'user-400',
      email: 'revoke@example.com',
      context: 'BUILDER',
      role: 'FDE',
      idpType: 'GOOGLE',
    })

    expect(await isRevoked(issued.tokenFamily)).toBe(false)
    await revokeTokenFamily(issued.tokenFamily)
    expect(await isRevoked(issued.tokenFamily)).toBe(true)
  })

  it('revokeAllSessions revokes all families for a user', async () => {
    const userId = 'user-500'
    const s1 = await issueSessionTokens({ userId, email: 'a@b.com', context: 'BUILDER', role: 'FDE', idpType: 'GOOGLE' })
    const s2 = await issueSessionTokens({ userId, email: 'a@b.com', context: 'BUILDER', role: 'FDE', idpType: 'GOOGLE' })

    await revokeAllSessions(userId)

    expect(await isRevoked(s1.tokenFamily)).toBe(true)
    expect(await isRevoked(s2.tokenFamily)).toBe(true)
  })

  it('isRevoked returns false for an active family', async () => {
    const issued = await issueSessionTokens({
      userId: 'user-600',
      email: 'active@example.com',
      context: 'BUILDER',
      role: 'FDE',
      idpType: 'GOOGLE',
    })

    expect(await isRevoked(issued.tokenFamily)).toBe(false)
  })

  it('rejects expired refresh token', async () => {
    const issued = await issueSessionTokens({
      userId: 'user-700',
      email: 'expired@example.com',
      context: 'BUILDER',
      role: 'FDE',
      idpType: 'GOOGLE',
    })

    // Manually expire the token in mock storage
    const entries = mockRefreshTokens[issued.tokenFamily]!
    entries.forEach(e => { e.expiresAt = new Date(Date.now() - 1000) })

    await expect(
      rotateRefreshToken(issued.tokenFamily, issued.refreshToken)
    ).rejects.toMatchObject({ statusCode: 401 })

    // Family should be revoked after expiry detection
    expect(await isRevoked(issued.tokenFamily)).toBe(true)
  })
})
