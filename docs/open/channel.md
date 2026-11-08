# Channel: brief and build status (2026-11-07)

Channel is the per-artist and per-org publishing console at
`arts-collective.com/channel`. It shows each piece of work and every post that
followed it, plans the pieces over time (Queue, routines, a per-piece board and
plan.md), and cross-posts. It follows the Claude Design handoff in
`docs/open/channel-handoff/` (`README.md`, `PROMPT.md`, `Channel.dc.html`):
layout, structure, copy and behaviour come from the handoff. Colour and type are
provisional until the owner sends the palettes. This brief maps the handoff
onto real tables, services and routes, and records what is built, verified and
still open. The first console (`/studio/channel`, `@elkdonis/studio/channel`,
`CHANNEL_CONSOLE_DESIGN_2026-11-07.md`) stays deployed and untouched; nothing
links to it once katie-the-potter is rebuilt.

## 1. Current state (2026-11-07: deployed, migration 252 applied, not yet used signed in)

### Routes (apps/arts-collective)
| Route | Screen | File |
|---|---|---|
| `/channel` | Home (1a): routines strip, In motion list, piece face | `src/app/channel/page.tsx` |
| `/channel?view=matrix` | Coverage matrix (1b) and "Coming up" | same |
| `/channel/queue` (`?view=month`, `?week=`, `?routines=edit`) | Queue (2a), routine form | `src/app/channel/queue/page.tsx` |
| `/channel/piece/<thread\|artwork>/<id>` | Piece board (2b) | `src/app/channel/piece/[kind]/[id]/page.tsx` |
| `/channel/new?about=<kind>:<id>` | New post (1d): About (choose any earlier piece through the library), Post as (Artwork, Writing, Video, Series, Meeting: sets the starting text), phone review tabs (1e) | `src/app/channel/new/page.tsx` |
| `/channel/outlets?tab=<site\|instagram\|facebook\|threads\|youtube\|live\|newsletter>` | Outlets: per outlet, the names it goes out as, accounts, Connect (the Center's Connections panel and routes), planned, not there yet, what went there, failures; Live tab with YouTube/Facebook Live state and the booth (admins) | `src/app/channel/outlets/page.tsx`, deployed 2026-11-07 16:00 EST |

Every page takes `?org=<org id>` for an org's channel. The viewer comes from
`requireUser()` (`getServerSession`). The org must be one the viewer owns or
guides (`listUserMemberships`); any other value falls back to the artist channel.

Pop-ups are host `custom` surfaces in the shared surface stack
(`src/components/channel/ChannelFrame.tsx`). Custom surfaces are not written to
`?surface=`, so the host keeps `?piece=<key>&tab=plan` itself:
- `channel:piece`: piece pop-up (3a) and Plan tab (3c), `PieceSurface.tsx`
- `channel:library`: content library as bricks with a lightbox (3b), `Library.tsx`
- `channel:quick`: quick sheet (2c), a right-hand sheet 460 px, Expand 900 px, `QuickSheet.tsx`

The left column is `ChannelNav.tsx`. Styles are in `channel.css`, on three area
tokens: `--eac-area-channel`, `--eac-area-studio`, `--eac-area-queue`. Contrast
was measured and is recorded in the file header. Icons are lucide, already a
dependency, in place of the mock's Phosphor.

### Data
Read from the tables that already record it (`src/lib/channel/load.ts`):

| What | Source |
|---|---|
| Pieces | `threads` of kinds writing, post, meeting, reading_group, series, workshop, event (status published or draft); `artwork` through commerce `listArtworksForPerson` / `listStoreArtworks` |
| Website / your page | `threads.published_at`; artwork on an org site through the `site_config` `shop:store` pin |
| Market | `artwork.status` available/reserved/sold |
| Instagram, Facebook, Threads | `threads.metadata.shares` (Studio "Post to") and `social_posts.shares` whose `link` is the piece's page |
| Failures | `publish_jobs` status failed, last 30 days |
| Letter | `email_sends` kind `notification` with a `thread_id`. Assumed: that kind is the default for all notification mail, so the row may be any mail about the thread. |
| Instagram quota | 25 minus the viewer's Instagram `publish_jobs` in 24 h. This is an estimate from our own log: it undercounts posts made outside the platform or by another person on the same account. `remainingInstagramQuota` (a Graph call) is not called on page load. |

Written by Channel: migration **252** (`packages/db/migrations/252_channel.sql`,
applied 2026-11-07 17:42 UTC; `\dt channel_*` lists the five tables), services `@elkdonis/services/channel` and the pure
`@elkdonis/services/channel-plan-md`:
- `channel_deliveries`: what Channel plans for a piece on an outlet: draft, scheduled, an accepted suggestion, or a `dismissed` row so a gap stops suggesting itself.
- `channel_plans` + `channel_plan_events`: plan.md per piece. The event log is append-only and written in the same transaction, recording actor kind and id. Whole-body saves carry `expectedUpdatedAt`; a stale copy is refused (`ChannelPlanConflict`).
- `channel_todos`: dated or undated to-dos (undated ones are the "Your note" tray cards).
- `channel_routines`: weekday, month-day or nth-weekday cadence, with a `source` of 'channel' or 'sophia'. Slots are computed at read time (`routineSlots`), never stored.

Before 252 was applied, reads returned empty and writes returned "Channel
planning is not switched on yet". The same guard still covers a database
without the tables (a scratch copy, say).

### Derived rules (load.ts)
- **In motion**, in order: a scheduled or live delivery ahead; the piece's own date ahead (`scheduled_at`, or the next `series_session`); published to any outlet in the last 14 days; open to-dos or unfinished plan steps. The reason is the row's sub-line.
- **Gaps → suggestions**: for a published piece, Instagram or Facebook is missing for an identity on which that outlet is connected (personal connections for the artist, `org_channels` for an org). Video and writing follow-ups are suggested for artwork in motion, and a letter only when a newsletter routine exists. Each suggestion is placed in the next open slot of a routine on that outlet with the same owner, else three days before the piece's date, else left in the tray.
- Accepting a suggestion writes a draft delivery and appends a step tagged "from the board" to plan.md, creating the plan the first time.

### Who may write what (actions.ts, review pass 2)
- The owner of a row comes from the session: the person, or an org they own or guide. `oad` never counts as an org they run.
- The name a row goes out under is the owner's own (`identityOf`), never a value from the form. A routine id is kept only if it is the owner's live routine.
- `mayTouch(…, "plan")` lets plans and to-dos cover artwork an org's site shows through its `shop:store` pin. `mayTouch(…, "deliver")`, for anything that would go out under a name, does not: an org manager cannot post another artist's work through the org. Archived artwork is refused either way.
- Accept and dismiss are idempotent (`findOpenChannelDelivery`). A batch is not atomic: if item N fails, items before it stay written.
- Ticking a plan step sends the step's text; if a step was added since the page loaded, the tick is refused instead of landing on the wrong line.

### Publishing
**2026-11-07, owner's go-ahead ("Make it real"); deployed 16:00 EST (arts-collective `eUiU07MUtgAPWBDzkPfpO`), no real post made yet:** New post publishes for real.
- "Publish to N places" first opens "Check before it goes out": each outlet's exact text, with a checkbox per account. Accounts come from the Studio's `listShareTargets`; in an org's channel only the org's own channels (`org_channels`) can be ticked.
- "Post now" runs `publishNewPostAction` (`apps/arts-collective/src/lib/channel/actions.ts`). It saves the post with each outlet's text (Instagram's with the link swapped for "link in bio"), then calls the Studio's own `publishSocialPost` for each ticked account: Instagram, then Facebook, then Threads.
- The connection, org-channel, JPEG and character checks and the `publish_jobs` row all come from the Studio. The first success also puts the post on the site (the Studio's mirror: the person's page, or the org's feed), so Website is not a separate switch.
- A failure on one account does not stop the others. Results are shown per account, with links to what went out.
- One change in the shared Studio code (`apps/arts-collective/src/lib/post-actions.ts`): an Instagram caption that already says "link in bio" no longer gets the URL appended.
- Verified in the harness (stubbed server): the review, the account checkboxes and the results render. Not verified: a real post, since none has been made from Channel.
- Still plans only: scheduled deliveries (no worker sends them), the quick sheet, and the dry-run helper, which now only feeds the review step.

### Verified (2026-11-07)
- `pnpm --filter arts-collective check-types` exit 0. `@elkdonis/services` check-types has 17 errors, all in files Channel did not touch (nextcloud, social-feeds, utils sanitize); none are in `channel*.ts`. `@elkdonis/utils` exit 0.
- The real components were bundled with esbuild on a hand-written sample model (stubs for the server actions and next/*) and screenshotted in Chromium at 1280 px and 390 px. Screens: Home, matrix, Queue week and month, board, New post, piece pop-up, Plan tab, library, quick sheet, empty state, dark. No script errors and no horizontal overflow. Harness: `scratchpad/chharness/` (session-local, not in the repo).
- The SQL columns were checked against the live schema (`\d`) by a review agent. Every hand-written query in `load.ts` and `actions.ts` runs under `EXPLAIN` on `elkdonis_dev` without error (EXPLAIN does not read rows).
- Migration 252 applied cleanly inside `BEGIN … ROLLBACK`, with `EXPLAIN` of the service's insert, update and select. Afterwards `to_regclass('channel_plans')` is NULL, so nothing was left behind.
- Dev preview (`docker compose run … pnpm dev`, port 3117, removed afterwards; `next-env.d.ts` restored): `/channel`, `/channel/queue`, `/channel/new`, `/channel/piece/thread/<id>` and `/channel?view=matrix` compile, and each answers 307 to `/login?next=<path>` signed out, with no compile errors in the log.
- Deployed 2026-11-07 12:58 EST: arts-collective rebuilt (BUILD_ID `b72lzLPmdegI9O0LvPhN2`, was `vTuvRoTYPzT3LCP0kgUIu`) and katie-the-potter rebuilt (`HP10UhUN2hJ7X8c01Dpok`, was `n7xyew1PkFnlHlqTAac6J`). The builds shipped every session's uncommitted work in those trees, including the Easyship shipping work in katie-the-potter, `packages/commerce` and `packages/checkout`. Backups: `~/eac-backups/next/{arts-collective,katie-the-potter}-20261107-1255.tgz` (gzip-tested).
- Through the edge, signed out: `arts-collective.com/channel`, `/channel/queue`, `/channel/new` and `/channel?view=matrix` answer 307 to `/login?next=…` with the full path kept; `/` 200. `pottery.arts-collective.com/channel`, `/hub` and `/manage*` answer 307 to login; `/` 200. Katie's server build contains the hand-off `${NETWORK_URL}/channel?org=` and no `/studio/channel` link (grep of `.next/server`).
- Not verified: the loader against live data, any signed-in render, the hand-off followed signed in.

### Backend reality by screen (2026-11-07)
What each screen stands on today. **Real** = read from or written to its own
table. **Derived** = computed per request from real rows. **Not built** = shown
or implied by the design, nothing behind it yet.

| Screen | Real or derived | Not built |
|---|---|---|
| Nav | Counts of the pieces loaded (the latest 160 threads and 120 artworks, so "of the recent", not all-time totals); outlet connection state from `user_connections` and `org_channels`; Instagram "N of 25" is derived from our own `publish_jobs` (an estimate); People is a member count in org scope | Live time (needs a live delivery or the broadcast schedule) |
| Home list and face | Pieces, timelines and in-motion reasons (derived). The market listing date is `artwork.created_at`, since there is no listed-at column. Letters are `email_sends` kind `notification` (assumed). | Shares made outside the platform, and posts whose link is not the piece's page, are not seen |
| Suggestions, "Next" chips | Gaps derived from connections and history; Accept and Dismiss write real rows (`channel_deliveries` and plan steps) | Registry or MCP actions behind the chips; follow-up lineage (a video *about* a piece is only known when Channel planned it) |
| Matrix | Website, Instagram, Facebook and Letter cells are real | Video, Writing and Live cells come only from Channel's own deliveries: no link yet from reels, writing or broadcasts back to the piece they are about (`studio_items` / `studio_item_links` could carry it) |
| Queue week and month | Deliveries, to-dos, routines (real tables); slots computed from routines; event dates from `threads.scheduled_at` and `series_session` | Drag to reschedule; a worker that sends scheduled items |
| Piece board | Real chips plus placed suggestions; "Add N to the queue" writes | Lanes for the piece's own dates beyond one event |
| Piece pop-up | Timeline and coverage by identity (derived) | Identity is attributed by owner and connection, not by which Page a share actually went to (shares do not record the Page per identity) |
| Plan tab | plan.md stored with an event log; Accept appends steps; tick and edit with conflict checks | Agents editing it (needs registry entries) |
| Library | Bricks from the loaded pieces, grouped by site | Network-wide content search; People, Sites and Forum tabs are links out |
| Quick sheet | Saves or schedules a real `channel_deliveries` row; the Instagram link swap is applied | The quote-card picture (layout preview only); sending |
| New post | Saves a real Studio post (`social_posts`); the dry run applies the outlet rules | Sending from Channel; per-outlet images; the site post itself |

Separate passes, roughly in dependency order:
1. Signed-in check of all of the above on real data, then a rebuild.
2. Registry entries for Channel, so the dock and an assistant can run them.
3. Follow-up lineage (piece ↔ reel, writing, broadcast).
4. A send worker for scheduled deliveries: site first, Meta container then publish, behind `CHANNEL_PUBLISH`.
5. Quote-card rendering (sharp, as the Studio picture route does).
6. Network content search for the library.

### Registry, next row and dock (2026-11-07, deployed 16:00 EST with the Outlets page and New post's chooser)
- Registry entries in the new scope `channel` (`packages/actions/src/channel.ts`, runners in `packages/actions/src/server/channel.ts`):
  - `channel-next` (status only), `channel-suggestion-accept`, `channel-suggestion-dismiss` (app door only), `channel-slot-fill`, `channel-plan-step`.
  - They write plans only. Actor kind 'user' from the app, 'agent' otherwise. `action_events.actor_type` is now written ('human', 'ai', 'system').
  - `check:registry`: 29 entries, 15 runners, consistent (agent report, exit 0).
  - The authorization helpers are copied from `actions.ts`, so both copies must change together until actions.ts uses the shared module.
  - Details and "Where the board is missing" (12 gaps): `docs/open/CHANNEL_REGISTRY_AND_BOARD_2026-11-07.md`.
- Home's next row (`components/channel/NextRow.tsx`, `lib/channel/next.ts`) sits above the routines strip, in place of 1a's count bands. It shows due and placed moves first, then gaps (owner: "Gaps too"). Each card runs its entry through the app runner or opens the sheet or piece. Verified in the harness at 1280 and 390 px; type check exit 0.
- Dock (`packages/dock`, `server/dock.ts`): on `/channel/*` (not Home) and `/studio*` it shows the channel's top move on one line. A daily repeating step that is done today gives way to the next step. Cost: each of those dock reads runs the full Channel loader (options in that doc §4).

### Onboarders like Katie (2026-11-07, deployed 18:20 EST)
Owner answers: Katie gets her own public domain soon and is listed under it then; until then Channel uses an override. Site links go to her own /manage. Onboarding guidance comes as setup moves in the next row, plus Channel steps in an LMS course. Her /manage overview links to Channel.

What was built:
- **Address:** `OWN_APP_SITES` in `lib/channel/load.ts` gives `pottery.arts-collective.com` and her `/manage/site`, `/manage/people` and `/manage/pieces` (nav "Pieces and shop"). An org_domains primary domain wins over it; take her entry out when the domain is listed. `org_domains` has no row for her (checked 2026-11-07); `shop:store` is pinned, so her pieces link to `pottery…/pieces/<slug>`.
- **Setup moves** (`lib/channel/next.ts` `setupMoves`, kind `setup` in `packages/actions/src/channel.ts`): at most two lead the next row and the dock while open.
  - Connect Instagram or Facebook, if none is connected.
  - Make a Page or account the org's channel, if connected but there are no org_channels.
  - Add a first piece, or post the first listed piece.
  - Add a routine.

  Each drops out once the platform shows it done.
- **Registry status entries** for a course: `channel-connect` (person), `channel-org-channel` (org), `channel-first-post`. `check:registry`: 32 entries, consistent. No course names them yet.
- **katie-the-potter:**
  - `/manage` has a "Sharing" card with **Connect Instagram and Facebook** (`/channel?to=outlets`) and **Open Channel**.
  - `/channel?to=outlets` hands off to `<network>/channel/outlets?org=katie-the-potter&tab=instagram`.
  - Connecting happens in Outlets' Connect panel, whose "Channel for <org>" picker sets org_channels.
- **Publishing fixes:** a retry skips accounts that already have the post (checked against `social_posts.shares`); the Facebook line says its preview reads the piece's own page.
- Checked: type checks pass (arts-collective, katie-the-potter, actions, dock, sophia); the harness renders a Katie-like org channel.
- Deployed 2026-11-07 18:20 EST (arts-collective `p9hRsBJoEXhBAIpSmtXNB`, katie-the-potter `1tsUv04Pj07veMTdWJSuQ`). The deploy also carried the Docket rename (user-facing text only; plan.md's stored `<!-- board -->` tag is unchanged), the dock change, the website-copy rule and the retry guard.
- Verified through the edge, signed out: every route 307s to login with its path kept (Katie's `/channel?to=outlets` too); `/`, `/learn` and Katie's `/` 200; dock API 401; no errors in either log since the start. Katie's build contains the Sharing card and the Outlets hand-off (grep of `.next/server`).
- Not checked: signed in. Katie cannot sign up until `pottery.arts-collective.com` is added to the Turnstile widget (the owner is doing it).

### Owner direction, second check-in (2026-11-07)
- **The LMS** is not a staged course any more. It is an MCP-style assistant that knows the person's state, offers actions and takes them to the right place on the site. The Akhand Path reminder's ghost-blue suggestion in the dock is the right tone.
  - Built: `routinesOnly` in `packages/actions/src/server/dock.ts` (default false). Corrected by the owner the same evening: course steps are welcome in the dock (bottom right) elsewhere. On `/channel` the ribbon (the next row) carries the suggestions as chips, so `/api/actions/dock` sets `routinesOnly` only on `/channel` paths and still prefers getting-started everywhere else.
- **Setup:** only immediate actions ("Connect Instagram", "Post Tenmoku tea bowl"), as pale-blue suggestion chips like the original design. No course-style "Getting set up" cards.
  - Built: NextRow draws `setup` moves as chips above the cards, and they do not take a card's place.
- **Channel steps in an LMS course:** hold. The three status entries stay unused.
- **Website copy:** a post about a piece that already has its page goes only to the socials, linking to that page; other posts still get the site copy.
  - Built: `publishSocialPost(…, { mirror })` in `post-actions.ts` (default true, Studio unchanged); Channel passes `mirror: !pieceKey`.
- **"The board"** was fine; renamed **Docket** the same evening at the owner's choice (deployed 18:20 EST), then back to **Board** at the owner's choice later that night (dock: "On your board").
- **"The board"** (original note) It names what the dock, LMS and routines provide: reminders, suggestions, more structure, with plan, routines and queue as one composite set in motion. The owner suggests **"docket"** as the name. Not renamed yet.

### Owner direction, third check-in (2026-11-07 evening)
- **Dock:** course steps are welcome in the dock (bottom right) on other pages. On `/channel` the ribbon (the next row) carries suggestions as chips; there the dock is a small side widget.
- **Ladders:** two more variations of each, from a matrix of content-evolution types and share types, with a variation function and sliders to tune a follow-up plan. A design agent is drawing these into the ladder canvas.
- **Routines dock / planner:** a suggested step can be adjusted when it is presented: when, where, what time, how important, the initial idea.
- **Next build pass:** the routines planner.
- **Naming:** the nav uses plain names, "Routines" and "Queue". The composite went back to **Board** (owner, fourth check-in).

### Routines planner, first pass (2026-11-07 evening, deployed 20:05 EST)
- **`/channel/routines`** (`components/channel/Routines.tsx`, nav row "Routines" under Queue):
  - every routine with Change (name, outlet, weekdays or day of month, time) and Stop (archive, confirmed);
  - an add form;
  - this week's slots.

  "Edit routines" and "Channel settings" link here; the Queue no longer has its own routine form.
- **Services:** `updateChannelRoutine` (`packages/services/src/channel.ts`).
- **Actions** (`lib/channel/actions.ts`):
  - `updateRoutineAction` and `archiveRoutineAction`.
  - `acceptAdjustedAction`: accept a suggestion as adjusted when it was presented (time, outlet, importance 1 to 3, the person's idea), stored in the delivery's payload, and the idea added to the plan step.
  - `neverSuggestAction`.
- **Migration 255 `channel_rules`** (written, not applied; trial-applied in `BEGIN … ROLLBACK` cleanly): "never suggest <outlet> for <kind>" per owner. `listChannelRules` returns nothing until it is applied; the loader then skips matching gaps.
- **Not built yet:** the adjustment sheet itself (from the planner mock-ups) and the dock's small expander.
- Checked: arts-collective type check exit 0; the Routines page renders in the harness.

### Planner, second pass (2026-11-07 late, deployed 20:05 EST)
- **Migration 255 applied** (owner's go-ahead), so `channel_rules` exists.
- **Importance is a star** (owner's choice over three levels). `payload.important` on a delivery puts a ★ on its draft move and sorts starred moves first in the next row and the dock.
- **Adjust sheet** (`components/channel/AdjustSheet.tsx`, surface `channel:adjust`, from design D1):
  - the idea;
  - when, as week days plus times, with routine slots marked;
  - where, as outlets (disconnected ones shown, not choosable) and the name it goes out as;
  - the star;
  - **Skip for this piece** (dismiss) and **Never suggest this** for "<kind> pieces" or "any piece" (`channel_rules`);
  - **Save as draft** and **Place it**.

  It is reached from "Adjust" on the Plan tab's suggestions, on Home's suggestion cards, and on the Queue's slots and suggestion lines.
- **Ladder canvas** gained 17 boards (version 4, https://claude.ai/artifact/FwQkqK5Y8LcC8m8BeWo8Kr), copied to `docs/open/channel-handoff/ladders/`:
  - the matrix of evolution types × share types, with a 9-step variation function;
  - an interactive ladder tuner (template, intensity, cadence, effort, reach, go-live, snap to slots);
  - two variations of each ladder;
  - the Docket planner (D1), the dock adjustment (D2) and the phone adjustment (D3).
- **Not built:** the dock's small expander (D2: when, star, snooze) and ladder templates in code.
- Checked: arts-collective type check exit 0; the adjust sheet renders in the harness.
- Deployed 2026-11-07 20:05 EST (arts-collective `dVMGEAy-tW_p-X0tD5IO1`, with the cap raised for the build), with the rename back to Board. Through the edge, signed out: every `/channel` route including `/routines` 307s to login; `/` and `/learn` 200; dock API 401; no errors in the log since the start. Backup: `~/eac-backups/next/arts-collective-20261107-2000.tgz`.
- Handover for the next session: `docs/sessions/2026-11-07_channel.md`. Render harness moved to `scripts/channel-harness/`.

### One object: the follow-up ladder (proposal, 2026-11-07, review agent)
Not adopted; for the owner. A piece moves up a short ordered ladder of next steps (post → walk-through clip with overlays → letter mention → live). Each step is suggested, placed (has a day), done or skipped. The board, the Queue, plan.md and the dock become four views of that one ladder:
- Piece pop-up: the ladder, top to bottom (it replaces the 2b grid and the Plan tab).
- Queue: the steps of every piece, placed on days.
- Home: each piece's single next step.
- Dock: the same next step, on any page.

Renames proposed: "From the board" → "Next steps"; "Accept" → "Add to my steps"; a placed step reads "Friday 10:00". One caveat is to settle first: step state lives in two stores today, `channel_deliveries` and plan.md checkboxes. Choose one (deliveries) and render plan.md from it, or the dock and Home will disagree.

### Research (2026-11-07)
- `docs/open/channel-research/FOLLOW_UPS_RESEARCH_2026-11-07.md` (web research, sourced). Findings:
  - **Instagram cap:** Meta's current documentation gives 100 and 50 posts per 24 h in different places; the old figure is 25. The UI's "N of 25" is therefore a conservative estimate, and the live value is `GET /<IG_ID>/content_publishing_limit` (`remainingInstagramQuota`).
  - **No surveyed tool derives follow-ups per content kind or detects gaps.** The closest models are Buffer's floating slots versus pinned posts, Kit's offset sequences, and reminder-mode statuses.
  - **"Best time" claims conflict by hours, with no peer-reviewed basis.** Keep the owner's routine slots and do not present a time as a finding.
- `docs/open/channel-research/FOLLOW_UPS_IDEAS_2026-11-07.md` (first principles): 120 actions (10 per kind, 12 kinds) and six ladders (light path, artwork to live, writing to conversation, event, workshop or service launch, practice routine). Ideas:
  - Chips end themselves when a share that links to the piece appears.
  - Dismissal is permanent per piece and step.
  - Lapse reminders use the person's own median posting gap.
  - Ladders are optional plans authored once as routine courses.
  - The dock shows only accepted work.

### Ladder mock-ups (2026-11-07)
Claude Design canvas "Channel follow-up ladders": https://claude.ai/artifact/FwQkqK5Y8LcC8m8BeWo8Kr (private to the owner). Source: `docs/open/channel-handoff/ladders/`. Six ladders and one phone view:
1. Light path: a print; branches at +7 days.
2. Artwork to live: a painting; branches at +8 days to go live, offer a print or lesson, or stay light.
3. Writing to conversation: an essay; branches on forum replies.
4. Event: a series session, counted back from its date.
5. Workshop or service: pottery; branches on seats.
6. Practice routine: an Akhand Path day.
7. Phone: the dock on a shop page, then that piece's ladder.

Each desktop board shows the ladder (steps, offsets, states, tools, branch point), the dock card on the page the person is already on, and Home's next row. The design agent suggests these next: a Queue view of the ladder, a dark theme, a rule for long piece names in the dock, where the routines strip goes, and clearer "waiting" versus "suggested" marks.

### The dock, the LMS assistant and routines (owner direction, 2026-11-07)
Noted only; nothing built.
- The dock (`packages/dock`, mounted in `apps/arts-collective/src/app/layout.tsx:55`) already shows on `/channel`. It shows the first open step of the person's course.
- Owner direction: the LMS is, in part, an MCP for an assistant, and routines should run through it. Channel's suggestions act like notifications, and the assistant and the dock are where they surface. Where that MCP and the assistant live (which app or process, which identity they act as) is not demarcated yet.
- The chain to keep in view: LMS (onboarding and admin courses) → action registry (`packages/actions`, runners, `action_events`) → MCP (`LMS_ACTION_LAYER_BRIEF_2026-11-06.md` §7.2) → the Center factory / one-app work (`centerRoutes`, `ORG_SITE_KIT_BRIEF_2026-11-06.md`) → assistant routines → notifications (suggestions in the dock, email, push).
- Owner decision (2026-11-07): the dock and Home's "next" row show unprompted gaps ("Field Notes isn't on Facebook") as well as accepted steps. Due accepted steps come first, one line at a time; a dismissed gap does not return.
- Routines as LMS courses: plan in `docs/open/CHANNEL_ROUTINES_AS_COURSES_PLAN_2026-11-07.md` (2026-11-07). It proposes routine courses whose slots Channel still generates, and ladder courses with the piece as a stored subject run (one new LMS table), with ten open questions for the owner. Question 2 (gaps in the dock) was answered as above.
- What this implies for Channel when it is taken up:
  - A Channel suggestion becomes a registry action that the dock and the assistant can show and run (`channel-slot-fill`, `channel-plan-step`; draft-only from any door except the app).
  - A routine's open slot becomes the dock's step for that day.
  - `channel_routines` keeps the weekly and monthly cadence until the LMS cadence model can hold it, then imports with `source='sophia'`.
  - Agent edits are already attributable: `channel_plan_events.actor_kind` and `actor_id`, and `channel_deliveries.actor_kind`.

## 2. Rules and constraints
- Resolve the acting user in every action from the session, and check the piece with `mayTouch` (`actions.ts`): the forms carry ids that a crafted request can change.
- Scope every channel row by `owner_kind` + `owner_id` and `org_id`. Personal rows use org `oad`, the same rule as Studio posts.
- Keep Channel's pop-ups as host `custom` surfaces. Do not add Channel vocabulary to `packages/cms-ui/src/surface`: the handoff and the surface rule both require it.
- ~~Do not send to Instagram or Facebook from Channel until a dry-run review and an explicit switch exist.~~ Superseded 2026-11-07: the owner said "Make it real". Sending happens only after the confirm step in New post, through the Studio's send path. `CHANNEL_PUBLISH` gates nothing; it only sets the dry run's `live` flag.
- `/channel` is a reserved slug (`packages/utils/src/reserved-slugs.ts`, 2026-11-07), so no org or user can take it.

## 3. Differences from the handoff
- **Package:** the handoff proposes `packages/cms-ui/src/channel/`. The UI is app-local (`apps/arts-collective/src/components/channel/`) because only arts-collective serves it. To move it into a package later, replace the app imports (`@/lib/session`, `@/lib/org-url`, link strings, the time zone) with a host object (`{ userId, links, siteUrlFor, marketUrl, artdirectUrl, timeZone }`). This follows the review agent's single-app recommendation; see the series-site and `centerRoutes` patterns.
- **Library:** "Whole network" scope and real People/Sites/Forum search are not there. The library searches only the pieces already loaded for this channel, and the tabs link to `/artists`, `/directory` and the forum. This host has no network content search.
- **Routines:** the handoff says routines come from the Sophia dock. The dock (`packages/dock`, `/api/actions/dock`) and LMS routines exist, but an LMS routine is a daily checklist course (`StepTask.repeat: 'daily'`), with no weekday or monthly cadence and no outlet. Channel therefore holds its own `channel_routines` with `source='channel'`, and keeps `source='sophia'` + `source_ref` for a later import. The strip says "Each one opens slots in the week" instead of "From your dock in Sophia".
- **Focus (2d)** is the Studio writing room. It is not built here: the owner said not to touch `/studio`.
- **Go live, drag to reschedule, Instagram presets, Site settings with Puck pages:** out of scope per the handoff. "Go live" and the nav's Live row link to `/studio/broadcast` and show only for network admins (`users.is_admin`), because the booth is admin-only. Tray cards have no drag grip.
- **New post labels:** "Publish to N places" reads "Check publishing to N places", and "Publish now ▾" is left out until sending exists.
- **Content rows in the nav** open the library filtered by kind, not the Studio.
- **Quick sheet "Change"** is a piece dropdown inside the sheet, not the stacked library.

## 4. Open items
1. Migration 252 applied 2026-11-07 (owner's go-ahead). Still to do: exercise plan.md, accept and dismiss, to-dos and routines signed in.
2. ~~Rebuild arts-collective and katie-the-potter~~ done 2026-11-07 12:58 EST (owner's go-ahead).
3. Registry bridge, proposed by the review agent: entries `channel-slot-fill` (person/org scope; status from this period's slot; run writes a draft delivery and plan step; draft-only) and `channel-plan-step`, so the dock and MCP can advance Channel. Not started.
4. Owner decisions: where "Edit routines ↗" should go (Channel's form today, or a Sophia course editor); whether `channel_routines` stays Channel-owned; what "templates" means for routines, since no template concept exists outside reel layouts (`REEL_TEMPLATES`).
5. Palette: three area colours from the owner, which go into `.chn` in `channel.css`.
6. A send path for scheduled deliveries (worker plus Meta publish, site first), behind a switch.
7. The time zone is fixed (`CHANNEL_TIME_ZONE`, default America/Toronto) because users have no time-zone column.
8. Accept and dismiss now pre-check for an open delivery, but two concurrent requests can still both write: a partial unique index on (owner, piece, outlet, identity) for draft/scheduled/dismissed in a later migration would close it.

## 5. History
- 2026-11-07 16:00 EST: second deploy (arts-collective `eUiU07MUtgAPWBDzkPfpO`): Outlets, New post's chooser, Post as and real publishing, the next row, the registry entries and the dock change. The first attempt was killed by the 5 GiB cap and the site was restored from backup; the next build 500'd `/channel/outlets` (a client-module constant in a server page), fixed in `outlet-tabs.ts` and rebuilt. Through the edge, signed out: every `/channel` route 307s to login, `/` and `/learn` 200, `/api/actions/dock` 401; no errors in the log since the start. Backups: `~/eac-backups/next/arts-collective-20261107-1553.tgz` and `-1558.tgz`.
- 2026-11-07: migration 252 applied. Styles sharpened toward the handoff: the accent is split into a fill (`--eac-area-channel`) and a text ink (`--eac-area-channel-ink`); the ground is cool and neutral; component classes now win over the base resets, which are `:where()` at zero specificity (`.chn button { font: inherit }` had overridden every button's size); the harness loads Source Serif 4 as production does.
- 2026-11-07: review agent pass 2 applied: the authorization tightening above; copy that claimed sending or a registry link removed; ARIA (no listbox or tab roles without their keyboard models; aria-pressed buttons instead); the lightbox makes the bricks inert, closes on Escape and returns focus; a Markdown draft survives a background refresh; to-do double submit guarded; the board hides only what was dismissed; import cycles removed (`context.tsx`, `quick-spec.ts`). Still open from that pass: closing a deep-linked piece strips `?piece=` on a 150 ms timer, which can race a slow `history.back()` (harmless until reload).
- 2026-11-07: handoff received; brief, migration 252 (unapplied), services, loader, actions and UI written; review agent pass 1 applied (author slug, published stage, org Instagram channels, slot filling by routine, routine owner in placement, org threads in artist scope, org_id on updates, plan version check, reserved slug).
