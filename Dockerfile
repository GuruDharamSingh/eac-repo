# Multi-stage Dockerfile for Next.js application
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Development stage
FROM base AS development

WORKDIR /app

# Copy all source code (development doesn't need multi-stage optimization)
COPY . .

# Install dependencies
RUN pnpm install

# Build database package
WORKDIR /app

# Expose port
EXPOSE 3000

# Start development server
CMD ["pnpm", "dev"]

# Production dependencies stage
FROM base AS prod-deps

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
COPY turbo.json ./
COPY pnpm-workspace.yaml ./
COPY apps/*/package.json ./apps/*/
COPY packages/*/package.json ./packages/*/

RUN pnpm install --prod --frozen-lockfile

# Build stage
FROM base AS build

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
COPY turbo.json ./
COPY pnpm-workspace.yaml ./
COPY apps/*/package.json ./apps/*/
COPY packages/*/package.json ./packages/*/

RUN pnpm install --frozen-lockfile

COPY . .

# Build all packages
RUN pnpm build

# Production stage
FROM base AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy production dependencies
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/admin/node_modules ./apps/admin/node_modules
COPY --from=prod-deps /app/packages/*/node_modules ./packages/*/node_modules

# Copy built application
COPY --from=build /app/apps/admin/.next ./apps/admin/.next
COPY --from=build /app/apps/admin/public ./apps/admin/public
COPY --from=build /app/packages/*/dist ./packages/*/dist

# Copy necessary config files
COPY package.json ./
COPY turbo.json ./
COPY apps/admin/package.json ./apps/admin/
COPY apps/admin/next.config.* ./apps/admin/
COPY packages/*/package.json ./packages/*/

EXPOSE 3000

CMD ["pnpm", "start"]