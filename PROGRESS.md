# Build Progress

## Status: PHASE 2 IN PROGRESS

## Phase 1 — Foundation
- [x] Monorepo skeleton — pnpm workspaces, tsconfig, package.json files
- [x] Docker Compose — Postgres 16 (port 5433 locally, 5432 internal), Redis 7, OpenFGA
- [x] Prisma schema — full data model from poc-scope.md
- [x] Initial migration — `20260506094951_init`
- [x] /lib — db, redis, secrets, logger, sentry
- [x] Core Backend entry point — Fastify, all 8 module stubs registered
- [x] GET /health endpoint
- [x] .env.example files for all apps

## Phase 2 — Core Backend Modules
- [x] Auth module — Part 1: JWT infrastructure + session management (Session 2.1)
- [x] Auth module — Part 2: OIDC + SAML + IdP management (Session 2.2)
- [x] Apps module
- [x] Schema module
- [x] Registry module
- [x] Registry seed script — all primitives

## Phase 3 — Execution Layer
- [x] Endpoint registry module
- [ ] Connector module
- [ ] Assets module
- [ ] Action logs module

## Phase 4 — Shared Packages
- [ ] /packages/core — all types + Zod schemas
- [ ] /packages/ui — all primitives + props schemas
- [ ] /packages/action-runtime — ActionExecutor + FormManager + EventBus

## Phase 5 — App Builder
- [ ] Next.js setup + auth middleware
- [ ] Canvas + drag and drop
- [ ] Component panel
- [ ] Props editor
- [ ] Data source config UI
- [ ] Action config UI
- [ ] Page management
- [ ] Publish flow + version history
- [ ] Preview (split pane + new tab)
- [ ] Theme + IdP + user group config UI
- [ ] Asset picker
- [ ] Commenting
- [ ] Endpoint tester

## Phase 6 — App Renderer
- [ ] Next.js setup + auth edge middleware
- [ ] Build webhook receiver
- [ ] Schema renderer — recursive component tree
- [ ] Component resolver
- [ ] Binding provider + DataSourceResolver
- [ ] Action execution (action-runtime wired up)
- [ ] Theme injection
- [ ] Portal login page + auth callbacks
- [ ] Error boundaries

## Notes

### 2026-05-06 — Session 3.1: Endpoint registry module complete
- modules/endpoint-registry/lib/bindingPaths.ts: computeBindingPaths(schema, prefix) — recursively walks JSON Schema, returns all leaf paths including array item paths with [] notation (e.g. data.rows[].id)
- modules/endpoint-registry/lib/ssrf.ts: validateUrl(url) — blocks localhost, 127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.169.254 (AWS metadata), 0.0.0.0, metadata.google.internal → throws 403; non-http/https → 403; invalid URL → 400
- modules/endpoint-registry/types.ts: RegisterConnectorSchema, RegisterEndpointSchema, UpdateEndpointSchema, TestEndpointSchema with ParamDefSchema
- modules/endpoint-registry/service.ts: listConnectors, registerConnector (SSRF-validates base URLs, encrypts authConfig via secretsProvider), listConnectorEndpoints, getEndpoint, registerEndpoint (auto-computes bindingPaths from responseSchema), updateEndpoint (recomputes paths on responseSchema change), deactivateEndpoint (soft delete isActive=false), testEndpoint (REGISTERED/CUSTOM_CONNECTOR/CUSTOM_MANUAL modes, 30s timeout → 504, required path param validation → 400, SSRF validation, async custom endpoint usage logging)
- modules/endpoint-registry/router.ts: GET/POST /endpoints/connectors, GET /endpoints/connectors/:id/endpoints, POST /endpoints/test, POST /endpoints/, GET/PATCH/DELETE /endpoints/:id
- 18 tests (75 total): computeBindingPaths flat/nested/array cases, validateUrl SSRF cases (all private ranges), registerConnector auth encrypted, registerConnector SSRF rejected, registerEndpoint binding paths computed, connector not found → 404, testEndpoint missing path param → 400, SSRF blocked, timeout → 504, custom endpoint usage logged

