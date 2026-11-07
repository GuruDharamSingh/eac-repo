# Elktours code map: reuse points and guardrails (2026-11-02)

Senior Code Officer pass, read-only. Scope: asset registry, fly-over render requests, stop reorder, places catalogue,
Experiences (new offering), tour thread surfaces, Puck in elktours, artist service commissioning (stub).
Paths are relative to `~/eac`. "verified" = read or queried on 2026-11-02 at about 21:00 UTC.

## 0. Ground truth that differs from the docs

- elktours (3021) runs **`next dev`** (`docker-compose.yml:1977`, `pnpm docker:dev`) and is **public** at
  `https://elkdonisexperiences.com` (brief, 2026-11-01 section). CLAUDE.md's "LAN only" is out of date. Every saved file
  goes live on a public site at once, and a syntax error 500s it.
- Sign-in on the public host is broken until `.env` gets `ELKTOURS_URL` + `ADDITIONAL_REDIRECT_URLS` (brief, 2026-11-01). Signed-in
  testing has to use the LAN URL until then.
- Highest migration is **232** (`232_reel_transcript_peaks.sql`, applied 2026-11-02 05:07). **Next free: 233.** The direct-editing
  handover says "next free 230". That is stale: 230-232 are taken and applied. Migrations 223-232 are all **untracked** files (not in git).
- Tracker table: `app_schema_migrations(filename, checksum)`. `schema_migrations` is Supabase's own, so ignore it.
- `pnpm -s check-types` in elktours: **0 errors** (verified, 19 s). `pnpm lint` in elktours is **broken**: there is no `eslint.config.*`, so
  ESLint 9 prints the migration guide. Do not count lint as a gate; fixing it is a separate task.
- Payee for the eleven tour threads: all are **authored by Dana McCool**, and Dana has **no** `stripe_account_id` and no `payout_email`
  (verified). So `bookingAvailability` hides tour booking today (brief Open item 2).
- 96 `tour_stops` rows, 85 distinct titles. The 11 duplicate titles across tours are what a places catalogue would merge on backfill.
- No `site_config` rows for elktours (`puck:tour-detail` is unset, so `DEFAULT_TOUR_LAYOUT` is drawn).
- No `media` rows for elktours: films and posters were uploaded straight to Nextcloud by the import script without `media` rows.
- No `services` feed exists for elktours (`org_feeds`: tours, journal, general), so `/services` (`getServiceThreads`, `section='services'`)
  is always empty.

## 1. Thread surfaces (listing / card / popup / detail)

Shared system: `packages/cms-ui/src/surface/` (`@elkdonis/cms-ui/surface`).
- Descriptor → surface switch: `SurfaceRouter.tsx`. It already has a **host registry**: descriptor
  `{ type: "custom", key, title?, kind?, size?, props? }` (`types.ts:291`) is rendered by `connectors.custom[key]`
  (`types.ts:1455`). **Use this for `tour` and `experience` popups, so no shared-package edit is needed.** elktours already registers `email`
  and `whiteboard` there (`apps/elktours/src/components/hub/HubSurfaces.tsx:179`). Other hosts: arts-collective
  `components/hub/console/OrgConsoleHost.tsx:218`, artdirect `components/oad/ManageSpace.tsx:110`, ifac `components/hub/HubSurfaces.tsx:332`.
- Building blocks to compose a custom surface: `SurfaceFrame`, `SurfaceSection`, `SurfaceFacts`, `ActionButton`, `SurfaceSkeleton`
  (`SurfaceShell.tsx`), `threadViewParts` (`ThreadView.tsx`, pure, server-safe: main + rail + kicker), `SurfacePage` (detail page =
  the surface at page size), `SurfaceCard`/`SurfaceCardGrid` (face; `surface` | `href` | `onClick`), `toSurfaceThread`
  (`thread-mapper.ts:105`), `kindMeta`/`asSurfaceKind` (`kinds.ts`), URL deep links `serializeDescriptor`/`parseDescriptor`/`SURFACE_PARAM` (`url.ts`).
