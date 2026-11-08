# 05 · Slice 1 build log (2026-11-08)

PM go 2026-11-08 (D-3 approved, D-4/D-5 approved for later, D-6 "verify, then decide").
Built read-only. Nothing deployed or restarted; the arts-collective build is the PM's.

## What was built

| Commit / file | What |
|---|---|
| `0fd68d0f` packages/actions | `agent?: 'read'|'draft'` on `ActionMeta`; `src/agent.ts` (map + `withAgent`, never appOnly); `agentExposure`, `AGENT_READ_IDS`, `AGENT_DRAFT_IDS`; `check:registry` rules. Coordinated with system32-9c (no collision). |
| `packages/mcp/` (new) | handler, grants, org lock, tools, audit, limits, sanitiser; `scripts/{harness,test,serve,mint-key}.mts`; README |
| `apps/arts-collective/src/app/api/mcp/route.ts` | thin lazy route, passes `ACTION_LINKS`, `channelNextSource`, the LMS readers |
| `apps/arts-collective/{package.json,next.config.ts}` | deps `@elkdonis/mcp`, `@modelcontextprotocol/server@2.4.0`; `transpilePackages` + `serverExternalPackages` |
| `pnpm-lock.yaml` | `docker compose run --rm install` (the documented path): +50 lines, additions only |
| `migrations/NNN_mcp_grants.sql` (this folder) | **parked**: `mcp_grants` + `action_events.agent_id`. Needs Justin's approval to run |

## Deviations from PLAN.md

- **SDK, not in-house** (D-6 verified): `@modelcontextprotocol/server` 2.4.0 `createMcpHandler`,
  `legacy: 'stateless'`, `responseMode: 'json'`. 2025-era requests come back as SSE (the
  legacy leg's transport); clients must accept both, and do.
- `entry_status` takes `id` as a plain string, not a JSON Schema enum: the SDK rejects enum
  misses before the tool runs, which would leave refused (e.g. appOnly) ids unaudited. The ids
  are listed in the tool description; the tool refuses anything not exposed.
- `content_passport` not built: the content lane's `content-passport` entry doesn't exist yet.
- Host check reads `X-Forwarded-Host` first, then `Host`.

## Tests run

- `pnpm --filter @elkdonis/mcp test` (in-process, real DB as Justin, in-memory keys/audit):
  **55 passed, 0 failed**: 401 no key / device token / unknown / expired; 404 org subdomain,
  mapped domain, forwarded org host; 403 foreign Origin; 405 GET/DELETE; 413 > 64 KiB;
  2025-11-25 initialize, no session id; tools/list in both eras; 2026-07-28 header/body
  mismatch → 400; read-only annotations; no appOnly/unexposed ids listed; **appOnly id
  refused and audited**; appOnly entry not callable as a tool; bound key cannot reach another
  org (even one Justin runs); unbound key cannot reach an org he doesn't run (no fallback);
  routine_steps refuses unenrolled courses; no-read key refused; one audit row per call with
  the grant id; sanitiser; 429 with Retry-After.
- `tsc --noEmit`: packages/actions 0 errors, packages/mcp 0 errors, the route in isolation
  (temporary tsconfig, one-off 3 GB container) 0 errors.
- curl through the docker network (`curlimages/curl` → one-off `mcp-smoke` container
  running `scripts/serve.mts`, same handler, real DB): 401, 404, 405, 2025 initialize,
  2026 tools/list, list_my_orgs (bound), org_summary, cross-org refusal, appOnly refusal,
  whats_next (real getting-started step). Container stopped after.
- **Not tested**: the route inside Next (needs the build), Channel's `channelNextSource`
  (Next-only; the local harness reads "cannot read the channel"), Claude Code and the Claude
  API connector against the public URL (need the build, the migration and a minted key).

## Build-memory impact (expected, not measured)

Not measured: measuring needs a build in or beside the running container. Expected: small.
One route file, one ~1,100-line TS package transpiled with the app, and the SDK kept out
of the bundle (`serverExternalPackages`), so webpack/turbopack does not process its 8 MB
dist. The type-check step sees the SDK's `.d.mts` (skipLibCheck on). The route-only
type-check above ran in under the 2.5 GB heap it was given.

## check:registry failure (diagnosed; fix proposed, not applied)

- Reproduced: `tsx ../actions/scripts/check-registry.mts` **fails on Node 22**
  (`node:22-alpine`: "does not provide an export named 'ChannelNotReady'") and **passes on
  Node 20** (eac-dev image, eac-arts-network, eac-sophia, eac-admin: "43 entries, 26 runners,
  27 checks, consistent").
- Cause: `@elkdonis/services` has no `"type"`, so its `.ts` files load as CommonJS. A probe
  `import * as m from '…/services/src/channel.ts'` shows **only `default`** on Node 22 and
  all 35 named exports on Node 20. So every named import from `@elkdonis/services/*` fails
  under Node 22 + tsx; `ChannelNotReady` is just the first one linked. Not specific to it.
- Minimal fix (proposed): no source change. Run the check where the platform runs (Node 20,
  as the script's documented command already does), and make it fail clearly elsewhere:
  `packages/actions/package.json` `check:registry` → prefix a Node major check that exits 2
  with "check:registry runs on Node 20 (eac-dev); Node 22 loads @elkdonis/services as CJS
  without named exports". The real fix (`"type": "module"` on services) belongs to the day
  the image moves to Node 22, with a sweep of its CJS consumers.
