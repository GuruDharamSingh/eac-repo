# TEMPLATE lane: is the phone tour page a template of blocks? (2026-11-21)

Lane TEMPLATE, for Manjushri and Justin. Part 1 is for Justin, in plain words. Part 2 is the technical detail.

---

# Part 1. For Justin

## What the phone tour page is today

It is one fixed arrangement of sections, filled in by one tour. It is not a stored page: it is drawn by code.

From the top, on a phone:

1. **The stage.** The full-screen walk (overview, then each stop), with a strip of stop faces and the Book button docked at the bottom. Book opens a sheet with the booking form.
2. **The index.** A full screen you swipe into: the framed title, four key facts, a tile with the next date, and a row for each section.
3. **A pill bar and seven sections:** What to expect, The route (map and stops), Dates and times, Meeting point, What is included, Your guide, Good to know. A section that has nothing real to show disappears, and its index row and pill go with it. Reviews are off.

The desktop page is different. It is a stack of six blocks (hero stage, film, title and facts, description with route and booking box, more tours, a text box) arranged in a stored layout at `/studio/tour-detail`. So the desktop page already is a template you can arrange. The phone page is not: it was one (eight `m-tour-*` blocks, `/studio/m-tour-detail`), and on 20 November it was swapped for the code version because the swipe-from-stage-to-index flow could not be built from blocks. That old phone document is still in the database, unused.

## Should the tour page become a template of blocks that you arrange once and every tour fills?

**Yes for the part below the stage, no for the stage itself, and in two steps rather than one.**

- **Stays code (sealed):** the stage, the dock with its Book button and the sheets, the swipe from stage to index, the sticky pill bar, and all of booking and payment. These are choreography and money. They are not "what is on the page".
- **Becomes blocks you arrange:** the seven sections (and the index rows and pills, which would be made from whichever sections you put there).
- **What you could then change yourself:** the order of the sections; which show; the words of each section heading; each section's looks (spacing, colour, borders) through the usual Style tab; and words, pictures or any other block placed between sections. You would arrange it once, in the editor, over a sample tour, and every tour would follow.
- **What you still could not do per tour:** a different arrangement for one tour. The template is one arrangement for all of them.

## What it costs and what could break

- **The index and the pill bar.** Today they read the list of sections the page decided to show. With blocks, the shell has to learn the list from the document (a section block says "I am a section called X with this teaser"). This is the real work, a few days, and the part that could break the swipe and the pills if done carelessly.
- **Bookings.** Not at risk if the rule holds: the new Booking options block calls the existing booking form, unchanged, with the same data. Nothing in checkout, booking or payment is touched. The date you pick in the list still reaches the Book sheet because both read the same shared "chosen date".
- **The phone layout.** The sections' look lives in a phone-only stylesheet. Blocks reuse it as it is, so the look is identical, but it also means the blocks are for phone widths until a desktop variant is made. The look also sets scroll-snapping on the whole page, which would be wrong on any page without the stage. I added a guard for that (see Part 2).
- **Yesterday's editing on the page.** The "click a line to rewrite it" marks sit inside the sections (What to expect, Good to know). They read the same signed-in-guide information, so they carry over, but each section block must carry its marks. Easy to forget, easy to test.
- **Empty sections.** Blocks draw nothing when they have nothing, as the sections do now, so the index must know that too.

## The smallest first step that changes nothing a visitor sees

Store today's phone arrangement as a document (the seven sections as blocks in today's order), open it in the editor over a sample tour, and leave the live page drawing the code. Nobody sees anything different; you could look at it, move sections about in the editor, and we would compare it to the live page section by section. The second step makes the live page read the document and draw the sections from it, only once the comparison matches exactly.

## What I built in this lane

Two blocks you can use on any record page, today a tour and later a workshop (a session, not a stop; a join link instead of Book):

- **Booking options.** The dates to choose from (with places left), optionally the price and the Book action, for the record on the page. Settings: show the dates, show places left, show the price, show the Book action, and the form compact (opens when Book is pressed) or full (always open). With nothing changed it looks exactly like today's Dates and times section. The Book action is the page's existing booking form, untouched.
- **Map and locations.** The places of the record as a map and/or an ordered list. Settings: show the map, show the list, order (as visited, A to Z), how much each place says (name only; name, kind and time; everything, opening for the address and place card), and a picture for each place. With nothing changed it looks exactly like today's route section.

Neither is placed on any page, so nothing a visitor sees has changed. They appear in the editors' block lists (landing editor, Studio pages, phone Studio).

## Section table

Names for blocks that exist are in bold. Reading means "what it takes from the page it sits on", no setting needed.

