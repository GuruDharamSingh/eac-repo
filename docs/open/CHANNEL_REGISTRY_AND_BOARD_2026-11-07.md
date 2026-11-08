# Channel in the action registry, the next row, the dock, and where the board is missing (2026-11-07)

This covers the first pass at Channel's registry entries (`packages/actions`), the "next" model and
row that replace Channel Home's four count bands, the dock's Channel part, and a comparison of the
design's board (2a, 2b, 3c, 1a) with what `/channel` shows. It records the owner's decisions of
2026-11-07 and the wiring the main Channel session still has to do. Source only: nothing is built,
deployed, committed, or run against live rows. Channel itself: `docs/open/channel.md`. Registry:
`docs/open/LMS_ACTION_LAYER_BRIEF_2026-11-06.md` §5a-5g. Routines as courses (a parallel plan):
`docs/open/CHANNEL_ROUTINES_AS_COURSES_PLAN_2026-11-07.md`.

## 1. Owner decisions (2026-11-07)

- Home, New post and Queue follow up on posts and structure the next move; the Studio is for heavy
  creation.
- Home's top row of four count boxes becomes a dock- and LMS-driven row of next moves.
- The dock stays small: it is only the surface of the board and its routines. One line at a time.
- Live stays in: it will be open to everyone soon. Today the booth (`/studio/broadcast`) is
  admin-only, so a live move opens the booth for admins and the piece for everyone else.
- "Gaps too": the dock and the next row show unprompted gaps as well as accepted or placed steps
  ("Field Notes is not on Facebook · Share the shop link"). Accepted or placed moves that are due
  come first, then gaps. A dismissed gap does not come back: the loader drops suggestions that have
  a `dismissed` delivery, and the accept and dismiss runners check `findOpenChannelDelivery` first.

## 2. Registry entries (in source)

### 2.1 The `channel` scope

`ActionScope` gained `channel` (`packages/actions/src/types.ts`). With no org the entry acts on
the person's own channel, which also carries the orgs they run, as `/channel` does. With an org claim
it acts on that org's channel. `resolveChannelOrg` (`src/server/org.ts`) honours the claim only for
owners and guides, never for `oad`, and has no fallback to an owned org. A claim that does not settle
is refused: the doors pass `orgClaim` beside `orgId`, and `performAction` returns `forbidden` when a
`channel` entry has a claim but no org (`src/server/run.ts`, `perform`). `COURSE_ACTIONS` now lists
only `person` and `org` entries. Reason: `@elkdonis/lms` `stepTask` and lms-ui's `LmsTaskChoice` read
only those two scopes, so a course step cannot name a channel entry yet. Sophia type-checks with this.

### 2.2 Entries

Ids are immutable once a course stores them, so they follow the `channel-<noun>[-<verb>]` pattern
and say what they act on.

