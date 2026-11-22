# ELK-tour-detail: review of the phone tour page, and the page made editable in place

2026-11-21. Source only: no rebuild, restart, install, migration, commit, email, Stripe call or production write. Every database test ran inside `BEGIN ... ROLLBACK`.

Status: Job 2 built and checked (80/80 on the new script, 102/0 on check-fields, tsc 0 errors before and after). Dates: not editable in the lens; the page links to the office editor instead (see "Dates"). Signed-in browser look: not done (reason below). Needs a rebuild of `eac-elktours` to go live.

---

## Job 1: review of the recent phone tour page work

Method: `git status`/`git diff` and file times over `apps/elktours` (about 190 files modified, most of `components/tours/**`, `components/mobile/**`, `blocks/tour/**`, `app/tours/**` changed in the last two days), read `app/tours/[slug]/page.tsx`, `lib/tour-page-data.ts`, `lib/tour-stage-data.ts`, `components/tours/stage/phone/**`, against `HERO_COMBINED_HANDOVER.md`. Signed-out screenshots of the live page at 390 and 360 wide (Montmartre, Marais) with measurements: `~/scratch/he-test/shots/tf/`, `.../tf2/`. Not done: contrast measurement, a screen reader pass, sold-out and one-stop pages (no such live tour; read from code only).

