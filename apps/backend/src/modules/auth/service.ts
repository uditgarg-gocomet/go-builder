import { signToken, verifyToken, getJWKS } from './lib/tokenSigner.js'
import {
  issueSessionTokens,
  rotateRefreshToken,
  revokeTokenFamily,
  revokeAllSessions,
  isRevoked,
} from './lib/sessionManager.js'
import type { TokenIssuanceParams, ValidateResponse } from './types.js'

export const authService = {
  issueSessionTokens: (params: TokenIssuanceParams) => issueSessionTokens(params),

  rotateRefreshToken: (tokenFamily: string, rawRefreshToken: string) =>
    rotateRefreshToken(tokenFamily, rawRefreshToken),

  revokeTokenFamily: (tokenFamily: string) => revokeTokenFamily(tokenFamily),

  revokeAllSessions: (userId: string, appId?: string) => revokeAllSessions(userId, appId),

  async validateToken(token: string): Promise<ValidateResponse> {
    try {
      const payload = await verifyToken(token)
      const revoked = await isRevoked(payload.tokenFamily)
      if (revoked) return { valid: false, reason: 'Token family revoked' }
      return { valid: true, payload }
    } catch (err: unknown) {
      const e = err as { code?: string }
      return {
        valid: false,
        reason: e.code === 'ERR_JWT_EXPIRED' ? 'Token expired' : 'Invalid token',
      }
    }
  },

  getJWKS: () => getJWKS(),

  signToken: (payload: Parameters<typeof signToken>[0]) => signToken(payload),
}
