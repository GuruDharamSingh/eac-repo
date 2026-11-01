# Elkdonis Tours & Experiences — brief and state (2026-10-18)

A tour company in Paris run by Dana McCool, on its own app `apps/elktours`
(port 3021, org `elktours`). Built in one session on 2026-10-18 from the
amrit-canada template: tours as threads, dated departures with capacity,
party-size card bookings through the existing Stripe rail, a stop-by-stop
route presentation with a map and a Street View slot, and a manage console
for the guide. Name and domain are provisional. The source documents Dana
prepared (PDFs) had not arrived when this was written; the one tour on the
site is a labelled sample.

## Current state

### Decisions 2026-10-18 (developer)
- Name: "Elkdonis Tours & Experiences" (the business plan's spelling); `siteConfig.orgName` and `organizations.name` updated.
- Map: MapLibre GL on OpenFreeMap vector tiles (free, no key), with 3D building extrusions and pitched fly-to between stops; Cesium deferred.
- Content: the French Revolution walk entered from Dana's guide (`French_Revolution_Guide.docx`), plus the three circuits the plan names, all as **drafts**. Seed SQL kept at `apps/elktours/scripts/seed-drafts-2026-10-18.sql`.
- Launch scope: tours only (no workshops or lessons yet).
- Google Maps key: in `.env` as `GOOGLE_MAPS_API_KEY`; the developer enabled the APIs on 2026-10-18 and Street View renders in the page (verified by screenshot). Restrict the key by HTTP referrer once a domain exists.

### Look (2026-10-18 evening, developer's choice: "zinc and brass")
- Palette in `src/app/globals.css` (`:root`; `.dark` repeats it): zinc ground
  #2a2e35, ivory #f1ece2, brass #c9a25c for fills/marks/rules (ink #1b1e23 on
  brass), brass-light #dcc08a for links, vermilion #e8805c for danger and the
  route line. Contrast ratios are recorded in the CSS banner. The reading
  layer's `--read-*` tokens are set on `.eac-article`.
- Type: Inner Group's faces, copied to `public/fonts` from innergathering —
  Basteleur (body), Brothers (headings), Venture (kickers via the `font-mono`
  utility, letter-spaced). No Google Fonts; `layout.tsx` loads nothing.
- Traps found: the template's `text-primary-foreground` reads as "ink on brass"
  and is invisible on the zinc ground (fixed in the header and the active stop
  title); `background-attachment: fixed` on `body` left full-page captures
  white below the first viewport and is ignored on iOS — the ground is on
  `html`, the gradient on `body` without `fixed`. Turbopack panicked after the
  dependency churn (`inner_of_upper_lost_followers`); `rm -rf .next/*` inside
  the container and a restart cleared it.

### Data (migration 208, applied 2026-10-18; 210 applied the same day)
- `organizations.elktours`; owners: Dana (`danamccoolart@gmail.com`) and the
  developer. Feeds: `tours` (tour threads), `journal` (public), `general`.
- A tour is `threads.kind = 'tour'`, `section = 'tours'`: `price` (per person,
  major units) + `currency` (EUR), `duration_minutes`, `location` (meeting
  point), `metadata.coverImageUrl`, `metadata.tour` = `TourDetails`
  (`apps/elktours/src/lib/tours.ts`: highlights, includes, languages,
  meetingPoint {lat,lng}, maxParty, effort).
- `tour_stops` (ordered places; lat/lng; Street View pose heading/pitch/fov;
  photo; sanitised HTML body; `guide_notes` — the guide's private crib notes,
  migration 210, shown only in the manage console and `/manage/tours/<id>/notes`), `tour_departures` (starts_at, capacity,
  guide_user_id, status scheduled|cancelled), `tour_bookings` (one per card
  order: departure, party_size, buyer, status
  awaiting_payment|confirmed|cancelled, buyer_token).
- `tour` is in `OFF_FEED_KINDS` (`packages/services/src/thread-kinds.ts`) and
  `PURCHASABLE_THREAD_KINDS` (`packages/commerce/src/server/service-orders.ts`).

### Commerce (`packages/commerce/src/server/tours.ts`, exported from `/server`)
- `createThreadOrder` gained `quantity`: unit price × quantity, split on the
  total, `commerce_order_line.quantity` set. Other callers unchanged (default 1).
- `startTourCheckout` (`@elkdonis/checkout/booking`): checks seats, creates the
  card order, then `createTourBooking` re-checks under `SELECT … FOR UPDATE` on
  the departure. Unpaid bookings hold seats for `HOLD_MINUTES` (75).
