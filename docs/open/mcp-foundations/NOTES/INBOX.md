# Inbox: notes for the MCP foundations lead

Append below: `## <date> · <lane/session>`, one paragraph, file paths. The lead folds each
note into PLAN.md or DECISIONS.md and adds "(folded in, <date>)" under it.

---

## 2026-11-15 · first live client (Claude Code on the TrueNAS host)
Key minted for the developer, scope `*`, 90 days (grant `02e4037e-dada-4c58-803f-7d69c24b68f9`,
label "Claude Code - TrueNAS host (eac)"); registered with `claude mcp add --scope local eac`
(`~/.claude.json`, project `/mnt/pool1/home/guru/eac`); `claude mcp list` reports Connected.
Verified by curl through the public URL: no key → 401; `initialize` (2025-11-25) and
`tools/list` (5 tools, all readOnlyHint); `list_my_orgs` (14 orgs); `whats_next` returns the
course step and the Channel part from `channelNextSource` inside Next (untested in NOTES/05);
`entry_status` on an appOnly id → refused; `action_events` rows `mcp:*`, via `mcp`,
actor_type `ai`, `agent_id` = the grant. Still open: Claude Code tool use in a session
(needs a new session to load the server), the Claude API connector test, and the
`--resolve …:30022` edge test, which returned 404 (assumed: the port in `Host` fails the
canonical-host check). The README/`packages/mcp/README.md` "not deployed" lines are stale.

## 2026-11-16 · sunjay as an MCP App (plan only)
Justin picked `apps/sunjay` to open inside Claude as an MCP App (a rebuilt client view, fixed home layout,
embedded fonts, visitor-only data). Plan: `SUNJAY_MCP_APP_PLAN.md` in this folder. It proposes a new
`packages/site-read` (sunjay queries moved out and taking the org as input), five read-only `site_*` tools in
`packages/mcp`, a Vite single-file view in `packages/mcp-ui-site`, and a `settlePublicOrg` lock in `org.ts`.
Nothing built; the build waits on Justin’s go.
(Superseded the same day: Justin clarified the aim is the dock assistant on arts-collective, not a sunjay view.)

## 2026-11-16 · dock rails plan (plan only)
Justin: the MCP is the internal assistant of the arts-collective dock and its LMS trail. Courses are the rails,
there is no AI to start, actions run after a confirm, it reaches across the network, and the codebase gets mapped
very minutely. Plan: `DOCK_RAILS_PLAN.md` in this folder. It covers the map (inventory to atlas), registry fields
(address, confirm, risk, roles), `data-eac-anchor`, runbooks, the dock as host (confirm, route and return cards,
current-step store), pushed completion, the org-site kit and cookie domain, and the MCP tools, prompts and
`ui://` views on top. New open decisions D-13 to D-18. Nothing built.
