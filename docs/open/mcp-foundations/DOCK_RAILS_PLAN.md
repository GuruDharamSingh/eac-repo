# Dock rails: the routed action base, with the MCP and apps on top (plan, 2026-11-16)

Status: **approved 2026-11-16; P0 (map) in progress.** Supersedes `SUNJAY_MCP_APP_PLAN.md`. Decisions taken after review: §5a.

## 0. In plain words

The platform gets one central, very well-routed **action base**. It lists every thing a person can
do anywhere on the network, where on the network it happens (the exact control), who may do it, how
we know it's done, and what it risks. **LMS courses are the rails.** Each step points at an
entry. **The dock** on arts-collective.com runs those rails. It shows the step, takes the
person to the exact control on whatever page or site it's on, shows a confirm card, runs the
server action, ticks the step, and brings them back to the trail. Short help tutorials are
courses too, picked from the dock.

There is **no AI at first**: the courses decide what happens next. Building this is the same work as
building the MCP. The action base is the MCP server:

| Platform | MCP |
|---|---|
| A mapped entry (an action a person can take) | **Tool** |
| Its status check (where a person or org stands) | **Read tool / resource** |
| A course, runbook or help tutorial | **Prompt**: ordered steps, each naming a tool |
| The dock's step card, confirm card and "go there" card | **MCP App views** (`ui://`) |
| The dock | **A host** that follows the rails with no AI. Claude Desktop/claude.ai become a second host later, with AI in the loop. |

## 1. Decisions taken (Justin, 2026-11-16)

- The MCP is the internal assistant of the arts-collective dock and its LMS trail, not a view of
  org sites in outside clients.
- **Actions run after a confirm** in the dock. Anything involving money only gives a link (rule kept from the LMS brief §7.2).
- **Across the network**: org subdomains and the org apps on their own domains, not only the hub host.
- **No AI connection to start.** Courses are the rails, and an AI or the Claude API plugs in later (D-12 deferred).
- **Map the codebase very minutely**, so every person-facing action is a routed entry.
- Plan document first.

## 2. Where it stands today (verified in code, 2026-11-16)

- **Registry** (`packages/actions`):
  - 49 entries: 35 usable from doors, 14 `appOnly` hub-card entries. The LMS brief's "17/20" counts are stale.
  - Entry shape (`types.ts:53-90`): id, label, describe, scope (`person|org|thread|channel`), area, derived, runnable, performs, params, appOnly, agent.
  - Runners and `allowed` live in `server/run.ts`, checks in `server/status.ts`, presentation in `present.ts`.
  - No role, risk/money, address or confirm-text field.
  - `presentAction` covers only the 16 onboarding entries, org-publish, channel-next and paath-*. Everything else is `none`.
- **Audit**: `performAction` (`run.ts:428`) writes `action_events` on every call with an actor.
  Nothing reads it, so **pushed completion is not built** (brief §3.4).
- **Anchors**: `data-eac-anchor` appears in **no** file. The only real address convention is the
  cms-ui surface descriptor plus `?surface=kind:id` (`packages/cms-ui/src/surface/types.ts:63`,
  `url.ts`; `useSurface` in 107 files). The editor's `data-edit-*` attributes are editor-only.
- **LMS** (tables, migrations 140–177):
  - Step types: reading, practice, reflection, session, thread, resource, task.
  - A `task` step binds `settings.task = {id, scope: person|org, params?, repeat?: 'daily'}` (`packages/lms/src/types.ts:80-95`).
  - Completion settles only when the lesson renders (`tasks.ts:41`).
  - No `thread`/`channel` scope, no subject, no step role gate, no runbooks: `lms_step_state` is keyed `(enrolment, step)`.
  - Published courses have 73 steps, of which 20 are bound to actions: getting-started 16/21 and akhand-path-daily 4/4.
- **Dock** (`packages/dock`, `packages/actions/src/server/dock.ts`, `/api/actions/dock`):
  - Mounted only in arts-collective's root layout.
  - Shows one current step (getting-started first, `COURSES` hard-coded at `route.ts:27`), a post card on `/sites/<org>/<post>`, and the channel's next move.
  - Runs allow-listed entries **with no confirm**.
  - "Surface"/"frame" steps only link to the lesson.
  - No go-there-and-back, no saved current step, no course or tutorial picker.
