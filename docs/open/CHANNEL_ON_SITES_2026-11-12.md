# Channel on the sites, Studio as the deep editor (plan, 2026-11-12)

Investigation and plan only: no code, migration, build or database write was made. This
document covers moving Channel's everyday surface onto each org site (`<site>/channel`, in the
site's look, mounting `@elkdonis/studio` parts) while `arts-collective.com/studio` stays the
catalogue and deep editor, with a defined hand-off in both directions. It follows the
developer's design-canvas comments of 2026-11-12. Labels: **V** verified (read in code on
2026-11-12), **A** assumed, **U** unknown. Written by a read-only research pass; every path was opened.

## 1. Developer direction (2026-11-12, design-canvas comments, abridged)

- Studio is "reference ui catalogue" for the services it provides (video blocks, forms,
  connectors). Channel "ingests studio ... for quick services, with its own ui, then directing
  back here for more robust controls". "/channel should live on the sites and be the way studio
  comes in for their forms in general ... for more meaningful deeper edits then they get
  redirected to arts-collective.com/studio."
- Queue "leans more towards the suggestive and per artwork"; Board is "a faster unified look as
  whats already confirmed in some way."
- "Plan it" belongs to the action registry / dock / board / queue, and should promote planning
  in general, not only a step of a plan type.
- Create's "Make into" is "content library + implied make into": bring the backend content
  library at hand, with the buttons on the right as Make into; also "a function of the queue".
- The daily routine card in Create is "another aspect of the dock or queue".

## 1a. Decisions and status (2026-11-12, later the same day)

Developer's answers: first site katie-the-potter; first quick form Artwork; Board = the coverage
matrix (confirmed state only); Out = a tab of the site's Channel. Coordinator's default: `back`
is limited to the acting org's verified `org_domains` rows and its network subdomain.

In source, type-checked (studio, channel, content, actions, utils, arts-collective,
katie-the-potter: 0 errors), not built or deployed, not committed:
- Phase 0: `packages/utils/src/studio-back.ts` (`checkStudioBack`, check script
  `packages/utils/scripts/check-studio-back.ts`, 22 cases pass), `listOrgHosts` in
  `packages/services/src/org-domains.ts`, Studio page reads `back`/`backLabel`, "Back to <label>"
  in the Studio bar, the writing publish notice and the forms' AfterPublish.
- Phase 4 (part): `channel-plan` ("Plan it") and `channel-next` `pieceKey` in `packages/actions`;
  proposals come from the loader's suggestions (`channelPlanProposalsSource`). No site door yet.
- Content pass 2 (part): `listContent` in `packages/content/src/server/list.ts` with access rules
  in `access.ts`; `loadContentDetail` not built.
- Phase 2: `packages/channel` (`@elkdonis/channel`: model, load, next, labels, quick-spec);
  arts-collective files are re-export shims.
- Phase 1: katie-the-potter `/channel` page (tabs; Home and Library from `listContent`; Queue,
  Board, Out hand off to the network Channel for now) and the Artwork quick form
  (`src/components/channel/ArtworkQuickForm.tsx`, `src/lib/channel-artwork-actions.ts`; quick
  tier draws Pictures, Title, Price; saves through commerce with the `/manage/pieces` gate).
- Lockfile changed by two container installs (content, channel, studio links).

~~Not verified: nothing rendered signed in; no real hand-off round trip; no save against the
database; katie runs in production mode and needs a rebuild to show any of it.~~
2026-11-12 18:20 EST: deployed. arts-collective rebuilt (`Nu6JntuhjM-AzxAJfrr3a`) and katie-the-potter
rebuilt (`xfwELMBMrpOXNUgRrTvAb`), both restarted; backups `~/eac-backups/next/*-20261112-1801.tgz`.
Verified: both builds exit 0; edge returns 200 on both home pages and 307 to /login for `/channel` and
`/studio` signed out; `scripts/tenant-smoke.sh` 9/9; the built chunks contain the What line
(`frm-bodyrow-line`), the Live entry, `channel-plan`, the Studio back link and katie's sheet
(`kch-sheet`). Not verified: no signed-in render (a throwaway guide account on katie-the-potter was
refused by the session's permission classifier), no hand-off round trip, no save against the database.
2026-11-12 18:35 EST, signed in (throwaway account, guide of katie-the-potter, headless Chrome through the
edge): katie `/channel` Home and Library list the store's piece ("Bud vase, black") with "Open in Studio";
the Queue tab hands off; the Artwork sheet opens but shows `guardStore`'s message, because a site guide
who is not on the store team (`store_member`) may not edit pieces (by design; the form itself not yet
seen). "Open Studio" hands the session to arts-collective `/studio?org=katie-the-potter&back=…` without
a login. Two faults found:
- Studio drew no back link: `listOrgHosts('katie-the-potter')` returns only
  `katie-the-potter.arts-collective.com`, because katie has no `org_domains` row and its real host is
  `pottery.arts-collective.com`. Fix is data (a verified `org_domains` row for that host), the
  developer's decision; the same row would also give Channel's own-app links (`5895fef7`) katie's host.
  2026-11-12 18:58 EST: row added on the developer's word (`pottery.arts-collective.com`, primary,
  verified; same shape as sunjay's `paratheater.arts-collective.com`). Verified signed in (second
  throwaway guide account, removed afterwards): Studio draws "← Katie the Potter", and following it
  lands on `pottery.arts-collective.com/channel` still signed in. No rebuild needed.
- Studio's focus-mode side menu: its link row (ten kinds) is wider than the 340px panel, so while the
  menu was closed the overflow showed at the window's left edge, and while open it ran across the page.
  Fixed in source 18:39 EST (`StudioShell.tsx` measures the head into `--st-side-head-h`; `studio.css`
  wraps the links and hides the closed head); checked by injecting the CSS on the live page; studio
  check-types 0. Deployed in the arts-collective rebuild of 18:45 EST (`ATFpZfso28sdWe9TdZdCu`,
  backup `~/eac-backups/next/arts-collective-20261112-1841.tgz`; tenant-smoke 9/9); verified signed in:
  closed head hidden at 1440 and 390px, open head 151px with the links wrapped and the list below it.
  That rebuild also shipped the IFAC session's finished Stripe setup-mode, bid widget and series-entry
  edits (that session confirmed them ready). Test account and its rows removed 18:47 EST. Known gap: the
artwork form's price section offers EUR/GBP, which katie's save refuses (CAD/USD only).

2026-11-12 19:20 EST, source only at the time (deployed 2026-11-14, below):
- Phase 3: `queueByPiece` and `confirmedCell` in `packages/channel/src/model.ts`. arts-collective
  `/channel/queue` opens "By piece" (one card per piece: its suggestions with Adjust, its accepted
  drafts, what is already out, Plan it = accept them all); Week and Month stay as `?view=week|month`.
  The coverage matrix (now labelled Board) shows confirmed cells only, with "N suggestions in the
  Queue"; the piece board drops suggestion chips and keeps Plan it and Dismiss in its footer.
  Checked: `@elkdonis/channel` and arts-collective check-types 0; Channel harness pages
  `queue-pieces` (1280, 390), `matrix`, `board`, `queue` render with no console errors.
