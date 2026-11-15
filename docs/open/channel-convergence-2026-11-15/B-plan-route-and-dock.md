# B. The Plan it route and the Dock: parity for the sites

Read-only design pass, 2026-11-15, for system32-fc. No code was edited.
All paths are under `~/eac`. Lines are as read on 2026-11-15 01:30. a2 is editing `packages/channel/**` now, so lines may drift.

Short answer: the board and the Dock already share one suggestion list (`channelNextMoves`). They are not two systems. What the sites lack is the piece plan view, plan.md, board init, and a URL that means the same thing.

---

## Today

### 1. Plan it on arts-collective

1. Studio draws a published piece with `PieceSummary`. Its "Plan it" is a plain link to `view.links.plan`: `packages/content/src/summary/PieceSummary.tsx:225-233`.
2. The Studio host fills that link in at `apps/arts-collective/src/lib/studio-summary-action.ts:78` (`links: { view, channel, plan: board.links.plan }`).
3. `board.links.plan` is built at `apps/arts-collective/src/lib/channel/studio-board.ts:89`: `/channel?org=<org>&piece=<key>&tab=plan`.
4. So "Plan it" is a full page load of `/channel` (Channel Home), not a route of its own. `apps/arts-collective/src/app/channel/page.tsx:13-24` renders Home inside `ChannelFrame`.
5. `ChannelFrame` reads `?piece=` and `?tab=plan` once on load and opens the piece pop-up: `apps/arts-collective/src/components/channel/ChannelFrame.tsx:89-97`. It mirrors the open piece back into the URL: same file, lines 99-117.
6. The pop-up is `PieceSurface` (`components/channel/PieceSurface.tsx:19-57`). It feeds the shared `ContentDetail` (`packages/content/src/ui/ContentDetail.tsx:32-47`), which owns the tab and writes `?tab=plan` (`tabInAddress`).
7. Two tabs. Overview shows where the piece went. Plan shows plan.md next to the board's waiting suggestions: `PieceSurface.tsx:12-17`, `packages/content/src/ui/panels/plan.tsx`.

What `/channel` renders (all under `apps/arts-collective/src/app/channel/`):

| Route | File | What it is |
|---|---|---|
| `/channel` | `page.tsx:13` | Home, or the matrix with `?view=matrix` |
| `/channel/piece/[kind]/[id]` | `piece/[kind]/[id]/page.tsx` | full-page piece board (`PieceBoard`), a different view from the pop-up |
| `/channel/queue` | `queue/page.tsx` | Queue by piece, week, month |
| `/channel/routines` | `routines/page.tsx` | routine planner |
| `/channel/outlets` | `outlets/page.tsx` | connected accounts |
| `/channel/new` | `new/page.tsx` | compose a post |

Almost all UI lives in `apps/arts-collective/src/components/channel/*` (about 4,600 lines with `lib/channel`). The loader, model and `next.ts` have already moved to `@elkdonis/channel` (`apps/arts-collective/src/lib/channel/load.ts:1-13`, `next.ts:1`, `model.ts:1`).

### 2. plan.md: what it is, where it is stored

- Markdown with a fixed outline: Goal, Dates, Steps, Notes. `packages/services/src/channel-plan-md.ts:1-12`. A step is `- [ ] text`; `<!-- board -->` marks one accepted from the board (`:32-35`).
- Stored in table `channel_plans` (`body_md`), with an event log `channel_plan_events`. `packages/services/src/channel.ts:506-600`.
- A piece is first put on the board by `ensureChannelPlan`, which writes `emptyPlan()` (`channel-plan-md.ts:50`; `channel.ts:648`). The UI trigger is the "Start plan.md" button (`packages/content/src/ui/panels/plan.tsx:67`), which calls `startPlanAction` (`apps/arts-collective/src/lib/channel/actions.ts:235-245`).
- The table needs a migration. `channelReady()` checks it (`channel.ts:95-100`). Without it the UI shows a banner (`ChannelFrame.tsx:123-127`).
- Board suggestions are `piece.suggestions`, produced by the loader's rules (`packages/channel/src/load.ts`). The pop-up lists them with Accept, Adjust, Dismiss (`PieceSurface.tsx:25-52`).

### 3. The Dock, the LMS and the registry

