import type { FastifyRequest, FastifyReply } from 'fastify'
import { authService } from '../modules/auth/service.js'
import { getMemberRole } from '../modules/apps/service.js'
import type { FDESessionToken, PortalSessionToken } from '../modules/auth/types.js'

// ── Request augmentation ──────────────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyRequest {
    fdeSession: FDESessionToken | null
  }
}

function extractBearerToken(request: FastifyRequest): string | null {
  const auth = request.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return null
  return auth.slice(7)
}

// ── extractFDESession ─────────────────────────────────────────────────────────

export async function extractFDESession(request: FastifyRequest): Promise<FDESessionToken | null> {
  const token = extractBearerToken(request)
  if (!token) return null

  const result = await authService.validateToken(token)
  if (!result.valid || !result.payload) return null

  const payload = result.payload as FDESessionToken | PortalSessionToken
  if (payload.context !== 'BUILDER') return null

  return payload as FDESessionToken
}

// ── requireAuth preHandler hook ───────────────────────────────────────────────

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const session = await extractFDESession(request)
  if (!session) {
    return reply.status(401).send({ error: 'Unauthorized — valid FDE session required' })
  }
  request.fdeSession = session
}

// ── requireAppRole preHandler hook factory ────────────────────────────────────

export function requireAppRole(minRole: 'OWNER' | 'EDITOR' | 'VIEWER') {
  const roleRank: Record<string, number> = { VIEWER: 0, EDITOR: 1, OWNER: 2 }

  return async function checkAppRole(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // requireAuth must have run first
    const session = request.fdeSession
    if (!session) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    // ADMIN bypasses all AppMember checks
    if (session.role === 'ADMIN') return

    const params = request.params as Record<string, string>
    const appId = params['id']
    if (!appId) {
      return reply.status(400).send({ error: 'Missing app ID' })
    }

    const memberRole = await getMemberRole(appId, session.sub)
    if (!memberRole) {
      return reply.status(403).send({ error: 'Access denied — not a member of this app' })
    }

    const userRank = roleRank[memberRole] ?? -1
    const requiredRank = roleRank[minRole] ?? 0

    if (userRank < requiredRank) {
      return reply.status(403).send({
        error: `Access denied — requires ${minRole} role, you have ${memberRole}`,
      })
    }
  }
}