- **Reach**:
  - Session cookies are host-only (`EAC_COOKIE_DOMAIN` unset).
  - SSO is a handoff broker (`/api/auth/handoff` → `/handoff/accept`, `ssoProxy`).
  - `actionRoutes()` is mounted only on arts-collective, same-origin only.
  - arts-collective serves `*.arts-collective.com` org subdomains via middleware. 15 verified `org_domains` rows, mostly served by their own apps (sunjay, ifac, amrit-canada, katie-the-potter, hidden-enneagram, danamccool, elktours…).
  - The planned `packages/org-site` kit (NETWORK_SERVING_ARCHITECTURE §4) does not exist.
- **Size of the job** (measured with grep; counts are a little low):
  - About 840 server-action exports, about 500 write-capable API route files and about 780 pages, across 21 apps.
  - arts-collective alone has 183 server actions in 46 files, 55 write routes and 69 pages.
  - No shared package has `"use server"` files. Each app wraps shared logic (`@elkdonis/services` exports 1,712 functions) in its own actions.
  - The same action file is repeated across apps: `meeting-actions`/`writing-actions`/`questionnaire-actions` in 6 apps each.
  - Several apps write raw SQL: elktours 34 files, inner-gathering 22, arts-collective 13, sunjay 11.
  - Only 7 arts-collective files call `runAction`/`performAction`.
  - Estimate: after merging duplicates, about 350–500 capabilities, of which **about 120–180 are
    person-facing**. The registry covers about 49 of them, roughly 10–15%.

## 3. Architecture: seven layers

### L1. The map (inventory → curated atlas)

- **Unit: one capability** = one service-level write, such as "save a series", "publish a post" or
  "invite a person". A capability has many **hosts**: each app's server action, route or component that
  performs it. That way six copies of `meeting-actions` become one row with six addresses.
- **Generated inventory** (scriptable):
  - `packages/actions/scripts/map-inventory.mts` (ts-morph) lists:
    - every export in `"use server"` files, including inline directives;
    - every POST/PUT/PATCH/DELETE route;
    - what each imports from `@elkdonis/services|hub|commerce|channel|…`, which groups hosts under capabilities;
    - raw `INSERT`/`UPDATE` sites;
    - catalogue coverage.
  - Output: `docs/open/mcp-foundations/MAP/inventory.json` plus one Markdown table per area, regenerated on demand.
  - A `check:map` script flags new uncovered writes, the way `check:registry` flags flag drift.
- **Curated rows**, one per capability: id, label, what it does; hosts (app, route/page,
  component `file:line`, action/route name); the service function; actor and roles (person, org owner,
  guide, operator, admin); input schema; status check; **address** (L3); **risk** (`money`,
  `irreversible`, `public`, `emails`); registry status (entry id / appOnly / uncovered / internal);
  agent exposure.
- **Curation order**:
  1. arts-collective hub, studio, channel and learn;
  2. shared capabilities used by the most apps (services, commerce, site-forms, studio-forms, hub);
  3. the per-app raw-SQL and duplicate apps (elktours, sunjay, ifac, innergathering);
  4. admin and the long tail.
- Rows marked person-facing become registry entries (L2). Internal ones stay in the map only.

### L2. Registry upgrades (`packages/actions`)

New fields on `ActionMeta`, all optional so nothing breaks:
- `address`: where the control lives (L3). A path template plus an anchor, or a surface descriptor, and the host kind: hub, org-site or app.
- `confirm`: the confirm-card wording, written from `performs` ("This will publish *{title}* to {org}'s site").
- `risk`: `money | irreversible | public | emails`. Money risk forces a link, never a run.
- `roles`: who may perform it (shown to others as context only).
- `scope` already allows `thread`/`channel`; the LMS side catches up in L4.

Also:
- `presentAction` gets an answer for every entry, with no `none` fallback for person-facing entries.
- `check:registry` gains rules: every person-facing entry has an address, a confirm text, a risk
  value and a status check (or is marked `unverifiable`).
- The 14 hub `appOnly` entries stay app-only for agents. For the dock they become **"go there"**
  steps: the dock routes the person to the hub card and the card's own button performs the action, so the door policy doesn't change.

### L3. Addresses and anchors

- **Convention**: `data-eac-anchor="<entry id>"` on the real control. Spread a helper
  `anchorProps(id, subject?)` from `@elkdonis/actions/anchor` (client-safe) so it is one line per
  control. Popups keep the existing `?surface=kind:id` address.
- **Address = host + path template + (anchor | surface)**, resolved per org and subject at run time
  (`/hub/sites/{org}/pages`, `?surface=thread:{id}`).
- **Return ticket**: navigating from the dock adds `?eac-step=<short id>`. The dock stores the departure
  (step, return path and subject) server-side, so it works across hosts after an SSO hop.
- Anchors are added only to controls that a mapped entry points at, area by area, following L1's order.

### L4. Rails (LMS)