- There are no tabs in `ThreadSurface`/`SurfaceFrame`. The only tab strip is a hand-built one in `surfaces/ProfileSurface.tsx:1371`
  (`role="tablist"`). A "Stops" tab means local tab markup inside a custom surface, or a shared change (avoid).
- The kind registry is closed: `SurfaceKind` union (`types.ts:18`) and `KINDS` (`kinds.ts:17`) have no `tour` or `experience`. Unknown kinds
  fall back to `neutral` (no accent). Adding them changes `cms-ui` (types.ts, kinds.ts, surface.css `[data-kind=…]`), which every app compiles.
  Use `kind: "event"` or `"service"` styling via the custom descriptor's `kind` for now.
- `SCHEDULED_KINDS` / `PRICED_KINDS` (`cms-ui/surface/types.ts:1465-1467`) mirror `packages/services/src/org-calendar.ts:78`. If an experience
  should be dated or priced in shared views, both lists must change (shared files).
- elktours today: `components/thread-card.tsx` (feed row → thread popup), `lib/surface-thread.ts` (local → shared mapper),
  `components/hub/HubSurfaces.tsx` (SurfaceProvider + connectors), `[feed]/page.tsx` + `[feed]/[slug]/page.tsx` (generic listing and detail).
  Tours bypass surfaces: `components/tours/tour-card.tsx` is a `<Link>` to `/tours/[slug]` (hover plays `metadata.film.url720`), and the detail page is
  Puck-shaped blocks (`src/blocks/tour/`).
- Compose catalogue: `packages/cms-ui/src/compose/catalogue.ts` (`ALL`, entry per kind; `service` gated by `ComposeContext.hasServices`).
  A new compose kind is a shared edit. For elktours, a local `/manage` form (like `components/manage/tour-form.tsx`) is safer.

## 2. Threads and the elktours data model

- `threads` (`\d threads`, verified): `kind varchar(20)` **with no CHECK**, so `experience` is a valid value. There is a CHECK on status
  (draft|pending|published|archived), visibility (PUBLIC|ORGANIZATION|INVITE_ONLY), format (in_person|online|hybrid), and min_role.
  Event-shaped columns are already there: `scheduled_at, duration_minutes, location, is_online, meeting_url, format, attendee_limit,
  is_rsvp_enabled, rsvp_deadline, recurrence_*, price, currency, sessions jsonb, metadata jsonb, section`.
- **A new kind is opt-out on every feed, forum, search and network surface.** Decide on day one whether `experience` goes in
  `OFF_FEED_KINDS` (`packages/services/src/thread-kinds.ts:41`; `tour` is in it). If it is listed only by elktours, add it (that is a shared
  edit in source-exported `@elkdonis/services`), or keep it out and accept that it shows on the forum, feeds and search. elktours' own
  `lib/data.ts` also filters with `OFF_FEED_KINDS`.
- Purchasable kinds: `PURCHASABLE_THREAD_KINDS` (`packages/commerce/src/server/service-orders.ts:33`: service, workshop, event, product, tour).
  If an experience is bought directly, add it there or reuse `service`.
- Tour model: migration `208_elktours_tours.sql` (`tour_stops`, `tour_departures`, `tour_bookings`), `210` (`tour_stops.guide_notes`),
  `211` (`still_url`, route cache). Reads and writes: `packages/commerce/src/server/tours.ts` (`listTourStops:164`, `saveTourStops:184`,
  departures, bookings). App read layer: `apps/elktours/src/lib/tours.ts` (`Tour`, `TourDetails` in `metadata.tour`, `TourFilm` in `metadata.film`).
- **Reorder already exists**: `saveTourStops` keeps ids and rewrites `position` from array order. `components/manage/stops-editor.tsx:71`
  has Up/Down buttons. `@dnd-kit/{core,sortable}` is already an elktours dependency, so drag reorder is UI-only work with no migration.
- `tour_stops` has **no** place or thread reference. Linking a stop to a catalogue place or to an experience thread needs a migration
  (e.g. `place_id uuid`, `experience_thread_id varchar(21)`), and `saveTourStops` (commerce, shared) must carry the new columns. Its UPDATE
  lists columns explicitly, so new columns survive a save only if they are added there.
