# EAC self-hosted Silex editor.
#
# ── Which upstream image ────────────────────────────────────────────────────
# `silexlabs/silex` on Docker Hub is a DEPRECATED name — it was built by Docker
# Hub Autobuild from a legacy repo and stopped at 3.7.0 (last push 2026-06-16),
# because Silex 3.8+ replaced Autobuild with a tag-triggered GitHub workflow
# (.github/workflows/docker.yml) that publishes only `silexlabs/silex-platform`.
#
# `silexlabs/silex-platform` is the current canonical image (the one behind
# v3.silex.me and the CapRover one-click app): `:latest` = 3.9.0, `:canary` =
# 3.10.0-canary. Bump SILEX_VERSION and rebuild to move.
#
# ── Why we still need our own layer ─────────────────────────────────────────
# silex-platform bundles "the full SaaS": a multi-site dashboard whose `/` route
# 302-redirects before the editor renders, plus an onboarding backend and FTP
# connectors. Silex loads that from server/deploy/.silex.js — a path hardcoded
# in server/config.js, not env-configurable — so we bake our own minimal
# version over it. It registers only the static editor client; the Nextcloud
# storage/hosting connectors + one-time token bridge come from
# SILEX_SERVER_CONFIG (packages/silex-nextcloud-connector, bind-mounted).

ARG SILEX_VERSION=3.9.0
FROM silexlabs/silex-platform:${SILEX_VERSION}

# Replace the SaaS deploy config. The relative `../../dist/...` requires inside
# it resolve the same in this image (/silex/server/deploy → /silex/dist) as in
# a plain `npm i @silexlabs/silex` tree.
COPY packages/silex/eac-deploy-config.js /silex/server/deploy/.silex.js

# Mount point for the bind-mounted connector package (see docker-compose.yml).
RUN mkdir -p /silex/extensions

# Base image already sets SILEX_PORT=6805, WORKDIR /silex, and
# CMD ["pnpm","start"] (→ node dist/server/server/). Nothing else to do.
EXPOSE 6805

# Note: silex-platform is ~1.5GB (it ships the full monorepo build tree). If
# that matters, an alternative is `FROM node:24-bookworm-slim` +
# `npm i @silexlabs/silex@<version>` (~370MB) — the connector wiring is
# identical, only the .silex.js require paths shift to
# node_modules/@silexlabs/silex/server/deploy/.silex.js.