- Currencies: katie's quick form, console form and both saves take CAD, USD, EUR and GBP (developer,
  2026-11-12: "dont limit just expand"); check-types 0. Correction: the quick form never offered
  EUR/GBP on katie (its price section reads the context's list); the gap was in the saves.
  Open: commerce does not stop one basket holding lines in two currencies (`addToCart`,
  `packages/commerce/src/server/index.ts` ~330); shipping quotes are in CAD.

2026-11-14 09:00 EST: both deployed. arts-collective `qV0CECrBA0ua1vhx_nzu3`, katie-the-potter
`GgfsIOd-Sl7G1sLKT2W4w` (backups `~/eac-backups/next/*-20261114-0859.tgz`; only this work had
changed since the 2026-11-12 builds). tenant-smoke 9/9. Verified signed in through the edge
(throwaway katie guide account, removed 09:10 EST) at 1440 and 390 px, no console errors:
`/channel/queue?org=katie-the-potter` opens By piece with one card (Bud vase, black: two
suggestions, Adjust on each, Plan it); `?view=matrix` (Board) shows the published website cell
only and "2 suggestions in the Queue". Not exercised: Plan it (it writes drafts), and katie's
EUR/GBP saves (no store seat for the test account).

2026-11-14, developer on the deployed Queue/Board: liked the original Week look of the Queue with routine
suggestions in their slots, and the piece popup's Plan tab ("From the board" suggestions). Working
model agreed in conversation: Queue and Board are two views of one list of items (piece, outlet, date,
state); Queue is laid out by time (routine suggestions start there), Board by coverage (gap suggestions
start there); the piece popup is both narrowed to one piece. Proposed and not done, on the developer's
word ("keep everything the same for now"): Week as the Queue default, dashed suggestions back on the
Board and the piece grid, "From the board" renamed. The By piece tab stays.

2026-11-14, developer's answers to section 5: (5) yes, a site's owners and guides run `channel` entries
for their own org on their own site, and the site's dock may do what arts-collective's does; (6) outlet
publishing is handed to arts-collective "for now, might change later"; (7) keep `/studio/channel`;
(8) not answered, coordinator's default: `@elkdonis/content` per person plus the acting org's pieces;
(9) the developer does not recall the Create screen, to be shown from the canvas.

2026-11-14, Phase 4 site door, source only (katie not rebuilt): `performSiteChannelAction`
(`packages/actions/src/server/site-channel-door.ts`) serves `channel-suggestion-accept`, `-dismiss`,
`channel-slot-fill`, `channel-plan-step` and `channel-plan` for the site's org only, settled by
`resolveChannelOrg` (owner or guide, never `oad`); `performAction` lets a site-bound `channel` call
through only with `siteChannel` set by that door and `orgId === siteOrgId` (`run.ts` ~433); the hub
door still refuses every channel entry. katie: `@elkdonis/actions` + `@elkdonis/channel` added
(container install; lockfile gained only those two links), `src/lib/channel-model.ts` (shared loader for
the site's org, `sitePlanProposals`), `src/lib/channel-door.ts` (`runChannelAction`, allow: accept,
slot-fill, plan-step, plan), Channel Home's Next row (`components/channel/NextMoves.tsx`; moves without
a site run open on the network host through the hand-off, Studio links carry `back`). Checked:
check-types 0 in `@elkdonis/actions`, katie-the-potter, arts-collective; refusal probe
`packages/actions/scripts/probe-site-channel-door.mts` 6/6 (no writes); `check:registry` consistent.
Not rendered; no move performed against the database.
2026-11-14 21:00 EST: katie rebuilt (`D5K3BnM813Vt0LRuT41MB`, backup `~/eac-backups/next/katie-the-potter-20261114-2056.tgz`;
the build also carried other sessions' source: the Studio forms `gathering` → `meeting` rename and the editor
team's direct-edit/page-builder edits of the morning; katie check-types 0 first). tenant-smoke 9/9. Verified
signed in through the edge (throwaway guide, removed 21:05 EST; no `channel_deliveries` rows written) at 1440 and
390 px, no console errors: Home shows "Next" with four moves (Connect Instagram, Post Bud vase, black, and two
follow-ups with "Add to the queue"); Channel links hand off to `arts-collective.com/channel/...?org=katie-the-potter`,
Studio links carry `back=https://pottery.arts-collective.com/channel` and "Katie the Potter". Katie's meeting
Studio link now uses `?kind=meeting`. Not exercised: "Add to the queue" (writes a draft). Seen: the Recent list
always prints "Not read: publish_jobs; plan" (`packages/content/src/server/list.ts:301`).
2026-11-14, source only (katie not rebuilt): katie's Artwork popup uses the approved Quick-Form look
(`quickFormTheme`, `@elkdonis/studio/forms/ledger.css`, IBM Plex Sans + Newsreader linked from the
component; the `--eac-form-*` site overrides removed), `ArtworkQuickForm.tsx`; check-types 0. Not rendered on
katie (production build); the forms session rendered the same theme in `scripts/forms-harness` (`q-artwork`).
2026-11-14 21:15 EST: katie rebuilt (`pCFtWiteLoHuOWEkzzSdL`, backup `~/eac-backups/next/katie-the-potter-20261114-2110.tgz`;
also carries the forms session's quick theme, Where tick boxes and card row, finished 21:05). Edge 200 on `/` and
`/pieces/bud-vase-black`, `/channel` 307 signed out; tenant-smoke 9/9; built CSS holds `ledger-quick` and the
client chunk the font link. Not seen signed in: the popup's fields need a store seat (guardStore).

2026-11-14 22:40 EST, katie's Queue, Board and Out drawn on the site (design canvas "Studio pipeline frame",
round 3, artboards D, D2, E; developer: "stick to intended design, make code catch up"). Deployed: katie
`7EaLEFIVnR5YQQUHfLVsU` (22:29), then `TQucAnKmArfeMh9WK0FaR` (22:38) with layout fixes; backups
`~/eac-backups/next/katie-the-potter-20261114-2228.tgz` and `-2236.tgz`; tenant-smoke 9/9; edge 200 on `/` and
`/pieces/bud-vase-black`, 307 on `/channel` signed out. The forms session confirmed studio-forms ready to ship first.
- `/channel?tab=queue` (D): one card per piece (`queueByPiece`), each suggestion with Accept, Plan it (an inline
  date and time, then accept at that time) and Dismiss; today's open routine slots as "Today · routine" cards
  (Fill the slot; Record in Studio for video/live slots); kind chips; Edit here (artwork) opens the quick form
  beside the Queue; Make into ▾; Open in Studio.
- `/channel?tab=board` (D2): the coverage matrix, confirmed only, columns Site, Shop (Collect Art listing),
  ArtDirect, Instagram, Facebook, Letter; cells "out · date", "sched. · date", "planned · date" (an accepted
  draft), "draft"; a pill links to the outlet's own page. `&piece=<key>` opens the piece summary sheet (C as a
  sheet): facts, Where it went, the Queue's suggestions for it, Edit here, Plan it (`channel-plan`), Make into,
  Open in Studio, View live.
- `/channel?tab=out` (E): what went out or failed in 30 days, by outlet (Connect for an unconnected Instagram
  or Facebook), Everything / Did not go; Retry hands the piece to the network Channel (publishing stays there,
  question 6). "Came back" (replies, comments) is not drawn: no source reads them yet.
- Header: the "Signed in as" line is gone (not in the canvas); New ▾ offers Artwork here plus Post, Gathering,
  Video, Writing in Studio. The site header's account menu and phone sheet gain "Channel" for editors. Library's
  "Not read: …" line is no longer printed.
- Site door: katie's allow list adds `channel-suggestion-dismiss` (within `SITE_CHANNEL_ACTIONS`).
- Make into links go to the network `/studio/make?from=&to=&org=&back=&backLabel=` (system32-fc, in source,
  arts-collective not yet rebuilt: until then that link 404s).
- Files: `src/app/channel/page.tsx`, `channel.css`, `src/components/channel/ChannelTabs.tsx` (server),
  `ChannelRuns.tsx` (client moves), `src/lib/channel-view.ts` (pure: Board columns and marks, Out rows, today's
  slots, Make into targets), `src/lib/channel-door.ts`, `src/components/site-header.tsx`.
- Checked: katie check-types 0; harness `scripts/channel-harness/katie` (sample model, door stubbed) at 1280 and
  390 px, no console errors, no horizontal overflow. Not checked signed in: minting a throwaway session was
  refused by the session's permission classifier this time; no move was run against the database.