### 2026-05-06 — Session 2.5: Registry module + primitive seeding complete
- modules/registry/types.ts: Zod schemas — RegisterCustomWidgetSchema, SavePrebuiltViewSchema, DeprecateEntrySchema, PropsSchemaQuerySchema, GetEntriesQuerySchema
- modules/registry/service.ts: listForApp (COMMON + TENANT_LOCAL for app), getEntry (by name + optional version), getPropsSchema (batch fetch for schema validation), registerCustomWidget (COMMON name collision → 409, TENANT_LOCAL if appId provided), savePrebuiltView (upsert with version increment), deprecate (404 if missing, 409 if already deprecated)
- modules/registry/router.ts: GET /registry/entries?appId=, GET /registry/entries/:name, GET /registry/props-schema?components=, POST /registry/custom-widget, POST /registry/prebuilt-view, POST /registry/entries/:id/deprecate
- modules/registry/seed.ts: seeds 34 primitive components across 6 categories (Layout: Stack/Grid/Divider/Card/Tabs/Accordion/Modal; Data: DataTable/Chart/StatCard/Badge/Avatar/Tag; Input: TextInput/NumberInput/Select/MultiSelect/DatePicker/Checkbox/Toggle/RadioGroup/Textarea/FileUpload; Action: Button/IconButton/Link/DropdownMenu; Feedback: Alert/Toast/Spinner/Skeleton/EmptyState/ErrorBoundary; Typography: Heading/Text/RichText) — each with full propsSchema and defaultProps
- 14 tests (57 total): listForApp COMMON+TENANT_LOCAL, no other-tenant entries, currentVersionDetails populated, DEPRECATED included, getPropsSchema correct schemas, empty list, unknown component, registerCustomWidget TENANT_LOCAL, duplicate COMMON → 409, savePrebuiltView v1.0.0, deprecate happy path, 404, 409 already deprecated, entry persists in DB after deprecation

### 2026-05-06 — Session 2.4: Schema module complete
- modules/schema/types.ts: ComponentNodeZ (recursive via z.lazy), PageSchemaZ (full page schema), SaveDraftRequestSchema, PromoteRequestSchema, RollbackRequestSchema, DiffQuerySchema
- modules/schema/service.ts: saveDraft (5MB size guard → 413, registry validation against db.registryEntry → 400, concurrent edit detection 30s window → warning flag, JSON Patch diff via fast-json-patch, version carries over from latest), promoteToStaging + promoteToProduction (semver.inc for bump, STAGING requires DRAFT → 409, PRODUCTION requires STAGED → 409, creates Deployment PENDING + DeploymentPage, fires HMAC-SHA256 webhook async, updates to BUILDING), rollback (PUBLISHED → ROLLED_BACK, target → PUBLISHED, PRODUCTION deployment + webhook), getHistory, getDiff (uses stored diffFromPrev if available, else computes), triggerBuild (HMAC-SHA256 signed, x-build-signature header)
- modules/schema/router.ts: POST /schema/draft, POST /schema/:versionId/promote/staging, POST /schema/:versionId/promote/production, POST /schema/:pageId/rollback, GET /schema/:pageId/history, GET /schema/:pageId/diff?from=&to=
- 13 tests (43 total): saveDraft happy path, registry validation failure → 400, concurrent edit warning, no warning on own drafts, semver minor bump, semver patch bump, staging rejects non-DRAFT → 409, production rejects non-STAGED → 409, rollback state transitions, rollback fires webhook, HMAC signature correctness, webhook payload shape