- The Dock component is `packages/dock/src/dock.tsx`. It is mounted once, in `apps/arts-collective/src/app/layout.tsx:55`. No site mounts it (no `Dock` in `apps/sunjay/src/app/layout.tsx` or `apps/katie-the-potter/src/app/layout.tsx`). It is fixed bottom-right (`packages/dock/src/dock.css:36-38`).
- It fetches `/api/actions/dock?path=...` (`dock.tsx:103`). The route is `apps/arts-collective/src/app/api/actions/dock/route.ts:32`; the logic is `packages/actions/src/server/dock.ts`.
  - LMS part: `dockStep` (`server/dock.ts:137`) takes the first open step of an enrolled course. The owner called it "the assistant's light suggestion".
  - Channel part: `dockChannel` (`:265-276`) reads `sources.channelNext`: one move plus an "N more waiting" count.
- `channelNext` is `channelNextSource` (`apps/arts-collective/src/lib/channel/next-source.ts:18-23`). It loads the Channel model and calls `channelNextMoves` (`packages/channel/src/next.ts:77`).
- **One function feeds all of these** (`next.ts:2-6` says so):
  - Channel Home's Next row: `components/channel/NextRow.tsx:29`.
  - The Studio's "Next for this piece": `studio-summary-action.ts:63`.
  - The Dock's Channel part.
  - Registry entry `channel-next` (`packages/actions/src/catalogue.ts:89`) and the MCP tool `whats_next` (`packages/mcp/src/server/tools.ts:141-174`).
  - The site Home's Next row: `packages/channel/src/site/page.tsx:199`.
- So the board and the Dock share one suggestion source. They differ in where they show:
  - `channelDockPath` hides the Dock on `/channel` itself (`server/dock.ts:250`), because Home already has the Next row. It shows on `/channel/*` and `/studio` (`:260`). The query string is dropped, so the Dock is absent on `/channel?piece=...&tab=plan`.
  - The Dock only performs `CHANNEL_DOCK_ACTIONS`: accept, slot-fill, plan-step (`packages/actions/src/channel.ts:74`). `channel-plan` is left out on purpose (`:75-77`).
- Channel registry entries (`packages/actions/src/catalogue.ts:89-113`; runners `server/run.ts:378-412`): `channel-next` (read), `channel-suggestion-accept` and `-dismiss`, `channel-slot-fill`, `channel-plan-step`, `channel-plan` ("Plan it": start a plan and propose steps, `run.ts:394`), `channel-delivery-save` (draft post, `run.ts:401`).
- There is no second "board" store. The "board" is the loader's model (`pieces[].suggestions`, `plan`, `week`). The Dock is a one-line view of the same derivation.

### 4. The shared site Channel

Files: `packages/channel/src/site/{page,tabs,grid,grid-data,runs,view,server}.ts(x)`. Mounted at `apps/sunjay/src/app/channel/page.tsx` and `apps/katie-the-potter/src/app/channel/page.tsx`. Door: `apps/*/src/lib/channel-door.ts` (calls `performSiteChannelAction`; allow list `SITE_DOOR_ALLOW` at `packages/channel/src/site/view.ts:11-18`: accept, dismiss, slot-fill, plan-step, plan, delivery-save). Loader: `siteChannelLoader` (`site/server.ts`), over the same `loadChannelModel`.

The URL contract differs from arts-collective:
- On a site, `tab` is the site tab: home, board, queue, out, library (`site/page.tsx:116`; unknown values fall back to home). `piece` is the manage-piece pop-up, and it only opens on the board or queue tab (`page.tsx:211,219`).
- So `/channel?piece=thread:X&tab=plan` on a site shows Home with no pop-up. The link does not work there.

What the site lacks, against arts-collective:

