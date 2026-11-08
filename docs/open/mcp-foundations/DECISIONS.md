# MCP foundations: owner decisions

Format: the question, the options, the recommendation, and why. "Decided" rows record who
decided and when. Open rows are for Justin through the PM. Plan references are `PLAN.md` §.

## Decided

### D-1 · Where the MCP lives: **arts-collective, `https://arts-collective.com/api/mcp`** (decided)
- Justin, 2026-11-08, via the PM (final; supersedes an earlier same-day choice of sophia).
- Matches the serving doc (§4.1: "central, single mount"). The registry, the dock readers,
  the Channel reader (`channelNextSource`) and the SSO broker all run in-process there, so the
  mount is a thin route (NOTES/04).
- **Considered and rejected: sophia** (`eac-sophia`, the LMS container, :3020). The LMS's
  home, but it would need Channel's loader and the dock readers copied in or called across
  hosts with a service credential, and a second session host for tokens.
- Cost to watch: arts-collective's build already needs the 9g cap raise (ops.md 2026-11-07).
  The MCP adds one lazy route and a small package with no new npm dependencies; peak build
  memory is measured before/after at PLAN §4.2 step 5.

### D-3 · Personal `eacm_` keys now, OAuth later (approved)
- PM with Justin's discretion, 2026-11-08. Built in slice 1 (`packages/mcp/src/server/grants.ts`);
  the key table is the parked migration `migrations/NNN_mcp_grants.sql`.

### D-4 / D-5 · arts-collective issues OAuth tokens (opaque); clients register by CIMD + DCR (approved for pass 4)
- PM, 2026-11-08. Nothing built for it yet.

### D-6 · Protocol layer: **the official SDK, `@modelcontextprotocol/server` 2.4.0** (decided after verification)
- PM ruling 2026-11-08: use the SDK if it supports the current spec and its core runs on
  web-standard Request/Response without express/hono; spec compliance outweighs weight.
- Verified 2026-11-08 (GitHub releases, npm registry, the unpacked 2.4.0 tarballs):
  - v2 is split into packages (`server`, `core`, `client`, and optional framework adapters
    `express`, `hono`, `fastify`, `node`). Release 2.4.0 (23 Oct): "Works on 2025-11-25 and
    2026-07-28"; the server README says v2 implements the 2026-07-28 spec.
  - `createMcpHandler(factory, { legacy: 'stateless' })` returns `fetch: (Request) => Promise<Response>`;
    2025-era requests are served statelessly from the same factory, GET/DELETE answer 405.
    `authInfo` is pass-through (we verify the key ourselves). Host/Origin checks are ours.
  - `@modelcontextprotocol/server` depends only on `@modelcontextprotocol/core` and `zod ^4.2`
    (zod 4.6.7 installed beside the repo's 3.25; tool schemas use the SDK's `fromJsonSchema`,
    so our code never mixes the two zods). No express, hono, ajv package (a JSON Schema
    validator is bundled in its dist).
  - My earlier reading (npm `@modelcontextprotocol/sdk` 1.32.2 with express/hono) was the v1
    line; it does not apply.
- Build cost: the SDK is in arts-collective's `serverExternalPackages`, so Next requires it
  at runtime instead of bundling it; the route imports `@elkdonis/mcp/server` lazily.
  `pnpm-lock.yaml`: +50 lines (also picks up a pending `apps/sunjay` link to
  `@elkdonis/actions`/`@elkdonis/hub` from today's hub lane).

## Open (recommendation first)

### D-2 · First consumer
- Options: (a) outside Claude clients, starting with Justin's Claude Code; (b) the dock
  assistant (needs the Claude API key/workspace, blocked like Astro Studio); (c) both at once.
- **Recommend (a)**, read-only (serving doc D-7). Costs the collective no model spend, proves
  the tool layer with a real client; (b) reuses the same `listTools`/`callTool` in pass 3.

### D-7 · Exposure is opt-in per entry (built, PM rule: additive, default deny)
- The catalogue field `agent?: 'read' | 'draft'` (`packages/actions/src/types.ts`), set from
  `packages/actions/src/agent.ts` by `withAgent`, never on `appOnly`; `check:registry` checks
  it. Commit `0fd68d0f`. Owner may still review the map (NOTES/02 table).

### D-8 · Default org scope of a key or grant
- Options: (a) one org per grant by default, `*` (all orgs the person manages) on request;
  (b) `*` by default.
- **Recommend (a)** for anyone but Justin's own keys. A client working on one org cannot read
  another's board, and a leaked key reaches one org.

### D-9 · Audit reads as well as writes
- Options: (a) one `action_events` row per `tools/call`, reads as `mcp:<tool>`, returned
  content not stored, plus `agent_id`; (b) audit writes only, as today.
- **Recommend (a)**. "Which assistant read Katie's board, when" should be answerable; rows are
  small and the table is append-only. One migration (`agent_id`, with `mcp_grants`).

### D-10 · Which writes come in pass 2 (drafts only)
- **Recommend**: `org-publish` (draft post), `channel-suggestion-accept`,
  `channel-slot-fill` (draft deliveries), `channel-plan-step` op `add` only. Not
  `thread-edit` (overwrites a draft's text), not ticks, not dismiss, nothing in
  profile/listing/org/store/email, never the hub entries. Confirm step = the person publishes
  or schedules in the app.

### D-11 · Fold OpenClaw into the MCP door (pass 5)
- **Recommend yes**: OpenClaw exchanges its courier token (RFC 8693, admin) for an
  MCP-audience grant and drafts through `draft_org-publish`; retire
  `apps/admin/src/app/api/agent/post`. One door to audit, one audit table
  (openclaw-bridge writes `threads` directly today, outside `performAction`).

### D-12 · Dock assistant model and spend (pass 3)
- Needs: the Claude API key/workspace on arts-collective, a model choice and a monthly cap.
- **Recommend** deciding at pass 3 with measured token use from slice-1 transcripts; it runs
  on the same tool layer, `via 'assistant'`, session actor, no token.
