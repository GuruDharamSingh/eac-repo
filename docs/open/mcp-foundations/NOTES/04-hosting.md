# 04 · Hosting on arts-collective (decided 2026-11-08)

Owner decision (final, via PM): the MCP lives in **arts-collective**,
`https://arts-collective.com/api/mcp`. Sophia was chosen briefly and reversed; see DECISIONS D-1.

## Why it fits

- Container `eac-arts-network` (:3007), the network plane and SSO broker (serving doc §0).
- Everything slice 1 reads is already in-process there: `@elkdonis/actions/server`,
  `@elkdonis/lms` (dock route imports `getLearnerOutline`, `stepTask`, …:
  `src/app/api/actions/dock/route.ts`), the Channel reader `channelNextSource`
  (`src/lib/channel/next-source.ts`), `ACTION_LINKS` (`src/lib/actions/links.ts`).
  The mount passes them in exactly as `actionRoutes` and the dock route do. No cross-host calls.

## Reachability trap

`src/middleware.ts` matcher excludes `/api`, so `/api/mcp` answers on **every host
arts-collective serves**: `tara.arts-collective.com/api/mcp`, and custom domains mapped
through `org_domains`. The route must refuse any `Host` other than the canonical one
(`MCP_PUBLIC_ORIGIN`, default `https://arts-collective.com`) with 404. Otherwise a token's
audience and the org a site implies get confused, and every org domain becomes an MCP door.

`/.well-known/*` (OAuth pass) does go through the middleware; on the canonical host the
middleware returns `next()` (network host), so `src/app/.well-known/…` routes work there.

## Build and memory cost

- Today: arts-collective builds at `NODE_OPTIONS=--max-old-space-size=3584
  NEXT_BUILD_CPUS=2` (`docker-compose.yml:777`), and the build in its own container needs the
  temporary cap raise `docker update --memory 9g --memory-swap 14g eac-arts-network`
  (ops.md, 2026-11-07: "Running TypeScript" was OOM-killed at 5 GiB).
- What the MCP adds: one route file, one new workspace package (`@elkdonis/mcp`, est.
  1,200–1,600 lines of TS), **no new npm dependencies** (zod/v4 and jose are already in the
  tree). Packages it imports (`actions`, `lms`, `services`, `db`) are already compiled into
  this app. Expected effect on peak build memory: small, a few percent at most (estimate, to
  be measured: record `docker stats` peak for the build before and after).
- The official `@modelcontextprotocol/sdk` 1.32.2 would add express 5, hono, ajv, cors,
  eventsource, express-rate-limit, … (npm registry, 2026-11-08) and does not mention protocol
  2026-07-28. That is the dependency weight to avoid on this app (DECISIONS D-6).
- **Lazy route**: yes, in the runtime sense. `app/api/mcp/route.ts` stays a thin file that
  does `const { mcpHandler } = await import('@elkdonis/mcp/server')` on first request, so the
  code is a separate server chunk loaded only when someone calls the MCP (no cost to page
  memory at rest). It is still compiled and type-checked at build time: Next has no
  build-skipped routes. The build-time lever is "no new deps, small package", not laziness.
- Runtime: stateless, no sessions held; rate-limit windows in memory (a few KB).

## Not chosen: sophia (`eac-sophia`, :3020)

It would need the Channel loader and the dock readers either copied in or called across hosts
with a service credential, a second session host for tokens, and its own 3584 MB build budget.