2026-11-14 22:50 EST, arts-collective rebuilt `AJGNf6E3kBx0ZoB6Bbbd-` (was `58BEDqJQlpqriP3LRKEsR`; backup
`~/eac-backups/next/arts-collective-20261114-2243.tgz`; memory 9g for the build, back to 5g). It carries system32-fc's
canvas A (Studio Create, `/studio?kind=create`), the `/studio/make` route that katie's Make into links use, and canvas C
(the piece summary in front of a published piece's form; `@elkdonis/studio/summary`), log
`docs/sessions/2026-11-14_studio-create-summary.md`; also the Check session's services additions (workshop offerings,
site series create; cleared by that session). tenant-smoke 9/9; `/studio/make` 307s to login with its full URL; served
CSS 896,632 → 908,861 bytes, `.studio`, `.studio-pipe`, `.ps` present. Not rendered signed in (see the 22:40 entry).

2026-11-14 23:11 EST, katie's Artwork popup seen signed in (developer allowed a store seat): throwaway guide with a
`store_member` row on store `632bb16f…` opened `/channel?tab=library&sheet=artwork` (new) and `&id=<bud vase>` at
1440 and 390 px against build `TQucAnKmArfeMh9WK0FaR`: Quick-Form look (label column, filled fields, gold primary,
IBM Plex Sans), no console errors, no horizontal overflow, only the context and load actions posted; nothing typed or
saved. Account, seat and GoTrue user deleted. Seen: editing an existing piece is headed "New artwork"; the bud vase
is `reserved` in the DB but the form offers Unpublish / Save changes (the server refuses a reserved piece).
2026-11-14 23:20 EST, Katie's org given feeds (developer: "publish any kind she wants"): `org_feeds` rows
`studio` "Studio" (1, public), `services` "Services" (2, public), `general` "General" (999, private), following
sunjay/amrit_canada. Verified: `listPostTargets(Katie)` now returns the two public feeds, so a Studio Post's feed copy
lands on her org instead of her `oad` blog, and meetings/offerings have a section to pick. Already true before:
she is `owner` of katie-the-potter (katie `/hub`; arts-collective `/hub` lands on `/hub/organization`) and may
make writing, meeting, offering, artwork and video pieces for the org. Still not open to her: Go live / broadcast
(`isAdmin` only), social Post to Facebook/Instagram/Threads for the org (no `org_channels` row; set in Connections).
pottery.arts-collective.com draws no thread pages (only Puck pages from `site_config` `puck:<path>`), and `/about`,
linked from its header and footer, 404s: no `puck:about` page exists.
2026-11-15 00:15 EST, developer's answers: bio page = a design mock-up first; her posts on her site = "feed linking
out"; Go live = open to org owners. Source only, nothing rebuilt:
- katie: block `ktp-studio-feed` ("From the studio", `src/blocks/studio-feed.tsx`): the org's public, published
  threads through `loadThreadFeed`, each linking to `https://katie-the-potter.<NEXT_PUBLIC_NETWORK_HOST>/<slug>`
  (arts-collective serves it; `/` there answered 200); draws nothing when empty; sample rows in the editor only.
  Registered in `blocks/index.ts`, `lib/puck/config.server.ts` (the shared `thread-feed` resolver now links out the
  same way, since `/<feed>/<slug>` is not a route here), `config.client.ts`; added to `DEFAULT_HOME` after the grid
  (a saved `puck:home` would not have it; none exists).
- Go live for org owners (`apps/arts-collective/src/lib/go-live-access.ts` `goLiveRole`: admin, or `owner` of any
  org): the Studio passes the Go live card when `goLiveRole` is set; owners get no console link, no Feeds in, no
  chat (`relay-types.ts` makes `addFeed`/`removeFeed`/`feedToScene` optional; `RelayPanel` hides Feeds in without
  them; `LiveCard` `consoleHref` optional). `broadcast-actions.ts`: claim, peek, stream and stream settings accept
  owners; every other OBS call stays admin-only; `/api/broadcast/release` accepts owners. `relay-actions.ts`: owners
  see, save, tick, remove and arm only destinations they saved (`DestinationScope.owner` → `set_by`, in
  `packages/services/src/relay.ts`), their own history, no feeds in the view; Stop by an owner who does not hold the
  lease throws instead of cutting the outputs. Probe (read-only): Katie's scope lists 0 destinations and `armRelay`
  refuses ("Tick at least one destination"); the table holds 0 rows today, so the filter itself is unexercised. Open:
  an owner streams whatever scene OBS shows; the relay status still lists the live outputs' labels and hosts.
