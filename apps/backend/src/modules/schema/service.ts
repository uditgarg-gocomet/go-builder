import crypto from 'node:crypto'
import * as jsonpatch from 'fast-json-patch'
import semver from 'semver'
import { Prisma } from '@prisma/client'
import { db } from '../../lib/db.js'
import { createChildLogger } from '../../lib/logger.js'
import type { SaveDraftRequest, PromoteRequest, RollbackRequest, ComponentNode } from './types.js'

const logger = createChildLogger('schema')

const CONCURRENT_EDIT_WINDOW_MS = 30_000
const INITIAL_VERSION = '0.1.0'
const MAX_SCHEMA_BYTES = 5 * 1024 * 1024 // 5MB
const DRAFT_SNAPSHOT_LIMIT = 50 // rolling cap per page

// ── Registry validation ────────────────────────────────────────────────────────

function collectComponentTypes(node: ComponentNode, types: Set<string> = new Set()): Set<string> {
  types.add(node.type)
  for (const child of node.children ?? []) {
    collectComponentTypes(child, types)
  }
  return types
}

async function validateSchemaComponents(layout: ComponentNode): Promise<{ valid: boolean; error?: string }> {
  const types = collectComponentTypes(layout)
  if (types.size === 0) return { valid: true }

  const entries = await db.registryEntry.findMany({
    where: { name: { in: Array.from(types) }, status: 'ACTIVE' },
    select: { name: true },
  })

  const registered = new Set(entries.map(e => e.name))
  const unknown = Array.from(types).filter(t => !registered.has(t))

  if (unknown.length > 0) {
    return {
      valid: false,
      error: `Unknown or inactive component types: ${unknown.join(', ')}`,
    }
  }
  return { valid: true }
}

// ── saveDraft ─────────────────────────────────────────────────────────────────

export interface SaveDraftResult {
  version: { id: string; version: string; status: string; createdAt: Date }
  concurrentEditWarning: boolean
}

export async function saveDraft(request: SaveDraftRequest): Promise<SaveDraftResult> {
  const { pageId, schema, savedBy } = request

  // Size guard
  const schemaBytes = Buffer.byteLength(JSON.stringify(schema), 'utf8')
  if (schemaBytes > MAX_SCHEMA_BYTES) {
    throw Object.assign(new Error('Schema exceeds 5MB limit'), { statusCode: 413 })
  }

  // Verify page exists
  const page = await db.page.findUnique({ where: { id: pageId } })
  if (!page) throw Object.assign(new Error('Page not found'), { statusCode: 404 })

  // Registry validation
  const validation = await validateSchemaComponents(schema.layout)
  if (!validation.valid) {
    throw Object.assign(new Error(validation.error!), { statusCode: 400 })
  }

  // Concurrent edit detection (30s window, different user)
  const recentCutoff = new Date(Date.now() - CONCURRENT_EDIT_WINDOW_MS)
  const recentDraft = await db.pageVersion.findFirst({
    where: {
      pageId,
      status: 'DRAFT',
      createdAt: { gte: recentCutoff },
      createdBy: { not: savedBy },
    },
    orderBy: { createdAt: 'desc' },
  })
  const concurrentEditWarning = !!recentDraft

  // Determine current version string (carry over from latest — no bump on draft)
  const latestVersion = await db.pageVersion.findFirst({
    where: { pageId },
    orderBy: { createdAt: 'desc' },
  })
  const currentVersionStr = latestVersion?.version ?? INITIAL_VERSION

  // Compute JSON Patch diff from previous
  let diffFromPrev: object | null = null
  if (latestVersion) {
    try {
      const prev = latestVersion.schema as object
      const patches = jsonpatch.compare(prev, schema as unknown as object)
      diffFromPrev = patches
    } catch {
      // Non-critical — proceed without diff
    }
  }

  // Upsert the DRAFT for this (pageId, version) pair so repeated saves don't conflict
  const newVersion = await db.pageVersion.upsert({
    where: { pageId_version: { pageId, version: currentVersionStr } },
    update: {
      schema: schema as unknown as object,
      diffFromPrev: diffFromPrev !== undefined ? (diffFromPrev as Prisma.InputJsonValue) : Prisma.JsonNull,
      createdBy: savedBy,
    },
    create: {
      pageId,
      version: currentVersionStr,
      schema: schema as unknown as object,
      status: 'DRAFT',
      diffFromPrev: diffFromPrev !== undefined ? (diffFromPrev as Prisma.InputJsonValue) : Prisma.JsonNull,
      createdBy: savedBy,
    },
  })

  // Snapshot the *previous* draft state before it's overwritten (if there was
  // one). This gives us a rolling last-N-edits audit trail we can revert to
  // when an accidental save blows away good content. Fire-and-forget — a
  // snapshot-insert failure must not fail the save.
  if (latestVersion && latestVersion.status === 'DRAFT') {
    void recordDraftSnapshot(pageId, latestVersion.schema, latestVersion.createdBy).catch(err => {
      logger.warn({ err, pageId }, 'Failed to record draft snapshot')
    })
  }

  return {
    version: {
      id: newVersion.id,
      version: newVersion.version,
      status: newVersion.status,
      createdAt: newVersion.createdAt,
    },
    concurrentEditWarning,
  }
}

