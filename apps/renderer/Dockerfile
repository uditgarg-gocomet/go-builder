FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/renderer/package.json ./apps/renderer/
COPY packages/core/package.json ./packages/core/
COPY packages/ui/package.json ./packages/ui/
COPY packages/action-runtime/package.json ./packages/action-runtime/
RUN pnpm install --frozen-lockfile --filter @portal/renderer...

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/renderer/node_modules ./apps/renderer/node_modules
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.json ./
COPY apps/renderer ./apps/renderer
COPY packages/core ./packages/core
COPY packages/ui ./packages/ui
COPY packages/action-runtime ./packages/action-runtime
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @portal/renderer build

# Runtime
FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 portal
USER portal

COPY --from=builder --chown=portal:nodejs /app/apps/renderer/.next/standalone ./
COPY --from=builder --chown=portal:nodejs /app/apps/renderer/.next/static ./apps/renderer/.next/static
COPY --from=builder --chown=portal:nodejs /app/apps/renderer/public ./apps/renderer/public

EXPOSE 3002

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/renderer/server.js"]
