# Elktours: places, assets, fly-overs, experiences — spec (2026-11-02)

Author: Platform Manager agent. For: Web Engineer (UI) and Platform Engineer (schema and server). Read with
`ELKTOURS_BRIEF_2026-10-18.md` (2026-11-01 section), `ELKTOURS_PIPELINE_READINESS_2026-11-02.md` (PE: assets and render
requests, **adopted here**) and `ELKTOURS_CODE_MAP_2026-11-02.md` (constraints). Status: design. Nothing is built or migrated.

## 0. What exists (do not break)

- A tour is a `threads` row with `kind='tour'`, org `elktours`, feed `tours`. It carries `metadata.tour` (route, meetingPoint,
  highlights, ...) and a top-level `metadata.film = {url,url720,poster,seconds,source}`. Its thread id is also the ElkTourUnity
  folder id.
- `tour_stops` (208/210/211): 96 rows, 11 tours, **85 distinct titles** (Sainte-Chapelle is in 3 tours; 10 others are in 2).
  All rows have coordinates and `still_url`; none has `image_url`. `saveTourStops` (shared `packages/commerce/src/server/tours.ts`)
  upserts by id, keeps the list order as `position`, deletes missing rows, and clears `still_url` when the pose changes.
- "Street View" is the cached Static still plus the live pano (`street-view-pano.tsx`). The "3D map" is maplibre
  (`route-preview.tsx`, `tour-map.tsx`). Films and posters live in Nextcloud `EAC_Network/elktours/Media/{Videos,Images}`, served
  through `/api/media`.
- `threads_kind_check` was dropped (097), so new kinds need no constraint. `kind='service'` is the platform's sellable offering.
  Artists' public pages: `forumProfileUrl(slug)` (`src/lib/forum.ts:57`) gives the ArtDirect profile. There is no per-artist
  classifieds listing to link to.
- Popups: the shared card, popup and page system in `@elkdonis/cms-ui/surface`. elktours registers its own popups in
  `components/hub/HubSurfaces.tsx` through `connectors.custom`. **cms-ui is not edited in this pass.** `@dnd-kit` is already an
  elktours dependency.
- Testing: elktours runs `next dev`, and every save goes live on public `elkdonisexperiences.com`. Signed-in tests must use the
  **LAN URL** (port 3021) until the auth `.env` fix lands. Tour checkout is blocked today because Dana has no Stripe account.

## 1. Data model (migrations 233–236)

Claim each number by creating the file first. Re-check `ls packages/db/migrations` and `--status` right before applying, because
other sessions are migrating today.

| # | File | Owner | Contents |
|---|---|---|---|
| 233 | `tour_assets` | PE (readiness doc, Proposal a) | adopted as written, plus the url note below |
| 234 | `tour_render_requests` | PE (readiness doc, Proposal b) | adopted as written |
| 235 | `elktours_places` | PE | `places`, `tour_stops.place_id/experience_id`, `tour_assets.place_id`, `place_stats`, backfill |
| 236 | `elktours_experiences` | PE | feed row, `experience_people`, `service_commissions` |

**Reused:** threads (tours, experiences, the artist's service), tour_stops, departures/bookings, Nextcloud + `/api/media`, users,
user_organizations, org_feeds, site_config (Puck layouts).

### 1.1 `places`: the catalogue (235)
```
id uuid pk, org_id varchar(50) fk organizations, slug text, title text not null,
body text              -- public copy (sanitised HTML)
private_notes text     -- company notes, never rendered publicly
lat, lng double precision, heading numeric(5,1), pitch numeric(4,1), fov numeric(4,1)   -- default Street View pose
address text, tags text[] default '{}',
source text check in ('stop_backfill','manual','photon','overpass'), source_ref text   -- e.g. 'osm:node/123'
archived_at timestamptz, created_by uuid, created_at, updated_at
unique (org_id, slug); lat/lng pair check; index (org_id, lat, lng)
```
`tour_stops` gains `place_id uuid NULL fk places ON DELETE SET NULL` and
`experience_id varchar(21) NULL fk threads ON DELETE SET NULL`.

**Key decision: copy on pick.** A stop keeps its own title, body, pose and still. It is that tour's telling of the place, and the
live tour pages keep reading `tour_stops` with no change to the read path. `place_id` records where the stop came from. Picking a
place copies its fields into a new stop. In the builder, "Update catalogue from this stop" and "Reset stop to catalogue" are
explicit buttons, and nothing propagates on its own. `guide_notes` stays per stop. `places.private_notes` holds company knowledge.

**Backfill (idempotent):** one place per group of existing stops with the same `org_id` and normalised title
(`lower(trim(title))`), giving the 85 places. Body, pose and image come from the group's most recently updated stop;
`source='stop_backfill'`. Then set `tour_stops.place_id`. Slugs come from titles, with suffixes on collision.

**`saveTourStops` change (shared commerce code; PE only, minimal):** `TourStop`/`TourStopInput` gain optional `placeId` and
`experienceId`. The UPDATE and INSERT write them only when the key is present in the input (`undefined` leaves the column alone).
Other callers are therefore unaffected. Validate that the place or experience belongs to the same org.

**`place_stats` view:** per place:
- `tours_count` and `published_tours_count`: distinct tours with a stop linked to the place
- `runs_count` ("times visited"): past non-cancelled `tour_departures` of those tours
- `guests_count`: confirmed `party_size` summed over those runs
- `last_visited_at`
- `experiences_count`

It is computed when read; no counters are stored.

### 1.2 Asset registry: `tour_assets` (233, adopted; extended in 235)
Adopt the readiness doc as written:
- `thread_id` plus an optional `stop_id`;
- kinds `film|poster|image|still|map3d|streetview|document`;
- `role`, `variant`, `storage`/`storage_key`/`url`, `source`, `attribution`, `licence_note`;
- `visible` default false, `archived_at` history, `render_request_id`;
- `metadata.film` kept as the cache of the visible hero film, written in the same transaction;
- backfill of the 8 films, posters and stills with visible=true.

Additions for the catalogue and the toggles:
- **Live features have no file.** `map3d` (per tour) and `streetview` (per stop) are switches. Ask the PE to create `url` nullable
  in 233, with `CHECK (url IS NOT NULL OR kind IN ('map3d','streetview'))`. Backfill one visible `map3d` row per tour and one
  visible `streetview` row per stop, so the toggles exist and nothing changes on screen.
- **Place assets (235):** add `place_id uuid NULL fk places ON DELETE CASCADE`, make `thread_id` nullable, and add
  `CHECK (thread_id IS NOT NULL OR place_id IS NOT NULL)`. These are the catalogue's reusable media (photos, a good still, later
  scan3d). When a place is picked, its assets are offered in the stop's asset panel. Choosing one copies it into a stop row
  (same url, `meta.fromPlaceAssetId`), so visibility stays per tour.
- **Experiences:** an experience is a thread, so its images use `thread_id`, `kind='image'`.
- **Public read:** `visible AND archived_at IS NULL`. Dana uses this single switch. The tour page reads hero film, poster and
  map3d/streetview switches through one `publicTourAssets(threadId)`.
- **Files:** existing files stay where they are. New ones go under `EAC_Network/elktours/Media/{Tours/<threadId>,Places/<placeId>,
  Experiences/<threadId>}/`. Undelivered or draft renders go under `Private/Media/...`, and making them visible copies them to
  public (readiness doc).
- **Terms:** films stay ≤30 s, uncropped, with the Google credit and "For promotional purposes only". The card and background
  credit line stays. Not a blocker: storing Street View Static stills is outside Google's usual terms, so the PE should check it.

### 1.3 Fly-over requests: `tour_render_requests` (234, adopted)
Adopt the readiness doc's table, lifecycle and worker API:
- `requested → accepted → claimed → rendering → delivered`, plus `failed | rejected | cancelled`;
- payload frozen at accept; heartbeat re-claim;
- `apps/elktours/scripts/render-jobs.mts` claim/heartbeat/complete/fail;
- delivered films land private, visible=false; `auto_publish` defaults to off.

This is an automated pipeline, not a to-do for a person. How the PC receives work is out of scope here. Additions:
- **Stop snapshot entries:** `{id, position, title, lat, lng, placeId, experienceId}`, so a film can later be credited to the
  places it shows. Never include stills or Street View data.
- **Style hints (editors):** `{camera:'mapcam', routeLine:'waveform', highlights:false, timeOfDay?, aspect?:['16:9'],
  emphasizeStopIds?: string[], notes?}`. The server fixes `limits.maxSeconds = 30`.
- **Who requests:** Phase A, editors only (`/manage/tours/[id]/flyover` and a button on the tour Edit bar). The visitor request
  form with rate limiting is Phase B.
- **Who accepts:** elktours owners (Dana, Justin). See Q2.
- **Stale film (Phase B):** the delivered film asset keeps `meta.payload_sha256`. The asset panel shows "Film is older than the
  route" when the current route and stops hash differs.

### 1.4 Experiences (236)
- `threads.kind='experience'`, org `elktours`, new public feed `experiences` (sort 2). Add `experience` to `OFF_FEED_KINDS`
  (`packages/services/src/thread-kinds.ts:41`, a one-line network-wide edit; PE). Do **not** add it to `SurfaceKind`,
  `SCHEDULED_KINDS` or `PURCHASABLE_THREAD_KINDS` in this pass.
- Columns used as on events: title (the only required field), body, excerpt, cover image, location, is_online,
  duration_minutes, price/currency (display only).
- `metadata.experience = {format:'in_person'|'online'|'hybrid', serviceThreadId?, highlights?: string[]}`.
- `metadata.page` is optional Puck Data for this experience's page. NULL means the default layout from `site_config`
  `puck:experience-detail`.
- **`experience_people`** `(thread_id fk threads ON DELETE CASCADE, user_id fk users, role check in ('artist','host'), position
  int, pk (thread_id,user_id,role))`.
  - Artists are linked, not copied. Name and avatar come from `users`.
  - "Artist profile" links to `forumProfileUrl(users.slug)` (ArtDirect). It links to their service page when
    `serviceThreadId` is set.
  - The host is the person who guides the visit.
- **As a stop:** set `tour_stops.experience_id` and copy title, body and pose (the same copy-on-pick rule). An online experience
  is a stop without coordinates. The route and still code already skip those.

### 1.5 Service listing and commission (236; payments are a STUB, neutral on who sells)
- The **service listing** is the artist's own public `kind='service'` thread, homed where the artist publishes. Elktours does not
  own it. `metadata.experience.serviceThreadId` links the curated experience to it.
- A **`service_commissions`** row records that an org booked an artist's public listing at the listed price. The terms are the
  same as for any org; it is not a Dana-only deal. Dana's curation function appears only as `buyer_org_id`.