- Task binding grows to `{id, scope: person|org|thread|channel, subject?: from-run | from-param,
  params?, repeat?: daily|weekly|per-subject, role?}`. A step whose role the person lacks shows as context.
- **Runbooks**: a course run bound to a subject, such as "Launch an org site" per org or "Run a series term" per
  series. Schema choice in D-17. Recommended: a `lms_runbook_runs(id, enrolment_id, subject_kind,
  subject_id, …)` table, with `lms_step_state` gaining a nullable `run_id`. This is additive, and existing
  progress is untouched.
- **Help tutorials** are ordinary short courses flagged `kind: 'tutorial'` and tagged with the areas or entries
  they explain. The dock offers the ones that match the current page.
- **Step kinds for routing**: a task step can now be *do* (run after a confirm), *go* (go to the control and
  let the person press it) or *check* (status only).

### L5. The dock as host

- **Current-step store**: server-side per user (migration; table `lms_dock_state(user_id, course,
  step, run_id, departed_from, ticket, updated_at)`), not derived anew each time and not a cookie.
- **Picker**: enrolled courses, active runbooks and the tutorials that match the page. The person
  chooses, and the hard-coded `COURSES` goes.
- **Cards**:
  - **Step card**: title, why, progress.
  - **Confirm card**: the `confirm` text, risk badges and Confirm/Cancel. Every *do* step goes through it, and it replaces today's one-click run.
  - **Route card**: "Take me there". It navigates to the address, outlines the anchor or opens the surface, and shows "Back to the trail" while away.
  - **Done card**: the step ticked, then the next one.
- Card data has the **same shape as the MCP tool results** (`structuredContent`), so the cards
  are MCP App views in waiting (L7, D-15).

### L6. Pushed completion

- After `record()` in `performAction`, look up the steps (and runbook runs) that name that entry for that
  actor, and settle them through the existing `settleTaskStep` path. Status checks stay authoritative:
  the event is only a hint to re-check.
- The dock refetches after a run and on return. `/learn` and the hub cards see the tick with no revisit.
- Writes that bypass the registry won't push. That's fine, because status checks still settle them when the lesson
  or dock next looks. As L1/L2 cover more, more of it pushes.

### L7. Network reach

- **Org subdomains** (`*.arts-collective.com`, served by arts-collective): either set
  `EAC_COOKIE_DOMAIN=.arts-collective.com`, giving one session across the apex and all subdomains (decision D-14; this
  signs everyone out once and touches the sign-in path on every subdomain), or keep host-only cookies and rely on the SSO
  handoff that `ssoProxy` already does. **Recommended: the cookie domain**, because it is simpler for the dock and for "go there".
- **Own-domain org apps** (sunjay, ifac, amrit-canada, katie-the-potter, hidden-enneagram,
  elktours…): build the planned `packages/org-site` kit: `<Dock>`, the local `/api/actions/dock`,
  `actionRoutes()`, the LMS readers wired to the shared DB, and `ssoProxy`. The domain must be allowed for the handoff. Roll it out
  app by app, **sunjay first** (as NETWORK_SERVING_ARCHITECTURE §4 already plans), then ifac and amrit-canada.
  Each app's dock reads the same `lms_dock_state`, so a step started on the hub continues on the org's own site.
- A cross-origin central API is ruled out: Safari and Firefox block third-party cookies.

### L8. The MCP and apps on top

- **Tools**: generated from the registry with the agent-exposure rules already in place (`agent.ts`, default
  deny). Reads now, drafts next (D-10), then "do" entries behind the same confirm. For an agent,
  the confirm becomes a pending action the person approves in the dock.
- **Prompts**: courses, runbooks and tutorials (`prompts/list`/`get`), mirrored as a
  `get_runbook` tool for tools-only clients (PLAN pass 3).