- metadata conventions (`docs/reference/data-model.md` "Query conventions"): merge with `COALESCE(metadata,'{}') || jsonb_build_object(...)`,
  write jsonb with `db.json(x)`. The tour form rewrites `metadata.tour` whole, so put new tour-level keys **top-level** (as `metadata.film` does)
  or inside the form's merge. `patchTourAction` (`lib/tour-live-actions.ts`) merges only touched fields, so follow it.
- `guide_notes` must never reach a public page (brief "Rules"). The same rule applies to the places catalogue's private notes and stats.
- Event-thread model: events/meetings are threads with `scheduled_at` + RSVP (`thread_rsvps`, and seats granted only by `confirmOrderPaid`
  for paid kinds). Series pattern: `packages/services/src/meeting-series.ts`, `series_sessions` (203). Cross-org carry: `thread_orgs`.
  Thread-to-thread edges: `thread_gathers` (`gather.ts:677`, relation + target). It is usable for "experience featured in tour" at tour level
  without a migration, but not at stop level.
- Org and membership: `user_organizations.role` owner|guide|member|viewer (`docs/reference/identity-and-tenancy.md:202`). elktours
  `lib/auth.ts` (`getViewer`, `requireOrgEditor` = owner/guide, `requireOrgMember`, `getApiEditor`). The "artist of the collective" is a
  non-viewer row in org `oad` (`packages/services/src/artist-space.ts` `gainSpace`). Platform users are global (`users`), and membership is per-org rows.
  Per-org profile publish: `org_profiles`. elktours owners: Dana and Justin.
- Tenancy: migration 227 RLS (`eac_tenant`, `withOrg` in `packages/db/src/tenant.ts:18`) covers 21 tables incl. `site_config` and `threads`, but
  **not** `tour_*` or `media`. elktours queries as `postgres` (bypasses RLS). New org tables (places, assets, render requests) should carry
  `org_id` and be added to the `tenant_isolation` loop the way 227 does (new migration, same DO-block pattern).

## 3. Artist profiles and links

- Canonical identity = `users` row (slug, bio, avatar, `profile_sections`, `directory_listed`); legacy `artist_profiles` / `directory_profiles`
  are still read in places. Person page data: `packages/services/src/person-page.ts` (`getPersonPage:344`, `personThreadHref:287`).
- ArtDirect = `apps/artdirect` (`directory.arts-collective.com`): `/[slug]` person page, `/[slug]/services/[service]` (service detail and
  booking), `/[slug]/writing`, `/[slug]/design` (Puck person page). A member's own services are `kind='service'` threads homed in org `oad`.
- Linking from elktours: env `NEXT_PUBLIC_ARTDIRECT_URL` is present in the container. The helper already in the app is
  `apps/elktours/src/lib/forum.ts:57` `forumProfileUrl(slug)` → `${ARTDIRECT_URL}/${slug}`. See also `app/api/center/profile/route.ts:66`.
  Service link: `${ARTDIRECT_URL}/${user.slug}/services/${thread.slug}`. Store link: `siteConfig.marketplaceUrl` + `@elkdonis/commerce/links`.
- **"Classifieds" is not a per-artist listing.** `apps/artdirect/classifieds/` + `src/classifieds/` is a newspaper-style visual
  generator (rule: UI only when Justin asks). arts-collective `/sites/[slug]/classifieds` (uncommitted) is an org page designed in
  `site_config` `classifieds:page`. Neither holds an artist's offering that an experience could link to. Link to the ArtDirect profile or
  service instead.

## 4. Payments (live Stripe keys: no probes, no Stripe objects)

Reference: `docs/reference/commerce.md` (read it whole before touching money).
- `packages/payments/src/providers/stripe.ts` is the only Stripe caller. A destination charge sets `transfer_data.destination` = the maker's
  connected account, with the org's share as `application_fee_amount` (`:204-205`). Otherwise it is a platform charge, and the ledger records what is owed.
- Routing: `resolveDestination` (`packages/checkout/src/server/stripe.ts:61`). It needs **every line to have the same maker** who
  `canReceiveDestinationCharge`.
