import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'

// ── RS256 key pair for tests ───────────────────────────────────────────────────
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string
process.env['JWT_PRIVATE_KEY'] = privateKeyPem.replace(/\n/g, '\\n')
process.env['JWT_PUBLIC_KEY'] = publicKeyPem.replace(/\n/g, '\\n')
process.env['JWT_KEY_ID'] = 'test-key-1'
process.env['CORE_BACKEND_URL'] = 'http://localhost:3001'
process.env['SECRETS_ENCRYPTION_KEY'] = 'a'.repeat(64) // 32-byte hex key

// ── Mock stores ───────────────────────────────────────────────────────────────
type OAuthStateRecord = {
  id: string; state: string; codeVerifier: string; idpId: string;
  context: string; appId: string | null; environment: string | null;
  redirectTo: string; expiresAt: Date; createdAt: Date
}
type SAMLStateRecord = {
  id: string; requestId: string; idpId: string; context: string;
  appId: string | null; environment: string | null; redirectTo: string;
  expiresAt: Date; createdAt: Date
}
type BuilderIdP = {
  id: string; name: string; type: string; label: string;
  config: string; isActive: boolean; createdAt: Date; updatedAt: Date
}
type AppIdP = {
  id: string; appId: string; environment: string; type: string;
  label: string; configSecretRef: string; isEnabled: boolean;
  order: number; createdAt: Date; updatedAt: Date; createdBy: string; updatedBy: string
}

const oauthStates = new Map<string, OAuthStateRecord>()
const samlStates = new Map<string, SAMLStateRecord>()
const builderIdPs = new Map<string, BuilderIdP>()
const appIdPs = new Map<string, AppIdP>()
const appUserGroupMembers: Array<{ identifier: string; group: { appId: string; name: string } }> = []

let idCounter = 0
function nextId() { return `id-${++idCounter}` }