// ── Draft snapshot history ────────────────────────────────────────────────────
// Captures the draft schema *before* it's overwritten by a subsequent save,
// so users can revert to prior states. Dedupes by content hash — identical
// saves don't bloat the history. Rolling cap at DRAFT_SNAPSHOT_LIMIT per page.

function hashSchema(schema: unknown): string {
  const json = JSON.stringify(schema)
  return crypto.createHash('sha256').update(json).digest('hex')
}

function countNodes(layout: unknown): number {
  if (!layout || typeof layout !== 'object') return 0
  const node = layout as { children?: unknown[] }
  let n = 1
  for (const child of node.children ?? []) {
    n += countNodes(child)
  }
  return n
}

async function recordDraftSnapshot(
  pageId: string,
  schema: unknown,
  createdBy: string,
  label?: string,
): Promise<void> {
  const hash = hashSchema(schema)

  // Dedupe: skip if the most recent snapshot already has this exact content.
  const last = await db.draftSnapshot.findFirst({
    where: { pageId },
    orderBy: { createdAt: 'desc' },
    select: { schemaHash: true },
  })
  if (last?.schemaHash === hash) return

  const json = JSON.stringify(schema)
  const layout = (schema as { layout?: unknown } | null | undefined)?.layout
  await db.draftSnapshot.create({
    data: {
      pageId,
      schema: schema as Prisma.InputJsonValue,
      schemaHash: hash,
      nodeCount: countNodes(layout),
      size: Buffer.byteLength(json, 'utf8'),
      label: label ?? null,
      createdBy,
    },
  })

  // Enforce rolling cap — delete oldest beyond DRAFT_SNAPSHOT_LIMIT.
  const total = await db.draftSnapshot.count({ where: { pageId } })
  if (total > DRAFT_SNAPSHOT_LIMIT) {
    const excess = total - DRAFT_SNAPSHOT_LIMIT
    const toDelete = await db.draftSnapshot.findMany({
      where: { pageId },
      orderBy: { createdAt: 'asc' },
      take: excess,
      select: { id: true },
    })
    if (toDelete.length > 0) {
      await db.draftSnapshot.deleteMany({
        where: { id: { in: toDelete.map(s => s.id) } },
      })
    }
  }
}

export interface DraftSnapshotSummary {
  id: string
  nodeCount: number
  size: number
  label: string | null
  createdBy: string
  createdAt: Date
}

export async function listDraftSnapshots(pageId: string): Promise<DraftSnapshotSummary[]> {
  const page = await db.page.findUnique({ where: { id: pageId } })
  if (!page) throw Object.assign(new Error('Page not found'), { statusCode: 404 })

  const snapshots = await db.draftSnapshot.findMany({
    where: { pageId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, nodeCount: true, size: true, label: true, createdBy: true, createdAt: true },
  })
  return snapshots
}

export async function restoreDraftSnapshot(
  pageId: string,
  snapshotId: string,
  restoredBy: string,
): Promise<SaveDraftResult> {
  const page = await db.page.findUnique({ where: { id: pageId } })
  if (!page) throw Object.assign(new Error('Page not found'), { statusCode: 404 })

  const snapshot = await db.draftSnapshot.findUnique({ where: { id: snapshotId } })
  if (!snapshot) throw Object.assign(new Error('Snapshot not found'), { statusCode: 404 })
  if (snapshot.pageId !== pageId) {
    throw Object.assign(new Error('Snapshot does not belong to this page'), { statusCode: 400 })
  }

  // Route back through saveDraft so all the usual machinery runs — registry
  // validation, pre-overwrite snapshot of the current draft, diff computation,
  // etc. This means restoring itself captures a snapshot of whatever was
  // there, so a restore can always be undone.
  return saveDraft({
    pageId,
    schema: snapshot.schema as unknown as SaveDraftRequest['schema'],
    savedBy: restoredBy,
  })
}

