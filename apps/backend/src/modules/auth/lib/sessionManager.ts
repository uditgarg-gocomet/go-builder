import { v4 as uuidv4 } from 'uuid'
import * as argon2 from 'argon2'
import { db } from '../../../lib/db.js'
import { redis } from '../../../lib/redis.js'
import { signToken, verifyTokenExpired } from './tokenSigner.js'
import type { TokenIssuanceParams, FDESessionToken, PortalSessionToken } from '../types.js'

const REFRESH_TOKEN_TTL_DAYS = 7
const REVOCATION_REDIS_TTL_SECONDS = 7 * 24 * 60 * 60

function revocationKey(tokenFamily: string): string {
  return `revoked:${tokenFamily}`
}

export interface IssuedTokens {
  accessToken: string
  refreshToken: string
  tokenFamily: string
}

export async function issueSessionTokens(
  params: TokenIssuanceParams
): Promise<IssuedTokens> {
  const tokenFamily = uuidv4()
  const rawRefreshToken = uuidv4()
  const tokenHash = await argon2.hash(rawRefreshToken)
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)

  const basePayload = {
    sub: params.userId,
    email: params.email,
    idpType: params.idpType,
    tokenFamily,
  }

  let accessToken: string
  if (params.context === 'BUILDER') {
    accessToken = await signToken({
      ...basePayload,
      context: 'BUILDER' as const,
      role: params.role ?? 'FDE',
    })
  } else {
    accessToken = await signToken({
      ...basePayload,
      context: 'PORTAL' as const,
      appId: params.appId!,
      environment: params.environment!,
      groups: params.groups ?? [],
    })
  }

  await db.refreshToken.create({
    data: {
      tokenFamily,
      tokenHash,
      userId: params.userId,
      appId: params.appId ?? null,
      context: params.context,
      environment: params.environment ?? null,
      expiresAt,
    },
  })

  return { accessToken, refreshToken: rawRefreshToken, tokenFamily }
}

export async function rotateRefreshToken(
  tokenFamily: string,
  rawRefreshToken: string
): Promise<IssuedTokens> {
  const stored = await db.refreshToken.findFirst({
    where: { tokenFamily, isRevoked: false },
    orderBy: { createdAt: 'desc' },
  })

  if (!stored) {
    // Possible reuse attack — family may have been revoked already
    throw Object.assign(new Error('Invalid or revoked token family'), { statusCode: 401 })
  }

  const hashMatch = await argon2.verify(stored.tokenHash, rawRefreshToken)

  if (!hashMatch) {
    // Reuse attack detected — revoke entire family
    await revokeTokenFamily(tokenFamily)
    throw Object.assign(new Error('Refresh token reuse detected — session revoked'), {
      statusCode: 401,
    })
  }

  if (stored.expiresAt < new Date()) {
    await revokeTokenFamily(tokenFamily)
    throw Object.assign(new Error('Refresh token expired'), { statusCode: 401 })
  }

  // Revoke the old token entry
  await db.refreshToken.updateMany({
    where: { tokenFamily },
    data: { isRevoked: true, revokedAt: new Date() },
  })

  // Issue new token pair under the same tokenFamily
  const newRawRefreshToken = uuidv4()
  const newTokenHash = await argon2.hash(newRawRefreshToken)
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)

  await db.refreshToken.create({
    data: {
      tokenFamily,
      tokenHash: newTokenHash,
      userId: stored.userId,
      appId: stored.appId,
      context: stored.context,
      environment: stored.environment,
      expiresAt,
    },
  })

  // Re-issue access token by looking up stored context
  // Email and idpType are not stored in RefreshToken — we fall back to DB lookup
  const storedContext = stored.context as 'BUILDER' | 'PORTAL'
  let accessToken: string
  if (storedContext === 'BUILDER') {
    const fdeUser = await db.fDEUser.findUnique({ where: { id: stored.userId } })
    accessToken = await signToken({
      sub: stored.userId,
      email: fdeUser?.email ?? '',
      context: 'BUILDER',
      role: (fdeUser?.role ?? 'FDE') as 'ADMIN' | 'FDE',
      idpType: 'OIDC',
      tokenFamily,
    })
  } else {
    accessToken = await signToken({
      sub: stored.userId,
      email: '',
      context: 'PORTAL',
      appId: stored.appId ?? '',
      environment: (stored.environment ?? 'STAGING') as 'STAGING' | 'PRODUCTION',
      groups: [],
      idpType: 'OIDC',
      tokenFamily,
    })
  }

  return { accessToken, refreshToken: newRawRefreshToken, tokenFamily }
}

export async function revokeTokenFamily(tokenFamily: string): Promise<void> {
  await db.refreshToken.updateMany({
    where: { tokenFamily },
    data: { isRevoked: true, revokedAt: new Date() },
  })
  await redis.setex(revocationKey(tokenFamily), REVOCATION_REDIS_TTL_SECONDS, '1')
}

export async function revokeAllSessions(userId: string, appId?: string): Promise<void> {
  const where = appId
    ? { userId, appId, isRevoked: false }
    : { userId, isRevoked: false }

  const families = await db.refreshToken.findMany({
    where,
    select: { tokenFamily: true },
    distinct: ['tokenFamily'],
  })

  await db.refreshToken.updateMany({
    where,
    data: { isRevoked: true, revokedAt: new Date() },
  })

  const pipeline = redis.pipeline()
  for (const { tokenFamily } of families) {
    pipeline.setex(revocationKey(tokenFamily), REVOCATION_REDIS_TTL_SECONDS, '1')
  }
  await pipeline.exec()
}

export async function isRevoked(tokenFamily: string): Promise<boolean> {
  // Fast path: Redis
  const redisResult = await redis.get(revocationKey(tokenFamily))
  if (redisResult !== null) return true

  // Fallback: Postgres
  const count = await db.refreshToken.count({
    where: { tokenFamily, isRevoked: true },
  })
  return count > 0
}