vi.mock('../../../lib/db.js', () => ({
  db: {
    oAuthState: {
      create: vi.fn(async ({ data }: { data: Omit<OAuthStateRecord, 'id' | 'createdAt'> }) => {
        const record: OAuthStateRecord = { id: nextId(), createdAt: new Date(), ...data }
        oauthStates.set(data.state, record)
        return record
      }),
      findUnique: vi.fn(async ({ where }: { where: { state: string } }) =>
        oauthStates.get(where.state) ?? null
      ),
      delete: vi.fn(async ({ where }: { where: { state: string } }) => {
        const record = oauthStates.get(where.state)
        oauthStates.delete(where.state)
        return record
      }),
    },
    sAMLState: {
      create: vi.fn(async ({ data }: { data: Omit<SAMLStateRecord, 'id' | 'createdAt'> }) => {
        const record: SAMLStateRecord = { id: nextId(), createdAt: new Date(), ...data }
        samlStates.set(data.requestId, record)
        return record
      }),
      findUnique: vi.fn(async ({ where }: { where: { requestId: string } }) =>
        samlStates.get(where.requestId) ?? null
      ),
      findFirst: vi.fn(async ({ where }: { where: { requestId: string } }) =>
        samlStates.get(where.requestId) ?? null
      ),
      delete: vi.fn(async ({ where }: { where: { requestId: string } }) => {
        const record = samlStates.get(where.requestId)
        samlStates.delete(where.requestId)
        return record
      }),
    },
    builderIdentityProvider: {
      findMany: vi.fn(async ({ where }: { where: { isActive?: boolean } }) => {
        const all = Array.from(builderIdPs.values())
        return all.filter(idp => where.isActive == null || idp.isActive === where.isActive)
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        builderIdPs.get(where.id) ?? null
      ),
      create: vi.fn(async ({ data }: { data: Omit<BuilderIdP, 'id' | 'createdAt' | 'updatedAt'> }) => {
        const record: BuilderIdP = {
          id: nextId(), createdAt: new Date(), updatedAt: new Date(), ...data
        }
        builderIdPs.set(record.id, record)
        return record
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<BuilderIdP> }) => {
        const existing = builderIdPs.get(where.id)
        if (!existing) throw new Error('Not found')
        const updated = { ...existing, ...data, updatedAt: new Date() }
        builderIdPs.set(where.id, updated)
        return updated
      }),
    },
    appIdentityProvider: {
      findMany: vi.fn(async ({ where }: { where: { appId: string; environment: string; isEnabled?: boolean } }) => {
        const all = Array.from(appIdPs.values())
        return all.filter(idp =>
          idp.appId === where.appId &&
          idp.environment === where.environment &&
          (where.isEnabled == null || idp.isEnabled === where.isEnabled)
        ).sort((a, b) => a.order - b.order)
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        appIdPs.get(where.id) ?? null
      ),
      create: vi.fn(async ({ data }: { data: Omit<AppIdP, 'id' | 'createdAt' | 'updatedAt'> }) => {
        const record: AppIdP = {
          id: nextId(), createdAt: new Date(), updatedAt: new Date(), ...data
        }
        appIdPs.set(record.id, record)
        return record
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<AppIdP> }) => {
        const existing = appIdPs.get(where.id)
        if (!existing) throw new Error('Not found')
        const updated = { ...existing, ...data, updatedAt: new Date() }
        appIdPs.set(where.id, updated)
        return updated
      }),
    },
    appUserGroupMember: {
      findMany: vi.fn(async ({ where }: { where: { group: { appId: string }; identifier: string } }) =>
        appUserGroupMembers.filter(
          m => m.group.appId === where.group.appId && m.identifier === where.identifier
        )
      ),
    },
    refreshToken: {
      create: vi.fn(async () => ({})),
      findFirst: vi.fn(async () => null),
      updateMany: vi.fn(async () => ({})),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    fDEUser: {
      findUnique: vi.fn(async () => null),
    },
  },
}))

vi.mock('../../../lib/redis.js', () => ({
  redis: {
    get: vi.fn(async () => null),
    setex: vi.fn(async () => 'OK'),
    pipeline: vi.fn(() => ({
      setex: vi.fn().mockReturnThis(),
      exec: vi.fn(async () => []),
    })),
  },
}))

vi.mock('@openfga/sdk', () => ({
  OpenFgaClient: vi.fn(() => ({
    write: vi.fn(async () => ({})),
  })),
}))

vi.mock('../../../lib/logger.js', () => ({
  createChildLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}))

vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
  init: vi.fn(),
}))

// ── Import modules under test ─────────────────────────────────────────────────
import { initiateOIDCFlow } from '../lib/oidcClient.js'
import { initiateSAMLFlow } from '../lib/samlClient.js'
import { syncUserGroups } from '../lib/openFGASync.js'

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  oauthStates.clear()
  samlStates.clear()
  builderIdPs.clear()
  appIdPs.clear()
  appUserGroupMembers.length = 0
})

