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
| Site tools | `src/server/site-tools.ts`, `site-read.ts` | `list_pages`, `read_page`, `list_blocks`, `describe_block`, `find_fields`, `list_surfaces` (2026-11-20). Org from the grant (`settleOrg`); `read_page` loads through the host's `pages.loadPageWithVersion` (validated rows) and is keyed by the settled org only; page text fenced and listed under `untrusted`; field ids in the C4 grammar (`block:<page>:<block id>:<setting>`, `record:thread:<id>:title`) |
| Draft tools | `src/server/draft-tools.ts` | `propose_page_patch({ org, slug, steps, note })` and `set_field({ org, field, value })` (2026-11-20). Need the grant scope `mcp:draft` (a read-only key is told so). Steps run through the house editor's one door (host-provided `drafts.applySteps`, with contracts built from the manifest for the blocks assistants may see) on the stored page, or on the assistant's own waiting draft when its `base` still matches; the result is saved as a draft (`author.kind = "assistant"`, the grant's label, the note, the steps) through the host's `drafts.saveDraft`. Never the live page; there is no publish on `McpDrafts`. Caps: 50 steps, 32 KiB of steps, 500-character note, 8 KiB value; own window of 30 proposals a minute per key. Assistants have `set_prop` and `set_look` only, aimed at blocks the manifest shows them and not inside a block it hides; a person's waiting draft is never replaced; a `record:` field is refused (records have no draft state). Refusals come back as results with each step's answer in the door's words |
| Block manifest | `src/manifest/` | `blocks.generated.ts` (checked in) built by `scripts/build-manifest.mts` from the shared catalogue's contracts plus `docs/open/DEVELOPMENT_APP_2026-11-20/blocks.json`. Visibility (2026-11-20, Justin: "unblock pages from sites"): an assistant may read, and aim a step at, every block unless `src/manifest/deny.ts` names it (`contact-form`; a setting named like an email, recipient, token, key, secret, webhook, password or api; a setting bound to a person, user or guide; raw html/css/script settings; no declared settings). App-local blocks are readable. The org lock and the fencing are unchanged `reads` (BUILD_SPEC C5) says what a block works out for itself. Regenerate: `pnpm --filter @elkdonis/mcp manifest`; drift check: `check-manifest` |
| Audit | `src/server/audit.ts` | one `action_events` row per tool call: `mcp:<tool>`, via `mcp`, actor_type `ai`, settled org, arguments, outcome, `agent_id` (the grant) when the column exists; results not stored |
| Limits | `src/server/limit.ts` | per key: 120 requests/min, 60 tool calls/min, 10/min for tools that run Channel's loader, 30/min for the draft tools |
| Output | `src/server/sanitize.ts` | member-written text stripped, capped and listed under `untrusted` with a notice; links only to platform hosts |

The tools never call `runAction` and never use `via: 'app'`. The only writes are the two draft tools' page drafts (through the host's draft store, never the live page); registry writes (pass 2) will go through
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
- The test also covers the site tools (cross-org reads refused, `puck:home` under several orgs, hostile page text, field ids) and the manifest. It needs the page reader, which the harness passes in (`scripts/harness.mts`, with `scripts/react-shim.mts` for the block catalogue's JSX); the host passes `pages: { loadPageWithVersion }` (arts-collective `api/mcp/route.ts`).
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

## Drafts: an assistant proposes, a person publishes

- Mint a draft key (the PM's): `mint-key.mts` with scopes `mcp:read mcp:draft`. Until one exists, both draft tools answer "This key cannot propose changes".
- The host passes `drafts` (arts-collective `src/lib/mcp-drafts.ts`, wired in `api/mcp/route.ts`): the step door and the draft store. Without it the tools say the writer is not connected.
- A proposal waits as the page's draft (`site_config` key `puck-draft:<slug>`). A person reviews it in the development app, Sites tab (`DraftReview`: who, why, the steps in words, the page before and after) and publishes or discards it through the gated actions there.
- Review fixes 2026-11-21: legacy `zones` are redacted like `content`; a block with an unresolved setting is denied; settings that decide who may see or join something (manifest/deny.ts, `readOnlyReason`) are readable but not settable; an assistant's save passes `expected` (compare-and-set) so it never replaces a draft saved meanwhile.
- Not yet: colour and size tokens (the manifest carries no token types), add/move/copy/remove of blocks (they need the page builder's block list), `record:` fields, creating a page.
