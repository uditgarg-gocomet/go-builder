# Stack Pick Memo

**Project:** Client Portal App Builder  
**Status:** Pending team review  
**Purpose:** One pick + one-paragraph rationale per stack axis before implementation lock

---

## Services & Deployment

### Monorepo Tooling
**Pick:** pnpm workspaces + Turborepo (added post-Day 1)

pnpm workspaces gives the fastest install times and strictest dependency isolation across apps and packages with zero configuration overhead. Turborepo is deferred to Day 3 because its primary value is build caching — something that only matters once the repo has enough packages to make cold builds painful. Starting with raw pnpm workspaces means Day 1 is not blocked on pipeline configuration.

---

### Core Backend
**Pick:** Single Fastify process + TypeScript + Postgres + Prisma — all backend logic as isolated modules

For the POC, all backend concerns live inside one Fastify process organised as isolated modules — apps, schema, registry, endpoint registry, connector, auth, assets, and action logs. Each module has its own router and service interface but shares a single Prisma client, Redis client, and logger. This eliminates inter-service HTTP overhead, service token management, and multiple deployment targets while the system is still being validated. Module boundaries are enforced by convention so extraction to separate services post-POC is a lift-and-shift rather than a rewrite.

---

### App Builder
**Pick:** Next.js (App Router) + Zustand + @dnd-kit/core + zundo

Next.js was chosen over a plain React SPA because it gives routing, API routes for preview sessions and asset uploads, and server-side rendering for the FDE login page without additional infrastructure. Zustand handles the complex nested canvas state — four stores covering canvas, pages, app config, and registry cache — because its minimal API surface lets us move fast without Redux's ceremony, while the zundo temporal middleware adds undo/redo in roughly ten lines of code. @dnd-kit was chosen over react-beautiful-dnd because it is actively maintained, headless, and handles both the component panel drag source and the canvas drop target in a single unified context.

---

### App Renderer Engine
**Pick:** Next.js (App Router) — separate deployment per tenant

The Renderer is a separate Next.js application from the Builder because their lifecycles are completely different — the Builder is an internal FDE tool that rebuilds rarely, while the Renderer rebuilds on every publish and is the client-facing surface that must be fast and isolated per tenant. Next.js was chosen specifically because generateStaticParams maps naturally to the multi-page portal model, SSR gives fast first render without client-side data fetching, and the middleware layer gives us a clean place to run JWT validation and OpenFGA checks on every request before any page component executes.

---

### Action Runtime
**Pick:** Shared package — `/packages/action-runtime`

After simplifying the Event/Action Pipeline by removing webhook delivery complexity, all remaining logic — ActionExecutor, FormManager, ComponentEventBus — is client-side and has no server component. Packaging it as a shared library consumed by both the Renderer and Builder means the same action execution logic runs in preview mode (Builder) and production (Renderer) without duplication. The package has no framework dependency — pure TypeScript — so it can be consumed by any future consumer without coupling to Next.js.

---

### Preview / Sandbox Service
**Pick:** Merged into Builder — Redis-backed preview sessions

The Preview Service has no meaningful existence as a separate deployment because its entire job is to render draft schemas that the Builder already holds in memory. Storing preview sessions in Redis with a one-hour TTL gives instant schema reads for the preview renderer route, survives Builder server restarts, and supports share links without any database writes. The preview renderer is a Next.js route inside the Builder app that reuses SchemaRenderer and mock provider implementations from the action-runtime package — no new rendering infrastructure is needed.

---

### Asset & Media Service
**Pick:** Merged into Core Backend — LocalStorage for POC, S3-compatible post-POC

Asset management at POC scale does not warrant a separate deployment. The storage layer is fully abstracted behind a StorageProvider interface with two implementations — LocalStorageProvider writing to disk for the POC and S3StorageProvider for production — so the swap requires changing one environment variable and zero application code. Content-addressed storage keys (SHA-256 hash of file content) give deduplication and cache-forever headers for free, without any versioning complexity.

---

## Language & Runtime

### Language
**Pick:** TypeScript across all services and packages

TypeScript was chosen uniformly across the stack because the most expensive bugs in a platform like this are contract mismatches between services — a schema the Builder writes that the Renderer cannot parse, or props a component expects that the Registry does not validate. TypeScript with shared types in `/packages/core` makes these mismatches compile-time errors rather than runtime surprises. The cost is a slightly slower initial setup which is fully offset by the reduction in integration debugging time.

---

### Runtime
**Pick:** Node.js 20 LTS

Node.js 20 LTS was chosen for stability and ecosystem compatibility. All chosen libraries — Fastify, Prisma, openid-client, jose, samlify, pino — have first-class Node.js support. Bun and Deno were considered but rejected because Prisma's native module support and several auth libraries have known compatibility gaps that would create unpredictable debugging overhead during a time-constrained POC.

---

## Frontend

### App Builder & Renderer Framework
**Pick:** Next.js 14+ (App Router)