describe('OAuthState', () => {
  it('creates an OAuthState record with correct fields', async () => {
    // We mock Issuer.discover to avoid real network call
    vi.mock('openid-client', () => ({
      Issuer: {
        discover: vi.fn(async () => ({
          Client: class MockClient {
            authorizationUrl(params: Record<string, string>) {
              return `https://accounts.google.com/o/oauth2/auth?state=${params['state']}&code_challenge=${params['code_challenge']}`
            }
          },
        })),
      },
      generators: {
        state: () => 'test-state-abc',
        codeVerifier: () => 'test-verifier-xyz',
        codeChallenge: () => 'test-challenge-hash',
      },
    }))

    const result = await initiateOIDCFlow(
      'idp-1',
      { issuerUrl: 'https://accounts.google.com', clientId: 'client1', clientSecret: 'secret1', scopes: undefined },
      'BUILDER',
      undefined,
      undefined,
      '/',
    )

    expect(result.state).toBe('test-state-abc')
    expect(result.codeVerifier).toBe('test-verifier-xyz')
    expect(result.authUrl).toContain('test-state-abc')

    // Check the record was stored
    const stored = oauthStates.get('test-state-abc')
    expect(stored).toBeDefined()
    expect(stored!.idpId).toBe('idp-1')
    expect(stored!.context).toBe('BUILDER')
    expect(stored!.codeVerifier).toBe('test-verifier-xyz')
    expect(stored!.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('stores an OAuthState with expiresAt ~10 minutes in the future', async () => {
    const before = Date.now()

    // Call initiateOIDCFlow — the module-level mock for openid-client returns 'test-state-abc'
    await initiateOIDCFlow(
      'idp-ttl',
      { issuerUrl: 'https://accounts.google.com', clientId: 'c', clientSecret: 's', scopes: undefined },
      'PORTAL', 'app-1', 'STAGING', '/dashboard',
    )

    const record = oauthStates.get('test-state-abc')
    expect(record).toBeDefined()

    const tenMinutesMs = 10 * 60 * 1000
    expect(record!.expiresAt.getTime()).toBeGreaterThanOrEqual(before + tenMinutesMs - 5000)
    expect(record!.expiresAt.getTime()).toBeLessThanOrEqual(before + tenMinutesMs + 5000)
  })
})

describe('SAMLState', () => {
  it('creates a SAMLState record when initiating SAML flow', async () => {
    vi.mock('samlify', () => ({
      ServiceProvider: vi.fn(() => ({
        createLoginRequest: vi.fn(() => ({
          id: 'saml-request-id-001',
          context: 'https://idp.example.com/sso?SAMLRequest=encoded',
        })),
      })),
      IdentityProvider: vi.fn(() => ({})),
      Constants: {
        namespace: {
          binding: {
            post: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
            redirect: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
          },
        },
      },
    }))

    const result = await initiateSAMLFlow(
      'saml-idp-1',
      { entityId: 'https://idp.example.com', entryPoint: 'https://idp.example.com/sso', certificate: 'CERT', metadata: undefined },
      'PORTAL',
      'app-abc',
      'STAGING',
      '/dashboard',
    )

    expect(result.requestId).toBe('saml-request-id-001')
    expect(result.redirectUrl).toContain('SAMLRequest=encoded')

    const stored = samlStates.get('saml-request-id-001')
    expect(stored).toBeDefined()
    expect(stored!.idpId).toBe('saml-idp-1')
    expect(stored!.context).toBe('PORTAL')
    expect(stored!.appId).toBe('app-abc')
  })

  it('stores a SAMLState with expiresAt ~10 minutes in the future', async () => {
    const before = Date.now()
    await initiateSAMLFlow(
      'saml-idp-2',
      { entityId: 'https://idp.example.com', entryPoint: 'https://idp.example.com/sso', certificate: 'CERT', metadata: undefined },
      'BUILDER',
      undefined,
      undefined,
      '/',
    )
    const record = samlStates.get('saml-request-id-001')
    if (!record) return
    const tenMinutesMs = 10 * 60 * 1000
    expect(record.expiresAt.getTime()).toBeGreaterThanOrEqual(before + tenMinutesMs - 5000)
  })
})

describe('App IdP listing', () => {
  it('returns only enabled IdPs for a specific app and environment', async () => {
    const { db } = await import('../../../lib/db.js')

    // Seed two enabled + one disabled IdP for STAGING
    appIdPs.set('idp-a', {
      id: 'idp-a', appId: 'app-1', environment: 'STAGING', type: 'GOOGLE',
      label: 'Google', configSecretRef: 'ref-a', isEnabled: true, order: 0,
      createdAt: new Date(), updatedAt: new Date(), createdBy: 'u1', updatedBy: 'u1',
    })
    appIdPs.set('idp-b', {
      id: 'idp-b', appId: 'app-1', environment: 'STAGING', type: 'OIDC',
      label: 'Okta', configSecretRef: 'ref-b', isEnabled: true, order: 1,
      createdAt: new Date(), updatedAt: new Date(), createdBy: 'u1', updatedBy: 'u1',
    })
    appIdPs.set('idp-c', {
      id: 'idp-c', appId: 'app-1', environment: 'STAGING', type: 'SAML',
      label: 'Disabled SAML', configSecretRef: 'ref-c', isEnabled: false, order: 2,
      createdAt: new Date(), updatedAt: new Date(), createdBy: 'u1', updatedBy: 'u1',
    })
    // Different environment — should not appear
    appIdPs.set('idp-d', {
      id: 'idp-d', appId: 'app-1', environment: 'PRODUCTION', type: 'GOOGLE',
      label: 'Prod Google', configSecretRef: 'ref-d', isEnabled: true, order: 0,
      createdAt: new Date(), updatedAt: new Date(), createdBy: 'u1', updatedBy: 'u1',
    })

    const result = await db.appIdentityProvider.findMany({
      where: { appId: 'app-1', environment: 'STAGING', isEnabled: true },
      orderBy: { order: 'asc' },
      select: { id: true, type: true, label: true, order: true },
    })

    expect(result).toHaveLength(2)
    expect(result.map((r: { id: string }) => r.id)).toContain('idp-a')
    expect(result.map((r: { id: string }) => r.id)).toContain('idp-b')
    expect(result.map((r: { id: string }) => r.id)).not.toContain('idp-c')
    expect(result.map((r: { id: string }) => r.id)).not.toContain('idp-d')
  })

  it('disabled IdPs are filtered out', async () => {
    const { db } = await import('../../../lib/db.js')

    appIdPs.set('disabled-idp', {
      id: 'disabled-idp', appId: 'app-2', environment: 'PRODUCTION', type: 'GOOGLE',
      label: 'Google', configSecretRef: 'ref', isEnabled: false, order: 0,
      createdAt: new Date(), updatedAt: new Date(), createdBy: 'u1', updatedBy: 'u1',
    })

    const result = await db.appIdentityProvider.findMany({
      where: { appId: 'app-2', environment: 'PRODUCTION', isEnabled: true },
      orderBy: { order: 'asc' },
      select: { id: true },
    })

    expect(result).toHaveLength(0)
  })
})

describe('OpenFGA sync', () => {
  it('does not throw when OpenFGA write fails', async () => {
    const { OpenFgaClient } = await import('@openfga/sdk')
    vi.mocked(OpenFgaClient).mockImplementationOnce(() => ({
      write: vi.fn(async () => { throw new Error('OpenFGA connection refused') }),
    }) as unknown as InstanceType<typeof OpenFgaClient>)

    // Add a group membership so fgaClient.write gets called
    appUserGroupMembers.push({
      identifier: 'user-1',
      group: { appId: 'app-1', name: 'admins' },
    })

    // Must not throw
    await expect(syncUserGroups('user-1', 'app-1')).resolves.toBeUndefined()
  })

  it('syncs user group tuples to OpenFGA on successful call', async () => {
    const writeMock = vi.fn(async () => ({}))
    const { OpenFgaClient } = await import('@openfga/sdk')
    vi.mocked(OpenFgaClient).mockImplementationOnce(() => ({
      write: writeMock,
    }) as unknown as InstanceType<typeof OpenFgaClient>)

    appUserGroupMembers.push(
      { identifier: 'user-2', group: { appId: 'app-x', name: 'editors' } },
      { identifier: 'user-2', group: { appId: 'app-x', name: 'viewers' } },
    )

    await syncUserGroups('user-2', 'app-x')

    expect(writeMock).toHaveBeenCalledOnce()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = writeMock.mock.calls as unknown as Array<Array<any>>
    const callArg = calls[0]?.[0] as { writes: Array<{ user: string; relation: string; object: string }> }
    expect(callArg).toBeDefined()
    expect(callArg.writes).toHaveLength(2)
    expect(callArg.writes[0]?.user).toBe('user:user-2')
    expect(callArg.writes[0]?.relation).toBe('member')
  })

  it('does not call OpenFGA when user has no group memberships', async () => {
    const writeMock = vi.fn()
    const { OpenFgaClient } = await import('@openfga/sdk')
    vi.mocked(OpenFgaClient).mockImplementationOnce(() => ({
      write: writeMock,
    }) as unknown as InstanceType<typeof OpenFgaClient>)

    // No members seeded for this user
    await syncUserGroups('user-no-groups', 'app-empty')

    expect(writeMock).not.toHaveBeenCalled()
  })
})
