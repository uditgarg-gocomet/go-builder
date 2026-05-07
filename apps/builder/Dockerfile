FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/builder/package.json ./apps/builder/
COPY packages/core/package.json ./packages/core/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile --filter @portal/builder...

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/builder/node_modules ./apps/builder/node_modules
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.json ./
COPY apps/builder ./apps/builder
COPY packages/core ./packages/core
COPY packages/ui ./packages/ui
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @portal/builder build

# Runtime
FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 portal
USER portal

COPY --from=builder --chown=portal:nodejs /app/apps/builder/.next/standalone ./
COPY --from=builder --chown=portal:nodejs /app/apps/builder/.next/static ./apps/builder/.next/static
COPY --from=builder --chown=portal:nodejs /app/apps/builder/public ./apps/builder/public

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/builder/server.js"]