Covered above per service. The consistent choice across both Builder and Renderer means shared knowledge, shared component types, and shared middleware patterns across the two most complex applications in the stack.

---

### State Management
**Pick:** Zustand + Immer + zundo

Zustand with Immer middleware handles the deep nested mutations in canvas state (adding nodes, reparenting subtrees, updating props) without manual spread chains. The zundo temporal middleware wraps the canvas store to provide undo/redo with a configurable history depth of fifty steps. Jotai was considered for its atomic model but rejected because the canvas state has too many interdependencies — moving a node requires updating nodes, childMap, and parentMap simultaneously — which fits Zustand's store model better than Jotai's atom model.

---

### Design System
**Pick:** shadcn/ui (copy-paste) + Radix UI primitives

shadcn/ui is not a dependency — it is a collection of copy-pasted components that live in `/packages/ui` and are fully owned by the team. This means no version lock, no upstream breaking changes, and complete freedom to extend components with schema-driven prop interfaces. Every shadcn component is built on Radix UI which provides accessibility (ARIA, keyboard navigation, focus management) out of the box. The alternative — building from raw Radix — was rejected because shadcn gives us a production-quality starting point that would take weeks to replicate.

---

### Theming
**Pick:** Tailwind CSS + CSS Variables

Tailwind handles layout and utility styling at build time with zero runtime cost. CSS variables handle per-client theme tokens (brand colors, fonts, border radius) that must be injected at runtime from the page schema — something build-time CSS solutions like Vanilla Extract cannot do without significant complexity. The two work naturally together: Tailwind utility classes reference CSS variables defined by the ThemeProvider, so a single component works correctly across any client theme without any conditional styling logic.

---

### Specialised Component Libraries

| Primitive | Library | Reason |
|---|---|---|
| Data Table | TanStack Table | Headless, most powerful, handles sorting/filtering/pagination |
| Charts | Recharts | React-native, composable, good enough for 90% of portal use cases |
| Date Picker | React DayPicker | Lightweight, accessible, Radix-compatible |
| Rich Text | TipTap | Headless, extensible, widely used |
| Forms | React Hook Form + Zod | Already using Zod, natural fit |
| Drag & Drop | @dnd-kit/core | Used in Builder canvas — same lib for any sortable primitives |
| Virtual Lists | TanStack Virtual | For large data sets in DataTable |

---

## Data & Infrastructure

### Primary Database
**Pick:** PostgreSQL 16

Postgres handles both relational data (apps, pages, deployments, users) and schema blobs (jsonb columns for page schemas, component props schemas, endpoint response schemas) in a single database. The jsonb operators allow future introspection queries — finding all pages using a deprecated component — without a separate document store. Separate databases per concern were considered and rejected for the POC because the operational overhead of managing connection pools, migrations, and backups across multiple databases is not justified at this stage.

---

### Cache & Session Store
**Pick:** Redis 7

Redis serves three distinct purposes in the stack: session revocation (sets of active token families per user), preview session storage (JSON blobs with TTL), and rate limiting in the connector module (sorted sets for sliding window counters). A single Redis instance handles all three for the POC. The data structures required — sets, sorted sets, string keys with TTL — are core Redis primitives available in any managed Redis offering, making the production migration straightforward.

---

### ORM
**Pick:** Prisma

Prisma generates TypeScript types directly from the schema file, which means every database query is fully typed end to end. The migration system is straightforward for a team moving fast — `prisma migrate dev` during development, `prisma migrate deploy` in CI. The alternative — Drizzle — was considered for its lighter runtime footprint but rejected because Prisma's ecosystem maturity and tooling (Prisma Studio for data inspection during development) outweigh the performance difference at POC scale.

---

## Auth & Security

### JWT Algorithm
**Pick:** RS256 (asymmetric)

RS256 was chosen over HS256 because the public key can be distributed to the Renderer, Builder, and any other validator via a JWKS endpoint, allowing each service to validate tokens independently without holding the signing secret. This means a compromised Renderer cannot forge tokens — it only ever sees the public key. The JWKS endpoint also enables future key rotation without redeploying every service simultaneously.

---

### IdP Protocols
**Pick:** OIDC + SAML via openid-client + samlify

openid-client is the most complete and actively maintained OIDC library for Node.js, with full PKCE support which is required for secure authorization code flows. samlify handles SAML 2.0 with support for both SP-initiated and IdP-initiated flows. Both libraries are chosen for FDE Builder auth and per-app portal auth — the same code path handles both contexts with different IdP configurations loaded from the database.

---

### Authorization
**Pick:** OpenFGA

OpenFGA implements the Zanzibar relationship-based authorization model which maps directly to the problem — users belong to groups, groups have access to pages and widgets, access rules are defined per app by FDEs. The alternative — a custom RBAC implementation in Postgres — was rejected because it would require reimplementing relationship traversal, tuple storage, and authorization checks that OpenFGA provides out of the box and has already proven at scale.

---

### Secret Storage
**Pick:** AES-256-GCM at application layer (POC) → Vault / AWS Secrets Manager (production)

