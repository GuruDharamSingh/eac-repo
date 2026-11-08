# @elkdonis/mcp

The platform's MCP server (2026-11-08): the door through which assistants (Claude Code,
claude.ai, later the dock assistant and OpenClaw) read the platform through the action
registry. Mounted at `https://arts-collective.com/api/mcp`
(`apps/arts-collective/src/app/api/mcp/route.ts`). Plan, decisions and notes:
`docs/open/mcp-foundations/`.

## Current state (slice 1, read-only)

| Part | File | Does |
|---|---|---|
| Endpoint | `src/server/handler.ts` | `mcpHandler(opts)` → `(Request) => Response`. Guards in order: 503 off (`MCP_ENABLED=0`), 404 any Host but the canonical one, 403 a foreign `Origin`, 405 not POST, 401 no/unknown/expired/revoked `eacm_` key, 503 key store missing, 429 per-key window; then `@modelcontextprotocol/server` 2.4.0 `createMcpHandler` (2026-07-28, and 2025-era clients statelessly), JSON responses, 64 KiB bodies |
| Keys | `src/server/grants.ts` | `eacm_` keys, SHA-256 in `mcp_grants`; grant = person + client + org scope (`*` or one org) + scopes. Not `eacd_`: auth-server never treats one as a session |
| Org lock | `src/server/org.ts` | bound key: only its org; unbound: owner/guide orgs only, a refused claim is refused (never the owned-org fallback); channels via `resolveChannelOrg` |
| Tools | `src/server/tools.ts` | `list_my_orgs`, `whats_next`, `routine_steps`, `org_summary`, `entry_status` (ids = catalogue entries with `agent` exposure and a check; never `appOnly`); resource `eac://catalogue` |
| Audit | `src/server/audit.ts` | one `action_events` row per tool call: `mcp:<tool>`, via `mcp`, actor_type `ai`, settled org, arguments, outcome, `agent_id` (the grant) when the column exists; results not stored |
| Limits | `src/server/limit.ts` | per key: 120 requests/min, 60 tool calls/min, 10/min for tools that run Channel's loader |
| Output | `src/server/sanitize.ts` | member-written text stripped, capped and listed under `untrusted` with a notice; links only to platform hosts |

The tools never call `runAction` and never use `via: 'app'`; writes (pass 2) will go through
`performAction` with `via: 'mcp'`, drafts only.

## Before it serves

1. Run the parked migration `docs/open/mcp-foundations/migrations/NNN_mcp_grants.sql`
   (copy to `packages/db/migrations/<next>_mcp_grants.sql`). Until then `/api/mcp` answers
   503 to any key, and audit rows are written without `agent_id`.
2. Rebuild arts-collective (the route is compiled in at build time).
3. Mint a key: `pnpm --filter @elkdonis/lms exec tsx ../mcp/scripts/mint-key.mts <email> <org|*> "<label>" [days]`
   (revoke: `… mint-key.mts --revoke <grant id>`).
4. `claude mcp add --transport http eac https://arts-collective.com/api/mcp --header "Authorization: Bearer eacm_…"`.

## Tests

- `pnpm --filter @elkdonis/mcp test` in an eac container (Node 20, `DATABASE_URL`): calls the
  handler in-process with real reads as Justin; keys and audit rows in memory (writes nothing).
- `scripts/serve.mts`: the same handler on node:http for curl through the docker network,
  with in-memory keys printed at start. In both, the Channel reader is absent (it is
  arts-collective's, Next-only), so the board part reads "cannot read the channel".

## Rules

- Exposure is the catalogue's `agent` field (`packages/actions/src/agent.ts`), default deny.
  Never expose an `appOnly` entry; `check:registry` fails on it.
- The actor is the grant's person, never input. A bound key never reaches another org.
- Tool names, descriptions and schemas are ours and static; member-written text goes only in
  data fields listed under `untrusted`.
- No secrets, other people's contact data, storage paths or Stripe ids in results.
