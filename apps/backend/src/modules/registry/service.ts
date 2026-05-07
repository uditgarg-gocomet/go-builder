import { Prisma } from '@prisma/client'
import { db } from '../../lib/db.js'
import { createChildLogger } from '../../lib/logger.js'
import type { RegisterCustomWidgetRequest, SavePrebuiltViewRequest, DeprecateEntryRequest } from './types.js'

const logger = createChildLogger('registry')

const INITIAL_VERSION = '1.0.0'

// ── listForApp ────────────────────────────────────────────────────────────────

export async function listForApp(appId: string) {
  const entries = await db.registryEntry.findMany({
    where: {
      status: { in: ['ACTIVE', 'DEPRECATED'] },
      OR: [
        { scope: 'COMMON' },
        { scope: 'TENANT_LOCAL', ownedBy: appId },
      ],
    },
    include: {
      versions: {
        orderBy: { publishedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })

  return entries.map(e => ({
    id: e.id,
    name: e.name,
    type: e.type,
    scope: e.scope,
    status: e.status,
    currentVersion: e.currentVersion,
    sourceType: e.sourceType,
    currentVersionDetails: e.versions[0] ?? null,
  }))
}

// ── getEntry ──────────────────────────────────────────────────────────────────

export async function getEntry(name: string, version?: string) {
  const entry = await db.registryEntry.findFirst({
    where: { name },
    include: {
      versions: version
        ? { where: { version } }
        : { orderBy: { publishedAt: 'desc' }, take: 1 },
    },
  })

  if (!entry) {
    throw Object.assign(new Error(`Registry entry "${name}" not found`), { statusCode: 404 })
  }

  return {
    ...entry,
    currentVersionDetails: entry.versions[0] ?? null,
  }
}

// ── getPropsSchema ────────────────────────────────────────────────────────────

export async function getPropsSchema(componentNames: string[]): Promise<Record<string, unknown>> {
  if (componentNames.length === 0) return {}

  const entries = await db.registryEntry.findMany({
    where: { name: { in: componentNames }, status: 'ACTIVE' },
    include: {
      versions: { orderBy: { publishedAt: 'desc' }, take: 1 },
    },
  })

  const result: Record<string, unknown> = {}
  for (const entry of entries) {
    const latestVersion = entry.versions[0]
    if (latestVersion) {
      result[entry.name] = latestVersion.propsSchema
    }
  }

  return result
}

// ── registerCustomWidget ──────────────────────────────────────────────────────

export async function registerCustomWidget(request: RegisterCustomWidgetRequest) {
  const {
    name, displayName, description, category, icon, tags,
    version, bundleUrl, bundleHash, propsSchema, defaultProps,
    appId, registeredBy,
  } = request

  // Check for name collision in COMMON scope
  const existing = await db.registryEntry.findFirst({
    where: { name, scope: 'COMMON' },
  })
  if (existing) {
    throw Object.assign(
      new Error(`A common registry entry named "${name}" already exists`),
      { statusCode: 409 }
    )
  }

  const scope = appId ? 'TENANT_LOCAL' : 'COMMON'
  const ownedBy = appId ?? 'platform'

  const entry = await db.registryEntry.create({
    data: {
      name,
      type: 'CUSTOM_WIDGET',
      scope,
      status: 'ACTIVE',
      currentVersion: version,
      sourceType: 'EXTERNAL_PLATFORM',
      ownedBy,
      createdBy: registeredBy,
    },
  })

  const entryVersion = await db.registryEntryVersion.create({
    data: {
      entryId: entry.id,
      version,
      propsSchema: propsSchema as Prisma.InputJsonValue,
      defaultProps: defaultProps as Prisma.InputJsonValue,
      bundleUrl: bundleUrl ?? null,
      bundleHash: bundleHash ?? null,
      displayName,
      description: description ?? null,
      category,
      icon: icon ?? null,
      tags,
      publishedBy: registeredBy,
    },
  })

  logger.info({ entryId: entry.id, name }, 'Custom widget registered')
  return { entry, version: entryVersion }
}

// ── savePrebuiltView ──────────────────────────────────────────────────────────

export async function savePrebuiltView(request: SavePrebuiltViewRequest) {
  const {
    name, displayName, description, category, icon, tags,
    viewSchema, propsSchema, defaultProps, appId, savedBy,
  } = request

  // Upsert: update existing or create new
  const existing = await db.registryEntry.findFirst({
    where: { name, scope: 'TENANT_LOCAL', ownedBy: appId },
  })

  let entry
  if (existing) {
    entry = existing
  } else {
    entry = await db.registryEntry.create({
      data: {
        name,
        type: 'PREBUILT_VIEW',
        scope: 'TENANT_LOCAL',
        status: 'ACTIVE',
        currentVersion: INITIAL_VERSION,
        sourceType: 'COMPOSED',
        ownedBy: appId,
        createdBy: savedBy,
      },
    })
  }

  // Increment version for updates
  const existingVersions = await db.registryEntryVersion.findMany({
    where: { entryId: entry.id },
    orderBy: { publishedAt: 'desc' },
  })
  const nextVersion = existingVersions.length === 0
    ? INITIAL_VERSION
    : incrementPatch(existingVersions[0]!.version)

  const entryVersion = await db.registryEntryVersion.create({
    data: {
      entryId: entry.id,
      version: nextVersion,
      propsSchema: propsSchema as Prisma.InputJsonValue,
      defaultProps: defaultProps as Prisma.InputJsonValue,
      viewSchema: viewSchema as Prisma.InputJsonValue,
      displayName,
      description: description ?? null,
      category,
      icon: icon ?? null,
      tags,
      publishedBy: savedBy,
    },
  })

  await db.registryEntry.update({
    where: { id: entry.id },
    data: { currentVersion: nextVersion },
  })

  logger.info({ entryId: entry.id, name }, 'Prebuilt view saved')
  return { entry, version: entryVersion }
}

function incrementPatch(version: string): string {
  const parts = version.split('.').map(Number)
  if (parts.length !== 3) return INITIAL_VERSION
  return `${parts[0]}.${parts[1]}.${(parts[2] ?? 0) + 1}`
}

// ── deprecate ─────────────────────────────────────────────────────────────────

export async function deprecate(id: string, request: DeprecateEntryRequest) {
  const { reason, replacedBy, deprecatedBy } = request

  const entry = await db.registryEntry.findUnique({ where: { id } })
  if (!entry) {
    throw Object.assign(new Error('Registry entry not found'), { statusCode: 404 })
  }
  if (entry.status === 'DEPRECATED') {
    throw Object.assign(new Error('Entry is already deprecated'), { statusCode: 409 })
  }

  const updated = await db.registryEntry.update({
    where: { id },
    data: { status: 'DEPRECATED' },
  })

  logger.info({ entryId: id, reason, replacedBy, deprecatedBy }, 'Registry entry deprecated')
  return updated
}