| Id | Runs / checks | Input (zod/v4) | Writes | Doors |
|---|---|---|---|---|
| `channel-next` | check only (`derived`) | none; `?org=` | nothing | status from any door: `GET /api/actions/channel-next` |
| `channel-suggestion-accept` | runner | `pieceKey`, `outlet` (11 outlets), `identityId?`, `text` (1-200), `at?`, `routineId?` | draft delivery placed at `at` (routine kept only if the owner's), plan step tagged "from the board" | app, http, dock |
| `channel-suggestion-dismiss` | runner | `pieceKey`, `outlet`, `identityId?`, `text?` | `dismissed` delivery | app only (refused elsewhere) |
| `channel-slot-fill` | runner | `routineId`, `at` (the slot's instant), `pieceKey`, `text?` | draft delivery in that slot (the routine's outlet, owner and name), plan step | app, http, dock |
| `channel-plan-step` | runner | `pieceKey`, `identityId?`, `op` add/check/uncheck, `text` (1-300), `index?`, `on?` | plan.md step appended, or ticked/unticked when the text at `index` matches | app, http, dock |

- `channel-next`'s status: done ("Nothing is waiting in the channel.") or partial with
  `detail` "Next: <title> · <reason> (and N more)", `href` `/channel[?org=]`, and the new
  `ActionStatus.next`: up to five `ChannelNextMove`s, each with its `run` (entry and input). The
  check reads through `StatusContext.sources.channelNext`, which the host passes
  (`ActionSources`, `src/server/status.ts`). Without it the check answers "This site cannot read the
  channel". It does not compute a second list.
- Authorization (`src/server/channel.ts`): `channelActing`, `channelOwnerFor`, `channelIdentityOf`,
  `channelOwnRoutine`, `parseChannelPieceKey`, `channelPiece` are copies of `ownerFor`, `identityOf`,
  `ownRoutine`, `parseKey` and `mayTouch` in `apps/arts-collective/src/lib/channel/actions.ts`, with
  the same SQL. `channelPiece` also returns the title. `plan` admits artwork an org site shows
  through `shop:store`; `deliver` does not. Exported from `@elkdonis/actions/server` so actions.ts can
  import them (open item 1).
- `channel-slot-fill` finds the routine among the channel's owners (the person and the orgs they
  run, or only the scope org). It checks that `at` is one of the routine's slots (`routineSlots`, zone
  `CHANNEL_TIME_ZONE`, default America/Toronto, as the loader uses) and is still ahead. It checks the
  slot is empty by the loader's rule: a non-dismissed delivery on that routine, or an unattached one on
  its outlet, that day. If the same piece already fills the slot it answers ok with `already`; another
  piece in the slot is refused. The default text follows the loader's wording ("Post <title> to
  Instagram").
- Refusal codes: `auth` (signed out, 401), `input` (schema, a bad piece key, a time that is not a
  date; 400), `forbidden` (not the person's channel, piece or routine; an unsettled org claim; dismiss
  from a non-app door; 403), `failed` (thrown, 500). Entry refusals with no code (422): Channel tables
  missing (`ChannelNotReady`), plan changed since read (`ChannelPlanConflict`), slot passed, no slot at
  that time, slot filled.
- Plans only. No entry schedules (`status 'scheduled'`) or sends. Scheduling stays with the quick sheet
  and New post, which are the app's own actions, so "draft-only from every door except the app" holds
  for every door.
