import { OpenFgaClient } from '@openfga/sdk'
import { db } from '../../../lib/db.js'
import { createChildLogger } from '../../../lib/logger.js'
import * as Sentry from '@sentry/node'

const logger = createChildLogger('openFGASync')

function buildFGAClient(): OpenFgaClient {
  return new OpenFgaClient({
    apiUrl: process.env['OPENFGA_API_URL'] ?? 'http://localhost:8080',
    storeId: process.env['OPENFGA_STORE_ID'] ?? '',
  })
}

export async function syncUserGroups(userId: string, appId: string): Promise<void> {
  try {
    const memberships = await db.appUserGroupMember.findMany({
      where: { group: { appId }, identifier: userId },
      include: { group: true },
    })

    if (memberships.length === 0) return

    const fgaClient = buildFGAClient()

    await fgaClient.write({
      writes: memberships.map(m => ({
        user: `user:${userId}`,
        relation: 'member',
        object: `group:${appId}:${m.group.name}`,
      })),
    })
  } catch (err) {
    // OpenFGA sync failure must not block login
    const error = err instanceof Error ? err : new Error(String(err))
    logger.warn({ err: error.message, userId, appId }, 'OpenFGA group sync failed — login continues')
    Sentry.captureException(error, { extra: { userId, appId } })
  }
}