// ── getDraft ──────────────────────────────────────────────────────────────────

export async function getDraft(pageId: string): Promise<{ schema: object } | null> {
  const page = await db.page.findUnique({ where: { id: pageId } })
  if (!page) throw Object.assign(new Error('Page not found'), { statusCode: 404 })

  const draft = await db.pageVersion.findFirst({
    where: { pageId, status: 'DRAFT' },
    orderBy: { createdAt: 'desc' },
    select: { schema: true },
  })

  if (!draft) return null
  return { schema: draft.schema as object }
}

// ── promoteToStaging ──────────────────────────────────────────────────────────

export async function promoteToStaging(
  versionId: string,
  request: PromoteRequest
): Promise<{ deploymentId: string; version: string }> {
  return _promote(versionId, 'STAGING', request)
}

// ── promoteToProduction ───────────────────────────────────────────────────────

export async function promoteToProduction(
  versionId: string,
  request: PromoteRequest
): Promise<{ deploymentId: string; version: string }> {
  const version = await db.pageVersion.findUnique({ where: { id: versionId } })
  if (!version) throw Object.assign(new Error('Page version not found'), { statusCode: 404 })
  if (version.status !== 'STAGED') {
    throw Object.assign(
      new Error('Only STAGED versions can be promoted to production'),
      { statusCode: 409 }
    )
  }
  return _promote(versionId, 'PRODUCTION', request)
}

async function _promote(
  versionId: string,
  environment: 'STAGING' | 'PRODUCTION',
  request: PromoteRequest
): Promise<{ deploymentId: string; version: string }> {
  const { bumpType, changelog, promotedBy } = request

  const version = await db.pageVersion.findUnique({
    where: { id: versionId },
    include: { page: true },
  })
  if (!version) throw Object.assign(new Error('Page version not found'), { statusCode: 404 })

  if (environment === 'STAGING' && !['DRAFT'].includes(version.status)) {
    throw Object.assign(
      new Error('Only DRAFT versions can be promoted to staging'),
      { statusCode: 409 }
    )
  }

  // Bump semver
  const bumped = semver.inc(version.version, bumpType)
  if (!bumped) throw Object.assign(new Error('Invalid version — cannot increment'), { statusCode: 500 })

  // Update version record
  const newStatus = environment === 'STAGING' ? 'STAGED' : 'PUBLISHED'
  await db.pageVersion.update({
    where: { id: versionId },
    data: {
      status: newStatus,
      version: bumped,
      changelog,
      promotedAt: new Date(),
      promotedBy,
    },
  })

  // Create Deployment record (PENDING)
  const deployment = await db.deployment.create({
    data: {
      appId: version.page.appId,
      environment,
      buildStatus: 'PENDING',
      deployedBy: promotedBy,
    },
  })

  // Link version to deployment
  await db.deploymentPage.create({
    data: {
      deploymentId: deployment.id,
      pageVersionId: versionId,
    },
  })

  // Fire build webhook and update to BUILDING, then SUCCESS.
  //
  // POC note: the Renderer in this POC reads schemas at request time with
  // `cache: 'no-store'` (see apps/renderer/src/app/[appSlug]/[pageSlug]/page.tsx),
  // so there is no actual CI build to wait for. The build webhook in this POC
  // only triggers an on-demand revalidation of static paths — it completes
  // quickly and doesn't call back to the backend to report status.
  //
  // The deployment query used by the Renderer (`getDeployment`) requires
  // `buildStatus = 'SUCCESS'`. If we leave deployments stuck at BUILDING, the
  // Renderer gets a 404 for every newly-promoted app. We therefore transition
  // PENDING → BUILDING → SUCCESS right after the webhook returns.
  //
  // Post-POC, when CI actually builds per-tenant Docker images, the status
  // should only become SUCCESS when the webhook receiver (or CI itself) calls
  // `PATCH /apps/deployments/:id/status` to report a completed build.
  triggerBuild(versionId, environment, deployment.id).then(async () => {
    await db.deployment.update({
      where: { id: deployment.id },
      data: { buildStatus: 'BUILDING' },
    })
    await db.deployment.update({
      where: { id: deployment.id },
      data: { buildStatus: 'SUCCESS' },
    })
  }).catch(async err => {
    logger.error({ err, deploymentId: deployment.id }, 'Build webhook failed')
    await db.deployment.update({
      where: { id: deployment.id },
      data: { buildStatus: 'FAILED' },
    }).catch(() => undefined)
  })

  return { deploymentId: deployment.id, version: bumped }
}

