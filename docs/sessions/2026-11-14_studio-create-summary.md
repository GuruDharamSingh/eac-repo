# Studio Create and piece summary (canvas A and C), 2026-11-14

Session `system32-fc`, working the Studio side of the design canvas "Studio pipeline frame"
(round 3; https://claude.ai/code/artifact/635014aa-3dc1-4d25-83b2-1fd45d4c73f2). The Channel side
(D Queue, D2 Board, E Out on katie-the-potter) is `system32-a2`'s, which leads and holds the
rebuild schedule; its running log is `docs/open/CHANNEL_ON_SITES_2026-11-12.md`. Nothing committed,
built or deployed by this session. No migration.

## Gap list (read-only survey, 22:00 EST)

| Artboard | In code before this session | Missing |
|---|---|---|
| A Create | nothing; `/studio` with no kind opens Writing | the whole screen |
| B Develop | Rail Essentials/More (`studio-forms/forms/shell/Rail.tsx`), What row line → Blocks (`fields/BlocksRow.tsx`), "All pieces / This piece" (`studio/frame.tsx` `StudioColumnHead`), On/As, Saved/Preview/Publish | family tab strip, Rail "Linked" group, provenance line, pipeline nav; all need a piece-to-piece lineage read that does not exist (deferred, agreed with a2) |
| C Summary | `BoardSheet` (`packages/studio/src/board.tsx`): Next for this piece, Make into, recent | the summary view itself, its action row and Add menu |

## A · Create (22:30 EST, source only)

Opened at `/studio?kind=create` (making it the default is the developer's call; a2 asks).

- `packages/studio/src/create/` (new): `CreateKind.tsx` (the extension: pipeline nav, Next from the
  queue, Material not yet used, New tiles, Bring in, Library with Make into chips, Products, Brand
  kit), `types.ts` (`StudioCreateData`, `CreateKindProps`), `index.ts` (`createExtension`,
  `PipelineNav`), `create.css` (Studio `--st-*` tokens, light and dark). Exports `./create` and
  `./create.css` added to `packages/studio/package.json`.
- Registered as a Studio extension like Video and Posts, so StudioShell is unchanged:
  `apps/arts-collective/src/components/studio/StudioApp.tsx` (optional `create` prop, first in the
  extension list) and `apps/arts-collective/src/app/studio/page.tsx` (CSS import, `create={{…}}`).
  No `kinds.ts` entry: `STUDIO_KINDS` only feeds "New ▾", and Create is not something to make.
- Loader `apps/arts-collective/src/lib/studio-create-actions.ts` (`loadStudioCreateAction(orgId)`,
  server action, session user only): Library from `listContent` (its own read rules); the column's
  card from `channelNextSource` (the dock's and `channel-next`'s list; the person's own work is
  preferred); material from `listStudioItems(stage "in")` minus items any `studio_item_links` row
  uses as a source; kit from `getThemeOverrides` (hex, colour functions or bare HSL triplets; font
  vars by name). Each part fails alone.
- Make into route `apps/arts-collective/src/app/studio/make/page.tsx` (contract from a2):
  `/studio/make?from=<thread|artwork:id>&to=<post|writing|meeting|artwork-form|video>&org=&back=&backLabel=`
  → session check → `/studio?kind=<to>&org=&from=<key>` with `back`/`backLabel` passed on for the
  Studio page's `checkStudioBack`. Nothing carries over yet (MAKE_INTO_CARRY M1 replaces it).
- Wiring: New Text → Social posts, Doc → Writing, Video → Video, Live → `/studio/broadcast` (admins
  only, as the page's existing `broadcastHref`); Bring in: Record on a phone → Recordings, From
  Nextcloud → `NEXT_PUBLIC_NEXTCLOUD_URL`; Products: Offering → `service-form`, Artwork →
  `artwork-form`; pipeline Develop → Writing, Channel → `/channel?org=`; Edit kit →
  `/hub/organization?org=` (owners and guides edit the site theme there); material rows → Recordings.
- Checks: `check-types` 0 in `@elkdonis/studio` and `arts-collective`. Not rendered (arts-collective
  runs a production build; rebuild is a2's to schedule).

Departures from the artboard, on purpose:
- The column card reads "Next · from your queue", not "Today": the move may be later in the week.
- The mark in the brand kit uses the Studio's ink, not the brand colour, so its letter stays readable
  whatever the colour.
- The artboard's explanatory footnotes (designer notes) are not drawn.

## C · Piece summary (22:45 EST, source only)

- `packages/studio/src/summary/` (new): `PieceSummary.tsx` (props only: cover with up to three
  pictures and a facts card, action row, "Where it went", "Next for this piece"; layout `page` or
  `sheet`; `actions` slot replaces the default row; `children`; sheet Close by `onClose` or
  `closeHref`), `types.ts` (`PieceSummaryView`, `PieceSummaryProps`), `gate.tsx`
  (`PieceSummaryGate`, `PieceSummaryHostContext`), `index.ts`, `summary.css` (every colour, face
  and radius a `--ps-*` property on `.ps`, falling back to `--st-*`; a site sets `--ps-*` on `.ps`
  in its own scope). Exports `./summary`, `./summary.css` in `packages/studio/package.json`.
- `packages/studio/src/make-into.ts` (new): `makeIntoFor(type)` and `makeIntoHref(base, from, to,
  org)`, shared by Create's Library and the summary's Make into ▾.
- Mount: `packages/studio/src/forms/focus.tsx` wraps `<FormShell>` in `<PieceSummaryGate>` (import
  plus the wrap; nothing else changed). The gate is off unless the host provides the context, so
  hidden-enneagram's `/publish` and every other host are unchanged. It decides once per opened
  item: opened published → summary; new, draft, or not on the person's Channel → the form. Edit
  shows the form; publishing from the form never swaps it back.
- Host: `StudioApp.tsx` (optional `summary` prop → `PieceSummaryHostContext.Provider` around the
  shell), `studio/page.tsx` (`summary.css`, `summary={{ load: loadStudioSummaryAction, makeBase }}`).
- Loader `apps/arts-collective/src/lib/studio-summary-action.ts` (server action, the Board sheet's
  scope: session user, piece on their own Channel, read-only): Channel's piece detail for cover,
  text, byline, links and "Where it went" (site, social, email, video, writing, live and market
  lanes; published, live, scheduled, failed; newest first, six); `channelNextMoves(model,
  { pieceKey })` for Next (a move with no link opens the piece's board); When for dated kinds. The
  gate adds the form's own value lines as facts for the sections rsvp ("Places"), hosts, details,
  edition and booking.
- Actions: Edit, Make into ▾ (`/studio/make`), Plan it (the piece's plan in Channel), View live,
  Open in <org>'s Channel ↗, and the status with its first publish date.
- Checks: `check-types` 0 in `@elkdonis/studio`, `arts-collective`, `katie-the-potter` and
  `hidden-enneagram`. Not rendered.

## Deployed (a2, 22:43 EST)

A and C are live on arts-collective build `AJGNf6E3kBx0ZoB6Bbbd-` (backup
`~/eac-backups/next/arts-collective-20261114-2243.tgz`), built by system32-a2. Checked by a2: tenant-smoke
9/9; `/studio/make` signed out redirects to login keeping its full URL; the served CSS holds `.studio-pipe`
and `.ps`, total CSS about 12 KB larger with nothing dropped. Not rendered signed in (no session-minting
path); the developer hand-tests: (1) `/studio?kind=create` for "Just me" and an org, (2) a Library Make into
chip → `/studio/make` → the target kind, (3) `/studio?kind=meeting&id=<published>` → summary → Edit → form,
(4) the same with a draft → the form.

22:46 EST, source only (ships with the next arts-collective build): signed out, `/studio?…` now sends
`login?next=` the whole Studio address (kind, id, org, focus, preset, next, back, backLabel) instead of bare
`/studio` (`apps/arts-collective/src/app/studio/page.tsx`); found by a2, it predates this work.
`check-types` 0.

## Sunjay install (23:10–23:55 EST)

The developer, 23:10: "Continue by working to install on apps/sunjay. You are boss now." system32-fc leads;
system32-a2 builds and owns the Channel code. Split (agreed with a2):

- a2: `@elkdonis/channel/site` (`packages/channel/src/site/`: page, tabs, runs, view, server, `site.css`;
  exports `./site`, `./site/view`, `./site.css`), extracted from katie's Channel; katie switched onto it (its
  old ChannelTabs, ChannelRuns, NextMoves, channel-view backed up to `~/eac-backups/src/katie-channel-20261114-b`);
  sunjay `/channel` (`src/app/channel/{page.tsx,channel.css}`, `src/lib/{channel-model,channel-door}.ts`,
  header link, deps `@elkdonis/channel` + `@elkdonis/content`). Its harness: `scripts/channel-harness/katie/
  {build-sunjay,shot-sunjay}.mjs`.
- fc: the shared summary moved out of `@elkdonis/studio` into **`@elkdonis/content/summary`** (+
  `summary.css`): `PieceSummary`, `makeIntoFor`, `makeIntoHref` and their types, React only, so sites mount it
  without the Studio's heavy package (three, konva, Filerobot, tiptap; sunjay's build ran out of memory on
  11-11). `@elkdonis/studio/summary` and `packages/studio/src/make-into.ts` re-export it; `@elkdonis/studio`
  now depends on `@elkdonis/content` (container install; the lockfile gained only that link). arts-collective
  imports `@elkdonis/content/summary.css`.
- fc: sunjay's Channel "Edit here" for meetings, mounted by a2's `editHere`:
  `apps/sunjay/src/components/channel/meeting-sheet.tsx` (async server component, reads `listOrgFeeds`),
  `meeting-sheet-form.tsx` (sunjay's own `sunjaySiteForms` binding, `SiteFormPage` kind `meeting`, quick tier;
  "More options in Studio ↗" to the page's Studio link), `meeting-sheet.css` (sunjay tokens; the Quick-Form
  sits on a light `#fdfcf9` panel because its button row is transparent and its ghost buttons are blue).

Fixes from a2's and the forms session's review (source):
- Sheet with no pictures: Close above the card (z-index), no empty cover band, card padded clear of it.
- Gate: a loading line while the item loads (no flash of the form), the form after 4 s if it never does;
  sold and reserved artwork open as their summary (`record` passed from focus.tsx); the left column shows
  "All pieces" beside the summary and "This piece" (the rail) after Edit.
- Harness `scripts/studio-harness/create-summary/` (new; README): Create, the summary and the sheet on samples,
  plus `entry-gate.tsx`, the gate in front of the real meeting form with stub actions (gate, gate-edit,
  gate-draft, gate-stuck). All pages render with no console errors and no sideways scroll at 390.

Checks: `check-types` 0 in content, studio, sunjay, katie-the-potter, arts-collective, hidden-enneagram.
Signed off for a2 to build katie, sunjay and arts-collective together.

Deployed by a2 (about 00:00 EST, 2026-11-15): katie-the-potter `9hJWL0SkdNREEfa7aqQZv` (CSS 576,309 → 582,603),
sunjay `a84xpHg3vQXGEzw-er-m-` (CSS 972,704 → 991,484), arts-collective `0TQKeRGLmWtX1JQzBDO0a` (CSS 909,143;
`/studio?kind=create` signed out → `login?next=/studio?kind=create`). tenant-smoke 9/9 after each; the served CSS
holds `.kch-board`, `.ps-card`, `.kch-sg` on both sites and `.studio-pipe`, `.ps-card` on arts-collective.
Incident: katie's first build hit the Google-font fetch glitch and left a stale `.next/lock`; retries failed on
the lock and katie was down about 3 minutes until a2 restored the backup, cleared the lock and rebuilt clean.
sunjay's dark "out" pill was already lifted through `--kch-ok-ink`. Not done: any signed-in check (the
developer's click-through).

## Queue week view on sunjay (2026-11-15, 00:15 EST)

The developer asked for the week view back in the site Channel's Queue; the forms session built it in
`packages/channel/src/site` ("By piece | Week", By piece the default; `?view=week&week=YYYY-MM-DD`, the date
checked before the loader). fc reviewed the sunjay harness at 1280 and 390 and signed off with two fixes,
both done by a2: day headings "Sat 14 Nov" (today/tomorrow kept; formatted on the site side, so
arts-collective's Queue is unchanged) and "Meeting"/"Meetings" instead of Gathering(s) in the week items,
New ▾ and the Library filter. Live: sunjay `WPi8QArtDmoJYFK7Kcmk2` (backup `sunjay-20261115-0015`; CSS 991,484
→ 993,674 with `.kch-week`; server chunks hold "Meeting ↗"; tenant-smoke 9/9). katie was rebuilt by the shell
session (`-Ck_tbKuV_lb75YdaQL_0`) 7 seconds before the label edits landed, so katie still says "Gatherings"
until its next build (that session asked the developer). Not checked signed in.

## Manage-piece pop-up (2026-11-15, source only)

The developer's direction for the site Channel (relayed by a2): the Queue and Board become one grid (a2), and
clicking a piece opens a "manage piece" pop-up, from the side on a desktop and the bottom on a phone, holding
Edit (inline quick form, then the form, then the full form), Make into and Open in Studio; no Queue ↔ Board
loop; the content library's pop-up so any piece can be viewed there.

fc extended `PieceSummary` (`packages/content/src/summary/`): `layout: "popup"` (fixed, 460px from the right at
640px and up; a bottom sheet with a grabber below, max-height 88vh; scrim and Close link to `closeHref`; Escape
closes; focus moves in; the page stops scrolling; no slide under reduced motion); the edit cascade (`editHref`,
`edit`, `editing`, `closeEditHref`: the host's quick form in place of the facts and lists, cover as a 96px
strip, "← Back to the piece"); `studioHref` (Open in Studio ↗); `nextRows` (host buttons for each "Next for
this piece" row); `outActions` (buttons on a "Where it went" row); "Where it went" split into Planned
(soonest first) and Out (newest first); `view.marks` drawn as a Coverage row with the content library's
`OutletMarks`, coloured in `summary.css`; `timeZone` (dates in a fixed en-GB locale, so server and browser
agree). Checks: `check-types` 0 in content, studio, arts-collective, katie, sunjay; harness pages popup,
popup-menu, popup-edit, popup-bare at 1280 and 390 on a dark site palette, no errors, no sideways scroll.
Harness shots now emulate reduced motion (a full-page capture replays the slide-in; a probe confirmed the live
panel is flush right at full opacity). The grid and its use of the pop-up are a2's.

a2's grid (`packages/channel/src/site/{grid-data.ts,grid.tsx,tabs.tsx,runs.tsx,page.tsx,site.css}`; new
registry entry `channel-delivery-save`, "Plan a post": drafts only through the same `target(…,'deliver')`
rights as the other channel entries, refuses a scheduled post, reopens a dismissed gap, adds a plan step;
`check:registry` 49 consistent). Reviewed by fc (shots board, board-cell desktop and phone, board-edit, queue
week, queue-piece) and signed off; a2 fixed the review items before building: compact cell pills so the whole
week plus "Not placed" fits at 1280, tab order Home, Board, Queue, Out, Library, `timeZone` passed to the
pop-up. Live 2026-11-15 00:40 EST: katie-the-potter `tyabgiBEBc4Q4UYGdNscs` (CSS 584,793 → 592,633; also
"Gatherings" → "Meeting"), sunjay `Q9tHspMJ2e38iXyuS1uLf` (CSS 993,674 → 1,001,514); both first try,
tenant-smoke 9/9, served CSS has `.kch-grid`, `.kch-dialog`, `data-layout=popup`; backups
`katie-the-potter-20261115-0039`, `sunjay-20261115-0040`. arts-collective not rebuilt (its Studio summary
picks up the cosmetic changes at its next build). Not checked signed in.

## Open items

- C: Add ▾ (a link, a reference, pictures or video, then "into this piece" or "a new piece from
  them"), Duplicate and Archive are left out: nothing in the Studio forms backs them yet. Artwork
  and Offering forms show the summary only where Channel covers them (`channelStoreOf`: meeting,
  post, artwork; Offering is not covered, so it opens the form).
- C: the family tab strip (piece · made from · made into) over the summary is B's lineage work,
  deferred.

- Left out until something backs them (no dead buttons): New → Photo (no picture kind), Bring in →
  Upload files (Capture records; nothing in Studio takes a file into material) and Import a link,
  Products → Workshop (`workshopKind` exists in studio-forms but is not mounted in Studio).
- Live from Create opens the booth, not Video's "Go live" card: an extension cannot start another
  kind's "New ▾" entry (`pendingNew` is the shell's). A `startNew(kind, as)` on the frame API would
  fix it (shell session's file).
- Brand kit has no model of its own yet (BRAND_KIT_ORIENTATION_2026-11-08); the card shows the site
  theme. "Just me" has no Edit kit link.
- Material lists only `studio_items` recordings and files; Out's "came back" items (replies,
  comments) are not stored anywhere yet.
- Create as the Studio default (`/studio` with no kind): developer.

## 2026-11-15: Justin's convergence notes (fc lead, a2, five Sonnet agents)

**The plan.** eris `docs/open/channel-convergence-2026-11-15/README.md` merges five research files: A (manage-piece), B (Plan it + Dock), C (one page + hub card), D (Make into) and a2-notes. It covers four decisions for Justin, all still open:
- one Channel page;
- what "weekly meeting" means;
- emailing attendees from the pop-up;
- the hub card's look.

**Live (a2, katie `T9k2OOI5K0Vr43OdSON0t`, sunjay `9mfAEGblKDnS-dY2Syqd5`):**
- Library as a cover grid.
- A one-row Queue toolbar.
- By week: kinds across, days down, plus Routines.
- View live per site (`threadPath`).
- Cells open a form. The "manage page" notice was the cell `<dialog>`, pinned top-left by Tailwind's base reset.

**In source, waiting for the arts-collective / katie / sunjay builds (a2 holds them until another session's `packages/booking` is safe):**
- Make into covers every kind Studio opens: content `make-into.ts`, and `/studio/make` TARGETS. Create's Library shows three chips plus More.
- The PieceSummary `plan` prop (`PieceSummaryPlan`, `PieceSummaryPlanStep`): a full-width Plan box. "Plan it" hides when the box is drawn. fmtDay draws a plain `YYYY-MM-DD` as a calendar day.
- Carry-over: `apps/arts-collective/src/lib/make-into-preset.ts` builds a "From “title”" FormPreset for meeting, artwork-form and service-form.
  - Access: the viewer's Channel model, then loadMeetingAction or loadArtworkFormAction.
  - A meeting carries no dates and no repeat.
  - FormShell's preset effect now waits for async presets.
  - Post and writing seeds are proposed only (D §7).
- a2 Phase 1:
  - the site `view=` param, with `tab=` aliases; `tab=plan` plus `piece` opens the pop-up;
  - next moves come from `channelNextMoves`;
  - `site/summary-view.ts`, and `./site/board` exports for the hub card.

Backups are in `~/eac-backups/2026-11-15-*`, none in src.

**Live 2026-11-15 (a2 builds):** arts-collective `i78laBRTN-xHnYK3JcZwm` (carry-over, /studio/make targets); katie `VWuFHWw6fu-lAcrXbvj_s`, sunjay `1vqSRDr7B8dHYSQuATG9H` (Phase 1 + Plan box + date fix). tenant-smoke 9/9. Not yet clicked through signed in.

**Live 2026-11-15, round 2:** one-page Home (a2): katie `vNuCis-uxECO5ma4BMrnR`, sunjay `_xFjHbX7mFtAlgx0q2bBL`. Channel hub card (fc, surface style, packages/channel/src/hub + sunjay hub, GET /api/hub/channel owner/guide only): sunjay `_xFjHbX7mFtAlgx0q2bBL`. Signed-out smoke: API 403, /hub and /channel 307 to login. Signed-in hub render (editor and non-editor) is still Justin's click-through. Open: Manage groups (decisions 2 and 3), calendar card tie-in, /manage Content retire, IFAC Channel.
