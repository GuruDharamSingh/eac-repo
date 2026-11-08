# 02 · The action registry, read for MCP (2026-11-08)

Package `packages/actions` (README is current). Read in full: `src/{types,catalogue,hub,channel,present}.ts`,
`src/server/{run,org,status,dock,routes,schema,hub-door}.ts`, `scripts/check-registry.mts`.

## What MCP gets for free

| Need | Exists | Where |
|---|---|---|
| Entry list with labels and one-line descriptions | `ACTION_CATALOGUE` (client-safe, no deps) | `src/catalogue.ts` |
| Input schemas as JSON Schema | `actionJsonSchema(id)` (zod/v4 → draft 2020-12, `io:'input'`, cached) | `src/server/schema.ts` |
| Read "where does this person stand" | `actionStatus` / `actionStatuses` (never writes) | `src/server/status.ts:327,345` |
| Perform with checks | `performAction(id, ctx, raw)`: actor from caller, zod parse, `allowed`, never throws | `src/server/run.ts` |
| Refusal codes | `auth` `unknown` `input` `forbidden` `failed` `limit` | `src/types.ts` `ActionFailure` |
| Door policy | `via` on `ActorContext`; `hostDoor` = via 'app'; `appOnly` entries refused elsewhere | `run.ts` `hostDoor`, `perform` |
| Audit | one `action_events` row per `performAction` call; `actor_type` 'ai' for every door but app/script | `run.ts` `record`, `actorType`; migration 245/246 |
| Org rule | `resolveActionOrg`, `resolveChannelOrg`, `actionOrgId`, opt-in `siteOrgId` lock | `src/server/org.ts` |
| Next moves | `ActionNextItem` / `ChannelNextMove` with `run` and `href` | `src/types.ts`, `src/channel.ts` |
| Dock reads | `dockStep`, `dockChannel`, `dockData` (reads only) | `src/server/dock.ts` |
| Presenters | `presentAction` → surface / link / run / form / frame / popup / none | `src/present.ts` |
| Consistency check | `check:registry` (runnable/derived vs RUNNERS/CHECKS, params) | `scripts/check-registry.mts` |

## What is missing for MCP

1. **No per-entry agent exposure flag.** Door policy is spread over `appOnly`, runtime
   `hostDoor` checks in single runners (`thread-*`), `CHANNEL_DOCK_ACTIONS` and `isDockAction`.
   Generating tools from "every runnable entry" would expose `profile`, `listing`, `org`,
   `store`, `gain-space`, `org-email`, which change public or money-adjacent state.
2. **No `agent_id` on audit rows.** `action_events` has `via` and `actor_type` only (`\d
   action_events`, 2026-11-08). Which client acted is lost. Rows today: 26 `http`, 12 `app`.
3. **Reads are not audited.** `actionStatus` writes nothing; an MCP read of a person's board
   would leave no trace.
4. **`resolveActionOrg` widens a refused claim** to the person's owned org (`org.ts`, no
   `siteOrgId`). Right for a lesson; wrong for an agent that named another org.
5. **`siteOrgId` refuses channel entries** (`actionOrgId` and `perform`): a token bound to one
   org cannot reuse it as-is for that org's channel.
6. **Presenters are UI-shaped.** `surface`/`frame`/`popup`/`form` need a page; for an agent the
   useful part is a link (`fallback.href`, `href`, `status.href`).
7. **Host readers.** `channel-next` needs `sources.channelNext`, which lives in arts-collective
   (`src/lib/channel/next-source.ts`, ~15 reads per call). The dock needs `DockLms` from
   `@elkdonis/lms`. Both are in-process on arts-collective.
8. `check:registry` currently fails on a tsx import (`ChannelNotReady`; PM board lane A open item).

## Entry-by-entry exposure (proposed `agent` field)

`read` = its status is an MCP read. `draft` = its runner is an MCP tool (pass 2). Blank = not exposed.

| Entry | scope | runnable | derived | agent | Why |
|---|---|---|---|---|---|
| profile | person | y | y | read | the write overwrites the person's text: app-only |
| gain-space | person | y | y | read | creates a folder and a public listing |
| listing | person | y | y | read | changes what is public |
| studio, show-on, cloud, service, artwork, payouts | person | n | y | read | status only |
| store | person | y | y | read | opens a market store (money-adjacent) |
| org | person | y | y | read | creates a public org and address |
| org-details | org | y | y | read | overwrites the org's text |
| org-offering, org-people, org-site | org | n | y | read | status only |
| org-email | org | y | y | read | mail settings |
| org-publish | org | y | y | **draft** | already draft-only (`run.ts` org-publish) |
| thread-edit | thread | y | n | | overwrites a draft's text; later, maybe only drafts the agent made |
| thread-publish | thread | y | y | read | publishes: app-only (already refused off-app) |
| thread-pin | thread | y | n | | app-only (already refused off-app) |
| paath-read/-record/-note/-publish | person | n | y | read | routine status |
| channel-connect, channel-org-channel, channel-first-post | person/org | n | y | read | status only |
| channel-next | channel | n | y | read | the board's next moves |
| channel-suggestion-accept | channel | y | n | **draft** | draft delivery + plan step, idempotent |
| channel-slot-fill | channel | y | n | **draft** | draft delivery in a slot; nothing scheduled |
| channel-plan-step | channel | y | n | **draft** (op `add` only) | tick/untick stays app + dock (Routines plan §2.4) |
| channel-suggestion-dismiss | channel | y | n | | permanent for the pair: app-only |
| org-person-role/-listed/-remove, org-arrival-welcome/-dismiss | org | y | n | | `appOnly` hub entries (`src/hub.ts`): never MCP |

`check:registry` rules to add: `agent` set ⇒ not `appOnly`; `agent:'draft'` ⇒ `runnable`;
`agent:'read'` ⇒ `derived`.
