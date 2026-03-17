# ==================================================================
# Production Dockerfile for Inner Gathering App
# ==================================================================
# Multi-stage build for optimized production image
# Memory target: ~300-500MB (vs 1.5GB in dev)
# ==================================================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/ui/package.json ./packages/ui/
COPY packages/auth-client/package.json ./packages/auth-client/
COPY packages/auth-server/package.json ./packages/auth-server/
COPY packages/services/package.json ./packages/services/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/hooks/package.json ./packages/hooks/
COPY packages/nextcloud/package.json ./packages/nextcloud/
COPY packages/redis/package.json ./packages/redis/
COPY apps/inner-gathering/package.json ./apps/inner-gathering/

# Install dependencies
RUN pnpm install --frozen-lockfile --prod=false

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/inner-gathering/node_modules ./apps/inner-gathering/node_modules

# Copy source code
COPY . .

# Build shared packages first
RUN pnpm --filter @elkdonis/db build
RUN pnpm --filter @elkdonis/types build
RUN pnpm --filter @elkdonis/utils build
RUN pnpm --filter @elkdonis/nextcloud build
RUN pnpm --filter @elkdonis/redis build
RUN pnpm --filter @elkdonis/auth-client build
RUN pnpm --filter @elkdonis/auth-server build
RUN pnpm --filter @elkdonis/services build
RUN pnpm --filter @elkdonis/hooks build
RUN pnpm --filter @elkdonis/ui build

# Build inner-gathering app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
WORKDIR /app/apps/inner-gathering
RUN pnpm build

# Stage 3: Production Runtime
FROM node:20-alpine AS production
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Add non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application from builder
COPY --from=builder --chown=nextjs:nodejs /app/apps/inner-gathering/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/inner-gathering/.next/static ./apps/inner-gathering/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/inner-gathering/public ./apps/inner-gathering/public

# Copy package files for migrations
COPY --from=builder --chown=nextjs:nodejs /app/packages/db ./packages/db
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

USER nextjs

EXPOSE 3004

ENV PORT=3004
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/inner-gathering/server.js"]