| Section | What it is today | The block it would be | Reads from its surroundings | Its few settings |
|---|---|---|---|---|
| Stage | Full-screen walk, dock, Book foot, sheets | Stays code (a sealed "stage slot" the template puts first) | the record, the viewer | none in this step |
| Index screen | Framed title, key facts, next-date tile, section rows | Made by the shell from the section blocks present; the title frame could be `record-header` with a look | the record, the sections present | which key facts |
| Pill bar | Sticky pills, one per section | Made by the shell from the sections | the sections present | none |
| 01 What to expect | Lede and pace/language/length grid (click-to-edit for the guide) | `record-body` + `record-facts` (shared record blocks) or one "About this record" block | the record, the viewer (edit marks) | show facts; heading |
| 02 The route | Route map, stop list opening to address and place card | **`locations`** (built) | the record | show map, show list, order, detail, picture per place |
| 03 Dates and times | Date rows, places left, tap to choose; link to change dates for the guide | **`booking-options`** (built) | the record, the viewer | show dates, places left, price, Book action, compact or full |
| 04 Meeting point | Address and a link out to the map app | `locations` with only the meeting point, or a small "Where we meet" block | the record | heading |
| 05 What is included | Ticks in one or two columns | A list block bound to the record's "includes" | the record | heading, columns |
| 06 Your guide | Guide's face, name, languages, their take | A "Host" block (a workshop's facilitator reads the same) | the record, the chosen date's guide | show take |
| 07 Good to know | Bullets, notes per date, contact line (click-to-edit) | A "Good to know" block | the record, the viewer | heading |
| Reviews | Off on the phone | The existing reviews section as a block | the record | hidden today |

---

# Part 2. Technical detail

## What the page is today (`path:line`)

- Route: `apps/elktours/src/app/tours/[slug]/page.tsx`. `Split` draws `phone` below md and `desktop` above. Phone is `<TourPhoneProvider><TourStagePhone/><TourPhoneIndex/></TourPhoneProvider>` (page.tsx:60-66). Desktop is `<TourLayout data={layout}/>` plus `GuideTakes` and `ReviewsSection` (page.tsx:68-76). Both sit inside `TourPageProvider data={data}` (page.tsx:79).
- The record's data: `lib/tour-page-data.ts` `loadTourPageData` builds `TourPageData` (`blocks/tour/context.tsx:15-42`): tour with stops (guide notes stripped), departures, `unavailable` (not priced / booking closed), `maxParty`, `signedInEmail`, `contactEmail`, `stage` (stop narratives, place facts, pictures), `fieldEditId` (who may edit in place).
- Phone stage: `components/tours/stage/phone/tour-stage-phone.tsx` (678 lines). Shared controller `TourPhoneProvider` (`:91`): active face, `chosenDepartureId` (`:95`). Dock `:351-380` with the Book button (`stage.select(BOOK)`); Book layer `BookSurface` (`:644`) draws `BookingForm` with `initialDepartureId`.
- Phone index and sections: `stage/phone/index/tour-phone-index.tsx` (548 lines) over `index/data.ts` `buildModel(page, chosenId, now)` (`data.ts:84`). The section list is built there (`data.ts:~165-180`): expect, route, dates, meet, incl, guide, know, each added only when it has content (the guide always gets expect and know so an empty one can be filled in place). Sections drawn at `tour-phone-index.tsx:~155-163`; pills at `:~139`. Reviews are commented out (`:~167`).
- Desktop template: `blocks/tour/config.tsx` (`TourStage, TourFilm, TourIntro, TourMain, TourMore, TourText`), stored under `puck:tour-detail` in a flat custom format (`blocks/tour/layout-data.ts`, `lib/tour-layout.ts`), edited at `app/studio/tour-detail/page.tsx` over a sample tour. Not Puck's own document type; `TourLayout` (config.tsx:~105) draws it.
- Old phone template: `blocks/mobile/tour.tsx` (`m-tour-topbar, hero, head, blurb, meet, route, dates, bookbar`), default document `lib/puck/mobile-defaults.ts:93`, resolvers `config.mobile.*.ts` read `metadata.mobileTour` (`lib/puck/mobile-tour.ts`). Not drawn by the page since 2026-11-20 (page.tsx:56-58).
- Phone vs desktop: phone has the stage, the index screen, pills, the Book sheet, a dock, no film block, no description body, no highlights list, no "more tours", no booking box (Book is a sheet). Desktop has film, description, highlights, route with a map, an inline booking box (`TourMain`), more tours, guide takes, reviews.

## What the platform already has for "one page arrangement per kind of record"

