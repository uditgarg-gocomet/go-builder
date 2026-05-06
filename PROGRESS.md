# Build Progress

## Status: PHASE 1 COMPLETE

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
- [ ] Auth module
- [ ] Apps module
- [ ] Schema module
- [ ] Registry module
- [ ] Registry seed script — all primitives

## Phase 3 — Execution Layer
- [ ] Endpoint registry module
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

### 2026-05-06 — Phase 1 complete
- Local Postgres conflict on port 5432 (macOS has Postgres running) → Docker postgres mapped to 5433 host port; internal container port remains 5432; DATABASE_URL uses 5433 for local dev.
- Two models not in spec but implied by relations: `DataSource` (from `App.dataSources`) and `AnalyticsEvent` (from `Page.analytics`) — added minimal definitions.
- `FDEUser` model added (implied by auth module POC scope: "FDE user model — ADMIN | FDE roles").
- pnpm 9+ available at `/opt/homebrew/bin/pnpm`; Node 20 at `/opt/homebrew/opt/node@20/bin/node`.