For the POC, connector credentials and IdP configs are encrypted with AES-256-GCM before writing to Postgres, with the encryption key held in an environment variable. The encryption logic sits behind a SecretsProvider interface with two implementations — EnvEncryptionProvider for POC and VaultProvider for production — so the migration requires implementing one interface and changing one environment variable. Storing secrets in plaintext was never considered.

---

## Data & Transforms

### Response Transforms
**Pick:** JSONata

JSONata was chosen for response transformation because it is a purpose-built JSON query and transformation language with a clean expression syntax that FDEs can write directly in the Builder UI. The alternative — JavaScript eval — was rejected for security reasons. Lodash-style transforms were considered but rejected because they require code, not expressions, which cannot be safely stored in a page schema and edited by non-engineers.

---

### JSON Diff
**Pick:** fast-json-patch (RFC 6902)

JSON Patch is the standard format for describing changes to a JSON document and maps directly to the operation types FDEs perform on a page schema — adding components, removing components, updating props. fast-json-patch is a well-maintained implementation that computes the minimal diff between two JSON objects. The diff is stored alongside each PageVersion so the Builder can render a human-readable changelog without recomputing it on every read.

---

## Build & Tooling

### Build Tool
**Pick:** Turbopack (Next.js apps) + Vite (shared packages)

Next.js 14+ ships with Turbopack as an opt-in dev server — faster HMR than Webpack with no configuration. Shared packages in `/packages/*` use Vite with vite-plugin-dts for fast builds and correct TypeScript declaration file generation. esbuild directly was considered for packages but rejected because Vite wraps it with a better plugin ecosystem and watch mode.

---

### Package Manager
**Pick:** pnpm

pnpm's workspace protocol (`workspace:*`) handles inter-package dependencies in the monorepo with strict hoisting rules that prevent phantom dependency bugs. Install times are significantly faster than npm and yarn because pnpm uses a content-addressed store with hard links rather than copying node_modules per package. Yarn Berry was considered but rejected because its Plug'n'Play module resolution has known compatibility issues with several native Node.js modules used in the auth and crypto layers.

---

### Error Tracking
**Pick:** Sentry

Sentry is the only decision in this memo that was locked early and never reconsidered. It provides error tracking, performance monitoring, release tracking, and source map support across all services and both Next.js applications with a single DSN per environment. The initSentry(service) factory in `/packages/core` ensures consistent configuration — sampling rates, data scrubbing, release tagging — across every deployment without duplicating setup code.

---

## Summary Table

| Axis | Pick |
|---|---|
| Monorepo | pnpm workspaces + Turborepo (Day 3+) |
| Backend | Single Fastify process — all modules inside |
| Auth placement | Inside Core Backend — isolated /auth module |
| App Builder | Next.js + Zustand + Immer + zundo + @dnd-kit |
| Renderer | Next.js — separate deployment per tenant |
| Action Runtime | Shared package — /packages/action-runtime |
| Preview Service | Merged into Builder — Redis sessions |
| Asset Service | Merged into Core Backend — LocalStorage POC |
| Language | TypeScript — strict mode everywhere |
| Runtime | Node.js 20 LTS |
| State Management | Zustand + Immer + zundo |
| Design System | shadcn/ui + Radix UI |
| Styling | Tailwind CSS + CSS variables |
| Data Tables | TanStack Table |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Rich Text | TipTap |
| Drag & Drop | @dnd-kit/core |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| ORM | Prisma |
| JWT | RS256 via jose |
| IdP Protocols | OIDC + SAML via openid-client + samlify |
| Password Hashing | argon2 |
| Authorization | OpenFGA |
| Secret Storage | AES-256-GCM env-key (POC) → Vault (production) |
| Response Transforms | JSONata |
| JSON Diff | fast-json-patch (RFC 6902) |
| Build — Apps | Turbopack (Next.js default) |
| Build — Packages | Vite + vite-plugin-dts |
| Package Manager | pnpm |
| Deployment | Docker + Nginx |
| Error Tracking | Sentry |
| Logging | pino |

---

## Review Checklist

Before locking this memo into the spec, the team should validate:

```
⬜ Node.js 20 LTS available in your Docker base image registry
⬜ OpenFGA can be self-hosted in your infrastructure for POC
⬜ Sentry DSN provisioned for staging + production environments
⬜ Postgres 16 available in your preferred managed DB offering
⬜ Redis 7 available in your preferred managed cache offering
⬜ pnpm version pinned in packageManager field in root package.json
⬜ RS256 key pair generated and stored securely before first deploy
⬜ AES-256-GCM encryption key generated (32 bytes) and stored in secrets
⬜ Team has reviewed IdP protocol choices against client IdP requirements
⬜ Turborepo pipeline config owner assigned for Day 3
⬜ CI/CD pipeline for Renderer rebuild identified (Jenkins / GitHub Actions / GitLab CI)
```

---

*Once the team signs off on this memo, it gets committed to the spec and implementation begins.*