- Payee: `resolveSettlement` (`packages/commerce/src/server/settlement.ts:77`). Maker = thread author for thread orders
  (`service-orders.ts:128-135`). The org's cut comes only from an accepted agreement (`resolveOrgShare`, `packages/services/src/agreements.ts:365`).
- Ledger: `payout_ledger` (098), append-only (`commerce/src/server/ledger.ts`). Third-party payees: `payee` + `org_beneficiaries`
  (209, `commerce/src/server/payees.ts`), ledger-only, "a person pays it out".
- Services: `packages/services/src/service-offerings.ts` (`upsertServiceOffering:243`, the one write path), `artist-offerings.ts` (`saveOffering`,
  `OFFERING_KINDS`), booking `@elkdonis/checkout/booking` (`thread-checkout.ts`), scheduling `service_bookings` (174, applied),
  `commerce/src/server/service-bookings.ts`. Tours: `startTourCheckout` → `createTourBooking`, `markTourBookingPaid` in `confirmOrderPaid`.
- One webhook for the network: art-auction `/api/stripe/webhook`. Apps add a return hop (`/api/checkout/return`; elktours has one).
- **Nothing models "service offered by member X, booked or commissioned by org Y" as a cost to Y.** Today the payer is always the buyer (end
  customer), and the payee is the thread author. There is no `transfers.create` anywhere (no separate-charges-and-transfers). A tour order is one
  line with one maker (Dana), so it cannot split between an artist and the org through Stripe.
  - Closest existing fit for "artist paid first, org takes a share, single fee": the artist **authors** the experience/service thread (homed in
    `oad` or `elktours`), the customer buys it directly, and the destination charge goes to the artist with the org's agreement share as
    `application_fee_amount`. That is one Stripe fee, and the artist is paid before the org. It works today if the artist accepted an elktours
    agreement (`org_agreements`).
  - An artist experience **bundled inside a tour order** is a mixed-maker order, so it falls back to a platform charge plus ledger accruals,
    with manual payouts. That is a real build (multi-line thread orders and transfers), not a stub.
  - Rule from commerce.md: **never give an org a connected account**. The org's share is a ledger balance only.
  - Stub suggestion: a commission record (org, artist user, service thread, status, agreed amount) with no money path, plus a link to the
    artist's ArtDirect service page.

## 5. Puck / page-builder

- `packages/page-builder` (`@elkdonis/page-builder`, pins `@puckeditor/core` **0.23.0**). Exports `PuckEditor` (`src/editor.tsx:74`; props
  slug, initial, config, orgId, onPublish, plugins, viewports, onSaveDraft), `buildPuckConfig`/`buildEditorConfig` (over `@elkdonis/blocks`),
  and `./server` (`loadPage`/`savePage`/`listPages`, store over `site_config`-style rows). `editor.tsx` imports `@puckeditor/core/puck.css` itself.
- `src/editor.tsx` + `package.json` carry **uncommitted** edits from the direct-editing session (save-recovery stash; `./style/schema`
  export). `packages/direct-edit` is being edited **right now** (files modified in the last 6 h) and depends on page-builder.
- Mounted today: danamccool `components/studio/page-editor.tsx` (the cleanest example, with plugins/HUD tabs), sunjay, innergathering,
  arts-collective `components/studio/OrgPageEditor.tsx`, artdirect `components/design/PersonPageDesigner.tsx`, art-auction (2 editors).
  RSC render: `import { Render, resolveAllData } from "@puckeditor/core/rsc"` (danamccool `app/[[...path]]/page.tsx`).
- `direct-edit` (plain-DOM canvas editor over block data, arts-collective classifieds and cards, innergathering page editor in progress) and
  `live-editor` (artdirect, arts-collective, ifac) are **separate** from Puck. The direct-editing plan's Phase 5 intends to upgrade Puck
  0.23 → 0.24 repo-wide and mount the direct-edit panel through Puck `overrides`. elktours must stay on exactly `0.23.0` until then, so the lockfile keeps one Puck.
- elktours readiness: `src/blocks/tour/config.tsx` is already in Puck `Config` shape (keys are persisted ids, so do not rename them).
  `lib/tour-layout.ts` reads `site_config` key `puck:tour-detail`. `TourPageProvider` context lives in `blocks/tour/context.tsx`.
