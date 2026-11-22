# elktours office: one hub, popups for the staff tasks (2026-11-19)

Proposal and state for merging the phone and desktop back ends of `apps/elktours` into the desktop `/hub`, with
six hub cards that open surface popups. Written from three read-only surveys on 2026-11-19 (office routes, UI kit,
data model) and the developer's brief of the same day. Nothing below the "Done" section is built.

## Developer's decisions (2026-11-19)

- `/hub` is the office on phone and desktop; `/manage` pages stay as full editors; header Manage → /hub; the phone
  Office on `/manage` is retired once the hub covers it.
- Build order: Offer a tour and Add a place first, then the Create Tour wizard.
- Route line: OSRM walking route with draggable points.
- elktours may be rebuilt as often as this work needs.

## Done 2026-11-19 (live since the 20:15 EST rebuild, `WX5BhIsdDBSBd-xknRB4C`; first rebuild 20:06 `fkdDKsZilHd2xbOcogq_M`)

- Hub Office band (`components/office/office-faces.tsx`, editors only, `app/hub/page.tsx`): six `SurfaceCard`s.
  Built: Offer a tour (`office-schedule`, `components/office/schedule-tour-popup.tsx`: tour, places, guide for owners,
  month calendar with dots for existing runs, one row per picked day with start times and a per-day tour, publish
  through `createSlots`) and Add a place (`office-add-place`, `components/office/add-place-popup.tsx`: step 1 search
  via `PlaceSuggestions` or pin/photo via `LocationCreator`; step 2 website from `place_links` + `PlaceForm`).
  The other four open `office-soon` (Create a tour links to `/manage/tours/new`). Reads: `lib/office-actions.ts`
  (atlas: ignored as reads). Header "Manage" links removed (editors have "Hub"). Built chunks carry the new
  strings; signed out, `/hub` and `/manage/schedule` redirect to login. **Not rendered signed in**: creating a
  test owner account was refused by the session's permission classifier.
- Developer feedback round 1 (2026-11-19 evening), live since the 20:48 EST rebuild `TpKnnR-EYJplONdmXNhoR`:
  Add a place opens on a search field (results only after typing); "Catalogue of places" and "Create place here"
  are foot actions; pin and photo are separate modes. Place form (`components/places/place-form.tsx`, also on
  `/manage/places/[id]`): no Public switch; "Known places within 50 m" replaces the position search; turning or
  zooming the Street View sets heading/pitch/fov (`StreetViewPano` `onViewChange`, debounced, ignores its own
  settle events), saved with the place. Offer a tour: controls and calendar left, day rows right on wide screens,
  a guide per row. Coming-soon cards use `SurfaceCard disabled`. `--eac-surface-danger` set (handoff finding 1).
- Create a tour wizard (`components/office/create-tour/`, key `office-create-tour`, size full), live since the
  20:58 EST rebuild `t9Oe6Xe960ELs6Xp3k97E` (not opened signed in): Description (city, title, summary, meeting point by pin or one of our places,
  where-exactly label, price, length, languages, cover; "More" holds description, highlights, includes, max
  party, walking) → Route (stop 1 = meeting point; map of our places within 1.2 km of the last stop with a card
  and "Add to route"; New place by pin; collapsible stop rows with reader text, guide notes, minutes, picture;
  Confirm the route = save stops, which recomputes the OSRM walking route and draws it) → Details (per-stop
  pictures in order with captions, hide/remove, add, copy from the place's pictures; Publish; Offer dates opens
  the schedule popup on top). "Continue a draft" reopens a draft. `saveTourAction` now creates the missing
  set-dates booking offer (`ensureTourOffer`) and stores `metadata.tour.city`.
