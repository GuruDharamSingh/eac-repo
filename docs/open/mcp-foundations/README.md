# MCP foundations: workspace

**Status (2026-11-08, evening):** slice 1 (read-only) built and tested locally; not deployed.
Waiting on: Justin's approval to run `migrations/NNN_mcp_grants.sql`, then the PM's
arts-collective build. Build log and test results: `NOTES/05-slice1-build.md`. Code:
`packages/mcp/`, `apps/arts-collective/src/app/api/mcp/route.ts`, `packages/actions/src/agent.ts`.

Purpose: the structural foundation of the platform's MCP server, the door through which
assistants read and act on the platform through the same action registry the apps use.
Consumers: Claude clients outside the platform (Claude Code, claude.ai), the dock/LMS
assistant, and later OpenClaw. Lead: the MCP foundations session (a PM sub-agent).

## Files

| File | Holds |
|---|---|
| `README.md` | this index, the status line, how to leave notes |
| `PLAN.md` | the deliverable: current state, architecture, safety model, first slice, later passes |
| `DECISIONS.md` | owner decisions: decided ones, and open ones with a recommendation each |
| `NOTES/01-protocol.md` | MCP protocol facts used by the plan (spec 2026-07-28, auth, Claude clients), with sources |
| `NOTES/02-registry-inventory.md` | the action registry read for MCP: what it gives, entry-by-entry exposure |
| `NOTES/03-auth-today.md` | identity on the platform today (GoTrue, SSO broker, admin OIDC, device tokens) and the gaps for MCP |
| `NOTES/04-hosting.md` | arts-collective as the host: mount, middleware, build cost, reachability |
| `NOTES/05-slice1-build.md` | slice 1: what was built, deviations, tests, build impact, the check:registry diagnosis |
| `migrations/NNN_mcp_grants.sql` | parked migration (`mcp_grants`, `action_events.agent_id`); runs only with Justin's approval |
| `NOTES/INBOX.md` | notes from other sessions (append here) |

## How other sessions leave notes

- Append to `NOTES/INBOX.md`: date, your lane, one paragraph, file paths. Newest at the bottom.
- Do not edit `PLAN.md` or `DECISIONS.md`; the lead folds inbox notes in and marks them done.
- Things that need the MCP to know about them: a new registry entry an agent should read or
  draft (say which and why), a change to `resolveActionOrg` / `performAction` / `action_events`,
  a new host reader (`ActionSources`), anything that changes auth on arts-collective.

## Sources read (2026-11-08)

`docs/open/LMS_ACTION_LAYER_BRIEF_2026-11-06.md` §7.2, `CHANNEL_ROUTINES_AS_COURSES_PLAN_2026-11-07.md` §2.4,
`NETWORK_SERVING_ARCHITECTURE_2026-11-08.md` §4.1, D-7, checklist 5 and 11, `PM_BOARD_2026-11-08.md`,
`CONTENT_LIBRARY_COMPONENT_2026-11-08.md` §4, `docs/reference/identity-and-tenancy.md`,
`docs/reference/ops.md`, `packages/actions` (all of `src/`), `packages/auth-server/src/{index,device-tokens}.ts`,
`packages/openclaw-bridge/src`, `apps/admin/src/lib/oidc.ts`, `apps/admin/src/app/api/oidc/token/route.ts`,
`apps/arts-collective/src/{middleware.ts,lib/actions/*,lib/channel/next-source.ts,app/api/actions/dock/route.ts}`,
`apps/arts-collective/next.config.ts`; read-only queries on `action_events`, `device_tokens`.
