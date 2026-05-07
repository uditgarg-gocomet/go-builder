# Portal Builder

POC — Client Portal App Builder. FDEs build and deploy client-facing portals via drag-and-drop without writing new React components for each client.

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 (`npm install -g pnpm`)
- Docker + Docker Compose

## Quick Start (Development)

```bash
# Start infrastructure (Postgres, Redis, OpenFGA)
docker-compose up -d

# Install all dependencies
pnpm install

# Run database migration + seed
pnpm --filter @portal/backend db:migrate
pnpm --filter @portal/backend db:seed

# Start all services in separate terminals
pnpm --filter @portal/backend dev    # http://localhost:3001
pnpm --filter @portal/builder dev    # http://localhost:3000
pnpm --filter @portal/renderer dev   # http://localhost:3002
```

## Development Workflow

```bash
# Run backend tests
pnpm --filter @portal/backend test

# Type-check all apps
pnpm --filter @portal/backend exec tsc --noEmit
pnpm --filter @portal/builder exec tsc --noEmit
pnpm --filter @portal/renderer exec tsc --noEmit

# Stop infrastructure
docker-compose down
```

## Production Build

```bash
# Build and start all services via Docker Compose
docker-compose -f docker-compose.prod.yml up --build -d

# Services exposed via nginx at:
#   http://builder.localhost  → App Builder
#   http://api.localhost      → Core Backend API
#   http://app.localhost      → App Renderer

# Health check
./scripts/health-check.sh
```

Add these to `/etc/hosts` for local production simulation:
```
127.0.0.1  builder.localhost
127.0.0.1  api.localhost
127.0.0.1  app.localhost
```

## Environment Variables

Copy `.env.example` to `.env` and fill in values.

### Backend (`apps/backend/.env`)
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | HS256 signing secret for access tokens |
| `JWT_REFRESH_SECRET` | HS256 signing secret for refresh tokens |
| `ENCRYPTION_KEY` | 32-byte hex key for connector auth config encryption |
| `BUILD_WEBHOOK_SECRET` | HMAC-SHA256 secret for renderer webhook |
| `OPENFGA_API_URL` | OpenFGA HTTP endpoint |
| `OPENFGA_STORE_ID` | OpenFGA store ID |
| `SENTRY_DSN` | (optional) Sentry error tracking DSN |

### Builder (`apps/builder/.env.local`)
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Public URL of Core Backend |
| `BACKEND_INTERNAL_URL` | Server-side URL of Core Backend |

### Renderer (`apps/renderer/.env.local`)
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Public URL of Core Backend |
| `BACKEND_INTERNAL_URL` | Server-side URL of Core Backend |
| `NEXT_PUBLIC_APP_ENVIRONMENT` | `STAGING` or `PRODUCTION` |
| `APP_SLUG` | App slug for static generation |
| `BUILD_WEBHOOK_SECRET` | Matches backend webhook secret |
| `REVALIDATE_TOKEN` | Secret for internal revalidation route |
| `JWKS_URL` | Backend JWKS endpoint for JWT verification |
| `OPENFGA_API_URL` | OpenFGA HTTP endpoint |
| `OPENFGA_STORE_ID` | OpenFGA store ID |

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  browser                                             │
│  ┌─────────────┐  ┌─────────────┐                   │
│  │   Builder   │  │  Renderer   │                   │
│  │  (Next.js)  │  │  (Next.js)  │                   │
│  └──────┬──────┘  └──────┬──────┘                   │
│         │                │                           │
│         └───────┬─────────┘                          │
│                 ▼                                    │
│         ┌──────────────┐                            │
│         │Core Backend  │                            │
│         │  (Fastify)   │                            │
│         └──┬──┬──┬─────┘                            │
│            │  │  │                                  │
│       Postgres Redis OpenFGA                        │
└──────────────────────────────────────────────────────┘
```

**Monorepo structure:**
- `apps/backend` — Fastify API (auth, apps, schema, registry, connector, assets, action-logs)
- `apps/builder` — Next.js drag-and-drop builder UI
- `apps/renderer` — Next.js portal renderer (SSG + ISR)
- `packages/core` — Shared TypeScript types + Zod schemas
- `packages/ui` — shadcn/ui component primitives
- `packages/action-runtime` — ActionExecutor, FormManager, EventBus