- **Apps**: the dock cards (step, confirm, route, done) as `ui://` MCP App views on the same server
  (`@modelcontextprotocol/ext-apps` 2.0.4, compatible with the server's 2.4.0). The dock would host them
  through the ext-apps host-side bridge, and Claude Desktop/claude.ai would show the same views. *To verify:*
  whether the host bridge suits our dock (bundle size, styling, in-page vs iframe).
- **AI later**: the dock's chat input uses the same tools through the Claude API (D-12), with the rails
  as its guide. The API key is in eris `.env` but not passed to arts-collective.

## 4. Build order

| Phase | What | Done when |
|---|---|---|
| **P0 Map** | `map-inventory.mts` + `check:map`; curate the arts-collective hub/studio/channel/learn rows | The inventory is regenerated; every arts-collective write is labelled person-facing, internal or admin |
| **P1 Registry** | Fields `address`/`confirm`/`risk`/`roles`; `presentAction` for all entries; new `check:registry` rules; new entries for the person-facing arts-collective rows; anchors on their controls | `check:registry` is clean; every person-facing entry has an address and an anchor |
| **P2 Dock host** | `lms_dock_state` migration; picker; step/confirm/route/done cards; return ticket; pushed completion | On the hub host: a getting-started step goes there, confirms, runs, ticks and comes back |
| **P3 Rails** | Step binding (scopes, subject, role, repeat); runbook runs migration; first runbooks ("Launch an org site", "Run a series term"); 3–5 help tutorials | A runbook runs per org with per-subject progress |
| **P4 Reach** | D-14 cookie domain; the `packages/org-site` kit; sunjay, then ifac and amrit-canada | One trail continues from arts-collective onto paratheater and back |
| **P5 Map the rest** | Shared capabilities, then elktours/sunjay/ifac/innergathering raw-SQL writes, then admin and the long tail | The registry covers about 120–180 person-facing capabilities |
| **P6 MCP on top** | Tools from the registry, prompts from courses, cards as `ui://` views, then AI in the dock (D-12) | Claude Desktop shows a runbook step card from `arts-collective.com/api/mcp` |

Each phase needs Justin's go before migrations run on prod, before rebuilds (arts-collective
needs the 9 GB build cap), and before any cookie change. Nothing gets committed without his say.

## 5. Open decisions (recommendation first)

- **D-13: where the map lives.** (a) Generated `inventory.json` in docs, plus curated rows as registry
  entries in code (recommended: one source of truth for anything the dock can use); (b) a DB table
  editable in a studio page; (c) Markdown only.
- **D-14: session across subdomains.** (a) `EAC_COOKIE_DOMAIN=.arts-collective.com` (recommended); (b) keep
  host-only cookies and the SSO hop on every subdomain visit.