- Minimal correct mount in elktours:
  1. `apps/elktours/package.json`: add `"@elkdonis/page-builder": "workspace:*"`, `"@puckeditor/core": "0.23.0"`.
  2. `next.config.ts` `transpilePackages`: add `@elkdonis/page-builder` and `@elkdonis/blocks` (danamccool does). If page-builder components
     use Tailwind classes, add `@source "../../../../packages/page-builder/src"` to `globals.css`.
  3. Install **only** via `cd ~/eac && sudo -n docker compose run --rm install`. That rewrites shared `node_modules` and `pnpm-lock.yaml`
     (already dirty from other sessions), so coordinate first. Then `docker compose restart elktours`.
  4. Route `/studio/tour-detail` (editor-only: `requireOrgEditor`). It is a client component rendering `<PuckEditor config={tourConfig} initial=...
     onPublish={serverAction}>` inside `TourPageProvider` with a sample tour. The server action re-checks the role and writes `site_config`
     `puck:tour-detail` (`db.json`). Puck canvas is an iframe that copies host styles at mount, so any CSS the blocks need must be imported in the
     **root** layout (index.ts header).
  5. Publish path stays `lib/tour-layout.ts` → `readTourLayout`. Validate the stored doc server-side (unknown block types dropped).

## 6. Media and asset storage

- Nextcloud path rule: `getUploadPath(orgId, type, filename, visibility)` (`packages/services/src/nextcloud.ts:286`) →
  `EAC_Network/<org>/Media/<Images|Videos|Audio|Documents>/…`, or `…/Private/Media/…` for non-public visibility. **A path without `Private/`
  is served to anonymous visitors.** `uploadFile` (`:300`), `getProxyFileUrl` → `/api/media/<path>` (`:226`).
- elktours serve route: `src/app/api/media/[...path]/route.ts` (org-scoped, passes Range headers, so video seeking works).
  Upload: `src/app/api/upload/route.ts` (editor-only; video ≤500 MB; writes a `media` row with `attached_to_type/id`). Picker:
  `components/manage/media-field.tsx`, `app/api/media/library/route.ts`.
- Films: `EAC_Network/elktours/Media/Videos/tour-<threadId>-{1080,720}-<stamp>.mp4`; posters in `Media/Images/…-poster-…jpg`;
  recorded at `threads.metadata.film = {url, url720, poster, source:"elktour-unity", seconds}`. Importer: `apps/elktours/scripts/import-films-2026-11-01.mts`.
  Stop stills: `tour_stops.still_url` (Street View Static, `lib/tour-cache.ts`).
- Existing table for an asset registry: `media` (`id, org_id, uploaded_by, attached_to_type varchar(20), attached_to_id varchar(21),
  url, type, nextcloud_path, mime_type, caption, alt_text, width, height`). It has **no** visibility/enabled flag and no stop-level id (stop
  ids are uuid, 36 chars, which does not fit `attached_to_id varchar(21)`). An asset registry with per-tour/per-stop visibility toggles needs a
  new table (or columns) via migration. Kinds "street view" and "3D map" are generated views, not files, so model them as toggles, not media rows.
- Fly-over render lifecycle precedents: `publish_jobs` (222: queued → started → finished, attempts, error), reels (189) + the
  `reel-render` worker. ElkTourUnity renders run offline on Justin's Windows PC (Unity + Cesium; ≤30 s Google limit), so a request
  row is a to-do for a human or an offline agent, not a server job.

## 7. Places, geocoding, maps, routing

- Geocoding: `geocodeAction` (`apps/elktours/src/lib/tour-actions.ts:313`, Photon, Paris-biased, `PHOTON_URL` env, editor-only) +
  `components/manage/place-search.tsx`. A fuller normalizer with a mock provider: `apps/artdirect/src/lib/geo.ts` + `app/api/geo/suggest/route.ts`.
  elastrocal has `app/api/geocode/route.ts`. There is no shared geocoding package and no POI catalogue table anywhere.
