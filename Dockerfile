# Multi-stage Dockerfile for Next.js application
FROM node:20-alpine AS base

# Accept app name as build argument (default: admin)
ARG APP_NAME=admin

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Development stage
FROM base AS development

WORKDIR /app

# Copy all source code (development doesn't need multi-stage optimization)
COPY --chown=node:node . .

USER node

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

# Re-declare ARG for this stage
ARG APP_NAME=admin

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

# Re-declare ARG for this stage
ARG APP_NAME=admin

WORKDIR /app

ENV NODE_ENV=production

# Copy production dependencies
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/apps/${APP_NAME}/node_modules ./apps/${APP_NAME}/node_modules
COPY --from=prod-deps --chown=node:node /app/packages/*/node_modules ./packages/*/node_modules

# Copy built application
COPY --from=build --chown=node:node /app/apps/${APP_NAME}/.next ./apps/${APP_NAME}/.next
COPY --from=build --chown=node:node /app/apps/${APP_NAME}/public ./apps/${APP_NAME}/public
COPY --from=build --chown=node:node /app/packages/*/dist ./packages/*/dist

# Copy necessary config files
COPY --chown=node:node package.json ./
COPY --chown=node:node turbo.json ./
COPY --chown=node:node apps/${APP_NAME}/package.json ./apps/${APP_NAME}/
COPY --chown=node:node apps/${APP_NAME}/next.config.* ./apps/${APP_NAME}/
COPY --chown=node:node packages/*/package.json ./packages/*/

USER node

EXPOSE 3000

# Use APP_NAME in start command
WORKDIR /app/apps/${APP_NAME}
CMD ["pnpm", "start"]