```
id uuid pk, service_thread_id fk threads, seller_user_id uuid fk users, buyer_org_id varchar(50) fk organizations,
requested_by uuid, experience_thread_id NULL fk threads, tour_thread_id NULL fk threads, departure_id NULL fk tour_departures,
unit text check in ('per_run','per_guest','flat'), quantity int default 1,
price_cents int, currency text           -- snapshot of the listed price at proposal
terms_snapshot text, status text check in ('proposed','accepted','declined','cancelled','completed') default 'proposed',
payment_status text not null default 'stub' check (payment_status = 'stub'),   -- NO MONEY PATH: see Q1
payment_ref text NULL, created_at, updated_at, responded_at
```
No split, no transfer, no order. Two payment models remain open (Q1), and either can attach later through
`payment_ref`/`payment_status`:
- the artist sells their part directly: a destination charge to their Stripe account, with any agreed org share as the
  application fee;
- a bundled tour order with mixed payees: a real build of multi-line orders plus transfers, deferred.

Rule from commerce: never give an org a connected account.

## 2. Suggestions (new places, and stops inside tour creation)
Shown in this order:
1. **Own catalogue:** places within 600 m of the last stop or the map centre, or matching the text.
2. **Photon** (`PHOTON_URL`, currently the public komoot instance): text search, as now.
3. **Overpass:** named POIs within 400 m. Tags: `tourism=attraction|museum|artwork|viewpoint`, `historic=*`,
   `amenity=place_of_worship|theatre`.

Both OSM sources are free, with fair-use limits and ODbL attribution ("© OpenStreetMap contributors" under the list). Cache
Overpass results by rounded bbox for 7 days in redis. If volume grows, self-host.

**Google Places was rejected:** it is billed per call, and its terms forbid storing place content beyond `place_id`, which breaks
a catalogue.

Picking a suggestion creates a `places` row (source `photon`/`overpass`, `source_ref`) and the stop.

## 3. Surfaces and routes
Popups are elktours-local custom surfaces (keys `tour`, `experience`, `place`) in `HubSurfaces.tsx`. Tabs are local markup and
cms-ui is untouched. Cards open the popup, and the popup's "Open page" goes to the detail page.

| | Listing | Card | Popup | Detail |
|---|---|---|---|---|
| Tour | `/tours` (exists) | `TourCard` (exists, now opens popup) | **Overview** (visible poster/film, intro, facts) · **Stops** (ordered: still, title, excerpt, mini map; experience stops badged) · **Dates** (next departures; Book when checkout works) | `/tours/[slug]` (exists, Puck blocks) |
| Experience | `/experiences` | `ExperienceCard` (cover, title, artist chip, format/place) | **Overview** · **Artist** (linked people + ArtDirect link) · **In tours** | `/experiences/[slug]` (`blocks/experience/`, default layout or `metadata.page`); inquiry form |
| Place (private) | `/manage/places` | catalogue row | public copy, private notes, stats, assets, tours using it | `/manage/places/[id]` |

**Manage screens (elktours editors):**
- `/manage/places`
  - Search and filter (tag, used or unused).
  - A row expands inline to public copy, private notes, stats (tours, runs, guests, last visited) and asset thumbnails.
  - "New place" uses the suggestions.
- `/manage/tours/[id]/stops`: the **tour builder**.
  - Left: the stop list, reordered by dnd-kit drag, with the Up/Down buttons kept for keyboard use.
  - Middle: the map.
  - Right: a picker with tabs **Catalogue · Experiences · Suggestions · New**.
  - Saves through `saveStopsAction` with `placeId`/`experienceId`.
- `/manage/tours/[id]/assets`
  - The tour's assets, then one row per stop.
  - Each asset shows its kind, source, status and attribution, with a **visible** switch, preview, replace and upload.
  - The offered place assets appear here too.
- `/manage/tours/[id]/flyover`: the open request's state timeline, the "Request fly-over" form (style hints), and the history.
- `/manage/flyovers`: the queue across tours. Owners accept or reject, cancel, and re-queue a failed request.
- `/manage/experiences`, `/manage/experiences/new`, `/manage/experiences/[id]`: the form, with artist and host pickers drawn from
  org members and a picker for the artist's service thread.
- `/manage/commissions`: Phase B UI. Phase A ships only the table and server functions.
- `/studio/experience/[id]` and `/studio/tour-detail`: `<Puck>` over the block configs, behind a **"Work in progress — layout
  edits may not be kept"** banner. Open to editors and, for an experience, its linked artists.

## 4. Phasing

### Phase A (this session)
**Platform Engineer** owns schema and server: `packages/db/migrations/233-236`, `packages/commerce/src/server/tours.ts`,
`packages/services/src/thread-kinds.ts`, `apps/elktours/package.json`, `apps/elktours/scripts/render-jobs.mts`, and
`apps/elktours/src/lib/**`.
- Migrations 233–236 with backfills.
- The `saveTourStops` placeId/experienceId change.
- `OFF_FEED_KINDS` += `experience`.
- **One** coordinated Puck install: `@elkdonis/page-builder` (workspace) + `@puckeditor/core` pinned `0.23.0`, then the container
  install.
- New `lib/` modules:

| Module | Functions |
|---|---|
| `places.ts` + `place-actions.ts` | list, get, save, archive, stats, updateFromStop, resetStop |
| `assets.ts` + `asset-actions.ts` | `listAssets({threadId\|stopId\|placeId})`, `setAssetVisible`, `upsertAsset`, `publicTourAssets` |
| `render-requests.ts` + `render-request-actions.ts` | request, accept, reject, cancel |
| `experiences.ts` + `experience-actions.ts` | (experience reads and writes) |
| `commissions.ts` | propose, respond; payment stub |
| `suggest.ts` | `suggestPlaces({q?, near?})` |

- `lib/tours.ts` reads the hero film, poster and live-feature switches from `publicTourAssets`. The `patchTourAction` film upload
  writes an asset and the `metadata.film` cache.
- **Ships first:** type exports in `lib/types.ts` (`Place`, `PlaceStats`, `TourAsset`, `RenderRequest`, `Experience`,
  `ExperiencePerson`, `PlaceSuggestion`, `ServiceCommission`), so the Web Engineer can start straight away.

**Web Engineer** owns UI only.
- Components:
  - `components/hub/HubSurfaces.tsx` (register `tour`, `experience`, `place`)
  - `components/tours/{tour-card,tour-popup}.tsx`
  - `components/experiences/*`
  - `components/places/*`
  - `components/manage/{tour-builder,asset-panel,flyover-panel,experience-form,place-search}.tsx` (`tour-builder` replaces
    `stops-editor` on the page; keep the old file until verified)
- Routes:
  - `app/experiences/**`
  - `app/manage/places/**`
  - `app/manage/tours/[id]/{stops,assets,flyover}/page.tsx`
  - `app/manage/experiences/**`
  - `app/manage/flyovers/page.tsx`
  - `app/studio/**`
- Also: `blocks/experience/**`, and nav entries in `manage/layout.tsx` and `site-header.tsx`.
- Does not touch `lib/**`, migrations, packages or package.json.

**Done (verified signed-in on the LAN URL):**
- Pick from the catalogue, drag to reorder, save, and see the new order on the public page.
- The film toggle hides the film on the page.
- A fly-over request appears in `/manage/flyovers` and can be accepted.
- An experience is created and works as a card, a popup and a page.
- The tour popup's Stops tab lists the stops.
- `/studio/*` loads behind its banner.

### Phase B
- The visitor fly-over request form.
- Stale-film badge.
- Per-experience fly-overs.
- The commissions UI (the artist answers from their account).
- Artists really editing experience pages in Puck.
- Reordering stops from the public Edit bar.
- Booking for experiences, if Q4 says yes.
- An optional public `/places/[slug]`.

### Later
- The commission payment model (Q1), including mixed-payee tour orders.
- The for-profit agency (a separate track).
- Self-hosted Photon/Overpass.
- scan3d splats as place assets.

## 5. Open questions for Justin (only the ones that block something)
1. **Commission payments: who is the seller?** Option one: the artist sells their part directly to the client, as a
   destination charge to their own Stripe account. Option two: one tour order with mixed payees (the platform charges, and the
   artist is paid first by transfer). The data model is neutral; this blocks only the money path. Dana also needs a payout route
   before any tour checkout works.
2. **Who accepts fly-over requests:** elktours owners (the default), only you because it is your PC, or auto-accept? This sets
   the accept permission and `auto_publish`.
3. **Catalogue edits: copy on pick (the default) or live propagation to every tour using the place?** Propagation means changing
   the read path on live tour pages.
4. **Experiences in Phase A: inquiry only (the default), or bookable with dates and checkout like tours?**
5. **Delivered films: hidden until Dana toggles them (the default), or shown at once?**


## Phase A — Web Engineer (done)

Web Engineer plus two sub-workers, 2026-11-02. UI only. Nothing was committed. No changes to `lib/**`, migrations, packages,
package.json, `.env` or docker-compose. All paths are under `apps/elktours/src`.

### Routes and components
**Popups.** These are registered in `components/hub/HubSurfaces.tsx` under `connectors.custom`. The tabs are local markup
(`components/surfaces/surface-tabs.tsx`, the same pills as ProfileSurface), so cms-ui is untouched.
- `tour`: `components/tours/tour-popup.tsx`, data from `app/api/surfaces/tour/[id]/route.ts`.
  - Overview: the film (uncropped, with the Google credit) or the poster, the excerpt, the facts and the highlights.
  - Stops: a MapLibre mini map with numbered pins, then each stop's still, title and excerpt. Experience stops are badged and
    open the experience popup.
  - Dates: the next 8 departures. The Book button appears only when booking is available.
  - Drafts are shown to editors only. `guide_notes` never leave the server.
- `experience`: `components/surfaces/experience-popup.tsx`, data from `app/api/surfaces/experience/[id]`.
  - Tabs: Overview · Artist (ArtDirect profile links and the service link) · In tours (each opens the tour popup).
  - The primary action is "Ask about it" (inquiry only).
- `place`: `components/surfaces/place-popup.tsx`, data from `app/api/surfaces/place/[id]`.
  - The data route is editor-only and answers 404 to everyone else.
  - Tabs: public copy, private notes, stats, assets, tours.

**Tour card.** `components/tours/tour-card.tsx` opens the tour popup on a plain click. Ctrl/cmd-click, middle-click and no-JS
still go to `/tours/[slug]`.

**Assets tab.** `/manage/tours/[id]/assets` (`components/manage/asset-panel.tsx`).
- The whole tour first, then one block per stop.
- Each row shows the kind, source, private-file flag, attribution, a preview, Replace, Remove and the **visible** switch.
- Uploads go to Private media and start hidden.
- A stop's place assets are offered there with "Use for this stop".

**Fly-over.** `/manage/tours/[id]/flyover` (`flyover-panel.tsx` and `flyover-status.tsx`).
- The open request appears as a timeline: requested → accepted → picked up → rendering (progress bar) → delivered, plus the end
  states failed, rejected and cancelled.