- Type checks: `@elkdonis/reels` 0; arts-collective and katie fail only on
  `packages/studio-forms/src/forms/fields/MaterialsRow.tsx:73` (the forms session's edit, 23:51), which blocks both
  rebuilds until it is fixed; `@elkdonis/services` alone reports 17 errors, none in `relay.ts`.
- Artist profile page, round 1 mock-up (design canvas https://claude.ai/artifact/2LSUSVRtqYVwq86QnJzdGk): Katie's
  `/about` in her site's look (cream ground, Newsreader + IBM Plex Sans, clay accent): portrait and name, "In her
  words", "In the studio" (three steps), Selected pieces (the bud vase plus labelled samples), From the studio,
  Find the work elsewhere, a commission band. Bracketed text is hers to write; nothing invented.
2026-11-15 00:14 EST (arts-collective ~00:12, katie 00:14:16), both rebuilt on the developer's word (forms and Check sessions confirmed their files at rest):
arts-collective `fPLaFov51Tsmd9O_v1Hpj` (was `0TQKeRGLmWtX1JQzBDO0a`, backup
`~/eac-backups/next/arts-collective-20261115-0009.tgz`), katie `-Ck_tbKuV_lb75YdaQL_0` (was `9hJWL0SkdNREEfa7aqQZv`,
backup `katie-the-potter-20261115-0009.tgz`; also carries the forms session's Queue week view in
`@elkdonis/channel/site`). Both type-check 0 before building; tenant-smoke 9/9 after each. Edge: arts-collective `/`
200, `/studio`, `/hub`, `/studio/broadcast` 307 signed out; katie `/`, `/pieces/bud-vase-black` 200, `/channel`, `/hub`
307, `/about` 404 (expected). The Go live refusal text and `ktp-studio-feed` are in the built server chunks. Not seen:
the feed draws nothing yet (0 public published threads in katie-the-potter); Go live not opened as an org owner.
Not in katie's build: a2's label fixes in `packages/channel/src/site` ("Meeting(s)" for "Gathering(s)", week headings "Sat 14 Nov"), saved 00:14:09, seven seconds before the build finished; the live chunks still read "Gatherings".
2026-11-15 00:52 EST, katie rebuilt on the developer's word: `azfKj3SKCbOlA06fhJgc5` (the build it replaced was
`tyabgiBEBc4Q4UYGdNscs`, so another session rebuilt katie after 00:14; backup
`~/eac-backups/next/katie-the-potter-20261115-0050.tgz`). check-types 0, no tree edits in the 10 minutes before;
tenant-smoke 9/9; `/`, `/pieces/bud-vase-black` 200, `/channel`, `/hub` 307 signed out. The Channel chunk now holds
"Meetings" and no "Gatherings" (a2's labels are in). Not seen signed in.
Correction (a2, 2026-11-15): `tyabgiBEBc4Q4UYGdNscs` was a2's 00:39 build (merged Board/Queue table, manage-piece
pop-up, the labels); 00:52 compiled the same source, so it changed nothing live. Katie builds: send the other session
a line before building.

2026-11-14 23:35 EST, Channel on a site is a shared package and runs on sunjay (developer: "install this on apps/sunjay
now"; system32-fc led the sunjay install, system32-a2 built the package and ran the builds).
- `@elkdonis/channel/site` (`packages/channel/src/site/`): `ChannelSitePage` (Home, Queue, Board + summary sheet, Out,
  Library; the site route keeps sign-in and the editor gate), `tabs.tsx` (server), `runs.tsx` (client: `ChannelDoor`
  context for the site's "use server" door, SuggestionRow, RunButton, NextMoves), `view.ts` (pure: `SITE_DOOR_ALLOW`,
  Board columns and marks, Out rows; also `./site/view`), `server.ts` (`siteChannelLoader({ orgId })`: `load`,
  `planProposals`), `site.css` (`.kch*` on the site's shadcn tokens; a site sets `--kch-font-display`,
  `--kch-font-body`, `--kch-link`, `--kch-ok-ink`, `--kch-dot`). "Edit here" is the site's own quick form through
  `editHere = { kinds, libraryTypes, newLabel, studioKind, render({ id, closeHref, studioHref }) }` (`?sheet=edit&id=`;
  katie's old `sheet=artwork` still accepted). The Board sheet is the shared PieceSummary, now
  `@elkdonis/content/summary` (moved by fc out of @elkdonis/studio so sites avoid studio's heavy deps).
  New package deps: auth-server, content, utils; peer next/react; container install run.
- A site mounts: `app/channel/page.tsx` (gate, then `<ChannelSitePage …/>`), `lib/channel-model.ts`, `lib/channel-door.ts`,
  a 5-line `channel.css` of vars, `@elkdonis/channel` + `@elkdonis/content` in package.json and transpilePackages.
- katie moved onto it (old files in `~/eac-backups/src/katie-channel-20261114-b`). sunjay: `/channel` with fc's
  `components/channel/meeting-sheet*` (meeting quick form through @elkdonis/site-forms) as Edit here; "Channel" beside
  Manage in the header; dark-ground vars in `app/channel/channel.css`.
- Deployed: katie `9hJWL0SkdNREEfa7aqQZv` (CSS 576,309 → 582,603), sunjay `a84xpHg3vQXGEzw-er-m-` (was
  `f-hcTx9IeILS7kz5iu2tu`; CSS 972,704 → 991,484), arts-collective `0TQKeRGLmWtX1JQzBDO0a` (fc's gate/summary fixes and
  the signed-out `/studio?…` login `next=` fix; CSS 909,143). Backups `~/eac-backups/next/*-20261114-23{27,29,30}.tgz`.
  tenant-smoke 9/9 after each; the served CSS holds `.kch-board`, `.ps-card`, `.kch-sg` (sites) and `.studio-pipe` (network).
  Cleared first by the forms session (studio-forms, site-forms) and Check (services workshop files).
- Incident: katie's first build failed on the Google font glitch and left `.next/lock`; the retries then failed on the
  lock and katie served 502 for about 3 minutes until the backup was restored. Lesson: remove `.next/lock` before a retry.
- Checked: harness renders of katie (identical to before) and sunjay (slate/bronze) at 1280 and 390, no console errors,
  no overflow (`scripts/channel-harness/katie`, `build-sunjay.mjs`). Not checked signed in on either site; no move run
  against the database.

2026-11-15 00:20 EST, the site Channel's Queue has its week view back (developer's request; built by the forms session in
`packages/channel/src/site`): a "By piece | Week" switch (By piece stays the default), `?view=week&week=YYYY-MM-DD`
(date-checked before the loader), ‹ › between weeks, each day's posts, slots (Fill the slot / Record in Studio),
meetings, suggestions (Accept / Plan it / ✕) and to-dos; `siteChannelLoader().load(viewer, { week })`. system32-fc's
review fixes (a2): day headings "Sat 14 Nov" drawn on the site side (the shared loader's `dayLabel` unchanged, so
arts-collective's Queue is as before), and "Meeting"/"Meetings" for Gathering(s) in the week items, New ▾ and the Library
filter (developer, 2026-11-14). Deployed: sunjay `WPi8QArtDmoJYFK7Kcmk2` (backup `sunjay-20261115-0015.tgz`; CSS
991,484 → 993,674; tenant-smoke 9/9). katie `-Ck_tbKuV_lb75YdaQL_0` (built by the shell session) carries the week view but
finished seven seconds before the label fixes: katie still reads "Gatherings" until its next rebuild (asked of the developer).

2026-11-15 00:45 EST, Board and Queue are one table, and a piece opens in a manage-piece pop-up (developer, 2026-11-15:
"a toggle of board and queue and queue options to show by week or piece ... the table more or less staying the same till
by piece then its slightly more routine possible and for the single piece adding step"; Edit / Make into / Open in
Studio "reserved for the piece manage"; no Board → Queue → Board loop; the pop-up from the bottom on a phone; manage
fused with quick edit: inline, then form, then full form). system32-a2 built the table, system32-fc the pop-up.
- `packages/channel/src/site/grid-data.ts` (pure) + `grid.tsx` (client): Board = pieces × outlets (what is there, else the
  Queue's suggestion dashed); Queue · By week = pieces × the week's days + "Not placed", routine rows above (chips pick
  them; "Set up routines ↗" hands off); Queue · By piece (`?view=piece&focus=<key>`) = one piece's outlet types × days,
  a Routines panel ("Put it here" = slot-fill) and Steps (`PieceSteps`: tick, add a step, Plan it). Every square opens a
  `<dialog>` (a bottom sheet under 40rem): the square's items (View / Change or Retry on arts-collective / Edit / Accept
  / ✕) and "Plan a post" (when, what goes out); an open routine slot opens "Fill the slot" with a piece select. Week
  pills are compact ("IG · sugg.", full words in title/aria-label) so seven days fit at 1280.
- New registry entry `channel-delivery-save` ("Plan a post"; packages/actions): the piece's open draft on that outlet
  gets the text and time, else a new draft delivery and a plan step; a scheduled post is refused (schedule and send stay
  on arts-collective), a dismissed gap is reopened as the draft. In catalogue, agent (draft), present,
  SITE_CHANNEL_ACTIONS, SITE_DOOR_ALLOW; check:registry consistent (49 entries).
- The pop-up: `@elkdonis/content/summary` PieceSummary `layout="popup"` (fc): a panel from the right, a bottom sheet
  under 640px; `nextRows` = the piece's suggestions with `SuggestionActs` (Accept / Plan it / ✕), Planned and Out lists,
  Coverage marks, Make into, Open in Studio; Edit → `?edit=1` shows the site's quick form in place (katie artwork,
  sunjay meeting; its "More options in Studio" is the full form); other kinds edit in Studio. Rows carry no Edit / Make
  into / Studio buttons any more. Tab order Home, Board, Queue, Out, Library.
- Deployed: katie `tyabgiBEBc4Q4UYGdNscs` (also the "Meeting" labels; CSS 584,793 → 592,633), sunjay
  `Q9tHspMJ2e38iXyuS1uLf` (CSS 993,674 → 1,001,514); backups `*-20261115-00{39,40}.tgz`; tenant-smoke 9/9; served CSS
  holds `.kch-grid`, `.kch-dialog`, `data-layout=popup`. arts-collective not rebuilt (fc: its summary changes are cosmetic
  and ride the next build). Checked in the harness (katie and sunjay looks, 1280 and 390, no errors, no overflow); not
  signed in; no move run against the database.
- Open: inline field editing inside the pop-up (needs per-field saves; for now Edit opens the quick form in place); the
  routine and step builders are another session's; arts-collective's own Channel does not use `channel-delivery-save` yet.

2026-11-15 01:45 EST, five fixes from the developer's look at the live sunjay Channel (relayed by system32-fc), plus fc's
review. Deployed: katie `T9k2OOI5K0Vr43OdSON0t` (CSS 592,633 → 601,062), sunjay `9mfAEGblKDnS-dY2Syqd5` (CSS 1,001,514 →
1,009,943); backups `*-20261115-014{1,2}.tgz`; tenant-smoke 9/9. (Between these, the shell session rebuilt katie at 00:52,
`azfKj3SKCbOlA06fhJgc5`, from the same source; katie builds are now announced between us first.)
- The "toasts at the top left": the square's `<dialog>` lost its centring to Tailwind's base (`*, ::backdrop { margin: 0 }`,
  which both sites load) and its leftover lines read as notices. The dialog is now placed explicitly (centred; a bottom
  sheet under 40rem); the harness loads the same reset. No registry refusal was involved (every cell move is a
  channel-scope entry, none appOnly).
- Squares answer with a form at once: Site, Shop, ArtDirect → the pop-up on the site's quick form (`?edit=1`, or Studio);
  Video, Live → Make into video, Writing → Make into writing (`/studio/make`); Instagram, Facebook, Letter → "Plan a post".
- Queue by week is now days down × content kinds across, a Routines column first (chips pick routines); a kind square's
  form picks the piece; a Routines square fills a slot (slot and piece picked). One compact toolbar row (By week | By
  piece, the week, the kind chips); Board lost its intro sentence too.
- Library (and Home's Recent): cover cards (two across on a phone; a short type-tinted band when there is no cover); a card
  opens the manage-piece pop-up (`?tab=library&piece=`), else Studio.
- "View live": `ChannelDeps.threadPath` (packages/channel/src/load.ts; default "/<slug>", arts-collective unchanged); sunjay
  passes its own `threadHref` (lib/gather.ts: /<feed>/<slug>; /writing/community-2 → 200); katie's threads go to the network
  shell `katie-the-potter.arts-collective.com/<slug>`. sunjay's /gatherings/<slug> 404s signed out only for members-only
  meetings (mayRead), by design.
- arts-collective held: system32-fc's PieceSummary plan prop and Create edits were in progress in content/summary and
  studio/create; it rebuilds at fc's build-safe point (widened Make into targets need it).
- Design notes on the next round: docs/open/channel-convergence-2026-11-15/ (A–D, README, a2-notes.md).

2026-11-15 02:00 EST, convergence Phase 1 (docs/open/channel-convergence-2026-11-15/README.md) live, with system32-fc's carry-over.
Deployed: katie `VWuFHWw6fu-lAcrXbvj_s`, sunjay `1vqSRDr7B8dHYSQuATG9H`, arts-collective `i78laBRTN-xHnYK3JcZwm` (replaced
`fPLaFov51Tsmd9O_v1Hpj`, another session's; memory 9g → 5g); backups `*-20261115-015{4,5,6}.tgz`; tenant-smoke 9/9. Held
until the booking session's new `@elkdonis/booking` was at rest (via Check); none of the three needed it in transpilePackages.
- The site page's parameter is `view` (home|board|queue|out|library); `tab=` stays an alias; the Queue's option is `by=week|piece`
  (old `view=piece` kept); `tab=plan|overview` with `piece` opens the pop-up on any view (Studio's "Plan it" lands there).
- Pop-up: a Plan box first (fc's PieceSummary `plan`: plan.md's goal and steps, a door-backed tick per step, add a step with
  an optional date, Start the plan / Propose steps via `channel-plan`); "Next for this piece" from
  `channelNextMoves(model, { pieceKey, limit: 4 })` (the Dock's list; suggestions keep Accept / Plan it / ✕); Make into from
  `makeIntoFor` (Offering, Word art, Next meeting…, which arts-collective's /studio/make now accepts, with the carry-over).
- For the hub's Channel card: `packages/channel/src/site/summary-view.ts` (`buildPieceSummaryView`) and the `./site/board` export
  (BOARD_COLUMNS, boardGrid/weekGrid/pieceGrid/routineRows, ChannelGrid, ChannelDoor, buildPieceSummaryView).

2026-11-15 02:55 EST, one Channel page (developer: "yes"; convergence C, prior work in E-prior-work.md): Home is now the
page. Live on katie `vNuCis-uxECO5ma4BMrnR` (backup `katie-the-potter-20261115-0253`; CSS 602,118 → 631,771, the content
library's rows); sunjay held for system32-fc's Channel hub card (its agent was editing sunjay's hub files).
- `packages/channel/src/site/home.tsx` (ChannelHome): one kind-chip row filtering everything (one count, one list, one chip
  behaviour); "Next" strip (the next row, compact cards: eyebrow, 2-line title opening the piece, 1-line reason, only the
  action button; "Did not go · n" → #kch-out; the week's day chips with counts from the same weekGrid); Pieces (Covers with
  coverage dots, or List = @elkdonis/content/ui PieceRow via `pieceToListItem`, the site's tokens mapped onto --ec-*);
  Board (Outlets or Week; `density="compact"`); Out (what did not go + the last five, "All of Out ›"). `?pieces=list`,
  `?board=week`. Board, Queue, Out and Library stay as views.
- `ChannelGrid density="compact"` (title-only piece column ~150px, sticky; a state dot and the day): shared with the hub card
  (`./site/board` exports it). Every grid's first column is sticky. The square dialog no longer bubbles its close.
- Fixed on the way: CSS grid min-content widening the page (min-width: 0), stray list markers on PieceRow.

2026-11-15 02:58 EST, sunjay `_xFjHbX7mFtAlgx0q2bBL` (backup `sunjay-20261115-0256`; CSS 1,012,538 -> 1,045,628): the one-page
Channel Home and system32-fc's Channel hub card (packages/channel/src/hub; apps/sunjay lib/hub-channel.ts; GET
/api/hub/channel gated by getApiEditor, the org fixed to the site's, no-store; compact density from ChannelGrid). Booking
held at a safe point for the build (via Check). Signed out: /api/hub/channel 403, /hub and /channel 307 to login. The
editor and non-editor hub renders need a signed-in look (the developer's click-through).

## 2. Current state

### 2.1 Channel today (V)

| Place | What it is | Source |
|---|---|---|
| arts-collective `/channel`, `/channel/queue`, `/channel/piece/<thread\|artwork>/<id>`, `/channel/new`, `/channel/outlets`, `/channel/routines` | The live Channel: Home (next row, list, matrix `?view=matrix`), Queue (week/month), piece board, New post, Outlets, Routines. Every page takes `?org=<org id>`, loads one `ChannelModel` per request. | `apps/arts-collective/src/app/channel/page.tsx:12`, `queue/page.tsx:12`, `piece/[kind]/[id]/page.tsx:15` |
| arts-collective `/studio/channel` | The first console (posts, artwork "Post this", accounts, activity). Kept deployed; `@elkdonis/studio/channel` is a shared package but its only host is this page. | `apps/arts-collective/src/app/studio/channel/page.tsx:34`, `packages/studio/src/channel/index.ts:4` |
| katie-the-potter `/channel` | Redirect only: signed out goes to `/login?next=/channel`, signed in goes to `handoffUrl(<network>/channel?org=<org>)`; `?to=outlets` goes to `/channel/outlets?tab=instagram`. | `apps/katie-the-potter/src/app/channel/page.tsx:16-27` |
| hidden-enneagram `/channel` | Same redirect without `?to=`. | `apps/hidden-enneagram/src/app/channel/page.tsx:17-23` |
| Other apps | No `/channel` route (find over `apps/*/src/app` returned only these three). | V |

**Shared vs app-local.** The loader and the model are app-local to arts-collective:
`loadChannelModel` (`apps/arts-collective/src/lib/channel/load.ts:182`, 909 lines) reads about
fifteen things through `@elkdonis/services` (`channel.ts`: deliveries, plans, routines, rules,
todos), `@elkdonis/commerce/queries` and `@elkdonis/db` directly. Its only `@/` imports are
`SessionUser` and `getOrgHomeUrl` (`load.ts:31-32`). `model.ts` (327 lines) is pure types;
`next.ts` (474 lines, the "next moves") is pure but imports two arts-collective components
(`quick-spec`, `labels`, `next.ts:3-4`). `lib/channel/actions.ts` (659 lines) imports
`publishSocialPost` and `listShareTargets` (`actions.ts:36-38`), so publishing to Meta stays
app-local. Shared today: `@elkdonis/services/channel` (tables and cadence, migration 252),
`@elkdonis/actions` (registry), `@elkdonis/dock`, `@elkdonis/content` (model, `ContentLibrary`,
`ContentDetail`, `PieceLightbox`), `@elkdonis/studio` (Board sheet, forms), `@elkdonis/studio/channel`
(old console). `@elkdonis/content/server` is a stub; "pass 2" (`loadContentDetail`, `listContent`)
is not built (`packages/content/src/server/index.ts:1-12`).

### 2.2 Queue vs Board as coded (V)

- **Queue** (`components/channel/Queue.tsx`): the week or five weeks as days, each day holding
  posts, routine slots, events, to-dos and unplaced suggestions (`DayItem`, `model.ts:174-179`),
  plus a "Not placed yet" tray of drafts, gaps and notes (`Queue.tsx:266-291`, `TrayItem`
  `model.ts:191-194`). Suggestions are derived on each request from hard-coded gap rules and
  placed in the next open routine slot or three days before a piece's date
  (`load.ts:632-690`; rules documented in `CHANNEL_ROUTINES_AS_COURSES_PLAN_2026-11-07.md` §1.1).
  So Queue is already the suggestive, time-ordered surface; its unit is a day, not a piece, and
  it mixes suggestions with confirmed items.
- **Board, Channel form**: the piece board is one piece against seven weeks, lanes
  dates/site/instagram/facebook/video/writing/live/newsletter, showing history, planned
  drafts and suggestions together (`PieceBoard.tsx:41-50`, `model.ts:42`). The matrix
  (`/channel?view=matrix`) is all pieces by seven outlet columns, state per cell
  (`model.ts:23-24`). Neither separates confirmed from suggested; `Cell.suggestion` sits beside `state`.
- **Board, Studio form**: the Board sheet is one piece, three weeks by lane, then "next" (up to
  four suggestions), "recent" (three past items) and links (`packages/studio/src/board.tsx:1-60`,
  `apps/arts-collective/src/lib/channel/studio-board.ts:61-119`). It is read-only; writes stay
  in Channel (`board.tsx:11`).
- **Mapping to the direction.** Queue = suggestive, per piece: close already, but Queue's
  unit is a day. Board = confirmed: the closest existing thing is the matrix plus the
  non-`suggested` timeline events.
  Changes to match: (a) give the model a confirmed-only projection (`ItemState` minus the
  `Suggestion` cells; `studio-board.ts` already filters `suggested` for "recent", line 105-109)
  and draw the Board from it; (b) group Queue by piece (a card per piece with its suggestions
  and "Plan it") with the day view kept as a secondary view; (c) leave the piece board's lanes
  but drop suggestion chips from it (they live in Queue). **U**: whether "Board" is the matrix,
  the piece board, or a new view (question 3).

### 2.3 Hand-off to arts-collective.com/studio (V)

- Site to network: `handoffUrl(to, next?)` returns `/api/auth/handoff?to=...`; the route mints a
  60-second token bound to the destination origin, and `/api/auth/handoff/accept` sets that
  site's cookies (`packages/auth-server/src/handoff.ts:23-50,145-149`). Destinations must pass
  `isAllowedHandoffOrigin`: localhost, `NEXT_PUBLIC_NETWORK_HOST` and its subdomains,
  `ADDITIONAL_REDIRECT_URLS` hosts, `SITE_URL` (`handoff.ts:111-143`). `next` is same-site path
  only (`safeNextPath`, `handoff.ts:152-155`). Design record: `docs/sessions/2026-09-25_network-sso.md`.
  `publicOrigin()` exists only in `apps/innergathering/src/lib/public-origin.ts:13` and as
  `publicOriginFrom` in `packages/checkout/src/server/thread-checkout.ts:63`; the handoff code
  derives the origin itself (`handoff.ts:100-105`).
- Today's two site `/channel` pages already use this to reach the network `/channel?org=`.
- Studio URL shape on arts-collective: `/studio?kind=<kind>&id=<id>&org=<org>&focus=1&preset=&next=`
  (`apps/arts-collective/src/app/studio/page.tsx:111,125`; the host's `studioHref` builds
  kind/id/org/preset/focus, `StudioApp.tsx:181-193`). The shared request type already has
  `next`, `about`, `delivery` (`packages/utils/src/host.ts:32-45`), but arts-collective's
  `studioHref` does not emit `next` (V: lines 181-193) and the page ignores `about`/`delivery`.
- **`?next=` is path-only and Channel-only.** `channelNext()` keeps a value only if it matches
  `^/channel(?:[/?#]|$)` and has no `//` or `\` (`studio/page.tsx:114-120`). It cannot return to
  another host. That is the safe default: no open redirect today. A return to a site needs a new,
  allow-listed parameter (section 3.3).
- Precedent for a site hosting its own Studio mount: hidden-enneagram `/publish`
  (`apps/hidden-enneagram/src/app/publish/page.tsx:1-30`), because `/studio` on katie, elktours,
  sunjay and hidden-enneagram is the Puck page editor (`packages/utils/src/host.ts:12-15`).
  So the deep editor must be reached at the network host, not at `<site>/studio`.

### 2.4 Quick forms on a site (V)

- Four form kinds: `post`, `gathering`, `artwork`, `service` (`forms/contract.ts:43`). `FormShell`
  already takes `tier: 'focus' | 'quick'` (`forms/shell/FormShell.tsx:80,158`); quick draws only
  sections marked `quick` and no "More" rows (`forms/shell/Sections.tsx:111-113`) with the lite
  editor (`FieldRenderer`, `LiteEditor.tsx`). No app mounts the quick tier yet: only
  `StudioApp.tsx` and `studio/page.tsx` import `@elkdonis/studio/forms` (grep, V).
- Host contract (`FormHost`, `contract.ts:~287-318`): `HostLinks` (`studioHref`, `channelHref`,
  `viewHref`, `loginHref`, `studioPaths`), `feeds`, `actions` per kind (`FormActions`:
  `context`, `load`, `save(orgId, answers, intent, id, {autosave})`, `presets`, `lastSettings`),
  `onSaved`/`onPublished`, `preview` (cards, theme vars) and `slots` (`body`, `blocks`, `media`).
  Theming: `data-form-theme` plus `--frm-*` tokens; themes exist for broadsheet, ledger, ledger-dark
  (`forms/theme/*.css`, `ledgerFormTheme`).
- Server side per app: `FormActions` are bound to `"use server"` functions, which are app-local.
  On arts-collective: `meeting-actions.ts` (thin over `@elkdonis/services` `meeting-content.ts`,
  which owns the permission rules, `meeting-actions.ts:11-16`), `artwork-form-actions.ts:133-183`,
  `service-form-actions.ts:113-143`, `series-form-actions.ts`, plus the post path. The business
  rules sit in services, so a site needs only thin wrappers, as hidden-enneagram's
  `lib/studio/writing-actions.ts` and `service-actions.ts` already do.
- A site must add: a `"use server"` file per kind it offers (context/load/save wrappers calling
  services with the site's `siteConfig.orgId`); a `FormHost` with `studioHref` pointing at the
  network (with `next`), `channelHref` to its own `/channel`, `feeds` from its org; the `media`
  slot (a picker over the site's `/api/upload` and `/api/media`); and a theme mapping to its
  tokens. Artwork additionally needs commerce context (stores, Stripe state); gathering needs
  `hostCandidates` and Talk-room flags (`MeetingContextView`). **A**: `gathering` and `post` are
  the cheapest kinds because their rules are fully in services; `artwork` and `service` depend on
  market/store state that differs per site (see `IFAC_STUDIO_STORES_AND_KIT_2026-11-12.md`).

### 2.5 Action registry and dock (V)

- Registry: `catalogue.ts` lists 32 entries in areas profile, directory, writing, cloud, market,
  payments, org, content, email, channel. Scopes: `person | org | thread | channel`
  (`types.ts:24`). Refusal codes: `auth | unknown | input | forbidden | failed | limit`
  (`types.ts:134`). `runAction` audits to `action_events` (`run.ts:~500-530`).
- Channel entries: `channel-connect`, `channel-org-channel`, `channel-first-post`, `channel-next`
  (status list of next moves), `channel-suggestion-accept`, `channel-suggestion-dismiss`,
  `channel-slot-fill`, `channel-plan-step` (add or tick a step in a piece's plan.md)
  (`catalogue.ts`, `run.ts:334-369`). The dock may perform only accept, slot-fill and plan-step
  (`CHANNEL_DOCK_ACTIONS`, `channel.ts:60`). Agent exposure: `channel-*` read or draft only
  (`agent.ts`).
- Post entries (`thread-edit`, `thread-publish`, `thread-pin`) and `org-publish` already exist.
- **A site-bound door refuses every `channel` scope entry**: `perform()` returns
  "This cannot be done from here." when `given.siteOrgId` is set and the entry's scope is
  `channel` (`packages/actions/src/server/run.ts:418-420`). ifac and sunjay use that door
  (`apps/ifac/src/app/hub/actions.ts`, `apps/sunjay/src/app/hub/actions.ts`). The comment calls
  Channel "central". A site-hosted Channel needs a different door (section 3.4).
- Dock: `@elkdonis/dock` is mounted only in arts-collective's layout
  (`apps/arts-collective/src/app/layout.tsx:5`); it reads `GET /api/actions/dock?path=` and
  shows the course step, post actions and, on Channel paths, the top next move
  (`packages/dock/src/dock.tsx:1-60`, `server/dock.ts:247-266`). No site mounts it.
- LMS: `task.repeat: 'daily'` (`packages/lms/src/types.ts:94`, `tasks.ts:24,59`); the daily
  routine is course `akhand-path-daily` with entries `paath-read`, `paath-record`, `paath-note`,
  `paath-publish`, status from `@elkdonis/services/paath-day` (read-only,
  `paath-day.ts:1-25`). Routines in Channel carry `source: 'channel' | 'sophia'`
  (`model.ts:RoutineView`); `channel_routines.source_ref` points at a course
  (`CHANNEL_ROUTINES_AS_COURSES_PLAN_2026-11-07.md` §1.1).

**Mapping of the requested elements to entries.**

| Element | Existing entries that can back it | Missing |
|---|---|---|
| "Next for this piece" | `channel-next` returns next moves for the whole channel, each with `pieceKey` and a `run` (`types.ts:ActionNextItem`, `channel.ts:ChannelNextMove`); filter by `pieceKey` in the caller. | A piece-scoped read: `channel-next` has no `subjectId` (entry scope is `channel`, not `thread`). Add an optional `pieceKey` filter to the source (`next-source.ts:19`, `next.ts` already caps two moves per piece). |
| "Plan it" (general) | `channel-plan-step` (append a step), `channel-slot-fill`, `channel-suggestion-accept` (puts a suggestion on the queue and plan). | A subject-agnostic "plan this" entry that creates the plan (`channel_plans`) for any piece and proposes first steps; today the plan exists only after a step is added (`planning` flag in `studio-board.ts:117`). |
| "Make into" | None. Design only: `docs/open/MAKE_INTO_CARRY_2026-11-11.md` (status: design, plain-field carry first). The Board sheet takes `makeInto` and `onMakeInto` props but nothing carries over (`board.tsx:45-47`). | `make-into` entry (scope `thread`/`artwork` subject, param target kind) returning a linked draft id and a Studio href; lineage via `studio_items`. |
| Daily routine card | `paath-*` entries and LMS `task.repeat`; `channel_routines` for post cadences. | A "today" read that merges the two (routine slots from `week.days` plus the LMS step) for one card; `channel-next` already carries `slot` moves (`next.ts` KIND_ORDER). |

### 2.6 Content library backends (V)

| Backend | What it lists | State |
|---|---|---|
| `@elkdonis/content` (`ContentLibrary`, `PieceLightbox`, `ContentListItem`) | Pieces (threads and artwork) with marks per outlet, status, cover, timeline. | UI shared; data filled client-side from Channel's `Piece` by `channelPieceToListItem` (`apps/arts-collective/src/lib/channel/content-list.ts:25-51`); server `listContent` not built. Channel's `LibrarySurface` uses it (`components/channel/Library.tsx:21-40`), scoped to the sites already loaded for the channel. |
| Studio's Library panel | The person's or org's pictures: endpoints `/api/my-files?path=Media/Images&kind=image` and `/api/media/library?org=:org` (`apps/arts-collective/src/app/studio/page.tsx:198-199`); `listOrgMediaLibrary`/`listUserMediaLibrary` in `packages/services/src/media-library.ts`. | Files, not pieces. |
| `studio_items` | Lineage: recording, file, reel, piece, linked source to target with a slot role (`packages/services/src/studio-items.ts:25-36,231,248`, migration 248). | Written from reels and recordings; `listStudioItems(ownerId, {stage})`, `getStudioTrail`. Per person, not per org. |
| Studio piece list | Writing pieces for one org (`listWriting`, `studio/page.tsx:136`). | Writing only. |

**Recommendation for Make into's source list:** `@elkdonis/content` `ContentLibrary`, filled
first by the same Piece-to-list mapping Channel uses. It is the only backend that lists pieces of
every kind with status and outlet state, which is what "content library" plus buttons for Make
into needs. `studio_items` supplies the lineage that Make into writes afterwards, and the media
library stays the picture picker. Implementing `listContent` server-side (content pass 2) is the
step that lets a site list its own pieces without the arts-collective loader.

## 3. Proposed architecture

### 3.1 Roles

- **Studio at `arts-collective.com/studio`**: the catalogue and deep editor. Owns the full forms
  (focus tier), the Canvas, Video, Recordings, the Board sheet, and the services' reference UI.
  Unchanged URL shape. Signed-in editors arrive carrying the session.
- **Channel on each site, `<site>/channel`**: the person's or org's everyday surface in the
  site's look. It mounts `@elkdonis/studio` parts at the quick tier (`FormShell tier="quick"`),
  `@elkdonis/content` library and detail, and the Board and Queue views fed by a shared loader.
  Anything the quick tier does not offer is a link to Studio ("More options", "Edit in Studio").
- **arts-collective `/channel`** stays as the network host's copy for the person's own channel
  and for orgs without their own site UI. Sites with `/channel` served locally stop redirecting.
- **Publishing to Meta/YouTube** stays on arts-collective: connectors, tokens and
  `publishSocialPost` are app-local there (`actions.ts:36-38`). A site's Channel hands publishing
  steps to the network host through the same hand-off.

### 3.2 What has to become shared

1. A package for Channel's server side (name open; `packages/channel`): `model.ts`, `load.ts`
   (with `SessionUser` and `getOrgHomeUrl` passed in), `next.ts` (with `quick-spec` and `labels`
   moved beside it). Sites and arts-collective import it. Verified blockers are only the four
   `@/` imports listed in 2.1.
2. A Channel door for sites: `channel`-scope entries are refused on a site-bound door
   (`run.ts:418-420`). Add a door that sets `orgId` from the site and allows `channel` entries
   for that org only, for owners and guides, as `actionOrgId` already settles. Requires a change
   in `packages/actions/src/server/run.ts` and a decision on question 5.
3. A thin Channel UI kit (rows, chips, state marks) taking the site's tokens. The arts-collective
   components (`ChannelFrame`, `Queue`, `PieceBoard`, ...) carry `chn-*` classes in
   `channel.css`; extracting them is larger than the first slice needs.

### 3.3 Hand-off contract

**Site to Studio** (deeper edit):
`https://arts-collective.com/api/auth/handoff?to=<studio url>` where the studio URL is
`/studio?kind=<studio kind>&id=<id>&org=<org id>&back=<encoded site url>&backLabel=<site name>`.
`handoffUrl` carries the session; kind and id come from the existing `studioHref` mapping
(`StudioApp.tsx:181-193`, `STUDIO_KIND_OF`). The site's `FormHost.studioHref` builds this.

**Studio to site** (return after Save or Publish): the Studio page accepts `back` in addition to
`next`. Validation, in this order: parse as an absolute URL, `https` (or `http` on localhost),
host passes an allow-list, path and query kept, length at most 512, no credentials. Allow-list:
reuse `isAllowedHandoffOrigin` from `packages/auth-server/src/handoff.ts:111`, or a narrower list
of the org's own domains (`organizations`/`org_domains`, read by `listOrgHomes`, `load.ts:5`).
**Open-redirect note:** `isAllowedHandoffOrigin` also admits `localhost` and `127.0.0.1` and every
`ADDITIONAL_REDIRECT_URLS` host; production should drop the localhost arm and, better, restrict
`back` to the acting org's own domains. Return goes through `handoffUrl(back)` so the site
receives the session. Until the validator exists the Studio must not read any `back` value
(today's `next` stays Channel-path-only, V).

**Link requests carry**: `kind`, `id`, `org`, `about` (`thread:<id>`/`artwork:<id>`), `delivery`.
`about` and `delivery` exist on `StudioLinkRequest` (`host.ts:41-43`) and are ignored by the
Studio page; wire them only if a flow needs them.

### 3.4 Surfaces on a site's /channel

- **Home**: the next row (from `channelNextMoves`) and a piece list from the content library.
- **Queue**: suggestive, per piece: a card per piece with its suggestions, "Plan it", and "Make
  into"; the day view as a second view. Drafts and unplaced items sit here.
- **Board**: confirmed items only, one unified look (matrix of pieces by outlet, plus the
  per-piece lanes), read-only chips linking to the outlet's own page.
- **New / Edit quick form**: the four form kinds at the quick tier in the site's theme; a
  "More options in Studio" link using 3.3.
- **Dock**: the same `@elkdonis/dock` mounted on site layouts that have `/channel`, reading the
  site door's `/api/actions/dock`; carries the daily routine and the next move. The routine card,
  Plan it and Make into are registry entries rendered by `presentAction`, not page-specific code.

## 4. Phased plan

Each phase is deployable alone. Rebuilds follow `docs/reference/ops.md`; none is done by this document.

**Phase 0: the return path (no UI).** In `apps/arts-collective/src/app/studio/page.tsx` add a
`back` parameter with the validator of 3.3; pass it as `initialNext`-style prop; after
Publish/Save the shell shows a "Back to <site>" link next to the existing Channel one
(`StudioShell.tsx:101-105`, `forms/shell/AfterPublish.tsx`). Add a unit-style check script for the
validator (there are no automated tests; use a small `tsx` script). No migration. Smallest slice
that makes "redirected to arts-collective.com/studio and back" real, and it is useful with the
two existing redirect pages.

**Phase 1: first site `/channel` page, one form.** Pick one site (hidden-enneagram or katie;
question 1). Replace the redirect with a page that shows a minimal list of the org's pieces
(`@elkdonis/content` `ContentLibrary`, data from a new `listContent` in
`packages/content/src/server/index.ts` or, as a shortcut, the existing services reads) and mounts
one quick form (`gathering` or `post`) with a `FormHost` and a `"use server"` wrapper file in
the app (`apps/<site>/src/lib/channel-form-actions.ts`), plus the "More options in Studio" link
from Phase 0. Reuses `packages/studio/src/forms/*` unchanged; adds a theme mapping.
Files: the site's `src/app/channel/page.tsx`, `src/lib/*-form-actions.ts`, one CSS file. No
migration. Verification: render signed in, save a draft, open Studio through the link, return.

**Phase 2: extract Channel's server side.** Create the shared package (3.2 item 1) with
`model.ts`, `load.ts`, `next.ts`; arts-collective re-exports from it so its pages are unchanged
(compare signed-in HTML before and after). No migration. Gate: `check-types` clean in every
workspace that imports `@elkdonis/services`-adjacent packages (one broken file fails every app).

**Phase 3: Queue per piece and Board confirmed-only.** In the shared package add the
confirmed-only projection and the per-piece Queue grouping (2.2 a-c); arts-collective renders both
first (it has the full UI), then the site page uses a reduced version. No migration.

**Phase 4: registry additions and the site door.** In `packages/actions`: `channel-next` gains
a `pieceKey` filter; new entries `channel-plan` ("Plan it", creates the plan and proposes steps;
reads and writes `channel_plans` through `@elkdonis/services/channel`) and `make-into` (after the
carry contract of `MAKE_INTO_CARRY_2026-11-11.md` is built; first version plain fields only);
a site door allowing `channel` scope for the site's org; extend `check:registry` and
`agent.ts` exposure (`channel-plan` as `draft`; `make-into` as `draft` since it writes a draft).
Likely a migration only if `make-into` records lineage beyond `studio_items` (assumed not:
`studio_items` kinds are `recording|file|reel|piece`, `studio-items.ts:25`, and a piece-to-piece link
may fit `role`); decide when built, using `/new-migration`.

**Phase 5: dock on sites and the daily routine card.** Mount `@elkdonis/dock` on the Phase 1
site (needs `/api/actions/dock` and a `run` server action there; see `apps/arts-collective/src/lib/actions/routes.ts`
and `dock-actions.ts`). Add the "today" read of 2.5. No migration.

**Phase 6: more sites and forms.** Roll to ifac, sunjay, amrit-canada, elktours, innergathering
(each rebuild deploys every session's uncommitted work in that app's tree; check `git status`
first, `.claude/rules/00-working-style.md`); add `artwork` and `service` forms after the store
decisions in `IFAC_STUDIO_STORES_AND_KIT_2026-11-12.md`.

## 5. Open questions for the developer

1. **First site.** hidden-enneagram (already mounts Studio at `/publish`, one editor) or
   katie-the-potter (`/channel` redirect plus a Channel card in `/hub`)? Or ifac/sunjay, which
   have the site-bound door?
2. **First form.** `gathering` (rules fully in services) or `post`, before `artwork`/`service`?
3. **What is "Board"?** The coverage matrix, the per-piece lanes, or a new unified view; and
   should Queue keep the day view as a secondary tab?
4. **Return target.** May `back` be restricted to the acting org's own domains (recommended),
   or is any network subdomain acceptable?
5. **Site door scope.** Should an org's owners and guides on their own site run `channel` entries
   for that org only (sketched in 3.2), and may a site's dock perform accept, slot-fill and
   plan-step as arts-collective's does?
6. **Publishing from a site.** Hand every outlet publish to arts-collective (sketched), or add
   Connections routes on the site (as `centerRoutes()` did for ifac, amrit-canada and sunjay)?
7. **Old console.** Retire `/studio/channel` and `@elkdonis/studio/channel` once a site `/channel`
   exists (the brief says nothing links to it after katie's rebuild), or keep it?
8. **Content library first.** Confirm `@elkdonis/content` as Make into's list (section 2.6), and
   whether the Make into list is per person, per org, or both (`studio_items` is per person).
9. **Create.** The canvas's "Create" screen with Make into and the daily routine card is not in
   code (**U**: no matching route found). Is Create a new Studio screen or the site Channel's Home?

## 6. Not verified

- No page was rendered; findings are from source. The design canvases were not opened.
- Whether `/api/auth/handoff` is enabled on every site, and the contents of production
  `ADDITIONAL_REDIRECT_URLS`: **U**.
- `FormShell tier="quick"` has no caller, so its present output is **U**.
- Runtime behaviour of `channel-next` with a `pieceKey` filter: not written, so **U**.