- Suggested locations: Photon can filter by `osm_tag` (tourism, historic, amenity) for POI suggestions. The other source is the org's own
  existing stops (85 distinct titles with coordinates), which makes a cheap first catalogue.
- Routing: FOSSGIS foot `routing.openstreetmap.de/routed-foot` (`lib/tour-cache.ts:79`), cached in `metadata.tour.route`.
- Maps: MapLibre + OpenFreeMap (`components/tours/tour-map.tsx`, `route-preview.tsx`). Street View: `street-view.tsx`, `street-view-pano.tsx`
  (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`). `three` + `3d-tiles-renderer` deps exist (virtual tour parked: "no third engine").

## 8. Migrations

- Dir `packages/db/migrations/`; runner `packages/db/scripts/migrate.mjs` (strips a file's own BEGIN/COMMIT). Apply:
  `sudo -n docker compose exec admin pnpm --filter @elkdonis/db db:migrate` (status: `db:migrate:status`). `eac-admin` is up.
- **Next free number: 233.** Duplicated numbers exist historically (052, 054, 102, 103, 112), so never reuse one. Other sessions are active
  (reels, stream, direct-edit Phase 4 plans `page_revisions`), so claim the number by creating the file first and check `ls` just before applying.
- Conventions: header comment block (number, date, purpose), `IF NOT EXISTS`, `org_id varchar(50) REFERENCES organizations(id)`,
  `thread_id varchar(21) REFERENCES threads(id)`, uuid PKs `gen_random_uuid()`, `timestamptz DEFAULT NOW()`, CHECKs for status vocabularies,
  and add org-owned tables to the `eac_tenant` `tenant_isolation` policy (227 pattern). Never edit an applied file. `elkdonis_dev` is production.

## 9. Guardrails

Do not touch without coordination (shared, source-exported, or another session in flight):
- `packages/services/**` (one broken file fails **every** app's type check; reels/stream sessions active), `packages/cms-ui/**`
  (surface, compose; many uncommitted edits), `packages/commerce/**` + `packages/checkout/**` + `packages/payments/**` (live money),
  `packages/page-builder/**` + `packages/direct-edit/**` (direct-editing session, active now), `packages/db/src/**`, `packages/auth-server/**`.
- `docker-compose.yml`, `.env`, `CLAUDE.md`, `pnpm-lock.yaml`, root `package.json` (shared-file edits were refused earlier: brief 2026-11-01).
- `OFF_FEED_KINDS`, `SCHEDULED_KINDS`, `PURCHASABLE_THREAD_KINDS`, `SurfaceKind`: one-line edits with network-wide effect.
- `saveTourStops` (commerce): the only stop writer. The importer and the stop editor depend on its id-preserving behaviour.

Breakage risks:
- Dev-mode public site: an edit to anything elktours imports (incl. `@elkdonis/services`, `cms-ui`) can 500 elkdonisexperiences.com instantly.
  Save complete files only. Prefer new files plus a final one-line import.
- `docker compose run --rm install` replaces `node_modules` under **every** running container. Run it once, coordinated.
- Persisted keys: Puck block keys in `blocks/tour/config.tsx`, `site_config` key `puck:tour-detail`, `metadata.film`/`metadata.tour` shapes.
- Public leakage: private place notes and stats, `guide_notes`, and `Private/` media must be stripped server-side before props reach client components.

Commands (from Git Bash: `ssh eris`, then `cd ~/eac`):
- Type check elktours: `sudo -n docker exec -w /app/apps/elktours eac-elktours pnpm -s check-types` (baseline 0 errors, ~20 s).
- A touched package: `sudo -n docker exec -w /app/packages/<pkg> eac-admin pnpm -s check-types`. If `services` or `cms-ui` changed, also type-check
  each live consumer app (arts-collective, ifac, innergathering, artdirect, …).
- Lint: elktours has no flat ESLint config (`pnpm lint` fails at config load). Skip it, or add `eslint.config.mjs` as its own task.
- Logs: `sudo -n docker compose logs --tail 100 elktours`. DB read: `sudo -n docker compose exec -T postgres psql -U postgres -d elkdonis_dev`.