- `confirmOrderPaid` calls `markTourBookingPaid` after commit (idempotent):
  booking → confirmed, emails buyer (ticket link `/bookings/<token>`) and the
  departure's guide (else the tour's author). Cancel paths email the buyer; no
  automatic refund (same policy as service bookings).
- Payee: the tour's author, via `resolveSettlement`; no org agreement, so the
  org share is 0%. Dana has no payout identity yet; until she onboards
  (`/manage/tours` → "Getting paid", Stripe Express, country FR) the tour page
  shows "Booking opens once they have set up how they are paid."
- Probe: `packages/commerce/scripts/probe-tour-booking.mts` (14 checks, no
  Stripe call, email disabled; self-cleaning). Passed 2026-10-18.

### App (`apps/elktours`, dev mode, `ELKTOURS_URL=http://192.168.0.11:3021`)
- Public: `/` (hero, tours, how it works, guides), `/tours`, `/tours/[slug]`
  (facts, body, highlights, the route: `TourStory` with a sticky MapLibre GL
  map (OpenFreeMap tiles, 3D buildings, pitched fly-to) + Street View slot
  that follows the stop in view; booking box),
  `/bookings/[token]` (+ `calendar.ics`), `/api/checkout/return` (reconciles,
  lands on the ticket page).
- Tour page hero (2026-10-18, late): the route preview is the hero of the tour
  page (`RoutePreviewLauncher hero`), full width, poster = cover image or the
  first stop's cached still; title, facts, body and booking follow. The cover
  image alone is the hero only for a tour with no placed stops. The lower
  "Preview the route" band was removed. Verified with viewport-sized shots
  (top, scrolled 700 px, phone): the sticky header does not cover content —
  the apparent overlap in earlier full-page captures was the capture, not the page.