| Piece | arts-collective | Site |
|---|---|---|
| Piece plan view (Overview + Plan tabs) | `ContentDetail` via `PieceSurface` | None. The pop-up is `PieceSummary` (`tabs.tsx:288-364`) with `links: { channel: null, plan: null }` (`tabs.tsx:338`), so the shared "Plan it" link is hidden (`PieceSummary.tsx:225`). |
| plan.md | read, edit, steps, Start plan.md (`panels/plan.tsx`) | Not shown or editable. The door can tick or add steps (`channel-plan-step`), but nothing draws plan.md. |
| Board init | "Start plan.md" -> `ensureChannelPlan` | Indirect. The pop-up's "Plan it" button (`tabs.tsx:362`) runs `channel-plan`, writes the plan and proposes steps, then shows a one-line note. It never shows the plan. |
| Suggestions | Plan tab, Home, Dock | Home Next row only (`page.tsx:199`). The pop-up passes `next: []` (`tabs.tsx:337`) and draws `p.suggestions.slice(0,6)` itself (`tabs.tsx:341-346`), not `channelNextMoves` with the piece key. |
| Dock | mounted (`layout.tsx:55`) | not mounted |
| Routines | `/channel/routines` | link out ("Set up routines", network) |
| New post | `/channel/new` | "New" menu links to Studio |
| Outlets | `/channel/outlets` | redirect through the hand-off (`page.tsx:111`) |
| Adjust, quick sheet, library stack | `components/channel/{AdjustSheet,QuickSheet,Library}.tsx` | grid cell dialog (`grid.tsx:204-232`), a Library tab |

### 5. The toasts Justin sees on queue and board cells

**I could not find these strings.** I searched for "manage page", "can be done", "done in", "reminder" and "plan reminder" across `packages/`, `apps/arts-collective/src`, `apps/sunjay/src`, `apps/katie-the-potter/src` (ts, tsx) and the `.next` output of those three apps. Nothing matches. What I can say:

- `packages/channel/src/site/grid.tsx` was changed today at 00:37. In the current source, a cell click opens a `<dialog>` form (`Cell` at `grid.tsx:183`; `CellDialog` at `:204-232`: plan a post, accept or dismiss, fill a slot). There is no toast. The same table serves Board, Queue by week and Queue by piece (`grid.tsx:9-16`).
- The site's only inline message is `NoteLine` (`packages/channel/src/site/runs.tsx:30-60`), text under a button. Its fixed strings are "This cannot be done from here." (`runs.tsx:36`) and "That did not work. Try again." (`:47,51`). Sunjay's Sonner toaster sits top-right, not upper-left (`apps/sunjay/src/app/layout.tsx:98`).
- On arts-collective, the Board matrix and Queue cells are not buttons. They are spans with a native `title` tooltip: `components/channel/Queue.tsx:145` and `Home.tsx:267`. A native tooltip shows near the pointer.
- Likeliest cause: an older deployed build than today's `grid.tsx`, or a native tooltip. I cannot see the deployed containers from here. If the strings are on the live site, grep inside the running sunjay or katie image, not the repo.

---

## Proposal

Principle: one URL contract, one plan view, one suggestion list. The site gets the same pop-up as arts-collective, not a copy.

### P1. Route parity: `/channel?piece=<key>&tab=plan` on every host

- Today `tab` is overloaded: the site tab on a site, Overview/Plan on arts-collective.
- Proposal: `tab` means the piece view everywhere. Rename the site tab param to `view` (`/channel?view=queue`). Keep old `tab=board|queue|out|library|home` as a read-only alias so existing links work. Then `piece` + `tab=plan|overview` opens the pop-up on any site tab, Home included.
- Where: `site/page.tsx:116,211,219`, `SiteLinks.tab` (`page.tsx:130-136`, `view.ts:26`).
- **Effort S. Lane a2 (channel).**

### P2. One piece view in @elkdonis/channel

What moves out of `apps/arts-collective/src/components/channel/` into `packages/channel/src/` (a client entry such as `@elkdonis/channel/piece`):
- `PieceSurface` (62 lines), its connectors, and the `channelPieceToDetail` mapper (`apps/arts-collective/src/lib/channel/content-detail.ts`, 135 lines).
- The plan actions (`startPlanAction`, `savePlanAction`, `setPlanStepAction`, `actions.ts:235-271`) become door entries. `channel-plan-step` and `channel-plan` already exist; start and save do not. Add them to `SITE_DOOR_ALLOW` and `packages/actions/src/server/site-channel-door.ts`. Same writer, same table, same actor rules.
- `ContentDetail` and `PlanPanel` already live in `@elkdonis/content/ui`, so they do not move. They need `SurfaceProvider` and `useLayer` from `@elkdonis/cms-ui/surface` (`ContentDetail.tsx:5,34`). Sites would mount a small provider, or `ContentDetail` gets a plain-modal mode.
- Result: arts-collective, sunjay and katie render the same Overview/Plan pop-up.
- **Effort L.** Lane **a2** for the move and the door; **fc** for any `@elkdonis/content` change (modal mode).
- Smaller first step: keep the site's `PieceSummary` and add a plain Plan section (read plan.md, tick steps, Start plan.md, save). **Effort M. Lane a2.**