What was fine: no horizontal scroll at 390 or 360 (scrollWidth equals clientWidth); one level-1 heading, sections are h2; Book sheet handles "no dates", "not priced" and "payments off" with a mail link (`booking-form.tsx:75-81`); guide notes are stripped (`guideNotes:null` on all nine stops in a visitor's payload); no `Private/` media in the visitor HTML; a sold-out date is disabled and tagged "Full" (`tour-phone-index.tsx` `Dates`); a long title shrinks to fit (`TITLE_FIT_MIN`).

| # | Sev | Where | What is wrong | Smallest fix |
|---|---|---|---|---|
| 1 | Medium | `lib/tour-page-data.ts` (builds `TourPageData`), sent to the browser by `app/tours/[slug]/page.tsx` | Every visitor's page carries internal user ids: `tour.authorId` and each departure's `guideUserId` (seen in the HTML: `4eebc495-...`, `fbf699b9-...`), plus the whole `others` list of six tours. Not secret keys, but they are account ids a visitor should not need. | Build a public shape: drop `authorId`/`guideUserId`, key `guidePhotos` by something public (the guide's slug), drop `others` on the phone tree. |
| 2 | Medium | live `/tours/montmartre-from-village-to-moulin-rouge` | In the first screenshot run the page showed "Something went wrong" (the error boundary) twice: at 360 wide on first load, and at 390 after a jump-scroll to 2.4 screens. Two later runs (390 and 360, plus a gradual-scroll probe with console capture) did not reproduce it. Possibly the rebuild in progress at the time, possibly a client error in a section that mounts on scroll (the route map mounts when near). | Add console and `pageerror` capture to the next rebuild's screenshot loop; check `eac-elktours` logs around 09:45 to 09:55 on 2026-11-21. |
| 3 | Medium | `phone/index/tour-phone-index.tsx` `INDEX_HIDDEN = ["know"]` and `Know` | "Good to know" is off the index, and it is the only place the contact address appears on the phone page outside the Book sheet. A tour with no dates (Montmartre) says "Ask us about a date" on the index with nothing to tap that asks. | Make the "No dates open yet / Ask us about a date" tile a mail link (the `contactEmail` is already in the page data), or put Contact back on the index. |
| 4 | Low | `tour-phone-index.css`, `tour-stage-phone.css` | Tap targets under 44 px high at 390: stop thumbnails 46x38, section pills 34 high, "back to tours" 66x42, home 36x42, "Start with stop I" link 41 high. All pass the 24 px WCAG 2.2 minimum; fail Apple's 44. | `min-height: 44px` on `.tsp-thumb`, `.tpi-pill`, `.tsp-back__*`, `.tsp-flow`. |
| 5 | Low | `phone/index/data.ts` `buildModel` | `highlights` is built and returned but nothing draws it on the phone (the "Highlights" the handover lists on the desktop have no phone home). Dead field. | Remove `highlights`, or draw it in "What to expect". |
| 6 | Low | `app/tours/[slug]/page.tsx` | `Split` puts both trees in the HTML (275 KB for one tour); the desktop tree's Puck layout is built for phone visitors too. Known design (`split.tsx`), noted for weight. | None now. |
| 7 | Low | `tour-stage-phone.tsx` (old `tsp-edit-hint`) | For a guide it linked to `/hub` ("Write this stop's line (hub > Create a tour)") on every stop with no line. Now replaced, for the tour's own guide, by the in-place field (this job). | Done in this job (`!page.fieldEditId` guard). |
| 8 | Low | `config/site.ts` | The fallback contact shown to every visitor is `danamccoolart@gmail.com`, a personal-looking address, via `ELKTOURS_OWNER_EMAIL`. Public by design today. | Owner to confirm it should be public; the new per-tour contact line lets a guide override it. |
| 9 | Info | handover vs code | The handover is the desktop hero ("Not built. Justin still has to say build it"); the phone tree is a different, later design (stage then index, "completely ignore Puck"). No contradiction found between the phone code and a stated phone decision; the desktop hero in the handover is not what `app/tours/[slug]/page.tsx` draws (it still draws the Puck layout). | Nothing for the phone session; flag for the PM that the handover's status line is out of date relative to the page. |

No broken state found for: no stops (the "route" section is absent, `stops.length` guard), one stop ("1 stop"), a long title, sold-out dates. Not exercised by screenshot.

---

## Job 2: field table

Findings first: the page draws "what to expect" from `threads.excerpt` (the wizard's "One-line summary", max 300; `tourLede = tour.excerpt || first sentences of body`), not from the long body. The phone page has no stored "good to know" at all: the section is built from each date's note plus one Contact row whose address is the site-wide `siteConfig.fallbackNotifyEmail`. So "good to know" bullets and a per-tour contact line are new stored values. A stop's walk-through line is `tour_stops.excerpt` (falls back to the first sentences of the stop body when empty).

| Label (as shown to the guide) | What the page shows | Table.column or path | Who may edit | Saved through |
|---|---|---|---|---|
| Tour title (`record:tour:<id>:title`) | The big title on the "Before you go" screen | `threads.title` | the tour's guide (author, or leading a coming date) or an owner; published and public tours only | `saveTourFields` (`lib/tour-fields.ts`) |
| What to expect (`...:excerpt`) | The lede in "What to expect", and the overview line on the walk | `threads.excerpt` (empty = derived from `threads.body` as the wizard does) | same | same |
| Walk-through line (`record:tourstop:<stop id>:line`) | The line under each stop | `tour_stops.excerpt` | same (decided on the stop's tour) | `saveStopLine` |
| Good to know (`...:goodToKnow`) | New bullets above the notes and contact, in "Good to know" | `threads.metadata.goodToKnow` (jsonb array of strings, top-level key) | same | `saveTourFields` |
| Contact line (`...:contact`) | The Contact row at the bottom of "Good to know" | `threads.metadata.contact` (string; empty = the office's address shows) | same | `saveTourFields` |
| Dates and times | The "Dates & times" section | `booking_slots` (live, `BOOKING_TABLES=1`) via `lib/departures.ts` | not in the lens | link to the office editor |

Top-level metadata keys on purpose: `saveTourAction` rewrites only `metadata.tour` and `coverImageUrl`, so an office form save cannot drop them (checked: the script proves the office's `metadata.tour`, the film and the cover are unchanged by lens saves).

## Who may edit

`mayEditTour` (`lib/tour-fields.ts:78`): signed in; org role owner or guide; tour published and public; then owner, or `threads.author_id` equals the person, or the person is `guide_user_id` of a not-cancelled coming departure of this tour (same rule as `lib/people.ts toursFor`, and as `saveRouteViaAction`'s owner-or-author). Decided on the server from `getViewer()` (which calls `getServerSession()`) inside `lib/fields-tour.ts` on every load, save and put-back; the browser sends only an id. The page asks once per request, only for a signed-in owner or guide (`lib/tour-page-data.ts`, `fieldEditId`). For everyone else `fieldEditId` is null, no `data-field` attribute is drawn, and the lens is not even sent (`FieldsLensGate`). Checked on a dev copy: a signed-out request for a tour page has 0 `data-field`, `"fieldEditId":null`, `"goodToKnow":[]`, no `previousVersions`.

Why a new function and not the wizard's: `saveTourAction` writes the whole form; `patchTourAction` and `setStopExcerptAction` gate on "any owner or guide of the organisation" (a guide could rewrite another guide's tour) and `patchTourAction`/`saveTourAction` rewrite the slug on a rename, which would break links already sent to customers. `lib/tour-fields.ts` keeps their limits and cleaning (title 2 to 200; summary 300 through `deriveExcerpt`; bullets up to 30, each up to 300; stop line 300 plain text; tags and script bodies removed) and adds the per-tour check. A title change leaves the web address alone (proved by the script).

The packages/actions catalogue has no entry for a tour's words and elktours does not depend on that package (`lib/fields-site.ts` says so), so no capability is registered; the save is the host's own gated function, the route `save` fallback the lens already supports. No direct table writes from the lens.

## What was built

Shared lens (`packages/house-editor/src/fields/`), all optional so the other sites are unchanged:
- `registry.ts`: input kind `list` (one line per bullet; `max` per line, `maxItems` default 30; blank lines drop out), `KindSpec.heading` (panel title without the id).
- `save.ts`: `PreviousVersion`; a route's `read` may return `previous`; a route may supply `restore`; `createFieldsActions` returns `restore` beside `load` and `save` (same gate, read-only reasons honoured).
- `FieldsLens.tsx`: `ListInput` (one box per line, "Add a line", remove button; line 579), "Put back the previous version" with who and when and the earlier text (`putBack`, line 422), new optional prop `restore`.
- `index.ts`, `server.ts`: type export.

elktours:
- `src/lib/tour-fields.ts` (new): `mayEditTour:78`, `editableTourId:93`, `cleanTourField:129`, `readTourFields:184`, `saveTourFields:224`, `putBackTourField:270`, `readStopLine:300`, `saveStopLine:309`, `putBackStopLine:339`. Takes the sql handle and actor as arguments (that is how the check runs it in a transaction).
- `src/lib/tour-fields-registry.ts` (new): the `tour` and `tourstop` kinds, labels and hints in plain words; `elktoursFieldsRegistry` = shared site kinds plus these.
- `src/lib/fields-tour.ts` (new): the lens routes (read, save, restore) bound to the session; `TOUR_KINDS`.
- `src/lib/tour-field-marks.ts` (new): `tourMark`/`stopMark`, `{}` when there is no edit id.
- `src/app/fields/actions.ts`: tour kinds go to `tourFields`; new `restoreFieldsAction`.
- `src/components/fields/FieldsLensMount.tsx`: uses `elktoursFieldsRegistry`, passes `restore`, no "Edit the look" link on `/tours/*`, bar says "Edit this tour" there.
- `src/lib/tours.ts`: `Tour.goodToKnow`, `Tour.contact` (optional), read from `metadata`.
- `src/lib/tour-page-data.ts`, `src/blocks/tour/context.tsx`: `fieldEditId`.
- `phone/index/data.ts`: bullets, contact (guide's own, else the office's; a mail link only when it is an address), sections the guide can fill appear for them.
- `phone/index/tour-phone-index.tsx`: marks on the title, "What to expect", the bullets and the contact row; an empty-state line only the guide sees; "Change dates and times" link (guide only).
- `phone/tour-stage-phone.tsx`: marks on each stop's line and on the overview line.
- `scripts/check-tour-fields.mts` (new).
- `packages/house-editor/scripts/check-fields.mts`: two source-level expectations widened (the elktours actions file now exports a third door, `restoreFieldsAction`; the mount may name `elktoursFieldsRegistry`).

All fields open in the side panel (not typed in place) so "Put back the previous version" is always reachable. Labels in plain words: "Edit this tour", "Tour title", "What to expect", "Walk-through line", "Good to know", "Contact line", "Add a line", "Put back the previous version", "Change dates and times".

## Dates

Cut to the fallback the brief gave. In the "Dates & times" section the guide (or owner) sees "Change dates and times", a link to the existing office editor for this tour (`officeHref("schedule", { tourId })`, `/hub?...`, the same target as the existing Edit menu). Why: the existing date functions (`saveDepartureAction`, `addDeparturesAction`, `cancelDepartureAction`, `removeDepartureAction`) all gate on "any owner or guide", not on this tour; they run over two stores with `BOOKING_TABLES=1`; changing or cancelling a date with bookings touches payments, refunds and emails. Opening a date calendar from the page would either need a per-tour gate added to each of them or skip their guards. I did not invent booking logic. The date popup in `schedule-tour-popup.tsx` is reachable by the link; embedding it in the lens (and giving those four functions the same per-tour check) is the follow-up.

## The one previous version

Chosen: `threads.metadata.previousVersions`, one jsonb entry per field (`title`, `excerpt`, `goodToKnow`, `contact`, `stop:<stop id>`), each `{ value, by (name), byId, at }`. No migration. I looked for an existing revisions or history table first (`grep revision|previous|history|_versions` in `packages/db/migrations` and `packages/services`): the platform has thread/page version stores for Studio and the canvas, but nothing for a tour's single fields, and the brief asked for one level. The tour's metadata is where the rest of a tour's loose facts live, and it is written in the same statement as the change (the stop line uses one CTE statement, so the line and its kept value change together or not at all).

Rules (all proved by the script): a save that changes a field stores the value it replaced; a second save replaces that kept value (one level, never two); "Put back" restores it and the value it had trades places into the kept slot, so pressing it again undoes it; saving an identical value changes nothing and keeps the earlier version; an empty earlier value is kept as empty ("It was empty"). The lens shows the button, who replaced it and when, and the earlier text, in the panel. Visitors never see it (`Tour` does not carry `metadata`; checked in a visitor's HTML). No dated name like `previousdraft1-[title]-date` is generated: the entry carries who and when instead.

## Decisions

- "What to expect" is `threads.excerpt` (the one-line summary), as the page and wizard define it; the long body is not touched.
- Good to know and Contact are new per-tour values in metadata; an empty contact falls back to the office address. The Book sheet's "email us" still uses the office address (a guide's contact line is shown in "Good to know" only).
- The tour's guide = the author or a guide leading a coming, not-cancelled date. An owner can edit any published tour.
- Drafts and unpublished tours are refused from the page ("Use the office"), as the brief said.
- Title rename keeps the web address.
- A stop line longer than 300 characters is refused, not silently cut (the old function cut it).
- Only the phone tree is marked. The desktop page is a Puck layout with its own existing Edit menu and in-page editor (`TourEditBar`); it is not marked here, and the two editors do not overlap because the lens only finds `data-field` elements.

## Cuts

Dates in the lens (link instead). Desktop marks. The signed-in browser look (below). Nothing cut from contact or put-back.

## Signed-in look: not done

The only test account (`house-editor-test@example.com`) is a guide of elktours but is neither the author nor the guide of any tour, so the page correctly shows it no marks; showing them needs a production write (a user_organizations or a departure's guide change), which the brief forbids, or a test hook in shipped code, which I did not add. What was done instead: a throwaway `next dev` copy (port 4023, scratch `.next`, reminder and slot sweeps disabled, container removed, `next-env.d.ts` restored to its original hash) served the page signed out: HTTP 200, compiles, 0 `data-field`, `"fieldEditId":null`. The panel, list editor and put-back button have not been looked at in a browser. Concern: the lens bar sits bottom centre at z-index 2147483000 and the phone page has a fixed dock at the bottom; the bar will overlap the dock's Book button for the guide. Look at it first.

## Check output (`apps/elktours/scripts/check-tour-fields.mts`, from `~/eac`)

Written first and run red (`ERR_MODULE_NOT_FOUND ... src/lib/tour-fields`), then green after the module existed. Final run, `~/scratch/tf/check-out.txt` on eris, on the real published tour "Discover the heart of Paris: Ile de la Cite" with a real draft tour, all inside one transaction rolled back:

```
80 passed, 0 failed
```
Groups: who may (owner, author, a guide leading a coming date, not once it is cancelled, a guide who does not lead it, a non-member, signed out); strangers read no values and cannot save, save a stop line or put back; a draft, a tour unpublished meanwhile, an owner on a draft all refuse; for each of title, excerpt, good to know, contact: save, read back, previous kept (who and when), second save keeps one level, put back restores, put back again undoes, same-value save is a no-op; a title change leaves the slug alone; the office's `metadata.tour`, film and cover are untouched; empty and one-letter titles refused; stop line save, previous, one level, put back, owner may, bad id refused; 50,000 characters refused in every field; 500 bullets refused; a 301-character bullet refused; undeclared fields (`slug`, `status`) and non-text values refused; script tags, `onerror`, `javascript:` links and markup cleaned from every field with the real words kept; stop line cleaned the same; after the rollback the fingerprints of the tour row, its stops, the draft row and its booking slots are byte-identical.

`packages/house-editor/scripts/check-fields.mts`: 102 passed, 0 failed (was 100/2 until its two source-level expectations were widened).

Not covered by the script: the session-bound wrappers (`lib/fields-tour.ts`, `app/fields/actions.ts`) and the browser. The gate (`getViewer`) is the app's existing one.

## tsc (`pnpm check-types`, eac-dev container)

| | before | after |
|---|---|---|
| apps/elktours | 0 errors | 0 errors |
| packages/house-editor | 0 errors | 0 errors |

(One intermediate run showed 3 errors in my new files, fixed: the app compiles non-strict, so unions on `ok` need both fields optional.)

## Files

New: `apps/elktours/src/lib/tour-fields.ts`, `tour-fields-registry.ts`, `fields-tour.ts`, `tour-field-marks.ts`, `apps/elktours/scripts/check-tour-fields.mts`.
Edited: `apps/elktours/src/app/fields/actions.ts`, `components/fields/FieldsLensMount.tsx`, `blocks/tour/context.tsx`, `lib/tour-page-data.ts`, `lib/tours.ts`, `components/tours/stage/phone/index/data.ts`, `.../index/tour-phone-index.tsx`, `.../phone/tour-stage-phone.tsx`; `packages/house-editor/src/fields/registry.ts`, `save.ts`, `FieldsLens.tsx`, `index.ts`, `server.ts`; `packages/house-editor/scripts/check-fields.mts`.
Not touched: `components/landing/**`, `packages/direct-edit`, `packages/db/migrations`. No migration was needed; none proposed.

## Must be rebuilt

`eac-elktours` (all of the above is source). Rebuild deploys the other session's uncommitted `components/tours/**` work too (see `.claude/rules/00-working-style.md`); the rebuild also picks up the shared `packages/house-editor` change, so any other app that bundles the lens (sunjay, hidden-enneagram, innergathering) gets the list input and put-back code on its next rebuild, unused there (optional props only).
