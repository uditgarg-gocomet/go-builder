import { importPKCS8, importSPKI, SignJWT, jwtVerify, exportJWK, type JWK } from 'jose'
import type { FDESessionToken, PortalSessionToken } from '../types.js'

const ALG = 'RS256'
const ACCESS_TOKEN_TTL = '15m'

function loadPrivateKeyPem(): string {
  const raw = process.env['JWT_PRIVATE_KEY']
  if (!raw) throw new Error('JWT_PRIVATE_KEY env var is not set')
  return raw.replace(/\\n/g, '\n')
}

function loadPublicKeyPem(): string {
  const raw = process.env['JWT_PUBLIC_KEY']
  if (!raw) throw new Error('JWT_PUBLIC_KEY env var is not set')
  return raw.replace(/\\n/g, '\n')
}

const KID = process.env['JWT_KEY_ID'] ?? 'portal-key-1'

export async function signToken(
  payload: Omit<FDESessionToken, 'iat' | 'exp'> | Omit<PortalSessionToken, 'iat' | 'exp'>
): Promise<string> {
  const privateKey = await importPKCS8(loadPrivateKeyPem(), ALG)
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: ALG, kid: KID })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(privateKey)
}

export async function verifyToken(
  token: string
): Promise<FDESessionToken | PortalSessionToken> {
  const publicKey = await importSPKI(loadPublicKeyPem(), ALG)
  const { payload } = await jwtVerify(token, publicKey, { algorithms: [ALG] })
  return payload as unknown as FDESessionToken | PortalSessionToken
}

export async function verifyTokenExpired(
  token: string
): Promise<FDESessionToken | PortalSessionToken> {
  // Verify signature only — ignores expiry — used for refresh rotation
  const publicKey = await importSPKI(loadPublicKeyPem(), ALG)
  const { payload } = await jwtVerify(token, publicKey, {
    algorithms: [ALG],
    clockTolerance: 60 * 60 * 24 * 7, // tolerate up to 7 days expired
  })
  return payload as unknown as FDESessionToken | PortalSessionToken
}

export async function getJWKS(): Promise<{ keys: (JWK & { use: string; alg: string; kid: string })[] }> {
  const { createPublicKey } = await import('node:crypto')
  const publicKey = createPublicKey(loadPublicKeyPem())
  const jwk = await exportJWK(
    await importSPKI(loadPublicKeyPem(), ALG)
  )
  return {
    keys: [
      {
        ...jwk,
        use: 'sig',
        alg: ALG,
        kid: KID,
      },
    ],
  }
}