### P3. "Plan it" on a site's manage-piece goes to the plan view

- Pass `links.plan = links.tab(tab, { piece: key, tab: "plan" })` in the site pop-up (it is `null` at `tabs.tsx:338`). The shared "Plan it" button then appears (`PieceSummary.tsx:225`). Under P2 it is the same pop-up switching tab, with no page load.
- Keep the `channel-plan` button (`tabs.tsx:362`), but move it into the Plan tab as "Propose steps" next to "Start plan.md". One verb, one place.
- Studio's "Plan it" always links to arts-collective `/channel` (`studio-summary-action.ts:78`). For a piece of an org with a site, link to that site's `/channel?piece=&tab=plan` through the hand-off.
- **Effort S** (site link) and **S** (Studio link). Lanes: **a2** for the site link, **fc** for Studio/summary.

### P4. Cell clicks open a form, form to form

- The current source already does this on sites (`grid.tsx:183-232`). Confirm it is what is deployed, and keep any toast path out. Check the live image first (Today 5).
- On arts-collective, make Board and Queue cells buttons that open the existing `QuickSheet` (`openQuick`, `context.tsx:58-64`). `specFromSuggestion` (`packages/channel/src/quick-spec.ts`) already builds the sheet input from a suggestion. An empty cell gets a blank "Plan a post" spec, the same shape `channel-delivery-save` takes. Replace the title-only spans at `Queue.tsx:145` and `Home.tsx:267`.
- Later: one `ChannelGrid` for both hosts (it is already in `@elkdonis/channel/site`).
- **Effort M** for the arts-collective cells; **L** to unify the grid. **Lane a2.**

### P5. Board, Queue and Dock as one suggestion source

They already are (Today 3). The gaps are surfaces, not data.
1. Site pop-up: replace its own `p.suggestions` rows (`tabs.tsx:341-346`) with `channelNextMoves(model, { pieceKey, limit: 4 })`, as the Studio summary does (`studio-summary-action.ts:63`). Site, Studio and Dock then list the same moves for a piece. **Effort S. Lane a2.**
2. Mount `Dock` on sites. Each site needs a `/api/actions/dock` route with a `channelNext` source over `siteChannelLoader` (scoped to its org) and a `runDockAction` over `performSiteChannelAction`. It brings the LMS "next step" to the sites too. **Effort M. Lane new** (`packages/actions`, `packages/dock`, site layouts and routes; only the loader call touches a2's files).
3. Show the Dock on the plan view. Make `channelDockPath` (`server/dock.ts:250`) read `piece` from the query, and have the Dock send `location.search` with the path. **Effort S. Lane new.**
4. Optional: let the Dock run `channel-plan` for the open piece (`actions/src/channel.ts:74-77` leaves it out today). **Effort S. Lane new.**
5. Name it once. Justin says "the Dock". The code says "board" (the model), "next row" (Home) and "dock" (the corner box). `DockChannel.label` already reads "On your board" or "Next for this piece" (`server/dock.ts:265-276`). **Effort S. Lane fc.**

### Suggested order

1. P1, the P3 site link, P5.1 (all S): the link works and the lists match.
2. P2 small step (M): plan.md visible on sites.
3. P4 on arts-collective (M), then P5.2 and P5.3.
4. P2 full move (L) after a2's current edits land.

## Open questions for Justin

1. Which page and URL showed the popups ("can be done in manage page", the plan reminder)? I could not find the strings in source. Was it before today's grid change, or a hover tooltip?
2. Should the site's manage-piece pop-up and arts-collective's pop-up become one component (P2 full, L), or is a plan.md section inside the site's pop-up enough for now (P2 small, M)?
3. Should `tab` mean Overview/Plan on every host, with site tabs renamed `view` (P1)? Old links would keep working as aliases.
4. Should the Dock appear on the sites (P5.2), and should it show on the plan view?