### 2026-05-06 — Session 2.1: Auth module Part 1 complete
- tokenSigner.ts: RS256 sign/verify with jose, JWKS export, `verifyTokenExpired` for refresh rotation
- sessionManager.ts: issueSessionTokens (argon2 hashed refresh token), rotateRefreshToken (reuse detection), revokeTokenFamily, revokeAllSessions, isRevoked (Redis fast path + Postgres fallback)
- router.ts: POST /auth/refresh, POST /auth/logout, POST /auth/validate, GET /auth/jwks
- service.ts: public interface wrapping all session operations
- /.well-known/jwks.json in index.ts updated to use real tokenSigner.getJWKS()
- 11 tests, all passing: token round-trip, PORTAL token, tamper rejection, refresh rotation, reuse detection, revocation, all-session logout, expiry handling
- vitest.config.ts created (was missing)

### 2026-05-06 — Session 2.3: Apps module complete
- modules/apps/types.ts: Zod schemas for CreateApp, UpdateApp, CreatePage, UpdatePage, AddMember, UpdateMemberRole, and all param schemas
- modules/apps/service.ts: createApp (slug uniqueness + auto-OWNER), listApps (admin sees all / FDE sees member apps), getApp, updateApp, createPage, listPages, updatePage, deletePage (deployment reference check → 409), listMembers, addMember, updateMemberRole, removeMember (last OWNER protection → 409), getDeployment (Renderer build-time fetch with full page version schemas), getMemberRole
- middleware/auth.ts: extractFDESession (calls authService.validateToken), requireAuth preHandler, requireAppRole(minRole) preHandler factory (ADMIN bypasses, role rank checked)
- modules/apps/router.ts: all 13 endpoints — POST/GET/PATCH /apps, POST/GET/PATCH/DELETE /apps/:id/pages, GET /apps/slug/:slug/deployment/:env, GET/POST/PATCH/DELETE /apps/:id/members; all with requireAuth + requireAppRole guards
- 10 tests (30 total): createApp happy path, duplicate slug → 409, delete page no refs, delete page STAGED ref → 409, delete page PUBLISHED ref → 409, remove last OWNER → 409, remove OWNER when multiple OK, remove EDITOR OK, getMemberRole null for non-member, getMemberRole correct role

### 2026-05-06 — Session 2.2: Auth module Part 2 complete
- lib/oidcClient.ts: buildOIDCClient (openid-client v5 Issuer.discover), initiateOIDCFlow (PKCE, OAuthState record), handleOIDCCallback (state validation, code exchange, userinfo)
- lib/samlClient.ts: initiateSAMLFlow (samlify SP createLoginRequest, SAMLState record), handleSAMLCallback (parseLoginResponse, signature validation)
- lib/openFGASync.ts: syncUserGroups — writes AppUserGroupMember tuples to OpenFGA; failure is non-throwing (Sentry + log)
- router.ts: GET /auth/builder/idps, GET /auth/portal/idps, GET /auth/init/:idpId, GET /auth/callback/oidc/:idpId, POST /auth/callback/saml/:idpId, POST /auth/service-token; also CRUD routes for builder + portal IdPs
- service.ts: listBuilderIdPs, createBuilderIdP, updateBuilderIdP, listAppIdPs, listEnabledAppIdPs, createAppIdP (encrypts config via secretsProvider), updateAppIdP, toggleAppIdP, getAppIdPConfig/getBuilderIdPConfig
- 9 new tests (20 total passing): OAuthState creation + TTL, SAMLState creation, enabled IdP filtering, disabled IdP exclusion, OpenFGA sync success + failure non-throwing + empty-membership skip

### 2026-05-06 — Phase 1 complete
- Local Postgres conflict on port 5432 (macOS has Postgres running) → Docker postgres mapped to 5433 host port; internal container port remains 5432; DATABASE_URL uses 5433 for local dev.
- Two models not in spec but implied by relations: `DataSource` (from `App.dataSources`) and `AnalyticsEvent` (from `Page.analytics`) — added minimal definitions.
- `FDEUser` model added (implied by auth module POC scope: "FDE user model — ADMIN | FDE roles").
- pnpm 9+ available at `/opt/homebrew/bin/pnpm`; Node 20 at `/opt/homebrew/opt/node@20/bin/node`.