- The form sends style hints only: light, formats, stops to linger on, and notes.
- History is shown below. The page polls every 15 s while a request is open.

**Queue.** `/manage/flyovers` (`flyover-queue.tsx`).
- Owners accept (with a "Show on delivery" box, off by default), reject (with a reason), cancel, and re-queue failed requests.
- Others can only cancel.

**Navigation.** `components/manage/tour-subnav.tsx` gives tour pages a shared header with Details · Stops (goes to the builder)
· Assets · Fly-over · Departures.
- `?tab=stops` still opens the old `stops-editor` until the builder is verified.
- The tour Edit bar gained Assets and "Request fly-over" links.
- The `/manage` nav gained Places, Experiences and Fly-overs.
- The header's "Experiences" entry comes from the new `experiences` org_feed row, so `site-header.tsx` was not edited.

**Worker 1 (catalogue and builder).**
- `/manage/places` and `/manage/places/[id]`, built from `components/places/*` (catalogue with search, tag and used/unused
  filters; expanding rows; suggestions with the OSM credit; place form).
- `/manage/tours/[id]/stops` with `components/manage/tour-builder.tsx` and `tour-builder/*`:
  - dnd-kit drag plus Up/Down buttons;
  - map and Street View;
  - picker tabs Catalogue · Experiences · Suggestions · New;
  - copy on pick;
  - Reset to catalogue and Update catalogue.
- The builder saves through `saveStopsAction` and sends `placeId`/`experienceId` only when they are known.

**Worker 2 (experiences).**
- `/experiences` and `/experiences/[slug]`, drawn by `blocks/experience/*` (Puck-shaped blocks; the page uses `metadata.page`,
  else the default layout).
- `components/experiences/*`: the card opens the popup; also people chips, the inquiry form and row actions.
- `/manage/experiences`, `/new` and `/[id]`, using `components/manage/experience-form.tsx`.
- `/studio/tour-detail` and `/studio/experience/[id]`: **placeholder pages** with the "Work in progress — layout edits may not
  be kept" banner. Puck is not installed (not in package.json or node_modules).

### Verified, and how
- `pnpm -s check-types` in the container: 0 errors after every chunk and after the final integration.
- The public domain returned 200 for `/`, `/tours`, `/tours/heritage-de-napoleon-bonaparte` and `/experiences` after each edit.
  One 502 came from a container restart by another session, and the site recovered with no change from us.
- Signed out on the LAN (`localhost:3021`):
  - every new `/manage/*` and `/studio/*` route answers 307 to login;
  - `/api/surfaces/place/x` answers 404;
  - `/api/surfaces/tour/<id>` returns real tour, stop and departure JSON.
- Playwright, signed out, on the public domain:
  - clicking a tour card opens the popup without navigating;
  - Overview shows the film and credit;
  - the Stops tab lists 6 stops with stills, and the map pins appear after the `tour-story.css` import;
  - `/experiences` shows its empty state.