- Actor attribution: `channelActor` writes `actor_kind` 'user' (id the person) from `via` 'app', and
  'agent' with id `door:<via>` (`door:http`) from any other door. The rows' `created_by`/`updated_by`
  stay the person. `action_events.actor_type` is now written: 'human' for app, 'system' for script,
  'ai' for other doors. Before this change the column kept its default 'human' (coordinator's note).
  Its CHECK allows only human/ai/system, so the values differ from Channel's user/agent.

### 2.3 Verified, assumed, unknown

- **Verified (type checks, in the admin container, 2026-11-07):** `@elkdonis/actions` check-types
  exit 0; `@elkdonis/dock` 0; `arts-collective` 0; `sophia` 0; `@elkdonis/lms-ui` 0;
  `check:registry` exit 0: "29 entries, 15 runners, 24 checks, consistent". `@elkdonis/services` was
  not edited.
- **Verified (pure probes, tsx, no database):** the four input schemas accept well-formed input and
  refuse an unknown outlet, blank text, a bad routine id and a tick without an index. Their JSON
  Schema lists the expected properties. `channelNextMoves` on a hand-written model gives the order in
  §3, and gives no runnable moves when `ready` is false. `channelDockPath` handles the path cases in
  §4. `COURSE_ACTIONS` holds no channel entry.
- **Verified (`EXPLAIN` on `elkdonis_dev`):** the `action_events` insert with `actor_type`, and both
  `channelPiece` queries.
- **Not verified:** any runner against live rows (every call writes an append-only `action_events`
  row, and the brief forbids writes); `channel-next` through the route; the dock and NextRow in a
  browser; the loader inside the dock route.

## 3. The next model and row

- `apps/arts-collective/src/lib/channel/next.ts`, `channelNextMoves(model, { limit })`, is pure: no
  database and no server-only import. It reads only the loader's `ChannelModel`, so NextRow (browser),
  the dock and `channel-next` (server, through `next-source.ts`) get one list. Its sources:
  - suggestions: in a routine slot (`slot`), by date (`suggestion`), or not placed. Unplaced ones are
    `gap` for Instagram, Facebook or Threads ("<piece> is not on Facebook", button text "Share the shop
    link" / "Make a quote card" / "Share it") and `follow-up` for video, writing or the letter;
  - week items: empty routine slots (one per routine), placed Channel drafts, scheduled lives, and
    today's and tomorrow's to-dos;
  - tray: unplaced drafts and notes;
  - plan.md: unticked steps of the person's own. Steps tagged "from the board" are left out, because
    their drafts stand for them (open item 6).
- Order: due today or overdue, then the next two days, then the rest of the week, then undated. Within
  each group, soonest first, then by kind: live, slot, draft, suggestion, step, to-do, gap, follow-up,
  note. At most two moves per piece. The row shows 4.
- Runs: suggestions → `channel-suggestion-accept`; own plan steps → `channel-plan-step` (check); to-dos →
  `setTodoDoneAction` (no registry entry yet, open item 4). Empty slots, drafts, notes and lives have no
  button. They open the quick sheet (empty slot: same fallback piece as the Queue; draft: the
  delivery's own identity from its timeline row), the piece or its Plan tab, the Studio (video and
  writing), the booth (admins) or the queue.
- `NextRow.tsx` + `next.css`: four columns (two below 1180 px, one below 480 px). Each card is a top
  rule, kicker, title (three lines at most), reason, one registry button and one "open" control. An
  urgent move gets a 2 px accent rule. The result shows in a status line kept at row level, then
  `onMutated` refreshes the page. It renders nothing when no move is waiting. Inks are the pairs
  `channel.css` already measured (recorded in the `next.css` header).
- `next-source.ts` (`channelNextSource`): users.email lookup, `loadChannelModel`, then
  `channelNextMoves`. The page-only fields (`sheet`, `todoId`, `urgent`) are left off the wire.

## 4. The dock

Built (smallest version):
- `server/dock.ts`: `DockOptions.sources` and `DockData.channel` (`DockChannel`: label, one move,
  `more`, href). `channelDockPath` gives the piece key on `/channel/piece/<kind>/<id>`, the channel
  on other `/channel/...` paths and `/studio...`, and null on Channel Home (its row shows the same
  moves) and everywhere else (the loader runs about fifteen reads). On a piece board the dock reads 20
  moves and shows that piece's first one. The dock route passes `channelNextSource`.
- `isDockAction` allows channel entries by id through `CHANNEL_DOCK_ACTIONS` (accept, slot-fill,
  plan-step), not by scope, so dismiss is never dock-runnable.
- `packages/dock`: `ChannelPart`, one line (the title cut with an ellipsis, the reason as its title
  attribute), the move's registry button through `runDockAction`, and a link to open it in Channel. The
  tab reads "Next in Channel" / "Next for this piece" when there is no course step.
- Routine steps (coordinator's note): `dockStep` walks the continue step and then the open steps. A
  step whose task has `repeat: 'daily'` and whose status is done today gives way to the next. A routine
  course with every step done today gives way to the next course. Courses without routine steps behave
  as before.

Should change next (not built):
- Cost: each dock read on those paths runs the whole `/channel` loader. A 60-second cache per person
  in `next-source.ts`, or a lighter reader (routines, slots, deliveries and plans only), would bound
  it. The routines plan prefers the lighter reader; that drops gaps, and the owner wants gaps too.
- The routines plan keeps the dock closed on all of `/channel*` and keeps gaps out of the dock. This
  pass shows the dock on Channel's inner pages and follows the later "Gaps too" decision. The owner
  has not chosen between the two.
- Org sites: the session cookie is host-only, so the dock (and its Channel part) shows only on the hub
  host.

## 5. Where the board is missing

Compared: the design artboards (`scratchpad/dshots/ch-1a.png`, `ch-2a.png`, `ch-2b.png`,
`ch-3c.png`) with the components as they stand (code read 2026-11-07, `Home.tsx` 12:29,
`Queue.tsx`, `PieceBoard.tsx`, `PieceSurface.tsx`, `QuickSheet.tsx`, `ChannelNav.tsx`). Not
rendered signed in.

1. **The board has no name or place of its own.** "Board" appears only inside the piece pop-up's
   Plan tab ("From the board", "Open the board for this piece", the "from the board" step tag). The
   nav has no entry for it (`NavActive` "piece"). Home, the Queue and the quick sheet never say it.
   The page it opens (`/channel/piece/<kind>/<id>`, 2b) has a breadcrumb "Channel / Artwork /
   <title>" and no heading that says board.
2. **One page, two labels.** The pop-up's mast button "Queue" (`PieceSurface.tsx:97-99`) and "Open the
   board for this piece" (`:361`) both go to the piece board, not to `/channel/queue`.
3. **The counts disagree.** The Plan tab counts every suggestion ("3 waiting"). The board draws only
   suggestions placed in time within its seven weeks (`PieceBoard.tsx:74`), so the same piece can show
   "3 waiting" and "No suggestions placed on this board." Unplaced gaps and follow-ups appear only in
   the Queue's tray (one per piece, Instagram and Facebook only) and on Home's chips.
4. **Accept one and accept all live on different screens.** Per-item Accept / Dismiss is only in the
   Plan tab. The board has only "Add N to the queue" / "Dismiss" for all. Its chips, like every "Next"
   chip on Home and in the Queue, open the quick sheet instead.
5. **Two ways onto the queue, two effects on plan.md.** Accepting writes a draft and a plan step.
   Saving the quick sheet writes a draft and only ensures the plan exists, with no step
   (`actions.ts` `saveQuickSheetAction`). A post made from a chip therefore never appears in Steps.
6. **The Dates lane is thin.** 2b draws "Open studio · Sat Nov 21" and "Letter goes out · Dec 1",
   which come from the plan's dates. Today the lane holds only the piece's own next date (`eventAt`).
   plan.md `## Dates` lines and dated steps (`<!-- on … -->`) are not drawn.
7. **1a's "Next for this piece" has fewer kinds.** The design shows "Post the walk-through to Instagram
   and Facebook" (a follow-up of a follow-up), "Go live from the studio" and "Add to the December
   letter". The loader suggests Instagram and Facebook gaps, "Film a short walk-through", "Write about",
   and a letter only when a letter routine exists. There is no live suggestion, and no chain from a made
   video back to its piece (needs the follow-up lineage, `channel.md` pass 3).
8. **2a's event-relative moves are missing.** "Open studio is a week away · Email the 34 going" has no
   counterpart. The letter is the only mail suggestion, and it is routine-bound.
9. **Empty slots guess a piece.** "Fill this slot" opens the quick sheet on the first piece with a
   suggestion on that outlet, else the first piece (`Queue.tsx:133`), with no word on why that piece.
10. **The tray is not draggable.** 2a: "Drag one onto a day or a slot" (out of scope per the handoff).
    Today a card opens the sheet. A note's chip goes to the Studio in general, not to a piece.
11. **Home has no count bands today.** `Home.tsx` (12:29) opens with the routines strip, as the handoff
    README asked ("replace the four count bands with the routines strip"). The bands the owner refers
    to are 1a's artboard. NextRow goes where they are drawn in 1a, above the routines strip.
12. **3c's registry line.** "Every change to plan.md is recorded with who made it, a person or an
    agent" (`PieceSurface.tsx:359`) is now backed: `channel-plan-step` and accept write `actor_kind`
    'agent' from non-app doors.

### Recommendation (for the main session and the owner)

- Name it once. Call the per-piece page "Board" everywhere: the pop-up's mast button "Board" (not
  "Queue"), the board page's heading "<title> · board", and a nav row under Queue that opens the board
  of the piece last open. Keep "Queue" for `/channel/queue` only.
- One count, one list. The board, the Plan tab and the dock should count the same thing: the piece's
  suggestions plus its open drafts and steps. Draw unplaced suggestions in a "Not placed" strip at the
  foot of the board (the tray, filtered to the piece), so "N waiting" matches what the board shows.
- One chip behaviour. Every chip gets the same two controls the next row has: a registry button "Add to
  the queue" (`channel-suggestion-accept`) and "Write it now" (the quick sheet). Accept, dismiss and the
  sheet are then reachable from every chip on Home, the Queue, the board and the dock.
- One effect on plan.md. Have `saveQuickSheetAction` append the step when it creates a delivery (or
  call `channel-slot-fill` / accept and then update the payload), so every queued post is a step.
- The board's Dates lane reads plan.md `## Dates` and dated steps, so the plan and the board show the
  same calendar.
- The next row is the board's surface on Home. The dock is its surface elsewhere. Neither needs a
  third list.

## 6. Wiring for the main session

- Mount the row in `Home.tsx` `InMotion`, above `<RoutinesStrip …/>` (inside ChannelFrame, so
  `useChannel` works): `import { NextRow } from "./NextRow";` then `<NextRow />`. Props are optional:
  `limit` (default 4) and `moves` (`ChannelNext[]`, precomputed). With no props it derives from the
  context model. No model field is needed.
- Optional, to share one copy of the rules: in `lib/channel/actions.ts`, replace `ownerFor`,
  `identityOf`, `ownRoutine`, `parseKey` and `mayTouch` with `channelOwnerFor`, `channelIdentityOf`,
  `channelOwnRoutine`, `parseChannelPieceKey` and `channelPiece` (non-null = may touch) from
  `@elkdonis/actions/server`, and `acting()` with `channelActing(user.id)` plus the actor. Until then
  the two copies must change together (header of `packages/actions/src/server/channel.ts`).
- The Tray's draft cards open the sheet with `p.ownerIdentityId` (`Queue.tsx:290`). For an org-owned
  draft in artist scope the update then misses the row ("That draft is gone."). The next model uses the
  delivery's own identity from its timeline row; the Tray could do the same. Assumed from the code, not
  reproduced.

## 7. Rules

- Add a Channel move to the derivation in `next.ts` only, not to the row, the dock or the check: the
  three read one list so they cannot disagree.
- Keep channel runners to plans (drafts, steps, dismissed rows): scheduling becomes sending once a send
  worker exists (`channel.md` §1 "Publishing").
- Resolve a channel entry's org with `resolveChannelOrg` and pass `orgClaim`: a claim must be refused,
  not widened to the person's own channel.
- Allow channel entries in the dock by id (`CHANNEL_DOCK_ACTIONS`): dismiss hides a gap for good and
  stays with the pages.

## 8. Open items

1. actions.ts to import the shared helpers (§6). Owner: main session.
2. Accept by suggestion id. The routines plan proposes that the runner recompute the suggestion from
   its id, so no door supplies text, time or routine. The derivation lives in the app loader, so the
   registry would need a host reader (`ActionSources.channelSuggestion(id)`). Today both the app action
   and the runner take the fields, owner-scoped.
3. Dock read cost (§4): a cache or a lighter reader, and the owner's choice between this pass and the
   routines plan's "closed on /channel*, no gaps in the dock".
4. To-dos have no registry entry. A `channel-todo-done` would let the dock and an agent tick them.
   Choose the id before any course stores one.
5. `channel-next` as a course step: `@elkdonis/lms` `stepTask` and lms-ui `LmsTaskChoice` need the
   `channel` scope (or a mapping to person). Then `COURSE_ACTIONS` can list it.
6. Board steps ("from the board") stay unticked after their delivery is scheduled or published.
   Nothing ticks them. The next model skips them for that reason.
7. Agent identity: Channel rows record the door (`door:http`), not an agent. Once agents carry delegated
   tokens (`act.sub`, brief §7.2), pass that id through `ActorContext`.
8. A partial unique index on open deliveries (`channel.md` §4 item 8) would close the double-accept race
   for the registry doors too. No migration was written in this pass.
