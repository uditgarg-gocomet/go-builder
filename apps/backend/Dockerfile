FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/core/package.json ./packages/core/
COPY packages/ui/package.json ./packages/ui/
COPY packages/action-runtime/package.json ./packages/action-runtime/
RUN pnpm install --frozen-lockfile --filter @portal/backend...

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.json ./
COPY apps/backend ./apps/backend
COPY packages/core ./packages/core
RUN pnpm --filter @portal/backend build

# Runtime
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat dumb-init
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 portal
USER portal

COPY --from=builder --chown=portal:nodejs /app/apps/backend/dist ./dist
COPY --from=builder --chown=portal:nodejs /app/apps/backend/node_modules ./node_modules
COPY --from=builder --chown=portal:nodejs /app/apps/backend/prisma ./prisma
COPY --from=builder --chown=portal:nodejs /app/apps/backend/package.json ./package.json

EXPOSE 3001

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