// ── rollback ──────────────────────────────────────────────────────────────────

export async function rollback(
  pageId: string,
  request: RollbackRequest
): Promise<{ deploymentId: string }> {
  const { targetVersionId, rolledBackBy } = request

  // Find current PUBLISHED version
  const currentPublished = await db.pageVersion.findFirst({
    where: { pageId, status: 'PUBLISHED' },
  })

  if (currentPublished) {
    await db.pageVersion.update({
      where: { id: currentPublished.id },
      data: { status: 'ROLLED_BACK' },
    })
  }

  // Reinstate target version as PUBLISHED
  const targetVersion = await db.pageVersion.findUnique({ where: { id: targetVersionId } })
  if (!targetVersion || targetVersion.pageId !== pageId) {
    throw Object.assign(new Error('Target version not found for this page'), { statusCode: 404 })
  }

  await db.pageVersion.update({
    where: { id: targetVersionId },
    data: { status: 'PUBLISHED', promotedAt: new Date(), promotedBy: rolledBackBy },
  })

  // Get appId for deployment
  const page = await db.page.findUnique({ where: { id: pageId } })
  if (!page) throw Object.assign(new Error('Page not found'), { statusCode: 404 })

  // Create deployment record for the rollback
  const deployment = await db.deployment.create({
    data: {
      appId: page.appId,
      environment: 'PRODUCTION',
      buildStatus: 'PENDING',
      deployedBy: rolledBackBy,
    },
  })

  await db.deploymentPage.create({
    data: { deploymentId: deployment.id, pageVersionId: targetVersionId },
  })

  // Fire build webhook for production
  triggerBuild(targetVersionId, 'PRODUCTION', deployment.id).then(async () => {
    await db.deployment.update({
      where: { id: deployment.id },
      data: { buildStatus: 'BUILDING' },
    })
  }).catch(err => {
    logger.error({ err, deploymentId: deployment.id }, 'Rollback build webhook failed')
  })

  return { deploymentId: deployment.id }
}

// ── getHistory ────────────────────────────────────────────────────────────────

export async function getHistory(pageId: string) {
  const page = await db.page.findUnique({ where: { id: pageId } })
  if (!page) throw Object.assign(new Error('Page not found'), { statusCode: 404 })

  return db.pageVersion.findMany({
    where: { pageId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      version: true,
      status: true,
      changelog: true,
      createdBy: true,
      createdAt: true,
      promotedAt: true,
      promotedBy: true,
    },
  })
}

// ── getDiff ───────────────────────────────────────────────────────────────────

export async function getDiff(pageId: string, fromVersionId: string, toVersionId: string) {
  const [from, to] = await Promise.all([
    db.pageVersion.findUnique({ where: { id: fromVersionId } }),
    db.pageVersion.findUnique({ where: { id: toVersionId } }),
  ])

  if (!from || from.pageId !== pageId) {
    throw Object.assign(new Error(`Version "${fromVersionId}" not found for this page`), { statusCode: 404 })
  }
  if (!to || to.pageId !== pageId) {
    throw Object.assign(new Error(`Version "${toVersionId}" not found for this page`), { statusCode: 404 })
  }

  // Use stored diff if available, otherwise compute
  if (to.diffFromPrev) {
    return { diff: to.diffFromPrev, from: from.version, to: to.version }
  }

  const patches = jsonpatch.compare(from.schema as object, to.schema as object)
  return { diff: patches, from: from.version, to: to.version }
}

// ── triggerBuild ──────────────────────────────────────────────────────────────

export async function triggerBuild(
  pageVersionId: string,
  environment: 'STAGING' | 'PRODUCTION',
  deploymentId: string
): Promise<void> {
  const webhookUrl = process.env['RENDERER_BUILD_WEBHOOK']
  const secret = process.env['BUILD_WEBHOOK_SECRET']

  if (!webhookUrl || !secret) {
    logger.warn({ deploymentId }, 'Build webhook not configured — skipping')
    return
  }

  const payload = { deploymentId, pageVersionId, environment }
  const body = JSON.stringify(payload)
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex')

  await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-build-signature': signature,
    },
    body,
  })
}
