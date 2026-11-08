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

## Open (recommendation first)

### D-2 · First consumer
- Options: (a) outside Claude clients, starting with Justin's Claude Code; (b) the dock
  assistant (needs the Claude API key/workspace, blocked like Astro Studio); (c) both at once.
- **Recommend (a)**, read-only (serving doc D-7). Costs the collective no model spend, proves
  the tool layer with a real client; (b) reuses the same `listTools`/`callTool` in pass 3.

### D-3 · Auth for slice 1: personal keys before OAuth
- Options: (a) operator-minted personal keys (`eacm_`, hashed, 90-day expiry, revocable,
  bound to one org or `*`); (b) wait for full OAuth 2.1 (PLAN §2.3, pass 4).
- **Recommend (a)**. Works today with Claude Code (`--header`) and the Claude API connector
  (`authorization_token`); OAuth is the biggest piece of work and only matters once people
  other than Justin connect. Keys are accepted by `/api/mcp` only, never as a session.

### D-4 · Who issues OAuth tokens (pass 4)
- Options: (a) arts-collective as the authorization server, opaque tokens in `mcp_grants`;
  (b) extend admin's OIDC provider (`apps/admin/src/lib/oidc.ts`); (c) GoTrue.
- **Recommend (a)**. arts-collective is the SSO broker with the login and session, and the
  MCP's own origin. Admin's provider signs with the shared HS256 `JWT_SECRET` that also signs
  SSO tokens, sets aud = client, has only confidential clients and no `resource`, DCR, CIMD or
  consent (NOTES/03). Opaque tokens give instant revocation with no signing key to leak.

### D-5 · How outside clients register (pass 4)
- Options: (a) CIMD + DCR, open, unprivileged, consent every time; (b) CIMD only; (c)
  pre-registered clients only (Justin adds each by hand).
- **Recommend (a)**. Claude Code registers by DCR by default and discovers CIMD; the spec
  prefers CIMD and keeps DCR for compatibility. Registration grants nothing: only a person's
  consent creates a grant. DCR registrations rate-limited and expired when unused.

### D-6 · Protocol layer: in-house vs the official SDK
- Options: (a) in-house, ~400 lines of JSON-RPC in `packages/mcp`; (b)
  `@modelcontextprotocol/sdk` 1.32.2.
- **Recommend (a)**. The SDK brings express 5, hono, ajv, cors, eventsource,
  express-rate-limit… into an app whose build is at its memory limit, and its npm page does
  not mention protocol 2026-07-28. Our surface is small (stateless, 7 methods). Revisit if
  we need SSE progress, subscriptions or MRTR elicitation.

### D-7 · Exposure is opt-in per entry
- Options: (a) a catalogue field `agent: 'read' | 'draft'`, default deny, checked by
  `check:registry`; (b) expose every `derived`/`runnable` entry and deny-list the risky ones.
- **Recommend (a)**. A new entry is invisible to agents until someone decides; (b) would have
  exposed `org`, `store`, `profile` on day one (NOTES/02 table).

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