- Shared record blocks, `packages/blocks/src/blocks/record-parts.tsx`: `record-header`, `record-body`, `record-facts`, `checkoutBlock(host)`, `rsvpBlock(host)`. One content setting, `record` (empty = the route's record, injected as `routeRecord`, `:488-492`), a host resolver returns `rec`. They are generic (a post, a gathering, a service, a tour) and carry no site CSS.
- `defineRouteTemplate` (`docs/open/SMART_COMPONENTS_KIT_2026-11-08.md` 2.1): a stored Studio page per record route, with `route(params)`, `sample(site)`, `reserved`. It is a proposal, built for hidden-enneagram and katie first; elktours has not adopted it. Elktours' own equivalent today is `TEMPLATE_SLUGS` (`lib/puck/reserved.ts:12`: `tour-detail`, `experience-detail`, m-* keys) plus `/studio/<template>`.
- Sunjay opens a template on one record with `?thread=<id>`/`?piece=<slug>` handed to the resolvers as metadata (`apps/sunjay/src/app/studio/[slug]/record.ts`), the same keys the route passes when it draws the template.

Fit: elktours already does this for desktop with its own flat format and for the retired phone document with Puck. The platform's direction (route template + record blocks + `routeRecord`) is the right home for the phone page too; the tour is not a `thread`/`service` the shared blocks know, so the section blocks stay site blocks (they read `TourPageData`, as here) until a record source for tours exists. Hence `reads: { from: "route", what: "record", kinds: ["tour"] }`.

## What stays code, and why
Stage and dock (`tour-stage-phone.tsx`), the scroll-snap choreography (`tour-phone-index.css:69-77`, `jump()` in `tour-phone-index.tsx`), the Book sheet and everything that books: `BookingForm`, `lib/book-actions.ts`, `lib/booking-lookup.ts`, `@elkdonis/checkout`. The template would name a "stage slot" first; STAGE lane owns its insides.

## Cost and risks in detail
1. Index and pills are derived from `model.sections`. A template needs each section block to declare `{ id, title, teaser(page) }` so the shell can build rows and pills from the document on the server, before children render. Smallest design: a `section` field on the block def (data only, like `reads`) and a pure `sectionsOf(document, page)`. This is the one structural change.
2. Booking: untouched by construction. `BookingOptionsView` passes the same props as `BookSurface` (`tour-stage-phone.tsx:659-671`). The chosen date is shared through `useTourPhone().chooseDeparture`; outside the provider it falls back to a local choice.
3. CSS: the sections use `.tpi-*` rules under `.tpi-root`, which also sets `html:has(.tpi-root) { scroll-snap-type: y mandatory }` (`tour-phone-index.css:69-77`) and `html body:has(.tpi-root) { padding-bottom: 0 }`. A page without the stage would snap-lock. `template-blocks.css` cancels the first rule unless `.tsp-root` is on the page; the body padding rule is left alone (noted). The look is phone-width by design.
4. In-place editing (`reports/ELK-tour-detail.md`): `tourMark(fieldEditId, field)` sits inside `Expect` and `Know` (`tour-phone-index.tsx:~298, ~522`). `Dates` has the "Change dates and times" link from `fieldEditId`; `booking-options` passes it, so that link carries over. Blocks that wrap Expect/Know must call `tourMark` the same way; a check should assert marks are present for a guide.
5. Editor: needs a phone-width canvas and a sample tour (`/studio/tour-detail` already builds one with `loadTourStageData`); the phone template would reuse that loader (not the static sample used here).
6. Empty sections: blocks return null as the sections do; the shell must count only blocks that draw.

## What I built

Directory `apps/elktours/src/blocks/template/`:
- `booking-options.tsx` (id `booking-options`, "Booking options", category actions). Props: `showDates` true, `showPlacesLeft` true, `showPrice` false, `showBook` false, `layout` compact|full. `reads`: route record (tour), viewer signed-in, flow booking. `dataDriven`, `interactive`, `styling: tokens`.
- `locations.tsx` (id `locations`, "Map and locations", category content). Props: `showMap` true, `showList` true, `order` route|alphabetical, `detail` name|summary|full (default full), `showCover` false. `reads`: route record (tour), site org.
- `views.client.tsx`: the drawing halves. `BookingOptionsView` draws the page's own `Dates` rows; with Book on it adds the existing `BookingForm` (compact: behind a Book button; full: always open; a sample draws it `inert`, so nothing can be booked from the editor). `LocationsView` draws the page's own `Route` section when the settings ask for nothing it cannot do (full detail, no pictures, list on; order and map on/off are applied by re-ordering and emptying the model it passes); otherwise it draws its own list/map with the same classes.
- `sample.ts`: a static made-up walk (3 stops, 3 dates, one full), plain JSON; `SAMPLE_TOUR_ID`.
- `resolvers.ts`: `templateEditorResolvers` (return the sample page) and `templateServerResolvers` (return `metadata.tourPage` or null; the block then reads `useTourPage()`, the provider the tour route already wraps its page in).
- `template-blocks.css`, `index.ts` (`TEMPLATE_BLOCK_LIST`).

Records: no "which record" setting; both read the route's. (A `binds: "record"` override has no source for tours yet; adding a setting that does nothing would mislead.)

## Decisions
- Site blocks, not shared: they draw `TourPageData` and the phone page's own sections; a workshop reuses them by supplying the same shape (sessions as departures, materials as places).
- Wrap by importing, not copying: `Dates`, `Route`, `WhenNear` are now exported from `tour-phone-index.tsx` (one word each, `export`); defaults are byte-identical to the page's own markup (checked).
- Defaults equal today's sections, so price and Book are off by default; the page shows price in the section heading and Book in the dock, neither inside the Dates body.
- Setting labels say "record"/"place"/"booking form", never "tour".

## Cuts and open items
- Not swapped onto the live page; no template document stored; no section blocks for expect, meet, included, guide, know (table above).
- Cover picture is a plain on/off using the stop's existing `cover`; choice of picture is lane MEDIA's (`StageStopData.cover`, `stopPhotos`, `placePhotos`).
- Desktop variant of the CSS not made.
- Changing the date in `booking-options` remounts `BookingForm` (key = chosen date) so it preselects; typed name/email in that form is lost on a date change. The Book sheet does the same when reopened.
- The registration puts the blocks in `PAGE_BLOCKS` and `MOBILE_BLOCKS`: they appear in the landing editor, Studio pages and phone Studio palettes, and draw nothing on a page with no tour (landing). If that is unwanted, move the `TEMPLATE_BLOCK_LIST` spread to a tour-only catalogue when the template exists.
- No live-page browser test (nothing placed). Server render only.

## Check output
`apps/elktours/scripts/check-template-blocks.mts`, run as given in the brief: **40 passed, 0 failed, 2 skipped.**
Covers: `createCatalogue` accepts both (ids unique, sample present); `reads` declared with the route record; no "tour" in any setting label or description; samples are plain JSON; both in `PAGE_BLOCKS` and `MOBILE_BLOCKS`; `mobileServerConfig` and `mobilePuckConfig` hold both; resolvers (editor sample, server pass-through, null); server render from samples (3 date rows, places left, a full date disabled; price/Book off by default; places left, price, compact fold and full form render; form inert for sample); drawing nothing without a record; default `booking-options` equals the page's `Dates` markup and default `locations` equals the page's `Route` markup byte for byte; A to Z, name-only, summary, map off, map only, cover on.
Skipped (not caused by these blocks): `config.server` and `config.client` cannot be built under node here, because `featuredPerson` is undefined in `PAGE_BLOCKS` in this harness (prints `UNDEF` at index 16 with or without these blocks; verified against a copy of `catalogue.ts` without my lines). Their block list is `PAGE_BLOCKS`, which is checked.

## tsc (`apps/elktours`, `pnpm check-types`)
Before: 0 errors. After: 2 errors, both in `src/app/api/media/libraries/[key]/route.ts(22,54)/(22,77)` (`LibraryResult` has no `error`/`status`): another lane's file (MEDIA), not touched by me. 0 errors in any file of this lane.

## Files
New:
- `apps/elktours/src/blocks/template/{booking-options.tsx, locations.tsx, views.client.tsx, sample.ts, resolvers.ts, template-blocks.css, index.ts}`
- `apps/elktours/scripts/check-template-blocks.mts`
- `docs/open/ELKTOURS_BLOCK_FORWARD_2026-11-21/TEMPLATE.md`
Edited (small hunks):
- `apps/elktours/src/components/tours/stage/phone/index/tour-phone-index.tsx`: `export` added to `WhenNear`, `Route`, `Dates` (nothing else).
- `apps/elktours/src/lib/puck/catalogue.ts`: one import, `...TEMPLATE_BLOCK_LIST` in `PAGE_BLOCKS` and in `MOBILE_BLOCKS`.
- `apps/elktours/src/lib/puck/config.client.ts`, `config.mobile.client.ts`: one import and `...templateEditorResolvers` in `resolvers`.
- `apps/elktours/src/lib/puck/config.server.ts`, `config.mobile.server.ts`: one import and `...templateServerResolvers` in `resolvers`.
- Board: start and finish entries appended.

## What must be rebuilt
elktours (Justin's session rebuilds it). Visitors see no difference: the blocks are placed nowhere. The editors' palettes gain two blocks.

## Notes for other lanes
- MEDIA: `locations` `showCover` is a boolean using `StageStopData.cover`; replace with the picker's reference when it exists.
- STAGE: nothing of yours touched; a template would need a named "stage slot" that draws `TourStagePhone` and owns the provider.
- BLOCKS: registration lines are adjacent to yours in `catalogue.ts` (`heroCityTitle`, then `...TEMPLATE_BLOCK_LIST`); re-read before editing.