- Screenshots: `C:\Users\Justi\AppData\Local\Temp\.playwright-mcp\elktours-02-tour-popup-overview.png`,
  `elktours-03-tour-popup-stops.png`, `elktours-04-experiences.png` (Justin's PC).
- **Not verified signed in.** No session was available to us on the LAN URL. None of the "Done" checklist items that need an
  editor (pick and reorder then save, film toggle, request and accept, create an experience) has been exercised.

### Gaps
- **Most of the lib is still CONTRACT stubs that throw.** That covers `places`, `place-actions`, `assets`, `asset-actions`,
  `render-requests`, `render-request-actions`, `experiences` and `experience-actions`.
  - Until they are implemented, the pages show "not available yet" notes.
  - The experience and place popups return 503.
  - The builder offers only Suggestions (Photon) and New.
  - Public-page logs were downgraded to `console.warn`, so the dev "Issue" badge does not show to visitors.
- Requests for the Platform Engineer:
  - `TourStop` reads must carry `placeId`/`experienceId`.
  - Batch `listPlaceUsage(ids[])` and `listAssets({placeIds})`: `/manage/places` makes 2 queries per place today.
  - A lib loader for `site_config` `puck:experience-detail`.
  - Confirm that `upsertAssetAction` with `visible: true` publishes a Private file.
  - Confirm that `listExperiences()` returns published experiences only by default.
  - `Experience` has no pose (heading, pitch, fov), so experience stops get none.
- Puck is not installed, so `/studio/*` are placeholders.
- The popup mini map fits the route loosely, because `TourMap`'s overview fit is tuned for the large map.
- The stops of the Napoléon tour have empty bodies, so the popup shows no excerpts (a data gap, not a UI bug).
- Builder caveats (Worker 1):
  - A rich-text `onChange` on mount may mark a stop unsaved; check this signed in.
  - Edits made while a save is running are lost when the list reloads.
- The stale-film badge reads `meta.stale` and is a Phase B placeholder.


## Phase A — Platform Engineer (done)

2026-11-02, Platform Engineer (claude). Nothing committed. `.env` and docker-compose were not touched.

### Migrations applied: 233, 234, 235, 236
All four files are in `packages/db/migrations/`. `--status` was clean right before applying (232 was the last), and all four applied OK.
- **233 `tour_assets`**: as in the readiness doc. `url` is nullable, with `CHECK (url IS NOT NULL OR kind IN ('map3d','streetview'))`. Also has the one-visible-hero-film unique index and the `tenant_isolation` RLS policy (227 pattern).
- **234 `tour_render_requests`**: as in the readiness doc, plus the FK from `tour_assets.render_request_id`, a one-open-request-per-tour unique index, and RLS.
- **235 places**: adds `places` (with RLS), `tour_stops.place_id` / `experience_id`, `tour_assets.place_id` (`thread_id` is now nullable, with an owner CHECK), the `place_stats` view, and `geo_suggest_cache`. Deviation: the 7-day suggestion cache lives in Postgres, not redis, because elktours has no redis client dependency.
- **236 experiences**: adds the `experiences` org feed (sort 2), `experience_people` and `service_commissions` (`payment_status` CHECK = `'stub'`). No RLS on these two because they have no `org_id` column.

### Backfill counts (idempotent)
Each backfill was dry-run twice in one rolled-back transaction, and the second pass added nothing.
- `tour_assets`, 227 rows, all `visible=true`:
  - 8 tours × film 1080 + film 720 + poster = 24 rows (`metadata.film.assetId` written back);
  - 96 `still` rows;
  - 11 `map3d` rows;
  - 96 `streetview` rows.
- `places`: 85 rows (`source='stop_backfill'`, unique slugs). All 96 `tour_stops` rows have `place_id` set.

### Files
- `apps/elktours/src/lib/catalogue-types.ts`: all the contract types. `lib/types.ts` re-exports them with `export type *`.
- `apps/elktours/src/lib/places.ts`: `listPlaces` (filters q/tag/used/near), `getPlace`, `getPlaceStats`, `listPlaceUsage`, **`listPlaceUsageMany`** (batch), `listPlaceTags`, `stopDraftFromPlace`, `uniquePlaceSlug`, `distanceM`.
- `apps/elktours/src/lib/place-actions.ts`: list, save, archive, `pickPlaceAction`, `pickSuggestionAction`, `updatePlaceFromStopAction`, `resetStopToPlaceAction` (returns a draft; save through `saveStopsAction`), `createPlaceFromStopAction`, `suggestPlacesAction`.
- `apps/elktours/src/lib/assets.ts`:
  - reads: `listAssets`, **`listPlaceAssetsMany`** (batch), `getAsset`, `publicTourAssets`;
  - writes: `upsertAsset`, `setAssetVisible`, `archiveAsset`, `writeFilmCache`, `syncHeroFilmFromUrls`, `copyPlaceAssetToStop`.
  - Showing a `Private/` file copies it with WebDAV COPY to the public twin path and repoints the row. Showing or hiding the hero film rewrites `metadata.film` in the same transaction.
- `apps/elktours/src/lib/asset-actions.ts`: list, visible switch, upsert, archive, copy-place-asset-to-stop.
- `apps/elktours/src/lib/render-requests.ts`:
  - reads, `normaliseStyle` and `buildRenderPayload`;
  - `buildRenderPayload` checks: route present, 2–40 stops, Paris bounding box, route ≤ 10 km, `maxSeconds: 30`, no stills or Street View data;
  - lifecycle: create, accept (freezes the payload and its sha256), reject, cancel, requeue;
  - worker side: `claimNext` (`FOR UPDATE SKIP LOCKED`, 20-min stale re-claim), `heartbeat`, `failJob` (retryable codes go back to the queue).
- `apps/elktours/src/lib/render-request-actions.ts`: editors request. Owners accept, reject and requeue (`ACCEPT_ROLES`). Cancel is open to the requester or an owner. `autoPublish` defaults to false.
- `apps/elktours/src/lib/experiences.ts`: list, by slug, by id. `listExperiences()` returns **published + PUBLIC only** unless `includeDrafts`. Also `listExperienceTours`, `listPersonOptions` (elktours members + oad artists), `listServiceOptions`, `stopDraftFromExperience`, `isExperiencePerson`.
- `apps/elktours/src/lib/experience-actions.ts`: save, status, people, `saveExperiencePageAction` (editors or linked people), pick, people search, service options, and `sendExperienceInquiryAction` (public; emails the owners and hosts).
- `apps/elktours/src/lib/experience-layout.ts`: `loadExperienceLayout` (`site_config` `puck:experience-detail`, else the default), `resolveExperienceLayout(page)`, `saveExperienceLayout`.
- `apps/elktours/src/lib/commissions.ts`: propose (snapshots the listed price and terms), respond (seller), cancel/complete, list. No money path.
- `apps/elktours/src/lib/suggest.ts`: catalogue (600 m / text), then Photon, then Overpass (400 m, 3 public endpoints tried in turn). Results are de-duplicated and carry the OSM attribution.
- `apps/elktours/src/lib/tours.ts`:
  - `TourFull.assets` (from `publicTourAssets`);
  - `TourFull.film` now comes from the visible hero asset, so hiding the film asset hides it on the page and the popup.
- `apps/elktours/src/lib/tour-live-actions.ts`: the film bar's `patchTourAction` registers the film and poster as the visible hero asset set (`syncHeroFilmFromUrls`).
- `apps/elktours/scripts/render-jobs.mts`: `claim`, `heartbeat`, `complete <id> <dir>`, `fail`, `show`. The usage is in the file header.
  - `complete` re-checks the gates (payload hash, ≤30 s, all checks true, real mp4/jpeg of a sane size).
  - It uploads to `Private/Media/{Videos,Images}` and registers the 3 assets **hidden**, with `render_request_id` set.
  - With `auto_publish` it makes the 1080 film the visible hero.
- Shared, minimal:
  - `packages/commerce/src/server/tours.ts`: `TourStop` gains `placeId` / `experienceId` (so the builder sees the backfilled links). `TourStopInput` makes them optional, and they are written only when the key is present. Same-org check.
  - `packages/services/src/thread-kinds.ts`: `OFF_FEED_KINDS += 'experience'` (one line).
  - `git diff` on both files was clean before the edit and shows only these lines after it.
- Puck:
  - `apps/elktours/package.json` adds `@elkdonis/page-builder` (`workspace:*`) and `@puckeditor/core` `0.23.0`, plus **`@tiptap/core ^2.8.0`**. Without the tiptap pin, Puck's tiptap 3 became the peer of elktours' tiptap 2 editor.
  - `next.config.ts` `transpilePackages` += page-builder and blocks.
  - The lockfile diff only adds the elktours entries and Puck's packages.

### Checks
- elktours typecheck (`docker exec -w /app/apps/elktours eac-elktours pnpm -s check-types`): **0 errors** after every chunk and after the install.
  - The `packages/commerce` typecheck shows 2 errors in `services/src/gather.ts`. They come from another session's file, not this work.
- Health after each chunk: `/` 200, the Marais tour page 200 and `/experiences` 200 on :3021; `https://elkdonisexperiences.com/` 200. `/manage/*` and `/studio/*` return 307 to login when anonymous.
- Install: the LAN status for the 13 app ports was recorded before the install and re-checked after both install runs. Results were identical: 3000/3001/3007/3008/3009/3012/3013/3015/3018/3020/3021 200, 3006 308, 3019 404 (already 404 before).
- Lib smoke run:
  - 85 places with stats; the near-point search works.
  - `publicTourAssets` shows a film for the 8 published tours.
  - Payloads build for all 10 non-archived tours.
  - The open-request dedupe holds.
  - claim → heartbeat → retryable fail → re-queue → final fail all work.
- End-to-end `render-jobs.mts` on the draft Latin Quarter tour with dummy files:
  - accept → claim → heartbeat → complete gave 3 hidden private assets;
  - `setAssetVisible` copied them to public `Media/` (served 200) and wrote `metadata.film`;
  - hiding cleared the cache;
  - test rows and Nextcloud files were deleted afterwards.
- `/api/surfaces/tour/<id>` returns 200. `/api/surfaces/place/<id>` and `/api/surfaces/experience/<id>` return 404 anonymously, by design. Nothing returns 503 now that the stubs are gone.

### Left / notes
- **Experience stops have no Street View pose**: `stopDraftFromExperience` gives heading/pitch/fov = null. An online experience also has no lat/lng, so the route and stills skip it.
- **Overpass**: every public instance tried was at capacity or timing out during testing (502/504/timeouts). Suggestions fall back to the catalogue and Photon. Failures are not cached, so Overpass items appear once an instance answers. Set `OVERPASS_URL` or self-host if this persists.
- The Web Engineer's `/manage/places` page can switch to `listPlaceUsageMany` / `listPlaceAssetsMany` (one query each instead of 2 per place).
- Not done:
  - the PC side (`Tools/autorender.mjs`) — the sub-worker was not used;
  - the visitor request form, rate limiting and the stale-film badge (Phase B);
  - the commissions UI;
  - an HTTP worker API.
- Photon/Overpass and Street View Static terms: stills are registered with a licence note marking storage as under review (spec §1.2).
- The tours' own `updated_at` changes when the film cache is rewritten.


## Phase A — Web Engineer round 2

Done after the Platform Engineer shipped the lib, `TourStop.placeId/experienceId` and Puck 0.23.0. UI only. Nothing was committed, and
there were no lib, package or package.json edits.

### Changes
1. **`/manage/places` batch reads:** the page now makes one `listPlaces` call plus `listPlaceUsageMany(ids)` and
   `listPlaceAssetsMany(ids)`. It used to make 2 queries per place (about 170 for 85 places).
   - `/manage/tours/[id]/assets` uses `listPlaceAssetsMany` for the place assets it offers, and reads `s.placeId` directly
     instead of casting.
2. **Puck studio.** The placeholders are gone, and every page is editor-only (`requireOrgEditor`, checked again in each publish
   action). The editors are full-screen and keep the amber "Work in progress — layout edits may not be kept" bar, a back link
   and a note naming the sample shown.
   - `components/studio/layout-studio.tsx` mounts `<PuckEditor>` from `@elkdonis/page-builder` (the danamccool pattern) inside
     `TourPageProvider` or `ExperiencePageProvider`, so the blocks draw a real sample.
   - `components/studio/puck-data.ts` and `components/studio/experience-sample.ts` are new helpers. The experience sample falls
     back to clearly marked sample text while no experience exists.
   - `app/studio/actions.ts` holds the publish actions:
     - Tour layout: cleaned by `readTourLayout`, then `savePage(org, "tour-detail")`, which writes `site_config`
       `puck:tour-detail`, the key `loadTourLayout` reads.
     - Default experience layout: `readExperienceLayout`, then `saveExperienceLayout`.
     - One experience: `readExperienceLayout`, then `saveExperiencePageAction`.
   - Routes:
     - `/studio/tour-detail`: `tourConfig` over a sample tour, by default the first published tour with a film; `?tour=<slug>`
       picks another. Guide notes are stripped, and the page's own Edit bar is off.
     - `/studio/experience-detail` (new): the site default, through `lib/experience-layout.ts`.
     - `/studio/experience/[id]`: one experience's `metadata.page`, starting from the default. Editors only in Phase A; artists
       editing their own page stays Phase B.
   - Links: "Page layout" on `/manage/tours`, and "Default page layout" on `/manage/experiences`. The experience row and edit
     links to `/studio/experience/[id]` already existed.
   - The unused `components/experiences/studio-shell.tsx` was deleted.
   - `/experiences/[slug]` now draws through `resolveExperienceLayout`: the experience's own page, else the site default, else
     the built-in layout. Its PE TODO is closed.
3. **Dead fallbacks removed.**
   - The `NotReady` component and its uses on the assets, fly-over and fly-overs pages.
   - The "not live yet" branches in `/manage/places`, `/manage/places/[id]` and `/manage/experiences`.
   - The builder's nullable catalogue and experiences props, and the picker's `catalogueReady`/`experiencesReady` flags.
   - The builder's "Added as a plain stop" catch: a failed `pickSuggestionAction` is now an error toast.
   - The inquiry form's fallback to `/api/inquiry`: `sendExperienceInquiryAction` is the only path.
   - Kept on purpose: the public `/experiences` pages still catch and log with `console.warn`, so a database error shows an empty
     state instead of a 500 on the public site.

### Verified, and how
- `pnpm -s check-types`: 0 errors after each of the 5 chunks.
- The public domain returned 200 for `/`, `/tours` and `/experiences` after each chunk.
- On the LAN, `/studio/tour-detail`, `/studio/experience-detail` and `/studio/experience/x` each answer 307 to login signed out,
  and the modules compile (no errors in the logs).
- Real data (SQL, read-only):
  - 85 places, with 85 `place_stats` rows; Sainte-Chapelle shows 3 tours.
  - 96/96 stops have a `place_id`.
  - 227 `tour_assets`, all visible.
  - 0 experiences, 0 render requests, and no `puck:*` rows yet.
- **Not verified signed in.** There is still no editor session on the LAN URL. I did not mint one, because forging a session
  for Justin's account was not authorised. So the following were not exercised in a browser:
  - the builder's Catalogue and Experiences tabs;
  - the place popup (editor-only);
  - the experience popup;
  - the Puck canvas: whether the provider context reaches the iframe, and the editor's height inside the fixed frame.
- The experience paths cannot be checked with real data until an experience exists. There are none.

### Gaps
- Signed-in checks are still owed for everything above, plus the round 1 "Done" list.
- Puck canvas styling is unverified. Puck copies the host's styles at mount, and the tour blocks' CSS comes from the root layout
  plus `tour-story.css`, which the popup and the tour page import.
- `/studio/tour-detail` publishes to the live layout for every tour at once. There is no draft step (`onSaveDraft` is not wired).


## Custom locations + placeholder experience — Platform Engineer (done, 2026-11-02)

### (A) Custom locations: pin or geotagged photo
- **Contract (shipped first):**
  - New types in `lib/catalogue-types.ts`: `PinPlaceInput`, `ReverseGeocode`, `PhotoGeo`, `PhotoPlaceResult`.
  - New module `lib/custom-place-actions.ts` (editor-only server actions):
    - `reverseGeocodeAction(lat, lng)`;
    - `createPlaceFromPin({lat, lng, title?, address?, ...})` → `{place, stop, reverse}`;
    - `createPlaceFromPhoto(formData)` with fields `file`, optional `title`, optional `lat`/`lng` (a pin that overrides the geotag);
    - `attachPhotoToPinAction(assetId, pin)`;
    - `discardPendingPhotoAction(assetId)`.
- **Pin:** Photon reverse geocoding (`reverseGeocode` in `lib/suggest.ts`, cached 7 days) fills whatever the editor left empty. The result carries the OSM attribution and URL.
- **Photo:**
  - EXIF is read with `exifr` (already in the monorepo, used by pigeonshoot): lat/lng, GPSImgDirection (becomes the place's Street View heading), taken-at time and altitude.
  - The original is stored untouched in `Private/Media/Images/` under a neutral name, as a hidden place asset (`kind` image, `source` photo).
  - No GPS and no pin → `{ok: true, needsPin: true, assetId}`. The photo is kept as `source='photo_pending'`.
- **Migration 237** (`237_tour_assets_pending_photo.sql`, applied) widens the asset owner CHECK so a pending photo can exist before its place does.
- **EXIF stripping:** any image/still/poster published from `Private/` is no longer copied byte for byte (`lib/assets.ts` `stripImageMetadata`):
  - it is re-encoded with sharp: orientation applied, then all metadata dropped;
  - exifr then re-checks the output, and publishing is refused if any GPS survived;
  - films are still copied unchanged.
- **HEIC:** GPS is still read and the original kept. Publishing refuses with a clear message ("export it as JPEG / set the camera to Most Compatible"), because this server's sharp cannot decode HEVC.
- **Dependencies:**
  - `apps/elktours/package.json` += `exifr ^7.1.3`, `sharp ^0.34.5` (both already in the lockfile).
  - `next.config.ts` raises the server action body limit and `proxyClientMaxBodySize` to 26 MB, because phone photos exceed the 1 MB / 10 MB defaults. The upload cap is 25 MB.
  - One install run. All 13 LAN app ports showed the same status before and after; the lockfile only gained the 2 elktours entries.
- **Tested** in the container:
  - a GPS-tagged JPEG read 48.8554, 2.3470, direction 123.45° and the right taken-at time;
  - the stripped copy had no EXIF at all;
  - a HEIC was refused with the message;
  - reverse geocoding at Sainte-Chapelle returned "Sainte-Chapelle, 8 Boulevard du Palais" with OSM credit.
  - Not tested: the actions themselves through a signed-in session (that is the Web Engineer's LAN check).

### (B) Experience visibility + placeholder seed
- **Model:** `threads.visibility` already allows `ORGANIZATION`. Lib changes:
  - `ExperienceInput.visibility` (`'PUBLIC' | 'ORGANIZATION'`) is written by `saveExperienceAction`.
  - Reads take `ExperienceReadOptions {includeDrafts, includeOrganization}`; the default is still published + PUBLIC only.
  - `ExperienceInput.placeId` and `Experience.placeId` (`metadata.experience.placeId`) are added; the place's coordinates are used when no lat/lng is given.
  - No migration was needed for this part.
- **Seed:** `apps/elktours/scripts/seed-placeholder-experience-2026-11-02.mts` (idempotent; ran twice with the same result).
  - Thread id **`elkPlaceholderExp0001`**, slug **`placeholder-sketching-at-place-du-tertre`**.
  - Title: "[Placeholder] Sketching at Place du Tertre with a Montmartre painter".
  - Status `draft`, visibility `ORGANIZATION`; both are forced back on every re-run.
  - Linked to the catalogue place Place du Tertre (`4fb49af9-c359-4184-8f75-47693b175426`) through `metadata.experience.placeId`, with Justin as host.
  - It is a stop in no tour (checked: 0 stops).
- **Verified not public:** `/experiences` does not list it; its detail page and `/api/surfaces/experience/elkPlaceholderExp0001` return 404.
- **To remove it:** `DELETE FROM threads WHERE id = 'elkPlaceholderExp0001'`.

### Checks
- The elktours typecheck had 0 errors after each chunk.
- `/`, the Marais tour page, `/tours` and `/experiences` returned 200 after each chunk, and the public site returned 200.


## Phase A — Web Engineer round 3: custom locations and experience visibility

UI only, against the PE's `lib/custom-place-actions.ts` (CONTRACT, then implemented) and `ExperienceInput.visibility`. Nothing
was committed. There were no lib, package or `.env` edits.

### Custom locations
- **`components/places/pin-map.tsx`:** a MapLibre (OpenFreeMap) map. Click to drop a pin, and drag the pin to correct it. It is
  controlled, and flies to a position set from outside, such as a geotag. The OSM credit sits under the map.
- **`components/places/location-creator.tsx`:** two modes.
  - **Drop a pin.**
    - `reverseGeocodeAction` prefills the name and address. Both stay editable, and a later pin never overwrites what the
      editor typed.
    - The OSM attribution from the result is shown.
    - "Create place here" calls `createPlaceFromPin`.
  - **From a photo.**
    - The browser previews the file locally.
    - `createPlaceFromPhoto(FormData)` reads the geotag on the server and creates the place.
    - The pin can then be dragged. "Use this location" saves the moved position through `savePlaceAction`, with every field
      resent so nothing is cleared.
    - With no geotag (`needsPin`), the photo is kept and the editor is asked to drop a pin. That pin goes to
      `attachPhotoToPinAction`, with "Discard photo" calling `discardPendingPhotoAction`.
    - The screen says the original stays private and public copies are EXIF-stripped.
- **Where it is used:**
  - `/manage/places` → "New place": opens the new place's page.
  - The tour builder's **New** tab, compact: adds the place to the catalogue and inserts a stop (copy on pick). The "Blank stop"
    button is kept below it.

### Experience visibility
- **`components/experiences/experience-audience.tsx`:** a selector with **Draft / Members only / Public** in the "Who sees it"
  column of `/manage/experiences`, replacing the status badge.
  - Draft uses `setExperienceStatusAction(draft)`.
  - Members only and Public use `saveExperienceAction` with the full input rebuilt from the stored experience (the action
    rewrites the whole row), `status: published`, and visibility `ORGANIZATION` or `PUBLIC`.
- The row's Publish/Unpublish buttons are gone, because the selector does that. Archived rows get "Restore as draft".
- The experience form gained "When published, who sees it" (Public / Members only).
- **Bug fixed:** the form now also resends `placeId`. Before, every save dropped the experience's catalogue place from its
  metadata.
- **Leak closed:** `/api/surfaces/experience/[id]` used to check only the status, so a published members-only experience would
  have been served to anyone. It now serves drafts to editors, members-only experiences to members and editors, and public
  experiences to everyone.

### Verified, and how
- `pnpm -s check-types`: 0 errors after each of the 4 chunks.
- The public domain returned 200 for `/`, `/tours` and `/experiences` after each chunk.
- The seeded draft `elkPlaceholderExp0001` (`placeholder-sketching-at-place-du-tertre`, draft, ORGANIZATION), signed out:
  - `/api/surfaces/experience/<id>` answers 404;
  - `/experiences/<slug>` answers 404;
  - the `/experiences` listing does not contain it;
  - `/studio/experience/<id>` answers 307 to login.
  This is the intended hiding.
- **Not verified signed in** (still no LAN session):
  - the pin and photo flows end to end: map clicks, reverse geocode, geotag, `needsPin`;
  - the builder's Experiences tab showing the seeded draft;
  - the experience popup's content;
  - the visibility selector actually changing a row.

### Gaps
- Abandoning the photo "confirm" step leaves the geotagged place in the catalogue, because it is created on upload. It can be
  archived from `/manage/places`.
- HEIC photos upload but do not preview in most browsers.
- Members-only experiences are reachable by members only through the popup route. The public `/experiences/[slug]` page uses
  the lib's public filter, so members get a 404 there. Decide whether members-only experiences need a members page (Phase B).


## Reviews, follow = member, visibility, payments — Platform Engineer (done, 2026-11-02)

### (1) Reviews
- **Nothing existing fitted, so this adds a new table.**
  - `astro_reviews` and `lamrim_reviews` hold the owner's study marks.
  - Migration 156 is a moderation gate for threads, not a review model.
  - The pigeonshoot ratings are a scoring rubric for its cards.
- **Migration 238 `org_reviews`** (applied):
  - one review per person per target;
  - `target_type` is place, tour or experience;
  - `rating` 1–5 is optional, but a review needs a rating or text;
  - `status` is visible or hidden, with who hid it, when and why;
  - the tenant-isolation RLS policy is set.
- **Contract** (types are in `lib/catalogue-types.ts`: `ReviewTarget`, `Review`, `ReviewSummary`, `ReviewList`, `ReviewInput`):
  - `lib/reviews.ts` (server reads): `listReviews`, `reviewSummary`, `reviewSummaries` (batched for cards), `targetExists`, `validTarget`.
  - `lib/review-actions.ts`: `listReviewsAction(target)` is public. It returns visible reviews, the viewer's own, and hidden ones for editors, plus the summary and the viewer's rights (`canReview`, `canModerate`, `mineId`).
  - `saveReviewAction(input)` creates a review or replaces the viewer's own. Text is stored as plain text.
  - `deleteOwnReviewAction(id)` deletes the viewer's own review; `setReviewHiddenAction(id, hidden, reason?)` is for editors.
  - Places can be reviewed once they exist. Tours and experiences can be reviewed only when published and public.
- **Quick check:** a test review on Place du Tertre showed up in `listReviews` and in the summary (average 5). It was deleted afterwards.

### (2) Follow = member
- **How it works today:** signing up does not create a membership row. Following does: the "follow" button on the arrival notice (`packages/auth-server/src/arrival.ts`) or on `/center` (`followOrg`) adds a `user_organizations` row with role `viewer`.
  - In elktours, `Viewer.isAffiliate` is true for that row; `isMember` is not (members are member, guide or owner).
- **So following after sign-up does not make someone a member** in the network's sense.
- **The change is local to elktours:** review rights are `isAffiliate`, so followers can review. The rule lives only in `review-actions.ts` (`canReview`). Network membership is unchanged.

### (3) Visibility
- `saveExperienceAction` already defaults to `PUBLIC`.
- The members-only value (`ORGANIZATION`) stays in the model and the read options, but nothing uses it.
- The placeholder seed now writes `PUBLIC` and stays a **draft**, so it is still not public: `/experiences/placeholder-sketching-at-place-du-tertre` returns 404 on the public site. The existing row was updated to match.

### (4) Payments: still open (Justin is working on it)
No build now. Justin's current thinking, either:
- **(a)** when a tour includes an experience, the artist's service bundles naturally into the tour; or
- **(b)** the artist is paid out of the tour's takings, i.e. their amount is subtracted from the total earned.

`service_commissions` stays a stub, with `payment_status` pinned to `'stub'` and `payment_ref` reserved. Both options can attach later. Option (b) is closest to the existing platform charge plus ledger accruals (`payout_ledger`), with payouts made by a person.

### Checks
- The elktours typecheck had 0 errors.
- The public site returned 200 for `/`, a tour page and `/experiences`.
- Since the `.env` change, plain `http://localhost:3021` answers 308 to https (expected), so health checks now use the public URL.


## Round 4 — Web Engineer: hub, Center, payouts, schedule, public-only experiences, reviews

UI only, with light testing as asked. Nothing was committed. There were no lib, package or `.env` edits. Backups of every
replaced file are in `~/we-stage/r4bak/` on eris.

### Changes
1. **The hub in IFAC's Cards 2 layout** (`app/hub/page.tsx`, rewritten; `app/hub/hub-cards.css`, new).
   - Built from the shared `@elkdonis/cms-ui/hubsite` pieces (`HubCardGrid`, `HubLinkCard`, `MeetingBanner`, `hubsite.css`),
     not a fork.
   - Order:
     - a welcome row and the gathering banner;
     - three across: Publish (`/manage/compose`) · Profile / Center (`/center`) · Tours (with a drafts count);
     - the Tours offered panel;
     - the Getting paid panel;
     - four across: Calendar · Manage the site · Whiteboard · General chat;
     - Working together: Forum · Ideas · Pipeline.
   - Editor-only cards and panels are hidden from members.
   - **Deviation from Cards 2:** Documents, Gallery and Email stay as in-place faces in a last section. This site has no page for
     them, and Cards 2 cards are links only.
   - **Dropped from the hub:** the old hub's chat and ideas faces. They are reached through the General chat and Ideas cards.
2. **`/center`** follows IFAC's: a back link to the hub (members) or home, Manage for editors, compose to `/manage/compose` for
   editors, and a Stripe `?payouts=done` return that re-reads the account. The hub's Profile / Center card links here.
3. **Stripe onboarding card in the hub:** the existing `PayoutsCard` (shared `PayoutSetup`, the same
   `lib/payout-actions.ts` actions as `/manage/tours`), editors only, with `?payouts=` handled on `/hub`.
4. **Tour schedule panel** (`components/hub/tour-schedule-card.tsx`): every tour, with All / Published / Drafts filters.
   - Each row has the next date and links to Edit, Stops, Dates and View/Preview.
   - The foot links to "Plan dates in the schedule" (`/manage/schedule`) and "New tour".
5. **Public only for now.**
   - The `/manage/experiences` selector offers Draft and Public. "Members only" shows only for a row already in that state, so
     the selector never misreports.
   - The experience form no longer offers visibility and always saves `PUBLIC`, so new experiences default to Public.
   - The data model is unchanged. The placeholder experience is still a draft.
6. **Reviews** (migration 238, `lib/review-actions.ts`), in `components/reviews/reviews-section.tsx`:
   - It shows the summary (stars, average, count), then the list, then one of three things depending on the viewer:
     - a write box (optional 1–5 stars plus text; edit or delete your own) when the viewer may review;
     - otherwise "Follow us to leave a review" with a one-click Follow (`POST /api/center/follow`);
     - for signed-out visitors, a sign-in link.
   - Editors see hidden reviews, each with a Hide / Show toggle (with an optional reason).
   - It loads itself through `listReviewsAction`, so it works in pages and popups. It is placed on:
     - `/tours/[slug]`, under the layout;
     - `/experiences/[slug]`, under the layout;
     - **places:** they have no public page, so the tour popup's Stops tab has "Reviews of this place" under each stop with a
       place (the popup API now sends `placeId`);
     - `/manage/places`: in each place's details (expanded row and `/manage/places/[id]`), with the editor hide toggle.

### Verified
- `pnpm -s check-types`: 0 errors after each chunk.
- At the end:
  - 200 for `/`, `/tours`, `/tours/heritage-de-napoleon-bonaparte` and `/experiences`;
  - 307 to login for `/hub` and `/center` signed out;
  - the tour page renders the reviews section;
  - the tour popup API returns stop `placeId`s;
  - no errors in the container logs.
- **Not looked at signed in.** I have no credentials for the newly fixed public sign-in, so these were not seen: the hub as Dana,
  the payouts card, the schedule panel, the Center links, the review write box and Follow.

### Gaps
- Stripe still returns to `/manage/tours?payouts=…` (`app/api/payouts/return/route.ts`), not the hub. Changing it is a one-line
  UI edit if wanted.
- Saving payout setup revalidates `/manage/tours` only (lib, PE). The hub reflects the change on the next load.
- Reviews are not a Puck block, so they cannot be moved in the layout editors.


## Round 5 — Web Engineer: stop sync, tour popup, About

UI only, with light testing. Nothing was committed. There were no lib, package or `.env` edits. Backups are in `~/we-stage/r5bak/`
on eris (`tour-story.tsx`, `tour-story.css`, `tour-popup.tsx`, `about-page.tsx`).

### Changes
1. **Tour page stop sync** (`components/tours/tour-story.tsx`, rewritten; `tour-story.css`).
   - **Scroll:** one IntersectionObserver on a 1px line 40% down the viewport. It keeps a running set of the stops on the line.
     The old code read only each callback's changed entries, so a stop leaving with none entering changed nothing. The top stop
     on the line becomes active after 140 ms with no change (a debounce).
   - **Click to view:** on wide screens the whole stop is a target. Its title is also a button for keyboard users, and a map pin
     selects too. A click makes the stop active at once, which moves the 3D map and Street View.
   - **No fighting:** a click locks scroll-driven changes. The lock lifts on the next real user scroll (wheel, touchmove or a
     scrolling key), never on the smooth scroll a click itself causes.
   - **Active stop:** a brass bar on the left edge, a tint, the title colour, an "On the map" note, and `aria-current`.
2. **Tour popup** (`components/tours/tour-popup.tsx`).
   - It opens on **Stops**, which is now the first tab. Overview, with the film, comes second.
   - The stop list is on the left and the 3D map on the right, sticky below the tab strip. On narrow popups they stack, map
     first.
   - Clicking a stop (row or title) flies the map to it. Clicking a pin selects the stop and scrolls its row into view.
   - The active row gets the accent bar and the accent number badge, and the map caption names the stop.
   - The old hover-to-activate was removed, because it fought clicks.
3. **About** (`app/about/page.tsx`, rewritten) follows art-auction's About structure: a title, a one-line lede, then sections.
   Each section has a kicker, a header with a brass rule, plain prose, an optional "Visit … →" link and an optional photo beside
   it. Names are the headers.
   - Art-auction's About components are app-local, not shared, so the structure was rebuilt rather than reused.
   - Sections, in order:
     - the company, with the published tours listed;
     - **Our story** (placeholder);
     - each public guide, from their own profile;
     - How a tour works (the home page's Choose / Book / Meet copy);
     - Experiences (the `/experiences` copy);
     - the pictures (OpenStreetMap/OpenFreeMap maps, Google Street View, and the Google credit on the films);
     - Elkdonis Arts Collective (the footer's fact);
     - **Contact** (placeholder).
   - The copy comes from the site, the guides' profiles, the tours and the brief. No history, numbers, credentials or quotes
     were invented.
   - Placeholders are marked "Dana to write / confirm" in a dashed box that only editors see. Visitors do not see them, as on
     art-auction, where empty sections are hidden from the public.
   - `/about/[slug]` is unchanged.

### Verified
- `pnpm -s check-types`: 0 errors after each chunk.
- 200 for `/`, `/tours`, `/tours/heritage-de-napoleon-bonaparte`, `/about` and `/experiences`. One 502 was another session's
  container restart, and the site recovered at once.
- **Quick looks (Playwright, signed out):**
  - The tour popup opens on Stops, with the list on the left and the map on the right. Clicking "La Madeleine" flew the 3D map
    to pin 4 and highlighted the row. Screenshot: `C:\Users\Justi\AppData\Local\Temp\.playwright-mcp\elktours-r5-popup-active.png`.
  - The About page renders with no placeholders shown publicly. Screenshot: `C:\Users\Justi\AppData\Local\Temp\.playwright-mcp\elktours-r5-about.png`.
- The tour-page scroll sync was **not** exercised in a browser; this round only typechecked it and checked the page returns 200.

### For Dana and Justin
- **Data, not code:** Guru Dharam Singh's public guide profile on elktours reads as a test account ("a test account for those
  purposes"). It appears on About and the home page's guides. Hide it, or rewrite the bio, in the org profile.
- **Dana to supply:** "Our story", and the contact details and tour languages for "Contact".


## Round 6: stop notes, visitor suggestions, place links (Platform Engineer, done 2026-11-02)

Migration **239** (`239_elktours_notes_suggestions_links.sql`, applied) adds:
- `tour_stops.excerpt`;
- the tables `tour_stop_notes`, `visitor_suggestions` and `place_links`;
- the column `places.suggested_by`;
- RLS on the two org tables.

The types are in `lib/catalogue-types.ts`: `StopNote`, `StopNoteInput`, `PlaceLink`, `RouteItem`, `RoutePreview`, `VisitorSuggestion`, `SpotSuggestionInput`, `RouteSuggestionInput` and `StopExtras`. `Place` gains `links?` and `suggestedBy?`.

### (1) Stop excerpt and notes (`lib/stop-note-actions.ts`, editors only)
- `setStopExcerptAction(stopId, excerpt)`:
  - stores plain text, at most 300 characters;
  - writes only the excerpt column, so `saveTourStops` never touches it.
- Notes:
  - `listStopNotesAction`, `listTourStopNotesAction(threadId)` (notes grouped by stop);
  - `addStopNoteAction({stopId, body, departureId?, runDate?})`;
  - `updateStopNoteAction`, `deleteStopNoteAction`;
  - `promoteStopNoteAction(id, excerpt?)`: copies the note, or an edited version, into the excerpt and stamps `promoted_at`.
- Notes are private: they never reach a public read.
- Public read: `TourFull.stopExtras[stopId] = {excerpt, links}`, from `loadTourFull`.
- Why a new table: places' `private_notes` is one text per place, but these notes belong to a stop and a run, with an author and a time.

### (2) Visitor suggestions (`lib/suggestion-actions.ts`)
- **Who:** the same rule as reviews (signed-in followers, `isAffiliate`). The limit is 10 per person per rolling 24 hours, spots and routes together.
- **Visitor actions:**
  - `suggestionAllowanceAction`;
  - `suggestSpotAction` (pin);
  - `suggestSpotFromPhotoAction(formData)`: uses the geotag when there is no pin; returns `{needsPin}` before anything is stored; the photo is kept private as a pending asset;
  - `previewRouteAction(items)`: FOSSGIS foot routing through `lib/walking-route.ts`;
  - `suggestRouteAction` (2–15 items, each a catalogue place or `{lat, lng, title}`);
  - `listMySuggestionsAction`, `withdrawSuggestionAction`.
- **Moderation (editors):**
  - `listSuggestionsAction`;
  - `acceptSuggestionAction(id, {title?})`:
    - a spot becomes a place, with the photo moved to it and the suggester credited in `places.suggested_by`;
    - a route's spots become places first, then a **draft** tour is built with one stop per item (`placeId` set, route refreshed), crediting the suggester in `metadata.suggestedBy`;
  - `rejectSuggestionAction`.
- The photo helpers moved to `lib/photo-geo.ts`, which `custom-place-actions.ts` now uses too.

### (3) Place links
- **Script:** `apps/elktours/scripts/enrich-place-links.mts` (idempotent; flags `--only <id>`, `--dry`).
- **Sources:**
  - Wikidata items within 150 m (`wikibase:around`), giving the Wikidata URL, the en/fr Wikipedia sitelinks and the official website (P856);
  - OSM features within 150 m that carry `website`, `wikipedia` or `wikidata` tags (Overpass, 3 endpoints);
  - an OSM `wikidata` tag is resolved through `wbgetentities` when Wikidata itself found nothing.
- **Matching rules:**
  - name similarity ≥ 0.8 and distance ≤ 150 m means **confident**;
  - 0.55–0.8 is stored with `confident=false` (logged as LOW, never shown);
  - a conflict between OSM's Wikidata item and Wikidata's own match downgrades the match to not confident;
  - every URL comes from a sitelink, a claim or a tag, never a guess.
- **Politeness:** requests go one at a time, at least 1.1 s apart per service, with backoff on 429/5xx and a User-Agent that includes a contact. A circuit breaker skips OSM for the rest of the run if Overpass fails for 3 places in a row.
- **Reads:** `Place.links` (`listPlaces`/`getPlace`, through `placeLinksFor`) and `TourFull.stopExtras[stopId].links`. Only confident links are returned, one per kind, with Wikidata's website preferred over OSM's.
- **Caveat:** Wikidata's "official website" for heritage monuments is sometimes the Mérimée register entry (e.g. the Arc de Triomphe du Carrousel). It is real data but not an official site; review it if that matters.
- **Run result (2026-11-02, third pass with stricter matching):** 85 places: **67 matched**, **12 low-confidence** (stored, not shown), **6 none**. That gives **200 confident links**.
  - **Why three passes:** the first two passes matched part-of and address items ("Chapitre de Notre-Dame", "67 rue Saint-Jacques"). The rule now accepts only a whole item name contained in the place title, or near-identical spelling; address items and longer names stay LOW. Each pass replaces its own earlier rows, so the false matches were removed.
  - **Low-confidence (for review):** Clos Montmartre, Cloître des Billettes, Hôtel-Dieu, Les Tuileries, Notre-Dame (→ Notre-Dame de Paris, Q2981), Parvis Notre-Dame, Philippe Auguste Wall, Rue Saint-Jacques, Rue des Francs-Bourgeois, Rue des Écoles, Rue du Cardinal Lemoine, Thermes de Lutèce. Several of these are right and only need an editor's yes, e.g. Notre-Dame and Hôtel-Dieu.
  - **None:** Boucherie Tribolet, Grande Caryatide, La Fermette, Stohrer (Wikidata has "La Pâtisserie Stohrer" 6 m away, but its similarity score was below the threshold), The bouquinistes, nysa cavistes.
  - **OSM:** Overpass was saturated again, so OSM links exist only for the first few places. Re-run the script when Overpass is up: it only replaces rows for services that answered.

### Checks
- The elktours typecheck had 0 errors.
- The public site returned 200 for `/`, the Marais tour page and `/experiences`.
- Quick functional checks: the walking preview gave an osrm route of 0.5 km; `getPlace` returns the links (Arc de Triomphe du Carrousel: website, en/fr Wikipedia, Wikidata, OSM); `loadTourFull` returns `stopExtras` for every stop.
- Stop-note and suggestion actions need a signed-in session, so they were only typechecked; that check belongs to the Web Engineer's LAN pass.


## Round 6 — Web Engineer: expandable stops, public places catalogue, visitor suggestions

UI only, with light testing. Nothing was committed. There were no lib, package or `.env` edits. Backups of replaced files are in
`~/we-stage/r6bak/` on eris.

### Changes
1. **Tour popup stops unfold.**
   - **Folded:** each stop shows a two-line excerpt, taken from `TourFull.stopExtras[stopId].excerpt` when set, otherwise from
     the stop copy.
   - **"More, links and reviews"** opens `components/tours/stop-details.tsx`: the full public copy, the place's links with their
     source (`components/places/place-links.tsx`: "Wikipedia ↗ via Wikidata" and so on), then the reviews. Several stops can be
     open at once.
   - **Editors** also get `components/tours/stop-admin.tsx`:
     - inline edit of the short excerpt (300 characters), which shows in the folded row at once;
     - "Add note", private and optionally tagged with the tour date;
     - the stop's past notes, each with "Use as public excerpt" (promote) and Delete;
     - all through `lib/stop-note-actions.ts`.
   - The popup API now sends each stop's `body`, `links` and the stopExtras excerpt.
2. **Places replaces Journal.**
   - `/journal` held no posts (elktours has none at all), so nothing was moved or archived. `app/journal/page.tsx` redirects to
     `/places`, and `/journal/<slug>` would still open any future post.
   - The header shows the journal feed as **Places → /places**. The feed row in the database is unchanged.
   - `/places` (`app/places/page.tsx`, `components/places/places-catalogue.tsx`):
     - search, then **Cards** or **Map**;
     - each card shows a photo, a line of copy, its stars and review count, the tours it is on, and its links;
     - a card unfolds in place, as a tour-popup stop does, into the full copy, the address, links and reviews with the write box;
     - the Map view (`components/places/places-map.tsx`) shows pins, with the picked place's card beside the map;
     - editors get **Add place**, a dialog holding the existing pin/photo `LocationCreator`, which opens the new place in
       `/manage/places`.
   - **Public rule:** a place is shown when it is not archived and at least one published tour stops there. That is 75 places
     today. Only public fields are passed to the client.
3. **Visitor suggestions** (`components/places/visitor-suggest.tsx`, on `/places`).
   - **Gate** (`suggestionAllowanceAction`): signed-out visitors get a sign-in link, signed-in non-followers a one-click Follow,
     and followers past the limit (10 a day) a message. A "used today" line is shown.
   - **Suggest a spot:** a pin or a photo (geotag, or ask for a pin if there is none), a title and why.
   - **Suggest a route:**
     - pick catalogue places or drop spots of your own;
     - reorder or remove them (2–15);
     - the walking line comes from `previewRouteAction` (FOSSGIS foot, straight-line fallback) on a sticky map, with the km;
     - then add a title and note, and send.
   - **Moderation:** `/manage/suggestions` (`components/manage/suggestions-queue.tsx`) has a Waiting / All filter.
     - Each item shows the suggester (linked to ArtDirect), the note, the private photo, the walk's stops and a map.
     - Accept a spot and it becomes a place; accept a walk and it becomes a draft tour, opened in the builder.
     - Reject keeps a reason.
   - **Links to the queue:** a Suggestions tab in `/manage`, and a Suggestions card with the waiting count in the hub's
     tools row. That row is five across for editors and three for members.

### Verified
- `pnpm -s check-types`: 0 errors after each chunk.
- 200 for `/`, `/tours`, `/places`, `/experiences` and `/about`. `/journal` answers 307 to `/places`. Two 502s were container
  restarts by another session, and the site recovered at once.
- **Quick look, signed out:** `/places` shows 75 places with tours and sourced links, and the nav reads Places. Screenshot:
  `C:\Users\Justi\AppData\Local\Temp\.playwright-mcp\elktours-r6-places.png`.
- **Not verified signed in:** the editor stop tools, Add place, the suggestion forms and the moderation queue.

### Requests for the Platform Engineer
1. **Low-confidence links (12 places):** there is no read for them and no approve/remove action. The editor UI in
   `/manage/places` is **not built**. Please add `listPendingPlaceLinks(placeId | all)` plus `approvePlaceLinkAction` /
   `removePlaceLinkAction`, and it is a small row of buttons in the place details.
2. **A public places read** (for example `listPublicPlaces()` with an explicit public rule, or a `places.public` flag). `/places`
   applies the rule above on top of `listPlaces` for now, so a place added in the catalogue only appears once a published tour
   stops there.
3. **A short public excerpt on `Place`:** cards derive one from `body` today.

## Round 7: link review, public places, place excerpt (Platform Engineer, done 2026-11-02)

Migration **240** (`240_elktours_place_public_excerpt.sql`, applied) adds:
- `places.is_public` (default true);
- `places.excerpt`;
- `place_links.rejected_at`.

Backfill:
- `is_public` is true for the **75** places that are not archived and appear in a published tour, and false for the other 10.
- `excerpt` is the first sentence of the existing copy (HTML stripped, at most 200 characters). Only **8** places had copy, so 8 have an excerpt.

Changes:
- **Types:** `Place.excerpt` and `Place.isPublic`; `PlaceInput.excerpt?` and `PlaceInput.isPublic?` (default true for new places); new `PublicPlace` and `PlaceLinkCandidate`.
- **Public read** (`lib/places.ts`):
  - `listPublicPlaces({q?, tag?, limit?})` and `getPublicPlace(slugOrId)`;
  - only places with `is_public` that are not archived;
  - no private notes, stats or provenance;
  - returned with confident links and the published tours that visit each place.
- **Link review** (`lib/place-actions.ts`, editors):
  - `listLowConfidenceLinksAction(placeId?)` and `listPlaceLinksForEditorAction(placeId)`;
  - `approvePlaceLinkAction(id)` copies the link to a `manual` row, so a re-run of the script cannot undo it;
  - `removePlaceLinkAction(id)` marks the link `rejected_at`;
  - `scripts/enrich-place-links.mts` now never re-adds a rejected URL.
- **Place form:** `savePlaceAction` writes `excerpt` and `isPublic`. Places created from a pin, a photo or a suggestion default to public.
- **Checks:** typecheck 0 errors; public site 200; `listPublicPlaces` returns 75 places, 58 of them with links, and no private fields.

### Round 6 follow-up — Web Engineer (wired to the Platform Engineer follow-up)
- **`/places`** now reads `listPublicPlaces` (`PublicPlace`). The interim "on a published tour" rule is dropped; visibility is the place's own `isPublic`. 75 public places today. Cards prefer `excerpt`, else a line from the copy.
- **Doubtful links:** `/manage/places` has an "N links to review" filter that shows every place's doubtful links (`components/places/link-candidates.tsx`, with match evidence and Approve / Remove through `listLowConfidenceLinksAction`, `approvePlaceLinkAction` and `removePlaceLinkAction`). Each place's details list its own.
- **Place form:** a "Public" toggle (`isPublic`, default on) and a "Short excerpt" field (`excerpt`, 200 characters), saved through `savePlaceAction`.
- **Tour popup stops:** the stop's own excerpt, else the place's public excerpt, else a line from the copy.
- The card link list is unchanged, pending Justin's decision.
- **Verified:** typecheck 0 errors; 200 for `/`, `/tours`, `/places` and `/about`; the popup API returns 200. Not checked signed in. Backups are in `~/we-stage/r6bak/` (`*.b` files).

## Operating places + official websites (Platform Engineer, done 2026-11-04)

**Migration 241** (`241_elktours_place_operating.sql`, applied):
- `places.operating` (boolean) and `places.operating_kind`;
- `places.classification` (jsonb evidence: OSM match and tags, Wikidata instance-of, how it was decided);
- `place_links.source` += `'web'`.

This is a reusable seed for the coming business-links work (`docs/open/ASSOCIATED_BUSINESSES_2026-11-04.md`). No business schema was built.

**Reads:** `Place.operating` and `Place.operatingKind`.
- A `web` link is reported as `source: 'manual'` with `sourceRef: 'web:...'`, because the Web Engineer's `components/places/place-links.tsx` has a closed label map. Once that map has a `web` label, widen `PlaceLink.source`.

**Script:** `apps/elktours/scripts/classify-places.mts`. It is idempotent and keeps manual, web and rejected rows.
- **Classification evidence, in order:**
  - 7 manual overrides, listed and explained in the file. These are venues whose nearest OSM feature is the street or square around them.
  - OSM tags of the best name match within 80 m: one batched Overpass request, retried with backoff across 4 mirrors. The 4th mirror answered after the others returned 502/504.
  - Wikidata P31 (instance of).
  - Keywords in the title and stop copy.
- **Websites:** only OSM `website` / `contact:website` tags and Wikidata P856.
  - Heritage registers and social pages are excluded. That filter is now in `enrich-place-links.mts` too.
  - Web search was used only for what was still missing, and a site counts only when its name and address are confirmed on the page.

**Result (85 places):**
- **34 operating:**
  - 13 museums, 8 churches, 1 synagogue, 2 cabarets;
  - 2 cafés, 1 bar, 1 bookshop;
  - a bakery, a butcher, a cheese shop and a wine shop (1 each);
  - 1 market, 1 gallery.
- **51 landmarks:** streets, squares, monuments, bridges and other landmarks.

**Operating places' websites:**
- **29** have a confident official site. **28** come from OSM/Wikidata. **1** comes from a web search (Musée de l'Armée for Hôtel des Invalides, with name and address confirmed on the site).
- **4** have low-confidence sites only, waiting in the link-approval flow:
  - Cloître des Billettes (Wikidata);
  - Notre-Dame (Wikidata);
  - Église Saint-Paul-Saint-Louis (`spsl.fr`): the site names the parish, but it only shows the secretariat's address;
  - Marché des Enfants Rouges: the City of Paris listing, not the market's own site.
- **1** has none: Boucherie Tribolet (54 rue Montorgueil). Only directories list it, so no URL was stored.
- **Note:** the Louvre's P856 is a Louvre page about the pyramid; it is real, but not the home page.


## Round 7 — Web Engineer: associated businesses (elktours UI; ArtDirect stopped)

UI only, against `@elkdonis/services/businesses` and `apps/elktours/src/lib/business-actions.ts` (the Platform Engineer's). Nothing
was committed. Backups of elktours files are in `~/we-stage/r7bak/`.

### Important findings
- **elktours and ArtDirect now run production builds** (`next build` then `next start`; the elktours build is from Nov 4 00:06).
  - Round 7 code is typechecked but **not live** until each app is rebuilt and restarted; in elktours, for example,
    `/manage/businesses` answers 404 publicly today.
  - The old rule "every save goes live" no longer holds.
  - I did not rebuild. A rebuild writes the `.next` folder the live server is using, so it needs a coordinated restart.
- **I overwrote another agent's file.** At 12:12 I uploaded my own `apps/artdirect/src/components/business/BusinessShellPage.tsx`.
  The other agent's version had been written at 12:11, with `BusinessForms.tsx`, `BusinessShellPage.module.css`,
  `lib/business-actions.ts` and the `[slug]/page.tsx` branch, and mine replaced it. No backup existed.
  - The file is now my version, made prop-compatible with their `page.tsx`. ArtDirect typechecks clean.
  - **Their version needs restoring by its author.** My extra ArtDirect files can then be deleted:
    `components/business/BusinessShellActions.tsx`, `components/business/BusinessShell.module.css` and
    `app/[slug]/business-actions.ts`.
  - I stopped all ArtDirect work after this, including the directory "Businesses" filter and badge. I did not edit
    `[slug]/page.tsx`.
  - The coordinator was told at once.

### elktours (done, typechecked, not live until a rebuild)
- **`components/places/business-card.tsx`:** a small org card built from `PlaceBusinessSummary`.
  - It shows the name (linked to the directory page), the kind ("inside" when the business hosts within the place), the address,
    the hours and the confirmed website only.
  - A shell carries its **marking** ("Unclaimed · listed by …"), an "Is this your business?" link to its page, and the facts'
    attribution lines (© OpenStreetMap contributors and so on).
  - It has no buy, book or pay controls, no vouches and no verified badge, for any status. Removed and former businesses are not
    shown.
- **Where it appears:**
  - `/places` cards show the kind under the title and the full card(s) when unfolded (batched `placeBusinessesFor`);
  - expanded tour-popup stops use `stopExtras.business`;
  - tour page stops (`TourStory`) show it under each stop's copy.
- **`/manage/places`**, in each place's details (`components/places/place-business-panel.tsx`):
  - "Create a business listing from this place" (prefilled by `createBusinessFromPlaceAction`; it reuses an existing match);
  - "Link an existing listing" (search the steward's listings; operates or inside; primary);
  - Make primary, and Unlink (kept as former);
  - "Edit facts" for a shell: name, kind, address, website with a "checked: show publicly" box, phone, OSM hours, with each
    field's source shown. No bio, logo, prices or offers.
- **`/manage/businesses`** (new; tab in `/manage`), in `components/manage/businesses-steward.tsx`:
  - **Claims waiting:** approve or reject (with a reason); otherwise "a platform admin decides".
  - **Removal requests:** listings with `removalDueAt`, each with "Remove now".
  - **Listings:** status, website-to-check flag, Remove and Restore.

### Not done
- ArtDirect directory filter and badge, and the reverse links (the steward org's page listing its businesses): stopped, see
  above.
- arts-collective: nothing was done.
- No data to see yet: 0 business listings and 0 place links when checked (the shell seeding had not run).
- Nothing checked signed in.

### When elktours left `next dev` (answer for the coordinator)
- **The switch:** `docker-compose.yml` changed the elktours command from `pnpm docker:dev` to "build if needed, then
  `pnpm docker:start`". The file was saved 2026-11-03 18:58 EST (uncommitted). The container restarted at 2026-11-04 00:05 UTC
  (19:05 EST) and built then.
- **Live today (checked inside the container's `.next`):** rounds 1–6, for example `/places`, `/journal`,
  `/manage/suggestions`, `/manage/flyovers`, the expandable stops and the "On the map" stop sync.
- **Not live until a rebuild:**
  - the Round 6 follow-up (the doubtful-link review, the place form's Public toggle and excerpt, `/places` on `listPublicPlaces`,
    excerpt fallbacks);
  - all of Round 7.

## Associated businesses, P1 + P2 (Platform Engineer, done 2026-11-04)

Built from `docs/open/ASSOCIATED_BUSINESSES_2026-11-04.md`, with Justin's decisions (claims approved by platform admins, plus steward owners for in-person claims; any org's owners can steward; a claim can stay a light owned listing; no place reviews on the business page; removal immediate before a claim and within 30 days after; a steward street-front photo is fine, with credit; **shells are listed in the directory**).

**Migration 242** (`242_business_listings.sql`, applied) adds:
- `business_listings`, the facts sidecar on a `users` row with `entity_type='organization'`. Columns:
  - address, position, category;
  - website with `website_status` (`confirmed` / `pending_review` / `none`);
  - phone, OSM `opening_hours`, `osm_ref` / `wikidata_ref` (unique);
  - per-field `facts_source`, photo and credit;
  - `status` (shell / claimed / removed, where removed is a tombstone);
  - steward and listed-by, claim fields, removal fields.
- `business_claims`: non-merging claims with a method, evidence and decision.
- `place_businesses`: org-owned, tenant RLS, many-to-many, one current primary per place, history kept as `former`.

**Shared service:** `packages/services/src/businesses.ts`, exported as `@elkdonis/services/businesses` (one line in its `package.json` exports, `index.ts` untouched).
- **Reads:** `getBusinessListing`, `getBusinessBySlug`, `listBusinesses`, `listBusinessesForPlaces`, `getBusinessConnections` (steward ↔ business, places ↔ business, published tours visiting it), `publicBusiness`.
- **Access:** `canStewardBusiness`, `canEditBusiness`, `canDecideBusinessClaim`.
- **Writes:** `createBusinessShell` (dedupes on OSM/Wikidata refs or name within 150 m, refuses tombstones, sets `directory_listed`, publishes on the steward's `org_profiles`), `updateBusinessFacts`, `linkPlaceBusiness`, `unlinkPlaceBusiness`, `transferStewardship`.
- **Claims:** `requestBusinessClaim`, `listBusinessClaims`, `decideBusinessClaim` (approve gives a light owned listing, sets verified, rejects other pending claims; never uses `approveClaim` or `mergeProfile`).
- **Removal:** `requestBusinessRemoval` (a shell is removed at once; a claimed listing gets a 30-day due date), `removeBusiness`, `restoreBusiness`.
- **Labels:** `shellMarking`, `businessCategoryLabel`, `businessSlugBase`.

**Seed:** `apps/elktours/scripts/seed-business-shells-2026-11-04.mts`, idempotent (the second run created 0).
- **30 shells** for the **34** operating places. The Conciergerie covers 3 places, the Panthéon 2 and the Sacré-Cœur 2.
- Each is linked as its place's primary business; the steward is elktours.
- Facts and their sources:
  - names come from OSM, or from reviewed names for tour labels;
  - 33 places have an address: from OSM `addr:*`, else Photon (OSM data), and 2 from the venue's or the City of Paris page;
  - 18 have opening hours (OSM);
  - websites are confirmed for 29 places, pending review for 4 (Cloître des Billettes, Notre-Dame, Saint-Paul-Saint-Louis, Marché des Enfants Rouges) and absent for 1 (Boucherie Tribolet).
- Slugs are transliterated (`cafe-de-flore`, `eglise-saint-severin`).

**elktours reads:**
- `Place.businesses: PlaceBusinessSummary[]` in `listPlaces` and `getPlace`, through `placeBusinessesFor` / `toBusinessSummary` in `lib/places.ts`.
- `TourFull.stopExtras[stopId].business` (the primary business).
- A website pending review is never public.

**elktours actions:** `lib/business-actions.ts`. Writes need an elktours owner.
- `listStewardBusinessesAction`, `getBusinessAction`;
- `createBusinessFromPlaceAction`;
- `linkPlaceBusinessAction`, `unlinkPlaceBusinessAction`;
- `updateBusinessFactsAction`, `removeBusinessAction`, `restoreBusinessAction`;
- `listBusinessClaimsAction`, `decideBusinessClaimAction`, `pendingBusinessClaimsCountAction`.

**ArtDirect (Platform Engineer owns this UI):**
- `app/[slug]/page.tsx` now branches first to `components/business/BusinessShellPage.tsx`. The page shows:
  - the unclaimed banner with steward credit;
  - facts and connections (tours visiting it);
  - a sources list with licence lines;
  - the claim and removal forms (`components/business/BusinessForms.tsx`), whose server actions are in `lib/business-actions.ts`.
- A removed listing returns 404. A Next page cannot return 410 without middleware.
- The Web Engineer's duplicates were removed: `BusinessShellActions.tsx`, `BusinessShell.module.css` and `app/[slug]/business-actions.ts`.
- `apps/artdirect` typecheck: 0 errors.

**Directory:**
- Shells list as `entity_type='organization'` profiles through the existing `listPublicProfiles`. The card shows `● unclaimed`, with the headline "<Category> · Unclaimed · listed by Elkdonis Tours & Experiences".
- **They are held unlisted** (`directory_listed=false`) **until the ArtDirect production build is rebuilt.** Until then the live build renders shells as generic "Dossier" pages without the marking or the claim/removal flow. Unlisted, those pages answer 404.
- After the rebuild, list them with:
  `UPDATE users u SET directory_listed = true FROM business_listings b WHERE b.user_id = u.id AND b.status = 'shell';`
- Classifieds has no per-entity listing to mirror (it is a visual ad generator).

**Left:**
- Adopting a claimed listing into a tenant org (`createOrganization({adoptProfileUserId})`, P3).
- The arts-collective admin queue for claims, removals and stewardship.
- Venue links on events and installations (P4).