- **D-15: dock cards as MCP App views now or later.** (a) React components in `@elkdonis/dock` now,
  with data shaped exactly like tool results, wrapped as `ui://` views in P6 (recommended: no bundle or
  iframe cost while there's no AI); (b) build them as MCP App views from day one and have the dock host them.
- **D-16: confirm wording.** (a) A `confirm` template per entry, written by hand during curation (recommended);
  (b) generated from `performs`.
- **D-17: runbook progress.** (a) A `lms_runbook_runs` table plus a nullable `run_id` on `lms_step_state`
  (recommended: additive); (b) a subject column on `lms_step_state`.
- **D-18: help tutorials.** (a) Short courses with `kind: 'tutorial'` and area/entry tags (recommended);
  (b) a separate tutorial type.
- Still open from DECISIONS.md: D-8 (org scope of keys), D-9 (audit reads), D-10 (draft writes),
  D-11 (OpenClaw), D-12 (model and spend; deferred by the "no AI to start" decision).


## 5a. Decided (Justin, 2026-11-16, after review)

- **Plan approved and P0 started.** Justin: "you got right ideas"; he left the storage and the tutorial setup to the lead.
- **Homogenising is in scope as a goal.** Standardising for the MCP is the occasion. The atlas records `drift`
  and a `canonical` path per capability. Merging code is its own approved pass per area.
- **D-13: storage, decided by the lead.** `packages/actions/atlas/`: a generated `inventory.json` (every write
  host), curated typed `areas/*.ts` (capabilities that claim hosts), `check-atlas`, and generated reports
  (coverage, drift, wording waves), plus an append-only `JOURNAL.md`. Kept out of `src/` until the registry
  imports it on purpose.
- **D-16: confirm wording goes to Justin in waves** with an explanation brief per row
  (`atlas/reports/wording-wave-NN.md`). Only `approved` text reaches a live dock.
- **D-18: help tutorials are written by AI later**, as we run through the trails. First the dock shows runbook
  progress; later the same progress view extends to tutorials of all kinds. No tutorial authoring in P0–P3.


## 5b. Structural direction (Justin, 2026-11-16, after the atlas)

Architecture only. Course and tutorial content is out of scope until its own pass.

- **The LMS is the central admin, with the MCP as its rails.** It flips switches and adds or edits, from the dock or from the course module itself.
- **The dock prefers its own module UI.** Where an action can be done in a dock module (a form or card the dock renders from the entry's input schema), do that. Navigating across pages and highlighting the real control is the fallback for actions the dock can't supply itself. Architecturally, each registry entry declares the two capabilities separately: `dockForm` (the dock can render and run it) and `address` (where the real control lives). `presentAction` picks dockForm first.
- **Courses are layered.** Areas run from broad, fundamental courses to specific ones that reuse the same entries. The structure only needs:
  - a course `area` (a tag);
  - `builds_on` links between courses, so a specific course can reuse a fundamental course's steps;
  - steps that are references to registry entries, not copied content.
  
  Skeletal for now: placeholders that name areas and entries, with no prose.
- **Broad areas** (tags to hang courses on later; each maps to atlas areas):
  - *profile*: establish, maintain;
  - *publishing*: posts, work, paid work;
  - *business*: offerings, booking, money; then *tours* (elktours: a tour with stops and a description, plus slots) as a specific layer on business/booking;
  - *site*: page builder and house editor; template page by hand, then customise, then themes;
  - *production*: studio, media, routines and the channel;
  - *artwork*: pieces, the store, auctions;
  - *email*: setup, then org/event template customisation.
- **Confirm-card wording should be drier.** The naming conventions are fine. House-style change for the next waves: state the action and its effect plainly, with no warmth or reassurance.
- **Stripe refunds** are automatic but triggered by hand: a cancel records the refund as due, and one press issues it through Stripe. In the dock this is a money entry, so it links to the refund control and never runs it.

- **Typed slots in confirm cards** (Justin, 2026-11-16, on wording batch 1: "surprised to see soo little different types of {brackets}. These suggestions will likely come with a template structure at some point and a degree of search should be allowed for title or choosen preset if relevant.").
  A placeholder is a slot with a kind, not a plain string substitution:

  | Slot | Example | How the dock fills it |
  |---|---|---|
  | entity | `{entity:post}` (shows the title) | from context when the person came from that item; otherwise a search-and-pick over that entity type, limited to what the person may act on |
  | preset | `{preset:outlet}`, `{preset:template}` | picked from a list of presets; a template is a named set of slot values (later also structure, e.g. a post with sections) and can fill several slots at once |
  | value | `{value:when}`, `{value:price}` | typed in, checked by the entry's input schema |
  | context | `{context:org}` | filled from where the person is; shown, not editable |

  - Slot kinds come from the entry's input schema. That is the same field declaration that draws the dock module form and the MCP tool input (`docs/open/SITE_FORM_2026-11-16/SYNTHESIS.md`, "one declaration, three renderings"). The wording names the slots; the schema says how to fill them.
  - Approved wording keeps its sentence. The slot markup is added when the schema lands, and the sentence needs no new approval unless it changes.
  - Not built yet:
    - a slot resolver and a picker in `packages/dock`;
    - one search read per entity type, reusing the existing list reads and scoped to the actor's own items or org;
    - a `presets` list per entry.

## 6. Risks

- **Size**: 120–180 entries is weeks of curation. P0–P2 on arts-collective prove the loop before the
  long tail.
- **Duplicate code paths**: until duplicated per-app actions call one service, a capability has several
  hosts that can drift. The map makes this visible. Merging the code is a separate cleanup and not in scope.
- **Hub `appOnly` entries**: these stay pressed in the hub card (as "go" steps), so the door policy is unchanged.
- **Money**: `store`/`payouts` have no risk flag today. P1 adds one, and the dock only ever gives a link for them.
- **Cookie change** (D-14): signs everyone out once and touches the sign-in path on every subdomain. Test it on one subdomain first.
- **Working tree**: lots of uncommitted work from other sessions sits in `~/eac`. Builds take whatever is there.

## 7. Sources

Read-only surveys on 2026-11-16 (two sub-agents plus the main session):
- `packages/actions/src/{types,catalogue,agent,hub,present}.ts` and `server/{run,status,dock,routes}.ts`
- `packages/lms/src/{types,tasks,step-types}.ts`, `packages/lms-ui`
- `packages/dock`
- `apps/arts-collective/src/{app/layout.tsx,app/api/actions/dock/route.ts,lib/actions/*,middleware.ts}`
- `packages/auth-server`, `packages/cms-ui/src/surface`
- live `lms_*`, `action_events` and `org_domains` reads
- grep counts across `apps/*` and `packages/*`
- docs: `LMS_ACTION_LAYER_BRIEF_2026-11-06.md`, `CHANNEL_ROUTINES_AS_COURSES_PLAN_2026-11-07.md`,
  `ONBOARDING_COURSE_BRIEF_2026-10-29.md`, `NETWORK_SERVING_ARCHITECTURE_2026-11-08.md`,
  `docs/reference/identity-and-tenancy.md`, `COMPONENT_CENSUS_2026-09-15.md`,
  `COMPONENT_CONNECTIONS_2026-11-06.md`, and this folder's PLAN, DECISIONS and NOTES/02.