- Round 2 (2026-11-19 late evening), live since the 21:31 EST rebuild `B0NDEJbdot5ZXBKjIpO3D` (tour pages 200 through
  the edge; not opened signed in):
  - Migration 279 applied 2026-11-19 21:16 EST, alone (263 still pending; tracker row and checksum written by
    hand, `migrate.mjs --verify` reports 0 drifted). Its header comment still reads "Not applied": an applied file
    cannot be edited.
  - Draggable walking path: `metadata.tour.via` ("<from>><to>" → [lng, lat] points; "meet" or a stop id);
    `refreshTourRoute` (`lib/tour-cache.ts`) sends them as extra waypoints and folds them back into their leg;
    `saveRouteViaAction` (`lib/tour-actions.ts`, owners any tour, guides their own, Paris box). Wizard map
    `components/office/create-tour/route-edit-map.tsx`: a + handle mid-leg to drag, square bends to move or click
    off; enabled once every stop is saved.
  - Street View spot: `places.view_lat/view_lng`; the panorama reports its position, the place form saves it,
    the panorama reopens there. Stops do not copy it yet (`tour_stops.view_lat/lng` exist, unused).
  - Guides' notes on a place: `place_notes`, `lib/place-note-actions.ts`, `components/places/place-notes.tsx` in
    the place form below "Shared notes" (the old single `private_notes` field, relabelled).
  - Offer availability: `guide_availability`, `lib/availability-actions.ts`, `components/office/availability-popup.tsx`
    (calendar, per-day parts/offers/note; "Save and tell the office" emails the owners, kind `notification`;
    owners see the team's days).
  - Personal takes: `tour_guide_takes`, `lib/guide-take-actions.ts`, `components/office/takes-popup.tsx`; public
    in "From our guides" on the desktop tour page (`components/tours/guide-takes.tsx`, `lib/guide-takes.ts`) while
    that guide leads an upcoming run (run without a guide = the tour's author). Not on the phone tour tree.
  - SQL trialled on the live tables in `BEGIN … ROLLBACK` (null-stop upsert, availability replace, public read).
- Public tour lists show only tours with an upcoming scheduled departure: `listTours()` without `includeDrafts`
  adds an EXISTS over `departuresSql()` (`apps/elktours/src/lib/tours.ts:227`). Office pages (`includeDrafts`)
  are unchanged; a tour with no dates stays reachable by its link. Verified by running the composed query on the
  live DB: 2 of 8 published tours qualify (Île de la Cité, Rue Montorgueil food tour; slots 27 and 28 Nov).
  Empty-state wording on `/` and `/tours`: "No tours are scheduled at the moment."
- Remove a cancelled departure (owners): `removeCancelledDeparture` (`lib/departures.ts`) deletes the
  `booking_slots` row and its legacy `tour_departures` twin in one transaction; refuses a scheduled run and any
  run with a booking row (`bookings.slot_id` is ON DELETE RESTRICT; the rows carry order/refund history).
  `removeDepartureAction` (`lib/tour-actions.ts`) checks `role === 'owner'`. Buttons: the schedule side panel
  ("Remove from schedule", `components/manage/schedule-planner.tsx`) and the tour editor's Departures tab
  (`components/manage/departures-panel.tsx`). Trial delete in `BEGIN … ROLLBACK`: no constraint blocked it.
  Atlas row `slot-remove`. Not on the phone Slot screen. Type check 0 errors. Not rendered (needs a rebuild).

## Tour page hero stage (2026-11-20, live since the 22:55 EST rebuild `lqCLG8Lc_lw3uRGMz_4ys`)

Built from the developer's design package (survey: `docs/open/ELKTOURS_SURFACE_HANDOFF_2026-11-20.md`) by four Sonnet
agents coordinating on a board file, plus a Sonnet code review; fixes applied by the main session.
- `SurfaceStage` (`packages/cms-ui/src/surface/SurfaceStage.tsx`, exported from `@elkdonis/cms-ui/surface`): surfaces
  docked into the page with a strip of faces; stage-scoped `useSurface()`; `size: "stage"`; `place` kind;
  `--eac-surface-primary` read by `.eac-btn--primary` (falls back to today's colour). Additive; sunjay and cms-ui
  type-check 0; other cms-ui apps not type-checked; they pick it up on their next rebuild.
- elktours `TourStage` (`components/tours/stage/*`, data `lib/tour-stage-data.ts`, wired through `TourPageData.stage`
  on `/tours/[slug]` and `/studio/tour-detail`): overview face, one face per stop (Roman numerals), Book face (pushed
  layer with BookingForm) when bookable; stop surface = narrative | media (Photos / Street View on press), flow line
  with walk minutes, place face pushing a place layer (facts, links, guides' takes). Colours from the surface tokens
  (see the comment in `tour-stage.css`).
- Puck block "Hero stage" (`blocks/tour/stage-block.tsx`, `stage-options.ts`, `stop-squares-field.tsx`): opens on,
  first tab, picture source (stop / stop then place / place), strip, height 480–640, narrative max, per-stop squares
  (hide, source, first tab, caption) keyed by stop id.
- Stored layout `site_config` `puck:tour-detail` changed 2026-11-20 22:51 EST from Film, Intro, Main, More to
  **Stage, Main, More** (backup `~/eac-backups/site-config/elktours-puck-tour-detail-20261119-2249.json`).
- Wizard Route step: a stop line field (soft 240, hard 280) saved to `tour_stops.excerpt` via `setStopExcerptAction`;
  placeholder = the body fallback, never saved. Details shows each line read-only.
- Verified: signed-out render at 1440 through a CDP Chrome (host mapped to the container, forwarded-proto header):
  overview, stop I, hover, place layer; no page errors (console errors were map tiles refusing the test's http
  origin). Not verified: Book layer render, keyboard, the Puck field in the studio, the wizard line save, phone.
- Data: no stop has a line yet (`excerpt` 0 of 79 published stops; 7 have a body; 6 linked places have an excerpt),
  so stops show their name until guides write lines. No columns for place hours/entry/built or a tickets link kind.
- ~~Open: the saved Site style keeps `--muted` dark under a white card~~ Fixed 2026-11-20 23:05 EST on the developer's
  go-ahead (rebuild `IRKgUVMnKJt7yIwZQ_xmC`): the Site style schema (`src/lib/site-style-schema.ts`) gained "Soft
  panels" (`--muted`), "Hover wash" (`--accent`) and "Quiet buttons" (`--secondary`); the saved elktours style got
  `40 14% 95%`, `40 18% 91%`, `40 12% 93%` (backup `~/eac-backups/site-config/elktours-site-themes-20261119-2300.json`);
  `globals.css` now derives card/popover/secondary/accent text from `--foreground` and popover from `--card` (same
  values in the default dark palette). Verified in a CDP Chrome: tour popup foot rgb(244,243,240) under status text
  rgb(41,39,35), about 13:1.

## Phone tour page v2 (2026-11-20, live since build `Kp82NHrBts-_crL_Mj-rq`, ~23:55 EST)

Developer: "completely ignore Puck", "follow through with the phone design", "full page swipe to index … replacing full mobile
detail page", then: type a size larger, Venture "double bold" instead of Basteleur on the phone page, strip minicards filled
by the cover with a centred plain number and no text. Built by Sonnet agents on a board (UNIFY, INDEX, HOST, PHONE, DESIGN).
- Phone tree of `/tours/[slug]` (`app/tours/[slug]/page.tsx`): `<TourPhoneProvider><TourStagePhone /><TourPhoneIndex /></TourPhoneProvider>`.
  The `m-tour-detail` Puck document is no longer drawn (it stays in the database). Desktop unchanged (stage via the Puck
  "Hero stage" block; the developer: "looks alright in landscape").
- `TourStagePhone` (`components/tours/stage/phone/tour-stage-phone.{tsx,css}`): on cms-ui `SurfaceStage layout="phone"`
  (HOST: media band, fixed dock with strip + foot, bottom sheets, swipe between faces; additive, docked layout unchanged;
  `StageFace.mark`; phone-only `z-index:auto` fix). Stage = 100svh (media 300 fixed, card scrolls inside); dock folds to the
  Book bar when the stage is off screen; `useTourPhone()` controller (active face, selectFace, chosen departure). BookingForm
  gained an optional `initialDepartureId`. The dark design map and Venture are scoped to `.tsp-root`; `.m-nav`/`.m-back`
  hidden on this page below 768px.
- `TourPhoneIndex` (`components/tours/stage/phone/index/*`): scroll-snap stage ⇄ index (mandatory, first two screens), then
  sections 01–06/07 with a sticky pill bar and scroll-spy, reviews after the last section; sections without data are hidden.
- Verified (CDP Chrome, 390×844, signed out): snap to the index at 844; index row, Next and pill jumps land on their sections
  (after INDEX's fix: the pill bar no longer smooth-scrolls, which cancelled the page's jump); a tapped pill stays lit until the visitor scrolls by hand; minicards; fonts; place sheet
  over the dock. Not verified: Book sheet and "About this tour" face (no bookable tour; no facts on the sample tours), touch
  devices (swipe, scroll chaining), maps with tiles (test origin blocks tiles).
- A build failed once (23:39) on another session's in-progress `packages/page-builder` edit; the previous build was restored
  within a minute. Builds now type-check immediately before and restore automatically on failure.

## Current state (surveys, 2026-11-19)

- No separate phone office route: `Split` (`components/mobile/split.tsx`) sends both trees and switches by CSS.
  `/manage` is the Journal table on a desktop and "The Office" (`BoardHomeMobile`) on a phone. `/hub` has one
  tree that reflows.
- Roles are owner, guide, member only (`lib/auth.ts`). `/manage` requires owner or guide on every page.
- Hub cards are mostly links (`HubLinkCard`) to `/manage/*`. Only Documents, Gallery and Email open popups
  (`SurfaceCard` + `surfaces.open`). Custom popups register in `components/hub/HubSurfaces.tsx` `custom`; they are
  not URL-addressable (`serializeDescriptor` returns null for `custom`).
- Same task, several UIs: scheduling (SchedulePlanner/RepeatScheduler, DeparturesPanel, phone NewSlotsView/SlotView),
  place edit, new experience, tour media, stops (StopsEditor vs TourBuilder).
- Departures live in `booking_slots` (migration 274, `BOOKING_TABLES=1`); `tour_departures` is a rollback copy.
- Parts to reuse: cms-ui `WizardProvider` (steps, autosave, local draft), `SurfaceFrame` (`actions`, `status`,
  `rail`), `RailSteps`; MapLibre `PinMap`, `TourMap`, `PlaceSuggestions`, `PlaceSearch`, Photon
  `reverseGeocodeAction`, `suggestPlacesAction`, OSRM `refreshTourRoute`; the phone month grid and start times in
  `components/mobile/new-slots-view.tsx`; the experience wizard layout in `components/mobile/artist-wizard-view.tsx`.
- Missing: a tour city field, guide availability by date, per-author place notes (`places.private_notes` is one
  text column), per-guide takes on a tour (only `tour_stops.guide_notes` and per-run `tour_stop_notes`).

## Proposal

1. `/hub` is the office on every screen size. A "Office" band of six cards, each a `SurfaceCard` opening a custom
   surface. `/manage/*` pages stay as the full editors a popup links to ("Open full page"). The header's Manage link
   goes to `/hub`. The phone Office tree on `/manage` is retired once the hub covers it on a phone.
2. Cards:
   - Offer availability: days or weeks ahead, free text per day, "alert the office" (email to owners). New table.
   - Offer tour (schedule): month calendar, click dates, add start times; below, each date's departures with
     "add a time" and "change tour". Built from the NewSlotsView grid and `createSlots`.
   - Create tour: wizard Description → Route → Details, back and forth, autosaved as a draft tour.
     Description: city (Paris default), title, one-line summary, meeting point by pin or by a place on the map,
     price, cover, languages. Route: stop 1 = meeting point (or "Create place"), map centred on the last stop with
     nearby catalogue places; click → card → "Add to route"; "New place" by pin with suggested name and address;
     stop rows collapse and open to the place card with notes, media, duration; a Confirm route row. Details: a
     preview of the tour page with media order and captions per stop.
   - Add experience: card says "Coming soon".
   - Add place: pin or search or photo, suggested name/address, then tags, public copy, private notes, link
     (auto-filled from the establishment's website). Shows the creator; the place belongs to the org.
   - Personal takes on a tour: the Details step per guide; each stop can carry the guide's own notes beside the
     site's canonical text, shown on the tour page for runs that guide leads.
3. Data changes (migrations, after confirmation): `metadata.tour.city`; `place_notes` (place, author, body) readable
   by every owner and guide with the author named; `guide_availability` (user, date, part or times, note);
   `tour_guide_takes` (tour, stop, guide, body, media).

## Open items (2026-11-19)

- Not opened signed in by Claude (test owner account refused by the session's permission classifier).
- ~~Route dragging, Street View spot, availability, takes, place notes: not built~~ (built 2026-11-19, round 2).
- Stops do not use the place's Street View spot; the phone tour tree shows no guides' takes.
- Add experience: card disabled ("Coming soon").
- ~~The phone Office on `/manage` is not retired yet.~~ Retired 2026-11-19 (developer's go-ahead; live since the 21:45 EST rebuild `ufKzCgV2dNCTwHnKHF6S5`, not seen on a phone): on a phone
  `/manage` draws `ManageIndexMobile` (`components/mobile/board-server.tsx`): "Open the Hub" plus the manage
  pages (Schedule, calls to make when any, Suggestions, Share a post, Bookings, Tours, Places, Experiences,
  Fly-overs, Journal, Settings). The bottom bar's first tab is "Hub" (`/hub`, badge kept); the + sheet opens the
  hub popups in place (Create a tour, Offer a tour, Add a place, Offer availability; New experience and Share a
  post stay pages). `BoardHomeMobile` is kept in source, unused. The phone Schedule, Slot, New slots and
  below-minimum screens stay: the hub does not replace a run's guest list, cancel, run or reopen.
- Handoff findings 2 (a `place` surface kind) and 5 (one label voice): not done.

## Open questions

- Whether a guide's personal takes are public on the tour page or visible only to booked guests.
- Route line: OSRM walking route between stops with draggable waypoints, or hand-drawn lines.
- Whether guides may schedule any tour or only their own (slot-actions limits guides to their own; tour-actions does not).
