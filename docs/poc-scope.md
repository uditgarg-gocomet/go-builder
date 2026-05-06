# POC Scope Document
## Client Portal App Builder Platform

**Version:** 1.0  
**Status:** Draft — pending team review  
**Last updated:** May 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Deployable Units](#deployable-units)
3. [Service 1 — Core Backend](#service-1--core-backend)
4. [Service 2 — App Builder](#service-2--app-builder)
5. [Service 3 — App Renderer Engine](#service-3--app-renderer-engine)
6. [Service 4 — Shared Packages](#service-4--shared-packages)
7. [Data Model — Consolidated Prisma Schema](#data-model--consolidated-prisma-schema)
8. [Stack Summary](#stack-summary)
9. [Open Items](#open-items)

---

## Overview

The platform enables FDEs (Field Deployment Engineers) to build and deploy client-facing portals via a drag-and-drop App Builder without writing new React components for each client. FDEs compose portals from a registry of primitive components and custom widgets, configure data sources, define actions, and publish directly to a client-specific URL — all without a code deployment.

### Core Objective

> Enable FDEs to deploy client-facing portals via an App Builder (drag and drop with JSON output) without writing new React components for each client.

### Design Principles

- **POC first** — build the minimum that proves the concept end to end
- **Unified backend** — all backend logic in one Fastify process, isolated as modules
- **Schema as contract** — JSON page schema is the single source of truth between Builder and Renderer
- **Separate tenants by deployment** — each client gets their own Renderer deployment; no multi-tenancy in application code
- **Clean module boundaries** — modules inside Core Backend are isolated; extraction post-POC is lift-and-shift

---

## Deployable Units

Four deployable units for the POC:

| Unit | Technology | Port | Purpose |
|---|---|---|---|
| Core Backend | Fastify + TypeScript | 3001 | All backend logic — 8 internal modules |
| App Builder | Next.js (App Router) | 3000 | FDE drag-and-drop portal builder |
| App Renderer | Next.js (App Router) | 3002 | Client-facing portal — one per tenant |
| Infrastructure | Postgres 16 + Redis 7 + OpenFGA | 5432 / 6379 / 8080 | Data, cache, authorization |

Shared packages (`/packages/core`, `/packages/ui`, `/packages/action-runtime`) are bundled into Builder and Renderer at build time. They are never deployed independently and are never consumed by Core Backend at runtime.

---

## Service 1 — Core Backend

### Purpose

The Core Backend is the single server-side process that owns all persistence, business logic, auth, and outbound HTTP execution for the platform. It is the only deployable backend unit in the POC. Every other service (Builder, Renderer) communicates with it over HTTP.

### Boundaries

**Owns:**
- All Postgres data — apps, pages, schemas, registry, auth tokens, assets, logs
- All Redis operations — session revocation, rate limiting, preview cache, concurrency counters
- OIDC and SAML flows for both FDE and portal end users
- JWT issuance and validation
- Outbound HTTP execution to external APIs (connector module)
- Component and endpoint registry
- Asset storage and delivery
- Action execution audit log

**Does not own:**
- Rendering logic — Renderer's responsibility
- Canvas state — Builder's responsibility
- Client-side action execution — action-runtime package
- Component UI implementations — ui package

### Internal Modules

Each module is a self-contained folder with its own router, service, and types. Modules share a single Prisma client, a single Redis client, and a single logger instance from `/lib`. No module imports another module's internal implementation — only its public service interface.

```
/src
  /modules
    /apps                 CRUD for App + Page entities
    /schema               PageVersion lifecycle — save, promote, rollback
    /registry             Component + widget + prebuilt view catalog
    /endpoint-registry    Connector + EndpointDef catalog
    /connector            HTTP execution, rate limiting, response cache, audit
    /auth                 OIDC, SAML, JWT, session management, OpenFGA sync
    /assets               File upload, validation, deduplication, delivery
    /action-logs          Action execution audit trail
  /lib
    db.ts                 Single Prisma client instance
    redis.ts              Single Redis client instance
    secrets.ts            SecretsProvider interface (AES-256-GCM for POC)
    logger.ts             pino logger factory
    sentry.ts             Sentry initialisation
```

### Stack

| Concern | Decision | Reason |
|---|---|---|
| Framework | Fastify | Schema-first, fast, excellent TypeScript support |
| Language | TypeScript | End-to-end type safety across all modules |
| ORM | Prisma | Type-safe queries, migration tooling, single schema file |
| Database | PostgreSQL 16 | Relational + jsonb for schema blobs |
| Cache | Redis 7 | Sessions, rate limiting, preview cache |
| Internal API | tRPC routers where Builder calls are type-safe | Zero schema drift between caller and handler |
| External API | REST endpoints for Renderer (build-time fetch) | Renderer is a separate deployment |
| JWT | jose + RS256 | Asymmetric — public key shareable via JWKS |
| OIDC | openid-client | Most complete Node.js OIDC library, full PKCE support |
| SAML | samlify | SAML 2.0, SP-initiated and IdP-initiated flows |
| Password hashing | argon2 | Best-in-class, GPU-attack resistant |
| Secret storage | AES-256-GCM at app layer | Abstracted behind SecretsProvider — swap to Vault post-POC |
| Validation | Zod | Paired with tRPC, reused across modules |
| Error tracking | Sentry | Errors, slow requests, release tracking |
| Logging | pino | Structured JSON logs, low overhead |

### Architecture

#### Request Flow

```
Inbound request
      │
      ▼
Fastify router (prefix-based module routing)
      │
      ├── /auth/*          → auth module
      ├── /apps/*          → apps module
      ├── /schema/*        → schema module
      ├── /registry/*      → registry module
      ├── /endpoints/*     → endpoint-registry module
      ├── /connector/*     → connector module
      ├── /assets/*        → assets module
      ├── /action-logs/*   → action-logs module
      ├── /health          → health check handler
      └── /.well-known/jwks.json → JWKS handler
```

#### Module Interface Pattern

Every module exposes a clean service layer. Other modules call the service, never the router or internal implementation:

```typescript
// modules/connector/service.ts — public interface
export const connectorService = {
  execute:         (params: ExecuteParams) => executor.execute(params),
  getEndpoint:     (id: string)            => db.endpointDef.findUnique({ where: { id } }),
  invalidateCache: (endpointId: string)    => cache.invalidate(endpointId)
}
```

#### Shared Lib Singletons

```typescript
// lib/db.ts
import { PrismaClient } from '@prisma/client'
export const db = new PrismaClient()

// lib/redis.ts
import { Redis } from 'ioredis'
export const redis = new Redis(process.env.REDIS_URL)

// lib/secrets.ts
interface SecretsProvider {
  store(key: string, value: object): Promise<string>
  resolve(ref: string): Promise<object>
}
// POC: AES-256-GCM encryption, key from env var
// Post-POC: swap to VaultProvider without changing callers
```

---

### Module 1.1 — Apps

#### Purpose
CRUD for the top-level App entity and its Pages. An App maps to a client portal. Pages are the individual routes within that portal.

#### API Surface

| Method | Path | Description |
|---|---|---|
| POST | /apps | Create a new app |
| GET | /apps | List all apps (FDE has access to) |
| GET | /apps/:id | Get app by ID |
| PATCH | /apps/:id | Update app metadata |
| POST | /apps/:id/pages | Add a page to an app |
| GET | /apps/:id/pages | List all pages for an app |
| PATCH | /apps/:id/pages/:pageId | Update page metadata |
| DELETE | /apps/:id/pages/:pageId | Delete a page |
| GET | /apps/:slug/deployment/:env | Renderer build-time fetch — published schema |
| GET | /apps/:id/members | List app members |
| POST | /apps/:id/members | Add a member |
| PATCH | /apps/:id/members/:userId | Update member role |
| DELETE | /apps/:id/members/:userId | Remove a member |

#### Key Decisions

- App `slug` is unique and maps directly to the portal URL subdomain
- Pages have an `order` field — FDE controls navigation order
- `AppMember` roles: `OWNER` (publish, manage members), `EDITOR` (edit, stage), `VIEWER` (read-only)
- `ADMIN` FDE role bypasses `AppMember` check and can access all apps

#### POC Scope

```
✅ App CRUD — create, read, update
✅ Page CRUD — create, read, update, delete, reorder
✅ AppMember CRUD — add, update role, remove
✅ GET /apps/:slug/deployment/:env — Renderer's build-time dependency
✅ Basic slug uniqueness validation
✅ FDE role check on all write operations
```

#### Out of Scope

```
❌ Soft delete / archive for apps
❌ App duplication / cloning
❌ App transfer between FDE accounts
```

#### Edge Cases

| Case | Handling |
|---|---|
| Duplicate slug on create | Return 409 — slug already taken |
| Delete page referenced in deployment | Block delete — return 409 with deployment reference |
| Last OWNER removed | Block removal — app must always have one OWNER |
| FDE without AppMember record tries to edit | Return 403 unless FDE role is ADMIN |

---

### Module 1.2 — Schema & Version Control

#### Purpose
Owns the complete lifecycle of a page's JSON schema — from first draft through staging to production. Every save creates a new `PageVersion`. Promotes trigger a build webhook to the Renderer.

#### API Surface

| Method | Path | Description |
|---|---|---|
| POST | /schema/draft | Save draft PageVersion |
| POST | /schema/:versionId/promote/staging | Promote draft → staging |
| POST | /schema/:versionId/promote/production | Promote staged → production |
| POST | /schema/:pageId/rollback | Roll back to a previous version |
| GET | /schema/:pageId/history | Version history for a page |
| GET | /schema/:pageId/diff | Diff between two versions |

#### Schema Format

```typescript
interface PageSchema {
  pageId:      string
  appId:       string
  version:     string           // semver e.g. 1.2.0
  meta: {
    title:       string
    slug:        string         // /dashboard
    order:       number
    auth: {
      required:  boolean
      groups:    string[]       // OpenFGA group names
    }
  }
  layout:      ComponentNode    // root of component tree
  dataSources: DataSourceDef[]
  actions:     ActionDef[]
  forms:       FormDef[]
  state:       StateSlotDef[]
  theme:       ThemeOverride?
  params:      PageParamDef[]
}

interface ComponentNode {
  id:         string
  type:       string
  source:     'primitive' | 'custom_widget' | 'prebuilt_view'
  props:      Record<string, any>
  bindings:   Record<string, string>  // {{datasource.x.y}}
  actions:    ActionBinding[]
  style:      StyleOverride
  responsive: { tablet?: Partial<PropsAndStyle>; mobile?: Partial<PropsAndStyle> }
  children:   ComponentNode[]
  dataSource?: ComponentDataSource
}
```

#### Key Decisions

| Decision | Choice |
|---|---|
| Schema format | JSON only — no YAML |
| Storage | jsonb column in Postgres |
| Versioning | Page-level — each page versioned independently |
| Semver bump | FDE chooses major / minor / patch on promote |
| Changelog | Optional on save, required on promote |
| Concurrent edits | Last write wins + concurrent edit warning flag returned |
| Validation | Against component registry at save time |
| Diff format | JSON Patch RFC 6902 via fast-json-patch |
| Environments | STAGING and PRODUCTION per app |
| Renderer fetch | Build-time — schema fetched during `next build` |

#### Build Trigger

On every successful promote, the schema module fires a webhook to the Renderer's build pipeline:

```typescript
async function triggerBuild(
  pageVersionId: string,
  environment:   'STAGING' | 'PRODUCTION',
  deploymentId:  string
) {
  await fetch(process.env.RENDERER_BUILD_WEBHOOK, {
    method:  'POST',
    headers: { 'x-build-signature': sign(process.env.BUILD_WEBHOOK_SECRET) },
    body:    JSON.stringify({ deploymentId, pageVersionId, environment })
  })
}
```

#### POC Scope

```
✅ saveDraft — registry validation + concurrent edit warning
✅ promoteToStaging — semver bump picker + required changelog
✅ promoteToProduction
✅ Rollback — reinstate previous PUBLISHED version + trigger build
✅ Version history — list with status, changelog, who promoted
✅ Diff storage — JSON Patch computed on every save
✅ Build webhook — fired on staging + production promote
✅ Deployment record — PENDING → BUILDING → SUCCESS / FAILED
```

#### Out of Scope

```
❌ Page-level diff UI rendering (diff stored, UI deferred)
❌ Multi-page atomic publish (publish individual pages only)
❌ Scheduled publish
```

#### Edge Cases

| Case | Handling |
|---|---|
| Renderer build fails | Deployment status → FAILED, previous version remains live |
| Concurrent promote by two FDEs | Second promote rejected — only one STAGED version per page |
| Rollback to version currently on staging | Allowed — staging and production track independently |
| Registry validation fails on save | Return 400 with specific component + prop that failed |
| Schema too large (> 5MB) | Return 413 — enforce at API layer |

---

### Module 1.3 — Registry

#### Purpose
Catalog of all components and prebuilt views available to the Builder. Two-tier model: common (shared across all tenants) and tenant-local (private until published).

#### Component Categories

| Type | Description | Source |
|---|---|---|
| PRIMITIVE | Atomic UI building blocks — Button, DataTable, Chart | Platform team, always common |
| CUSTOM_WIDGET | Built by internal platform teams, delivered via npm | External platforms, start local |
| PREBUILT_VIEW | Saved compositions of components built by FDEs | Builder output, start local |

#### Two-Tier Model

```
Common registry              Tenant-local registry
─────────────────────────    ─────────────────────────
Primitives (always)          Custom widgets
Published custom widgets      Local prebuilt views
Published prebuilt views
                             ← publish with platform team review
```

#### API Surface

| Method | Path | Description |
|---|---|---|
| GET | /registry/entries | List available entries for an app |
| GET | /registry/entries/:name | Get entry with current version details |
| GET | /registry/props-schema | Batch fetch props schemas for validation |
| POST | /registry/custom-widget | Register a new custom widget |
| POST | /registry/prebuilt-view | Save a prebuilt view |
| POST | /registry/entries/:id/publish | Submit for common registry review |
| POST | /registry/entries/:id/deprecate | Deprecate an entry |
| GET | /registry/review-requests | List pending review requests (platform team) |
| POST | /registry/review-requests/:id/approve | Approve publish to common |
| POST | /registry/review-requests/:id/reject | Reject publish to common |

#### Props Schema Convention

Every primitive exports a Zod schema. This is stored in the registry and used for Builder prop editor generation and save-time validation:

```typescript
// packages/ui/src/primitives/DataTable/props.schema.ts
export const DataTablePropsSchema = z.object({
  title:      z.string().default(''),
  pageSize:   z.number().min(1).max(100).default(10),
  columns:    z.array(z.object({
    key:      z.string(),
    label:    z.string(),
    sortable: z.boolean().default(false)
  })),
  striped:    z.boolean().default(false),
  searchable: z.boolean().default(false)
})

export const manifest = {
  displayName: 'Data Table',
  category:    'Data',
  description: 'Displays tabular data with sorting and pagination',
  icon:        'table',
  tags:        ['table', 'data', 'grid']
}
```

#### Key Decisions

| Decision | Choice |
|---|---|
| Widget delivery | npm publish with widgetManifest in package.json |
| Bundle hosting | Source platform CDN — URL stored in registry |
| Primitive versioning | Always latest — no pinning per page schema |
| Deprecation behaviour | Warn — pages continue to work, Builder shows warning |
| Review process | Platform team only — FDEs cannot self-approve to common |

#### POC Scope

```
✅ RegistryEntry + RegistryEntryVersion data model
✅ Seed common registry with all primitive components
✅ listForApp — returns common + tenant-local for Builder
✅ getPropsSchema — used by schema module save validation
✅ getEntry — used by Renderer component resolver
✅ registerCustomWidget — external platforms push widgets
✅ savePrebuiltView — FDE saves a composition as reusable view
✅ Deprecation warning tracking
```

#### Out of Scope

```
❌ publishToCommon + review flow (post-POC)
❌ AppRegistryAccess granular control (all apps see all common entries)
❌ Widget bundle integrity verification (post-POC)
```

#### Edge Cases

| Case | Handling |
|---|---|
| Primitive used in page schema gets deprecated | Page continues to render, Builder shows warning badge on node |
| Custom widget npm package removed from registry | Renderer falls back to ErrorBoundary for that node |
| Two FDEs publish same widget name to common | Second request rejected — name already exists in common scope |
| Prebuilt view references deprecated component | Warning propagated to view entry |

---

### Module 1.4 — Endpoint Registry

#### Purpose
Catalog of pre-registered API endpoints that FDEs can select in the Builder instead of manually configuring method, path, params, and auth. Acts as a structured contract between the FDE and the external API.

#### Concepts

- **Connector** — the parent entity. One per external system (Finance API, CRM API). Holds auth config and base URLs per environment.
- **EndpointDef** — a specific operation under a connector. Holds method, path, param definitions, response schema, and pre-computed binding paths.

#### API Surface

| Method | Path | Description |
|---|---|---|
| GET | /endpoints/connectors | List all active connectors |
| POST | /endpoints/connectors | Register a new connector |
| GET | /endpoints/connectors/:id/endpoints | List endpoints for a connector |
| GET | /endpoints/:id | Get single endpoint definition |
| POST | /endpoints | Register a new endpoint |
| POST | /endpoints/test | Test an endpoint with real params |
| PATCH | /endpoints/:id | Update endpoint definition |
| DELETE | /endpoints/:id | Deactivate endpoint |

#### Binding Path Auto-computation

When an endpoint is registered, binding paths are pre-computed from the response schema so the Builder can offer autocomplete without a real API call:

```typescript
// Response schema: { data: { rows: [{ id, amount, status }], total: number } }
// Computed paths:
// ["data.rows", "data.rows[].id", "data.rows[].amount", "data.rows[].status", "data.total"]
```

#### Custom Endpoint Fallback

FDEs always have the option to bypass the registry:

| Mode | Auth | URL | When to use |
|---|---|---|---|
| REGISTERED | From connector | From endpoint def | Standard path — always prefer |
| CUSTOM_CONNECTOR | From connector | FDE enters manually | Endpoint not registered yet |
| CUSTOM_MANUAL | FDE enters manually | FDE enters manually | Third-party or one-off |

Custom endpoint usage is logged to `CustomEndpointUsage` so the platform team can identify registration candidates.

#### Key Decisions

| Decision | Choice |
|---|---|
| Auth storage | Encrypted via SecretsProvider — never plaintext |
| Per-environment base URLs | Stored in connector config — staging + production |
| Param validation | Required path params validated before execution |
| SSRF protection | Block localhost + private IP ranges in custom URLs |

#### POC Scope

```
✅ Connector CRUD — register, list, update, deactivate
✅ EndpointDef CRUD — register, list, get, update, deactivate
✅ computeBindingPaths — auto-computed on registration
✅ POST /endpoints/test — real call, returns response + binding paths
✅ Connector auth config encryption via SecretsProvider
✅ CustomEndpointUsage logging
✅ SSRF protection on custom URL inputs
```

#### Out of Scope

```
❌ GraphQL connectors
❌ WebSocket connectors
❌ Connector health monitoring dashboard
```

#### Edge Cases

| Case | Handling |
|---|---|
| Connector base URL unreachable during test | Return 502 with timeout detail |
| Required path param missing in test request | Return 400 with missing param names |
| Custom URL targets private IP | Return 403 — SSRF protection |
| Endpoint deactivated while referenced in page schema | Connector module returns 410 — schema module marks datasource as errored |

---

### Module 1.5 — Connector

#### Purpose
Secure execution layer for all outbound HTTP calls. The only module that resolves connector credentials and makes requests to external APIs. Called directly by other modules as a function — no HTTP hop within Core Backend.

#### Execution Modes

| Mode | Auth | URL resolution |
|---|---|---|
| REGISTERED | Resolved from Connector entity | Built from EndpointDef path + params |
| CUSTOM_CONNECTOR | Resolved from Connector entity | FDE-supplied URL, interpolated |
| CUSTOM_MANUAL | FDE-supplied headers | FDE-supplied URL, interpolated |

#### Key Responsibilities

- Validate request against endpoint definition (REGISTERED mode)
- Resolve connector auth credentials via SecretsProvider
- Enforce rate limiting (sliding window, per connector per app)
- Enforce concurrency limits (configurable per connector)
- Enforce response size limits (configurable per connector)
- Cache GET responses (Redis, registered endpoints only)
- Invalidate cache on mutations
- Log every request to `ConnectorRequestLog` with correlationId
- Report errors and slow requests to Sentry

#### Rate Limiting

```
Three windows checked per request:
  per-minute  → default 60  req/min
  per-hour    → default 1000 req/hour
  per-day     → default 10000 req/day

Sliding window via Redis sorted sets.
Config stored in ConnectorRateLimit, cached in Redis for 5 minutes.
```

#### Concurrency Limiting

```
Redis counter per connector per app.
Incremented on request start, decremented in finally block.
Max concurrent requests configurable per connector.
Default: 5 concurrent requests.
Leaked locks expire after 60 seconds.
```

#### Response Size Limiting

```
Configurable per connector via ConnectorRateLimit.maxResponseSizeKb.
Default: 5120 KB (5MB).
Enforced by streaming response and counting bytes.
Content-Length header checked first as fast path.
```

#### correlationId

Every execution receives a `correlationId` from the caller. This ties the `ConnectorRequestLog` entry to the `ActionExecutionLog` entry in the action-logs module, enabling full trace of one user interaction across both logs.

#### API Surface (internal function calls only — no HTTP route exposed outside Core Backend)

```typescript
// modules/connector/service.ts
export const connectorService = {
  execute(params: ExecuteParams): Promise<ExecuteResult>
  getConfig(connectorId: string): Promise<ConnectorConfig>
  invalidateCache(endpointId: string): Promise<void>
}
```

The Renderer calls `/connector/execute` as an HTTP POST. This is the only external-facing route for this module.

#### Key Decisions

| Decision | Choice |
|---|---|
| Retry logic | Not in Connector module — Renderer errorHandling config owns this |
| GraphQL | Not supported in POC |
| Webhook delivery | Not supported — external platforms handle their own notifications |
| Request timeout | 30 seconds hard limit |
| Cache scope | GET requests only, registered endpoints only |

#### POC Scope

```
✅ POST /connector/execute — single execution endpoint
✅ REGISTERED, CUSTOM_CONNECTOR, CUSTOM_MANUAL modes
✅ Connector auth resolution — BEARER, API_KEY, OAUTH2, NONE
✅ SSRF protection — block localhost + private IPs
✅ Rate limiter — sliding window, Redis, per connector per app
✅ Concurrency limiter — configurable, Redis counter
✅ Response size enforcement — streaming, configurable limit
✅ Response cache — Redis, GET + registered endpoints only
✅ Cache invalidation — on successful mutations
✅ ConnectorRequestLog — every request logged with correlationId
✅ Sentry — errors + slow requests (> 5s)
✅ 30s request timeout
```

#### Out of Scope

```
❌ Retry logic (Renderer owns this)
❌ GraphQL execution
❌ Webhook outbound delivery
❌ Response transformation (Renderer owns JSONata transform)
```

#### Edge Cases

| Case | Handling |
|---|---|
| External API returns 5xx | Return error to Renderer — no retry |
| Rate limit exceeded | Return 429 — logged, Sentry breadcrumb |
| Concurrency limit exceeded | Return 429 — release slot in finally |
| Response exceeds size limit | Stream cancelled — return 413 |
| Request times out at 30s | Abort signal fires — return 504 |
| Connector credentials expired (OAuth2) | Attempt token refresh — if fails, return 401 |
| SSRF attempt via custom URL | Return 403 — log to Sentry as security event |

---

### Module 1.6 — Auth

#### Purpose
Single authority for identity and session management across the entire platform. Handles both FDE authentication (into Builder) and end-user authentication (into rendered portals). Issues and validates JWTs, manages refresh token rotation, enforces session revocation.

#### Two Auth Contexts

| Context | Who | IdP config |
|---|---|---|
| BUILDER | FDEs only | BuilderIdentityProvider — one or few, internal IdPs |
| PORTAL | End users | AppIdentityProvider — multiple per app, per environment, client-configured |

#### JWT Strategy

RS256 asymmetric signing. Private key signs tokens (Core Backend only). Public key distributed via JWKS endpoint to Builder, Renderer, and any other validator. Token validation does not require a call back to Core Backend — validators cache the public key from JWKS on startup.

#### Session Token Payloads

```typescript
// Builder (FDE) token
interface FDESessionToken {
  sub:         string       // FDE user id
  email:       string
  context:     'BUILDER'
  role:        'ADMIN' | 'FDE'
  idpType:     IdPType
  tokenFamily: string       // for refresh rotation + revocation
  iat:         number
  exp:         number       // 15 minutes
}

// Portal (end user) token
interface PortalSessionToken {
  sub:         string
  email:       string
  context:     'PORTAL'
  appId:       string
  environment: 'STAGING' | 'PRODUCTION'
  groups:      string[]     // OpenFGA group names — synced at login
  idpType:     IdPType
  tokenFamily: string
  iat:         number
  exp:         number       // 15 minutes
}
```

#### Refresh Token Rotation

```
On login:
  generate tokenFamily (UUID)
  issue access token (15m JWT, signed)
  generate raw refresh token (UUID)
  store argon2 hash of refresh token in Postgres
  store tokenFamily in Redis session set
  set refresh token in HttpOnly cookie

On refresh:
  verify access token (expired OK — extract tokenFamily)
  find stored token by tokenFamily
  verify argon2 hash matches cookie value
  if mismatch → reuse attack detected → revoke entire family
  if match → revoke old token → issue new token pair

On logout (single session):
  revoke tokenFamily in Postgres
  set revoked:{tokenFamily} in Redis (TTL 7d)

On logout (all sessions):
  revoke all families for this user+app in Postgres
  set revoked:{family} for all families in Redis
  clear session set in Redis
```

#### OpenFGA Sync

On every portal login, user group memberships are synced to OpenFGA:

```typescript
async function syncUserGroups(userId: string, appId: string) {
  const memberships = await db.appUserGroupMember.findMany({
    where: { group: { appId }, identifier: userId }
  })
  await fgaClient.write({
    writes: {
      tuple_keys: memberships.map(m => ({
        user:     `user:${userId}`,
        relation: 'member',
        object:   `group:${appId}:${m.group.name}`
      }))
    }
  })
}
```

#### API Surface

| Method | Path | Description |
|---|---|---|
| GET | /auth/builder/idps | List enabled Builder IdPs |
| GET | /auth/portal/idps | List enabled portal IdPs for app + env |
| GET | /auth/init/:idpId | Initiate OIDC / SAML flow |
| GET | /auth/callback/oidc/:idpId | OIDC callback |
| POST | /auth/callback/saml/:idpId | SAML assertion callback |
| POST | /auth/refresh | Rotate refresh token, issue new access token |
| POST | /auth/logout | Revoke session (single or all) |
| POST | /auth/validate | Validate token + check Redis revocation |
| POST | /auth/service-token | Issue service token for Renderer → Core Backend |
| GET | /.well-known/jwks.json | Public key for JWT validation |

#### Multiple IdPs Per App

FDEs configure one or more IdPs per app per environment in the Builder. End users see all enabled IdPs on the login page and choose how to authenticate.

```
AppIdentityProvider
  appId         String
  environment   STAGING | PRODUCTION
  type          GOOGLE | OKTA | SAML | OIDC | AUTH0 | MAGIC_LINK
  label         String    // "Login with Google"
  configSecretRef String  // encrypted credentials ref
  isEnabled     Boolean
  order         Int       // display order on login page
```

#### Key Decisions

| Decision | Choice |
|---|---|
| JWT algorithm | RS256 — asymmetric, public key shareable |
| Session duration | Access: 15 minutes. Refresh: 7 days |
| Refresh token storage | Postgres (argon2 hashed) + Redis (revocation) |
| Force logout | Yes — single session or all sessions |
| Multiple IdPs per app | Yes — FDE configures, enables, disables |
| Session ownership | Renderer owns portal sessions via auth edge layer |
| Auth service location | Inside Core Backend as isolated module |

#### POC Scope

```
✅ RS256 JWT signing — JWKS endpoint
✅ OIDC flow — initiate + callback + PKCE
✅ SAML flow — initiate + callback
✅ Multiple IdPs per app per environment
✅ Token issuance — access (15m) + refresh (7d)
✅ Refresh token rotation — argon2 hash, family-based
✅ Reuse detection — revoke family on hash mismatch
✅ Force logout — single session + all sessions
✅ Redis revocation — fast lookup on every middleware check
✅ Token validation endpoint — POST /auth/validate
✅ Builder IdP list + Portal IdP list endpoints
✅ Service token issuance for Renderer
✅ OpenFGA group sync on portal login
✅ OAuthState + SAMLState — PKCE + nonce persistence
✅ FDE user model — ADMIN | FDE roles
```

#### Out of Scope

```
❌ Magic link / passwordless (post-POC)
❌ MFA (post-POC)
❌ IdP-initiated SAML SSO (post-POC)
❌ User auto-provisioning on first login (manual for POC)
```

#### Edge Cases

| Case | Handling |
|---|---|
| OAuthState expired (> 10 min) | Return 400 — restart flow |
| Refresh token reuse detected | Revoke entire token family — force re-login |
| All IdPs disabled for an app | Portal login page shows "No login methods configured" |
| OpenFGA sync fails on login | Log error to Sentry — do not block login — groups default to empty |
| SAML assertion signature invalid | Return 401 — log to Sentry |
| Concurrent refresh token requests (race) | First wins — second gets reuse detection → family revoked |

---

### Module 1.7 — Assets

#### Purpose
Storage and delivery of static files uploaded by FDEs — logos, images, icons, fonts — referenced by URL in page schemas and theme tokens.

#### Storage Strategy

Abstracted behind `StorageProvider` interface. Two implementations:

| Implementation | When | Storage |
|---|---|---|
| LocalStorageProvider | POC | Disk at `/uploads`, served via `/assets/*` route |
| S3StorageProvider | Post-POC | S3-compatible, delivered via CDN |

Swap requires one env var change and zero application code change.

#### Deduplication

Content-addressed storage keys using SHA-256 hash of file content. Same file uploaded twice returns the same asset record and URL — no duplicate storage.

```
key = apps/{appId}/{sha256hex}{ext}
url = {BACKEND_URL}/assets/apps/{appId}/{sha256hex}{ext}
```

Because keys are content-addressed, old URLs always resolve. No versioning needed — re-uploading a modified file produces a different hash and therefore a different URL and key.

#### File Validation

```
Allowed types: image/png, image/jpeg, image/svg+xml, image/webp,
               image/gif, font/woff2, font/woff, application/pdf
Max size: 10MB (configurable)
SVG: script tags stripped and rejected
Extension must match MIME type
```

#### API Surface

| Method | Path | Description |
|---|---|---|
| POST | /assets/upload | Upload file (multipart) |
| GET | /assets | List assets for an app |
| DELETE | /assets/:id | Delete asset (checks references first) |
| GET | /assets/:key* | Serve file (local storage only) |

#### Key Decisions

| Decision | Choice |
|---|---|
| Global assets | No — assets are per-app only |
| Image optimization | No — not in POC |
| Asset versioning | No — content addressing handles it naturally |
| Reference check on delete | Yes — block delete if URL found in any page schema |

#### POC Scope

```
✅ LocalStorageProvider — disk writes + file serving
✅ Asset Prisma model — metadata + hash + dimensions
✅ File validation — types, size, SVG script check
✅ Deduplication — SHA-256 content-addressed keys
✅ POST /assets/upload — multipart, validate, deduplicate, store
✅ GET /assets — list by appId, filter by type, search by name
✅ DELETE /assets/:id — reference check then delete
✅ GET /assets/:key* — serve files (local mode)
✅ Image dimension extraction on upload
✅ Cache-Control: immutable, 1 year (content-addressed)
```

#### Out of Scope

```
❌ S3StorageProvider (post-POC)
❌ CDN integration (post-POC)
❌ Image optimization
❌ Global asset pool
```

#### Edge Cases

| Case | Handling |
|---|---|
| Same file uploaded twice | Return existing asset — no re-storage |
| Delete asset referenced in page schema | Return 409 — list pages referencing it |
| SVG with script tags | Return 400 — reject upload |
| File exceeds size limit | Return 413 |
| Upload directory full (local) | Return 507 — log to Sentry |

---

### Module 1.8 — Action Logs

#### Purpose
Persistent audit trail of every action execution fired by an end user in a rendered portal. Enables FDEs to debug portal behaviour via the Builder's action debug panel. Non-blocking — portal operation never waits on log writes.

#### correlationId

Every action log entry carries a `correlationId` that links it to the corresponding `ConnectorRequestLog` entry in the connector module. One user interaction → one `ActionExecutionLog` entry + one or more `ConnectorRequestLog` entries, all with the same `correlationId`.

```
User clicks "Approve Invoice"
  → correlationId: corr_abc123
  → ActionExecutionLog { actionType: RUN_SEQUENCE, correlationId: corr_abc123 }
  → ActionExecutionLog { actionType: API_CALL,     correlationId: corr_abc123 }
  → ConnectorRequestLog { method: POST /invoices,  correlationId: corr_abc123 }
```

#### API Surface

| Method | Path | Description |
|---|---|---|
| POST | /action-logs | Batch ingest from Renderer — non-blocking |
| GET | /action-logs | Query logs — appId, pageId, userId, status, limit |

#### Key Decisions

| Decision | Choice |
|---|---|
| Write strategy | Non-blocking — 202 returned before DB insert completes |
| Log errors | Swallowed — logging must never affect portal operation |
| correlationId | Required — links to ConnectorRequestLog |
| Retention | No policy in POC — all logs kept |

#### POC Scope

```
✅ ActionExecutionLog Prisma model + indexes
✅ POST /action-logs — batch ingest, non-blocking insert, 202 response
✅ GET /action-logs — queryable by appId, pageId, userId, status
✅ correlationId field + index
✅ Sentry — log insert failures as warnings (non-critical)
```

#### Out of Scope

```
❌ Log retention / expiry policy
❌ Log export
❌ Real-time streaming to Builder debug panel (polling for POC)
```

#### Edge Cases

| Case | Handling |
|---|---|
| Postgres unavailable during log write | Error swallowed — Sentry warning — portal unaffected |
| Batch exceeds 100 events | Return 400 — Renderer should batch at ≤ 50 |
| correlationId missing | Log accepted — correlationId nullable |

---

### Core Backend — POC Scope Summary

```
✅ Single Fastify process — all 8 modules registered
✅ Single Postgres connection pool via Prisma
✅ Single Redis client via ioredis
✅ Health check — GET /health (Postgres + Redis)
✅ JWKS endpoint — /.well-known/jwks.json
✅ Sentry initialisation — errors + slow requests
✅ pino structured logging — service-tagged on every line
✅ correlationId — all inbound requests tagged, passed downstream
✅ Docker container — single image, single port 3001
```

---

## Service 2 — App Builder

### Purpose

The App Builder is the primary tool FDEs use to create, configure, and publish client-facing portals. It is a drag-and-drop interface that produces a valid JSON schema consumed by the Renderer.

### Boundaries

**Owns:**
- Canvas — drag and drop component placement
- Component panel — browsing and searching the registry
- Props editor — configuring component props
- Data source configuration — defining page and component-level data fetching
- Action configuration — defining and wiring actions
- Form definition — creating forms with validation
- Page management — creating, ordering, deleting pages
- Theme configuration — setting brand tokens
- IdP configuration — setting up auth per app per environment
- User group management — defining OpenFGA groups
- Publishing flow — promote to staging and production
- Preview — draft schema rendered without publishing
- Endpoint tester — test real API calls outside preview context
- Asset management — upload and manage files
- Action debug panel — execution log in preview mode
- FDE authentication — Builder login via configured IdPs
- Builder access control — per-app OWNER / EDITOR / VIEWER roles
- Commenting — per-node comments with replies and resolve

**Does not own:**
- Schema storage (Core Backend schema module)
- Component implementations (ui package)
- Auth sessions (Core Backend auth module)
- Portal rendering (Renderer)

### Stack

| Concern | Decision | Reason |
|---|---|---|
| Framework | Next.js 14+ (App Router) | Routing, API routes, SSR for login page |
| State management | Zustand + Immer + zundo | Low ceremony, deep mutation support, built-in undo/redo |
| Drag and drop | @dnd-kit/core | Actively maintained, headless, unified drag source + drop target |
| Component library | shadcn/ui + Radix UI (from /packages/ui) | Copy-paste ownership, accessible primitives |
| Styling | Tailwind CSS + CSS variables | Build-time utilities + runtime theme tokens |
| API client | tRPC client (Builder → Core Backend) | End-to-end TypeScript, no manual schema |
| Forms | React Hook Form + Zod | Already using Zod, natural pairing |
| Rich text | TipTap | For RichText primitive editing in canvas |
| JSON diffing | fast-json-patch | For concurrent edit detection display |

### Architecture

#### Canvas State — Normalized Tree

The canvas maintains a normalized flat map — not the raw JSON schema. Serialization to schema happens on every save.

```typescript
interface CanvasState {
  nodes:          Record<string, CanvasNode>  // id → node
  rootId:         string
  childMap:       Record<string, string[]>    // parentId → childIds
  parentMap:      Record<string, string>      // childId → parentId
  selectedNodeId: string | null
  hoveredNodeId:  string | null
  dragState:      DragState | null
}
```

Normalized structure gives O(1) lookup for any node, O(1) parent lookup, and clean subtree extraction for copy/paste.

#### Zustand Stores

Four separate stores avoid monolithic state:

| Store | Contents |
|---|---|
| useCanvasStore | Component tree, selection, drag state — wrapped in zundo for undo/redo |
| usePageStore | Pages list, active page, page metadata |
| useAppStore | App config, theme, IdPs, data sources, user groups |
| useRegistryStore | Cached registry entries for this Builder session |

#### Auto-Save

Canvas changes debounced 1.5 seconds → `saveDraft` → Core Backend schema module. Returns concurrent edit warning flag if another FDE saved within 30 seconds.

#### Preview Sessions

Draft schema stored in Redis (1 hour TTL) via Builder API routes. Preview renderer is a route inside Builder — no separate deployment.

#### Breakpoint System

Canvas renders at active breakpoint. Props editor shows base (desktop) values with override indicators for tablet and mobile. Edits in tablet/mobile mode write to `node.responsive.tablet` or `node.responsive.mobile` — never mutate base props.

### Key Decisions

| Decision | Choice |
|---|---|
| Undo/redo | zundo temporal middleware, 50 steps, partialize to nodes + tree only |
| Clipboard | Zustand + sessionStorage — persists across page navigation within Builder |
| Concurrent edits | Last write wins + warning flag — no locking |
| Preview mode | Mock data only — no real API calls |
| Endpoint tester | Real API calls — separate from preview, uses Connector module |
| FDE auth | Next.js middleware, BuilderIdentityProvider, ADMIN | FDE roles |
| Access control | Per-app OWNER / EDITOR / VIEWER — ADMIN bypasses all |

### POC Scope

```
✅ Canvas with drag and drop (@dnd-kit)
✅ Component panel — registry list, search, categories
✅ Props editor — dynamically generated from Zod schema
✅ Binding input — {{}} expression with autocomplete
✅ Canvas state in Zustand (normalized tree)
✅ Serialize / deserialize schema ↔ canvas state
✅ Auto-save (debounced 1.5s) → saveDraft
✅ Undo / redo (zundo, 50 steps)
✅ Page management — create, rename, reorder, delete
✅ Promote flow — semver picker + changelog required
✅ Version history panel per page
✅ Rollback — one click from version history
✅ Theme configuration UI — brand tokens, fonts, colors
✅ IdP configuration UI — add, enable, disable per app per env
✅ User group management UI — groups + members (synced to OpenFGA)
✅ Responsive breakpoint editor — desktop / tablet / mobile
✅ Copy / paste — full subtree, sessionStorage, across pages
✅ Keyboard shortcuts — history, copy, move, breakpoints, zoom
✅ Builder access control — OWNER / EDITOR / VIEWER
✅ Commenting — per node, replies, resolve, unresolved badge
✅ FDE authentication — middleware, login page, session tokens
✅ Page Settings → Data Sources — add, edit, delete, mock data
✅ Page Settings → Actions — add, edit, delete, all action types
✅ Page Settings → State slots — named state with default values
✅ Page Settings → Forms — fields, validation, submit action
✅ Page Settings → Version History
✅ Component-level data source config (DataTable, Chart)
✅ Binding context explorer — sidebar showing resolved shape
✅ Preview — split pane + new tab both available
✅ Preview mock data editor — JSON editor per data source
✅ Preview action log panel — intercepted actions shown
✅ Endpoint tester — test real calls, import response as mock
✅ Prebuilt view editor — isolated canvas, save to registry
✅ Asset picker — upload, browse, select in props editor
✅ Action debug panel — execution log (polls /action-logs)
```

### Out of Scope

```
❌ Component locking
❌ Real API calls in preview (endpoint tester is the escape hatch)
❌ Offline support
❌ Builder mobile UI (desktop only)
❌ Custom code blocks / scripting in actions
```

### Edge Cases

| Case | Handling |
|---|---|
| Concurrent FDE edit detected | Toast warning shown — "Overwritten by {email} {N}s ago" |
| Registry validation fails on save | Node highlighted in canvas, props editor shows specific error |
| FDE loses connection mid-edit | Auto-save retries with exponential backoff, offline banner shown |
| Canvas tree becomes invalid (broken reference) | ErrorBoundary per node in preview, validation error on promote |
| Preview session expires (1h) | Expired banner shown — click to refresh |
| Promote with no changes since last version | Blocked — "No changes to promote" |

---

## Service 3 — App Renderer Engine

### Purpose

The App Renderer Engine turns a published JSON page schema into a fully functional, statically built client-facing portal. It fetches schemas at build time, resolves components from the registry, renders the component tree, handles portal auth, and executes data sources and actions at runtime.

### Boundaries

**Owns:**
- Static page generation — `generateStaticParams` + `getStaticProps`
- Component tree rendering — recursive `SchemaRenderer`
- Component resolution — primitives (static) and custom widgets (dynamic CDN import)
- Data source resolution — `DataSourceResolver` with dependency ordering
- Binding context — full context shape made available to all components
- Action execution — via `action-runtime` package (client-side)
- Portal auth — session tokens, IdP callbacks, token refresh, logout
- Auth edge layer — Next.js middleware validates JWT + Redis revocation + OpenFGA
- Theme injection — CSS variables from schema tokens
- Responsive rendering — breakpoint-aware prop merging
- Build webhook receiver — triggers `next build` on publish
- Error boundaries — per node, broken component never crashes page

**Does not own:**
- Schema storage (Core Backend)
- Component implementations (ui package)
- Auth issuance (Core Backend auth module)
- HTTP execution for data sources (Core Backend connector module)

### Stack

| Concern | Decision | Reason |
|---|---|---|
| Framework | Next.js 14+ (App Router) | SSR, static generation, middleware, dynamic routes |
| Rendering strategy | Full static build on publish | Consistent schema, no runtime drift |
| Component library | /packages/ui (shared) | Same components as Builder — identical rendering |
| Action runtime | /packages/action-runtime (shared) | Same execution logic as Builder preview |
| Styling | Tailwind + CSS variables | CSS vars injected at runtime from theme tokens |
| Auth validation | POST /auth/validate → Core Backend | Centralised validation, public key cached via JWKS |
| Error tracking | Sentry | Per-node errors + renderer-level errors |
| Data transforms | JSONata | Response reshaping defined in schema |
| Deployment | Docker + Nginx per tenant | One container per client portal |

### Architecture

#### Build-Time Flow

```
Build webhook received
    → GET /apps/:slug/deployment/:env (Core Backend)
    → Fetch all published PageSchemas
    → generateStaticParams — one route per page
    → For each page:
        fetch schema + theme + enabled IdPs
        preload custom widget bundles from CDN
        resolve component tree
    → next build → static HTML + JS bundle
    → Docker container deployed to client URL
```

#### Runtime Flow

```
User hits portal URL
    → Next.js middleware (auth edge layer)
        validate JWT signature (public key from JWKS cache)
        check Redis revocation (tokenFamily)
        check OpenFGA page access
    → Page component renders (static HTML served)
    → Client hydrates
    → BindingProvider fetches data sources (via Core Backend connector)
    → ActionProvider mounts — actions available to all components
    → Components render with resolved props + bindings
```

#### Provider Hierarchy

All context providers mounted at page root in dependency order:

```typescript
<ThemeProvider tokens={theme.tokens}>
  <AuthProvider idProviders={idProviders}>
    <BindingProvider schema={schema} urlParams={urlParams}>
      <ActionProvider schema={schema}>
        <SchemaRenderer schema={schema} />
      </ActionProvider>
    </BindingProvider>
  </AuthProvider>
</ThemeProvider>
```

#### Component Resolver

```typescript
function resolveComponent(node: ComponentNode): React.ComponentType {
  switch (node.source) {
    case 'primitive':
      return Primitives[node.type]           // static import
    case 'custom_widget':
      return widgetCache.get(node.type)      // pre-loaded from CDN at build time
    case 'prebuilt_view':
      return createPrebuiltViewComponent(node) // recursive resolution
  }
}
```

#### Binding Context Shape

```typescript
interface BindingContext {
  datasource: Record<string, any>       // resolved data source results
  params:     Record<string, string>    // URL params (/clients/:clientId)
  user: {
    id:     string
    email:  string
    groups: string[]
  }
  env: {
    appId:       string
    environment: 'staging' | 'production'
  }
  state:  Record<string, any>           // named state slots
  form:   Record<string, FormState>     // form field values + errors
}
```

### Key Decisions

| Decision | Choice |
|---|---|
| Rendering strategy | Full rebuild on every publish — no ISR |
| Multiple renderers | One per tenant — custom domain per client |
| Deploy platform | Docker + Nginx (POC) |
| Session ownership | Renderer owns portal sessions |
| Data fetching | Client-side via BindingProvider — not SSR data fetch |
| Action execution | Client-side via action-runtime — not server actions |
| Build webhook secret | HMAC signature — Renderer verifies before triggering build |

### POC Scope

```
✅ Dynamic [appSlug]/[pageSlug] routing
✅ generateStaticParams — build all pages from published schemas
✅ Schema fetch from Core Backend at build time
✅ SchemaRenderer — recursive component tree renderer
✅ ComponentResolver — primitive (static) + custom widget (CDN)
✅ DataSourceResolver — dependency-ordered, interpolated bindings
✅ BindingProvider — full context shape
✅ PollingManager — auto-refresh per data source interval
✅ JSONata transform support
✅ useComponentDataSource — pagination, sorting, filtering
✅ ThemeProvider — CSS variable injection
✅ Auth middleware — JWT + Redis revocation + OpenFGA
✅ Portal login page — lists enabled IdPs
✅ Auth callback routes — OIDC + SAML
✅ Session refresh endpoint
✅ Logout + Redis session revocation
✅ Build webhook receiver — verifies signature + triggers next build
✅ Responsive props resolver — breakpoint-aware prop merging
✅ ErrorBoundary per node
✅ ActionExecutor (via action-runtime) — all action types
✅ StateManager — named state slots
✅ ActionProvider + ActionContext
✅ FormManager — validation, dirty/touched tracking
✅ ComponentEventBus — inter-component communication
✅ Action execution logging — non-blocking POST to /action-logs
✅ Sentry integration
✅ TRIGGER_WEBHOOK — simple fetch(), fire and forget
```

### Out of Scope

```
❌ ISR / incremental static regeneration
❌ Offline / service worker
❌ Server actions (Next.js) — all mutations go through connector
❌ Portal-level analytics (post-POC)
```

### Edge Cases

| Case | Handling |
|---|---|
| Build fails (bad schema) | Deployment status → FAILED, previous build stays live |
| Component type not found in registry | ErrorBoundary renders "Component unavailable" |
| Custom widget CDN URL unreachable at build | Build fails — logged to Sentry, FDE notified via deployment status |
| Data source fetch fails at runtime | errorHandling config on DataSourceDef — show-error / show-empty |
| OpenFGA unavailable at auth check | Fail closed — deny access, log to Sentry |
| Redis unavailable at revocation check | Fail closed — deny access, log to Sentry |
| Action API call fails | onError outcome fires — toast shown to user |
| Page not in current deployment | 404 — Next.js default not-found page |

---

## Service 4 — Shared Packages

### Purpose

Three packages shared between Builder and Renderer. Bundled at build time. Never deployed independently. Never consumed by Core Backend.

### Package 1 — /packages/core

**Purpose:** Shared TypeScript types and interfaces. Single source of truth for data contracts between all services.

**Contents:**
```
/src
  /types
    schema.ts          PageSchema, ComponentNode, all schema interfaces
    registry.ts        RegistryEntry, ComponentType, RegistrySource
    datasource.ts      DataSourceDef, ConnectorConfig, all datasource types
    actions.ts         ActionDef, ActionType, all action config interfaces
    auth.ts            SessionToken, FDESessionToken, PortalSessionToken
    api.ts             Shared API request/response types
  index.ts             Barrel export
```

**Key decision:** Core types live here — not duplicated in each app. If a type changes, it changes once.

### Package 2 — /packages/ui

**Purpose:** Shadcn/ui component library copied into the monorepo. All primitive components with their Zod prop schemas and manifests. Consumed identically by Builder (canvas preview) and Renderer (production portal).

**Contents:**
```
/src
  /primitives
    /Button            index.tsx + props.schema.ts
    /DataTable         index.tsx + props.schema.ts (TanStack Table)
    /Chart             index.tsx + props.schema.ts (Recharts)
    /Input             index.tsx + props.schema.ts
    /Select            index.tsx + props.schema.ts
    /Stack             index.tsx + props.schema.ts
    /Card              index.tsx + props.schema.ts
    /Modal             index.tsx + props.schema.ts
    /Tabs              index.tsx + props.schema.ts
    /StatCard          index.tsx + props.schema.ts
    /RichText          index.tsx + props.schema.ts (TipTap)
    ... (all primitives listed in registry section)
  /hooks
    useThemeTokens.ts  resolves CSS variables from schema
    useActionBinding.ts resolves action pipeline bindings
  index.ts             barrel export
```

**Key decisions:**
- Copy-paste model — no upstream version lock
- Every primitive exports `propsSchema` (Zod) and `manifest` for registry seeding
- Radix UI underlies all interactive components — ARIA + keyboard nav built in
- TanStack Table for DataTable — headless, handles sort/filter/pagination
- Recharts for Chart — composable, React-native

### Package 3 — /packages/action-runtime

**Purpose:** Client-side action execution, form management, and inter-component events. Shared between Builder (preview mode execution) and Renderer (production execution). Pure TypeScript — no Next.js or framework dependency.

**Contents:**
```
/src
  /executor
    actionExecutor.ts      Full ActionExecutor class — all action types
    actionTypes.ts         All ActionDef, ActionConfig interfaces
  /forms
    formManager.ts         FormManager — state, validation, dirty tracking
    formValidation.ts      All validation rule implementations
  /events
    eventBus.ts            ComponentEventBus — pub/sub between components
  /binding
    bindingResolver.ts     resolveBinding — {{}} expression evaluator
    interpolate.ts         deepMap interpolation for config objects
  /state
    stateManager.ts        StateManager — named state slots
  index.ts                 barrel export
```

**Key decisions:**
- All action execution is client-side — no server component
- Action execution audit logging is non-blocking POST to Core Backend
- Same executor runs in Builder preview and Renderer production — no behaviour difference
- TRIGGER_WEBHOOK is a simple fire-and-forget fetch() — no retry, no signing

### POC Scope — Shared Packages

```
✅ /packages/core — all shared types defined, barrel export
✅ /packages/ui — all primitives seeded, props.schema.ts per component
✅ /packages/action-runtime — ActionExecutor, FormManager, EventBus
✅ Build tooling — Vite + vite-plugin-dts per package
✅ pnpm workspace:* protocol linking packages into apps
```

---

## Data Model — Consolidated Prisma Schema

```prisma
// ─── App + Page ───────────────────────────────────────────────────────────────

model App {
  id          String    @id @default(cuid())
  name        String
  slug        String    @unique
  createdBy   String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  pages       Page[]
  members     AppMember[]
  deployments Deployment[]
  dataSources DataSource[]
  idProviders AppIdentityProvider[]
  userGroups  AppUserGroup[]
  assets      Asset[]
}

model Page {
  id        String    @id @default(cuid())
  appId     String
  name      String
  slug      String
  order     Int
  createdAt DateTime  @default(now())

  app       App       @relation(fields: [appId], references: [id])
  versions  PageVersion[]
  comments  NodeComment[]
  analytics AnalyticsEvent[]

  @@unique([appId, slug])
}

// ─── Schema Versioning ────────────────────────────────────────────────────────

model PageVersion {
  id           String            @id @default(cuid())
  pageId       String
  version      String
  schema       Json
  status       PageVersionStatus
  changelog    String?
  diffFromPrev Json?
  createdBy    String
  createdAt    DateTime          @default(now())
  promotedAt   DateTime?
  promotedBy   String?

  page         Page              @relation(fields: [pageId], references: [id])
  deployments  DeploymentPage[]

  @@unique([pageId, version])
  @@index([pageId, status])
}

enum PageVersionStatus {
  DRAFT
  STAGED
  PUBLISHED
  ARCHIVED
  ROLLED_BACK
}

model Deployment {
  id          String      @id @default(cuid())
  appId       String
  environment Environment
  buildStatus BuildStatus
  deployedBy  String
  deployedAt  DateTime    @default(now())

  app         App         @relation(fields: [appId], references: [id])
  pages       DeploymentPage[]
}

model DeploymentPage {
  deploymentId  String
  pageVersionId String

  deployment    Deployment  @relation(fields: [deploymentId], references: [id])
  pageVersion   PageVersion @relation(fields: [pageVersionId], references: [id])

  @@id([deploymentId, pageVersionId])
}

enum Environment  { STAGING PRODUCTION }
enum BuildStatus  { PENDING BUILDING SUCCESS FAILED }

// ─── Access Control ───────────────────────────────────────────────────────────

model AppMember {
  id        String  @id @default(cuid())
  appId     String
  userId    String
  role      AppRole
  addedBy   String
  addedAt   DateTime @default(now())

  app       App     @relation(fields: [appId], references: [id])

  @@unique([appId, userId])
}

enum AppRole { OWNER EDITOR VIEWER }

model AppUserGroup {
  id          String   @id @default(cuid())
  appId       String
  name        String
  description String?
  createdBy   String
  createdAt   DateTime @default(now())

  app         App      @relation(fields: [appId], references: [id])
  members     AppUserGroupMember[]

  @@unique([appId, name])
}

model AppUserGroupMember {
  id        String       @id @default(cuid())
  groupId   String
  identifier String
  addedBy   String
  addedAt   DateTime     @default(now())

  group     AppUserGroup @relation(fields: [groupId], references: [id])

  @@unique([groupId, identifier])
}

// ─── Registry ─────────────────────────────────────────────────────────────────

model RegistryEntry {
  id             String        @id @default(cuid())
  name           String
  type           ComponentType
  scope          RegistryScope
  status         EntryStatus
  currentVersion String
  sourceType     SourceType
  sourceRef      String?
  ownedBy        String
  createdBy      String
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  versions       RegistryEntryVersion[]

  @@unique([name, scope])
  @@index([type, scope, status])
}

model RegistryEntryVersion {
  id           String        @id @default(cuid())
  entryId      String
  version      String
  propsSchema  Json
  defaultProps Json
  bundleUrl    String?
  bundleHash   String?
  viewSchema   Json?
  displayName  String
  description  String?
  category     String
  icon         String?
  thumbnail    String?
  tags         String[]
  changelog    String?
  publishedAt  DateTime      @default(now())
  publishedBy  String

  entry        RegistryEntry @relation(fields: [entryId], references: [id])

  @@unique([entryId, version])
}

enum ComponentType { PRIMITIVE CUSTOM_WIDGET PREBUILT_VIEW }
enum RegistryScope { COMMON TENANT_LOCAL }
enum EntryStatus   { ACTIVE DEPRECATED PENDING_REVIEW REJECTED }
enum SourceType    { INTERNAL EXTERNAL_PLATFORM COMPOSED }

// ─── Endpoint Registry ────────────────────────────────────────────────────────

model Connector {
  id          String            @id @default(cuid())
  name        String
  description String?
  baseUrl     Json
  authType    ConnectorAuthType
  authConfig  String
  headers     Json
  isActive    Boolean           @default(true)
  createdBy   String
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  endpoints   EndpointDef[]
  rateLimit   ConnectorRateLimit?
}

model EndpointDef {
  id             String      @id @default(cuid())
  connectorId    String
  name           String
  description    String?
  method         HttpMethod
  path           String
  category       String
  tags           String[]
  pathParams     Json
  queryParams    Json
  bodySchema     Json?
  headers        Json
  responseSchema Json
  responseSample Json?
  bindingPaths   Json
  isActive       Boolean     @default(true)
  createdBy      String
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  connector      Connector   @relation(fields: [connectorId], references: [id])
  cacheConfig    EndpointCacheConfig?

  @@unique([connectorId, method, path])
}

model ConnectorRateLimit {
  id                String    @id @default(cuid())
  connectorId       String    @unique
  requestsPerMin    Int       @default(60)
  requestsPerHour   Int       @default(1000)
  requestsPerDay    Int       @default(10000)
  burstLimit        Int       @default(10)
  maxConcurrent     Int       @default(5)
  maxResponseSizeKb Int       @default(5120)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  connector         Connector @relation(fields: [connectorId], references: [id])
}

model EndpointCacheConfig {
  id          String      @id @default(cuid())
  endpointId  String      @unique
  ttlSeconds  Int
  varyBy      String[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  endpoint    EndpointDef @relation(fields: [endpointId], references: [id])
}

model CustomEndpointUsage {
  id        String         @id @default(cuid())
  appId     String
  pageId    String
  alias     String
  mode      DataSourceMode
  url       String
  method    HttpMethod
  usedBy    String
  createdAt DateTime       @default(now())

  @@index([mode, createdAt])
}

enum ConnectorAuthType { BEARER API_KEY OAUTH2 NONE }
enum HttpMethod        { GET POST PUT PATCH DELETE }
enum DataSourceMode    { REGISTERED CUSTOM_CONNECTOR CUSTOM_MANUAL }

// ─── Connector Audit ──────────────────────────────────────────────────────────

model ConnectorRequestLog {
  id              String         @id @default(cuid())
  correlationId   String?
  appId           String
  pageId          String?
  datasourceAlias String?
  actionId        String?
  userId          String
  mode            DataSourceMode
  connectorId     String?
  endpointId      String?
  method          HttpMethod
  urlPattern      String
  statusCode      Int?
  durationMs      Int
  cacheHit        Boolean        @default(false)
  error           String?
  createdAt       DateTime       @default(now())

  @@index([appId, createdAt])
  @@index([correlationId])
  @@index([connectorId, createdAt])
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

model BuilderIdentityProvider {
  id        String   @id @default(cuid())
  name      String
  type      IdPType
  label     String
  config    String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model AppIdentityProvider {
  id            String      @id @default(cuid())
  appId         String
  environment   Environment
  type          IdPType
  label         String
  configSecretRef String
  isEnabled     Boolean     @default(true)
  order         Int
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  createdBy     String
  updatedBy     String

  app           App         @relation(fields: [appId], references: [id])

  @@unique([appId, environment, type])
}

model RefreshToken {
  id          String       @id @default(cuid())
  tokenFamily String
  tokenHash   String       @unique
  userId      String
  appId       String?
  context     TokenContext
  environment Environment?
  isRevoked   Boolean      @default(false)
  revokedAt   DateTime?
  expiresAt   DateTime
  createdAt   DateTime     @default(now())

  @@index([tokenFamily])
  @@index([userId, context])
}

model OAuthState {
  id           String       @id @default(cuid())
  state        String       @unique
  codeVerifier String
  idpId        String
  context      TokenContext
  appId        String?
  environment  Environment?
  redirectTo   String
  expiresAt    DateTime
  createdAt    DateTime     @default(now())
}

model SAMLState {
  id          String       @id @default(cuid())
  requestId   String       @unique
  idpId       String
  context     TokenContext
  appId       String?
  environment Environment?
  redirectTo  String
  expiresAt   DateTime
  createdAt   DateTime     @default(now())
}

enum IdPType      { GOOGLE OKTA SAML OIDC AUTH0 MAGIC_LINK USERNAME_PASSWORD }
enum TokenContext { BUILDER PORTAL }

// ─── Assets ───────────────────────────────────────────────────────────────────

model Asset {
  id         String   @id @default(cuid())
  appId      String
  name       String
  key        String   @unique
  url        String
  mimeType   String
  sizeBytes  Int
  hash       String
  width      Int?
  height     Int?
  uploadedBy String
  createdAt  DateTime @default(now())

  app        App      @relation(fields: [appId], references: [id])

  @@index([appId])
  @@index([hash])
}

// ─── Action Logs ──────────────────────────────────────────────────────────────

model ActionExecutionLog {
  id            String       @id @default(cuid())
  correlationId String?
  appId         String
  pageId        String
  userId        String
  actionId      String
  actionName    String
  actionType    String
  status        ActionStatus
  durationMs    Int
  error         String?
  metadata      Json?
  executedAt    DateTime     @default(now())

  @@index([appId, executedAt])
  @@index([correlationId])
  @@index([pageId, executedAt])
}

enum ActionStatus { SUCCESS ERROR }

// ─── Comments ─────────────────────────────────────────────────────────────────

model NodeComment {
  id            String    @id @default(cuid())
  pageId        String
  nodeId        String
  pageVersionId String
  body          String
  resolved      Boolean   @default(false)
  resolvedBy    String?
  resolvedAt    DateTime?
  createdBy     String
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  page          Page      @relation(fields: [pageId], references: [id])
  replies       NodeCommentReply[]
}

model NodeCommentReply {
  id        String      @id @default(cuid())
  commentId String
  body      String
  createdBy String
  createdAt DateTime    @default(now())

  comment   NodeComment @relation(fields: [commentId], references: [id])
}
```

---

## Stack Summary

| Axis | Pick |
|---|---|
| Monorepo | pnpm workspaces + Turborepo (Day 3+) |
| Backend framework | Fastify + TypeScript |
| Frontend framework | Next.js 14+ (App Router) |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| State management | Zustand + Immer + zundo |
| Design system | shadcn/ui + Radix UI |
| Styling | Tailwind CSS + CSS variables |
| Drag and drop | @dnd-kit/core |
| Tables | TanStack Table |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Rich text | TipTap |
| JWT | jose + RS256 |
| OIDC | openid-client |
| SAML | samlify |
| Password hashing | argon2 |
| Authorization | OpenFGA |
| Secret storage | AES-256-GCM env-key (POC) → Vault (post-POC) |
| Data transforms | JSONata |
| JSON diff | fast-json-patch |
| Error tracking | Sentry |
| Logging | pino |
| Build — apps | Turbopack (Next.js default) |
| Build — packages | Vite + vite-plugin-dts |
| Package manager | pnpm |
| Deployment | Docker + Nginx |

---

## Open Items

These decisions were deferred and must be resolved before or during POC:

| Item | Context | Owner |
|---|---|---|
| Analytics retention policy | How long to keep AnalyticsEvent rows | Platform team |
| FDE analytics access control | Can all FDEs see all app analytics | Product |
| Portal user auto-provisioning | First SSO login — auto or manual approval | Product |
| MFA requirement | FDEs, portal users, or both | Security |
| IdP-initiated SAML | Does any client require it | Client requirements |
| Magic link / passwordless | Any portals need email-based login | Client requirements |
| CI/CD pipeline for Renderer rebuild | Jenkins, GitHub Actions, GitLab CI | DevOps |
| OpenFGA self-hosted topology | Single instance or HA for POC | DevOps |
| Sentry DSN provisioning | One DSN per service or shared | DevOps |
| RS256 key pair generation + rotation plan | Who generates, where stored, how rotated | Security |
