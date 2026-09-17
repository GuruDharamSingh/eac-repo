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

# ── Vendored GrapesJS plugins ───────────────────────────────────────────────
# Third-party editor plugins, installed into their OWN npm tree at
# /silex/eac-vendor rather than into /silex/node_modules: the base image's tree
# is pnpm-managed (symlinked .pnpm store), and `npm i` into it rewrites those
# links and can leave Silex itself unresolvable.
#
# Only the UMD bundle of each is ever served (see the connector's
# editorAssetsMiddleware → /eac-vendor/<id>.js). They are loaded in the browser
# as <script> tags, because the client config is served raw to the browser and
# cannot resolve bare npm specifiers.
#
# Which of these actually run in the editor is decided in client-config.js —
# installing a plugin here only makes it AVAILABLE. See VENDOR_PLUGINS there
# for what is on by default and what is opt-in via `?plugins=`.
#
# NOT here on purpose: @silexlabs/grapesjs-ui-suggest-classes. npm deprecates
# it in favour of @silexlabs/grapesjs-advanced-selector, which this image
# ALREADY bundles (/silex/grapesjs-plugins/grapesjs-advanced-selector) and
# whose code the built client already references. Installing it would have
# been a deprecated second copy of a feature Silex ships.
ARG EAC_VENDOR_PLUGINS="grapesjs-tabs@1.0.6 grapesjs-rte-extensions@1.0.13 grapesjs-project-manager@2.0.6 grapesjs-blocks-flexbox@1.0.1 grapesjs-blocks-table@1.1.2 grapesjs-plugin-export@1.0.12 grapesjs-preset-newsletter@1.0.2 grapesjs-mjml@1.0.8"
RUN mkdir -p /silex/eac-vendor \
 && cd /silex/eac-vendor \
 && npm init -y > /dev/null \
 && npm i --no-audit --no-fund --omit=dev ${EAC_VENDOR_PLUGINS} \
 && npm cache clean --force

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