- Route preview v2 (2026-10-18 evening, after the developer's notes on v1 — "no
  finesse, flat buildings"): `components/tours/route-preview.tsx` +
  `route-preview-launcher.tsx`, band above "The route" (`?preview=1` opens it).
  Renderers behind one `Renderer` interface: **Google photorealistic 3D**
  (Maps JavaScript API `maps3d`, `Map3DElement`, needs Map Tiles API on the key —
  enabled 2026-10-18) first, MapLibre extrusions as fallback. Camera: travels
  the cached street geometry at constant speed (10 s per leg, shorter for short
  hops; `easeTravel` trapezoid), tilt 70 / range 110 m, heading = direction of
  travel smoothed; arrival lifts to range 130, tilt 60, turning to the stop's
  Street View heading; then the card opens and one reused `StreetViewPanorama`
  tilts up from the pavement (pitch −22 → the stop's pitch, 1.8 s) over the
  cached still. Click-through: dots (★ overview), prev/next, ← → space; any
  click pauses. Verified 2026-10-18 by a still from headless Chrome (software
  WebGL, ~2 fps): photorealistic Tuileries, route line, card with live panorama.
  The developer asked for no video recording.
  Spend controls: 3D map created on Play only (one Immersive Maps event per
  play); one panorama instance per page (one Dynamic Street View event per
  play); stills and routes from the site's cache (below). `window.__previewNow`
  lets a recorder drive the clock; unset in normal use.
- Caches (migration 211 + `lib/tour-cache.ts`): `tour_stops.still_url` — one
  Street View Static image per stop at its pose, made on save (cleared when the
  pose changes), stored in the org's media folder; ceiling `STILLS_PER_DAY` = 150.
  `metadata.tour.route` — OSRM foot geometry per leg, refreshed on save of stops
  or meeting point. Warmer: `scripts/warm-cache.mts` (run 2026-10-18: 5 tours,
  30 stills, all routes from OSRM).
- Budget guards only the developer can set (asked 2026-10-18): per-day quotas in
  Cloud Console on Street View Static, Maps JavaScript map loads and Map Tiles;
  a billing budget with alerts; referrer restriction when the domain exists.
  Free allowances per SKU per month (2026): Static Street View 10,000; Dynamic
  Street View 5,000; Immersive Maps 5,000; Map Tiles 3D 1,000.
- Street View: `components/tours/street-view.tsx` → `street-view-pano.tsx`.
  Without `GOOGLE_MAPS_API_KEY` each stop shows its photo and a key-less "Look
  around in Street View" link (Maps URLs API). With the key the slot is a
  `StreetViewPanorama` from the Maps JavaScript API at the stop's pose; moving
  to another stop eases the heading round (1.2 s). The Embed API was not
  enabled on the key, so the embed path is unused. Compose passes the key as
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; recreate the container after setting it.
- Manage (`owner`/`guide`): `/manage/tours` (payouts card, list, feature /
  publish / archive), `/manage/tours/new`, `/manage/tours/[id]` tabs Details
  (form, Photon place search for the meeting point), Stops (editor with map
  preview and Street View preview), Departures (add several days at once,
  edit, cancel, manifest with per-booking cancel), `/manage/bookings`.
- Account page lists the signed-in person's tour bookings.
- `proxy.ts` upgrades http→https only when `NEXT_PUBLIC_APP_URL` is https
  (Next's dev server stamps `x-forwarded-proto: http` itself).

### Verified 2026-10-18
- `tsc` clean for the app, commerce and checkout.
- Probe above; seat hold, over-capacity refusal, duplicate-booking refusal,
  confirmation, buyer view, cleanup.
- Headless Chrome screenshots (1440 and 400 px) of `/`, `/tours`, the tour
  page (scrolled to a stop: map pins, route line, meeting-point star) and,
  signed in as a temporary owner, `/manage/tours`, the Stops and Departures
  tabs: no page errors, no horizontal overflow. Test account removed.
- Not verified: a real Stripe Checkout (the keys are live; no session was
  created), the emails as rendered, the Street View embed with a key.

## Rules and constraints
- Keep the payee the tour's author: a departure's `guide_user_id` says who
  leads, not who is paid. For paid employee guides, either make them the
  author of their tours or add an org agreement for the company's share.
- Mount the map only in a visible box (`TourStory` checks a media query):
  fitting bounds in a `display:none` container fails (Leaflet threw
  `Invalid LatLng (NaN, NaN)`; the MapLibre version keeps the guard).
- `guide_notes` must never reach a public page: the tour page strips it before
  passing stops to the client (`page.tsx`), and `listTours`/public reads should
  stay that way.
- Client components import formatting from `lib/tour-format.ts`, never
  `lib/tours.ts` (which imports the database).
- The sample tour (`montmartre-golden-hour-sample`, id `mzyc19DNtQCRsvTa7r3w`)
  is placeholder content; archive or replace it before launch.

## Open items
1. Content: the business plan (received) has prices and circuit names, not
   itineraries; the French Revolution guide (received) is entered as a draft
   with coordinates and headings estimated by hand — Dana to check each stop's
   position and Street View heading in the Stops tab, add photos, then publish
   and add departures. The three other circuits are outline drafts.
2. Dana: sign in, `/manage/tours` → Getting paid → country France → Stripe
   Express onboarding. Bookings open once Stripe enables payouts.
3. Google Maps key: done 2026-10-18 (JavaScript + Street View Static enabled).
   Add referrer restrictions when the domain exists; Map Tiles API only if the
   Cesium 3D option is pursued.
4. Domain: pick it, set `ELKTOURS_URL=https://…`, add to
   `ADDITIONAL_REDIRECT_URLS`, proxy host via `scripts/add-proxy-host.sh`, then
   switch the compose service to the production shape (ops.md).
5. Multi-guide: guides already hold `guide` and can be assigned to departures;
   each guide must author their own tours to be paid, or the company takes an
   agreement share. Decide the model before onboarding a second guide.
6. Virtual tour, parked by the developer 2026-10-18 after seeing v2: the
   photorealistic tiles are too coarse below ~100 m for the eye-level drive
   they want; options discussed were Unreal/Unity + Cesium (offline render) or
   three.js + 3d-tiles-renderer in-page (declined for now: "no third engine").
   Revisit after launch. Route preview follow-ups: hide Google's POI pins/labels in the 3D view if
   they distract; per-stop captions on the images; narration/music; a
   self-hosted OSRM (the public demo server has no SLA; a failure keeps the
   last cached route). Virtual-clock recording showed the movie reaching stop 4
   by ~22 s of player time, faster than the 10 s/leg design predicts — check
   leg pacing in a real browser before launch.
7. Not built: refunds from the console (issue from the order on the market
   host), waitlists, private/custom dates, reviews, multilingual pages, a
   journal entry template. (Palette: done, zinc and brass.)
8. Another session's untracked `packages/services/src/org-people.ts` imported
   `'./db'` (no such file) and broke every dev-mode app from 18:48; this session
   changed that one line to `'@elkdonis/db'`. Owner of that file to confirm.
