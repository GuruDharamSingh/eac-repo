# Multi-stage Dockerfile for Next.js application
FROM node:20-alpine AS base

# Accept app name as build argument (default: admin)
ARG APP_NAME=admin

# Install pnpm somewhere every uid can use it. The app containers run as the
# host user (compose `user:`), not root, so nothing they write into the
# bind-mounted repo comes out root-owned; corepack's default cache is under
# /root and would be unreadable to them.
ENV COREPACK_HOME=/opt/corepack
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate \
 && chmod -R a+rwX /opt/corepack
# A writable HOME for a uid that has no passwd entry.
ENV HOME=/tmp/home
RUN mkdir -p /tmp/home && chmod 1777 /tmp/home

# Native-addon toolchain. sweph (Swiss Ephemeris, used by @elkdonis/astro)
# ships only glibc prebuilds, so on Alpine/musl it compiles from source during
# pnpm install. Every app shares one node_modules, so every image needs this
# for an install to succeed, not just elastrocal's.
RUN apk add --no-cache python3 make g++

# Development stage
#
# Deliberately empty of source and node_modules. Every service bind-mounts the
# repo over /app, which hid whatever was copied and installed here — sixteen
# ~3GB images each carrying a node_modules nothing could see. One slim image
# (`eac-dev`) now serves every app. Dependencies are installed into the
# mounted tree by the one-shot `install` service:
#     docker compose run --rm install
FROM base AS development

WORKDIR /app

EXPOSE 3000

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
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/${APP_NAME}/node_modules ./apps/${APP_NAME}/node_modules
COPY --from=prod-deps /app/packages/*/node_modules ./packages/*/node_modules

# Copy built application
COPY --from=build /app/apps/${APP_NAME}/.next ./apps/${APP_NAME}/.next
COPY --from=build /app/apps/${APP_NAME}/public ./apps/${APP_NAME}/public
COPY --from=build /app/packages/*/dist ./packages/*/dist

# Copy necessary config files
COPY package.json ./
COPY turbo.json ./
COPY apps/${APP_NAME}/package.json ./apps/${APP_NAME}/
COPY apps/${APP_NAME}/next.config.* ./apps/${APP_NAME}/
COPY packages/*/package.json ./packages/*/

EXPOSE 3000

# Use APP_NAME in start command
WORKDIR /app/apps/${APP_NAME}
CMD ["pnpm", "start"]