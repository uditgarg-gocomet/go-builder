# CLAUDE.md

## Project overview
Client Portal App Builder — POC.
FDEs build and deploy client-facing portals via drag-and-drop without
writing new React components for each client.

## Reference documents
- /docs/poc-scope.md        — full architecture, data models, API surfaces,
                              module boundaries, edge cases, POC scope
- /docs/stack-memo.md       — every stack decision with rationale
- /instructions.md          — session-by-session build guide with
                              deliverables and implementation detail
- PROGRESS.md               — current build state, update after every session

Read all four before starting any task. The spec is the source of truth.
Do not deviate from decisions documented in poc-scope.md or stack-memo.md
without explicit instruction from the user.

## Monorepo structure
pnpm workspaces. Apps in /apps, packages in /packages.
Never install dependencies at root level.
Always install inside the correct app or package.

/apps/backend             Fastify — Core Backend (all modules)
/apps/builder             Next.js — App Builder
/apps/renderer            Next.js — App Renderer
/packages/core            Shared TypeScript types + Zod schemas
/packages/ui              shadcn/ui primitives + Radix UI
/packages/action-runtime  ActionExecutor + FormManager + EventBus

## Build order
Always follow this order. Never skip ahead.
1.  Monorepo skeleton + tooling
2.  Prisma schema + migration
3.  /lib — db, redis, secrets, logger, sentry
4.  Core Backend entry point + health check + Docker Compose
5.  Auth module
6.  Apps module
7.  Schema module
8.  Registry module + primitive seeding
9.  Endpoint registry module
10. Connector module
11. Assets module
12. Action logs module
13. /packages/core
14. /packages/ui
15. /packages/action-runtime
16. App Builder
17. App Renderer

## Non-negotiable rules

### TypeScript
- Strict mode everywhere — tsconfig strict: true
- No `any` unless explicitly justified with a comment
- All function parameters and return types explicitly typed
- No non-null assertions (!) unless unavoidable with comment

### Validation
- Zod for all input validation — every API endpoint
- Shared Zod schemas live in /packages/core
- Never trust unvalidated input at any boundary

### Database
- Prisma is the only way to touch the database
- No raw SQL except jsonb queries explicitly approved in spec
- Every query must go through the db singleton from /lib/db.ts
- Never instantiate PrismaClient outside of /lib/db.ts

### Backend
- Every Fastify route must have request + response Zod schemas
- Every module exposes a service.ts public interface
- No module imports another module's router or internal files
- Modules communicate only through service.ts interfaces
- pino for all logging — never console.log in production code
- All secrets go through SecretsProvider — never hardcode or log secrets
- correlationId must be attached to every inbound request and passed downstream

### Frontend
- No inline styles — Tailwind classes only
- CSS variables for all theme tokens — never hardcode brand colors
- No direct fetch() calls in components — always go through the api client
- action-runtime is the only place action execution logic lives

### Testing
- Write tests alongside each module — not after
- Every service.ts function must have at least one test
- Edge cases listed in the spec must have corresponding tests

### Git
- Commit after each session is complete and tested
- Commit message format: feat(module-name): description
- Never commit .env files — only .env.example

## Commands
pnpm install                          install all dependencies
pnpm --filter @portal/backend dev     run backend
pnpm --filter @portal/builder dev     run builder
pnpm --filter @portal/renderer dev    run renderer
pnpm --filter @portal/backend db:migrate   run migrations
pnpm --filter @portal/backend db:seed      seed registry
pnpm --filter @portal/backend test         test backend
docker-compose up -d                  start infrastructure
docker-compose down                   stop infrastructure



## Handling incomplete sessions
If a session is too large to complete in one context window:
1. Do as much as possible
2. Add a note to PROGRESS.md under the session:
   "PARTIAL — completed: [what was done]. Remaining: [what is left]"
3. Start the next Claude Code instance with the universal prompt
   Claude Code will read the partial note and continue from there

## Spec compliance check
Run this any time you want to verify a module matches the spec:

  Review [file or folder path] against the [module name] section
  of /docs/poc-scope.md. List anything missing, incorrectly
  implemented, or deviating from the decisions table.

## Edge case check
Run this after completing any backend module:

  Check that all edge cases listed in the [module name] section
  of /docs/poc-scope.md have corresponding test coverage.
  List any that are missing and add tests for them.

## When something is broken
  The current behaviour is [X].
  The spec in /docs/poc-scope.md says [Y].
  Fix the implementation to match the spec.
  Do not change the tests unless the spec explicitly
  says the test expectation is wrong.
