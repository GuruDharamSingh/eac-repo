# CLAUDE.md

Orientation for Claude Code in the Elkdonis Arts Collective (EAC) monorepo.
Rewritten 2026-09-23. Kept short on purpose: it loads in every session. Detail
lives in `docs/reference/` (read on demand) and, on the maintainer's machine, in
`.claude/rules/` (loaded automatically by path) — see `.claude/README.md`.

## What this is

A self-hosted platform run by the Elkdonis Arts Collective, a not-for-profit.
One server hosts a network of org sites (arts groups, study groups, artists'
sites, an art marketplace) that share one database, one sign-in and one
Nextcloud. `arts-collective.com` is the network hub and offers subdomain
hosting; the collective also hosts and edits other organisations' own domains.
`inner_group` (InnerGathering, `elkdonis-arts.org`) is the collective's core
member group; its content is private by default.

Stack: Next.js 16 (App Router) + React 19 + TypeScript · PostgreSQL 16 ·
Supabase GoTrue · Nextcloud 33 (AIO) · Redis · Silex 3.9 · Puck
(`@puckeditor/core`) · Turborepo + pnpm · Docker Compose on a TrueNAS host,
edge via Nginx Proxy Manager. UI: `@elkdonis/cms-ui` + `@elkdonis/primitives`
(plain CSS on `--eac-*` tokens); Mantine + `@elkdonis/ui` only in five legacy apps.

## Facts that prevent the most damage

- `elkdonis_dev` is the production database. Every write lands on live data.
- The Stripe keys in `.env` are live. Do not create Stripe objects or run probe
  scripts; see `docs/reference/commerce.md`.
- The tree and the running containers are shared with other sessions. Read
  `.claude/rules/00-working-style.md` (or `docs/reference/ops.md`) before any
  build, checkout, revert or migration.
- Multi-tenancy is by `org_id` on every content table; filter by it.
- Resolve the acting user from `getServerSession()`, never from request params.
  `users.is_admin` is granted only in `apps/admin`.
- A media path without a `Private/` segment is served to anonymous visitors.
- Check `\d <table>` before hand-writing SQL; several documented columns do not
  exist. Store jsonb with `db.json(x)`, never `${JSON.stringify(x)}::jsonb`.
- A new `threads.kind` appears on every feed, forum and search page unless it
  is added to `OFF_FEED_KINDS`.
- `request.nextUrl.origin` reports `0.0.0.0:<port>`; build external URLs with
  `publicOrigin()`.
- `@elkdonis/services` exports TypeScript source: one broken file fails every
  app's type check.

## Operating rules

- Install only through the container: `docker compose run --rm install`.
  `node_modules` holds Alpine/musl native addons (sweph, sharp).
- App containers run as uid 3003 from one image, `eac-dev`
  (`docker build --target development -t eac-dev .`). Nothing in the tree
  should be root-owned.
- Each app's `.next` is a per-container volume; the host `apps/<app>/.next`
  directory is its mount point. Never `rm -rf` it on the host. To force a
  rebuild of a production-mode app, follow `docs/reference/ops.md`.
- `docker-compose.override.yml` is untracked but changes what runs. Use
  `docker compose config` to see the effective configuration.
- After editing `.env`, recreate the service (`docker compose up -d <svc>`);
  `restart` does not re-read it. `NEXT_PUBLIC_*` and `<APP>_URL` are baked in
  at build time.
- Postgres, Redis, PostgREST and Realtime listen on 127.0.0.1 only; apps reach
  them on `eac-network`.
- Type-check script is `check-types` in every workspace (turbo skips other names).
- Migrations: next number via `/new-migration`; never reuse a number or edit an
  applied file. The runner strips a file's own `BEGIN;`/`COMMIT;`.
- Nightly DB backups: `scripts/backup-db.sh` → `~/eac-backups` (same pool; not off-box).
- There are no automated tests or CI. Verification is manual: `docs/reference/testing.md`.

## Commands

```bash
docker compose ps                                        # what is running
docker compose logs -f <svc>
docker compose up -d <svc>                               # (re)create one service
docker compose exec admin pnpm --filter @elkdonis/db db:migrate
docker compose exec admin pnpm --filter @elkdonis/db db:migrate:status
docker compose exec -T postgres psql -U postgres -d elkdonis_dev
pnpm --filter <pkg> check-types                          # in a container
./scripts/add-proxy-host.sh <host> <port>                # proxy host + certificate
```

Do not run a bare root `pnpm dev` (it starts every app).

## Apps

| Dir | Port | org_id | Public host | Status |
|---|---|---|---|---|
| admin | 3000 | global | — | internal; stopped 2026-10-19 (start it before migrations or check-types) |
| sunjay | 3001 | sunjay | paratheater.arts-collective.com | live |
| blog-guru-dharam | 3002 | guru-dharam | — | not running |
| forum | 3003 | all orgs | forum.arts-collective.com | live (Grand Forum; owns wiki + dictionary) |
| inner-gathering | 3004 | inner_group | meetings.elkdonis-arts.org | stopped 2026-10-10 (retired; do not restart) |
| elkdonis-arts-collective | 3005 | elkdonis | — | retired (landing moved to innergathering) |
| amrit-canada | 3006 | amrit_canada | amritcanada.ca | live; template for new org sites |
| arts-collective | 3007 | network | arts-collective.com | live; SSO broker, `/hub` console |
| ifac | 3008 | ifac | ifacgroup.com | live |
| art-auction | 3009 | market | market.arts-collective.com | live; reference store app |
| blog-tester | 3011 | elkdonis | — | not running |
| hidden-enneagram | 3012 | hidden-enneagram | hiddenenneagram.com | live; Silex pages |
| artdirect | 3013 | network | directory.arts-collective.com | live |
| pigeonshoot | 3014 | pigeonshoot | — | not running |
| innergathering | 3015 | inner_group | elkdonis-arts.org | live |
| elastrocal | 3016 | elastrocal | arts-collective.com/astro | stopped 2026-10-19 (dev mode); `/hub/studio` review deck |
| danamccool | 3018 | danamccool | danamccool.com | live; Puck pages |
| fourthwayBookreaders | 3019 | fourth_way_book_readers | elkdonis-arts.org/books | live; basePath `/books` |
| elktours | 3021 | elktours | — (LAN only) | dev mode; Paris tour company, card bookings |
| sophia | 3020 | — | — | LMS; not deployed |
| signal-watch | — | — | — | Android app, outside the web platform |

Details, run modes and per-app traps: `docs/reference/apps.md`. Ports 3010 and
3017 are held by containers outside this repo.

Packages (41, in `packages/`): catalogue and conventions in
`docs/reference/packages.md`. Most-used: `db` (client, migrations), `services`
(business logic, source-exported), `auth-server`/`auth-client`, `cms-ui`,
`primitives`, `nextcloud`, `email`, `commerce`/`payments`/`checkout`,
`blocks`/`page-builder`.

## Current work (2026-09-25)

- Onboarding sprint, workstreams A–F: `docs/open/SPRINT_2026-09-18_onboarding.md`.
- Open security fix: `getServerSession()` does not verify the session token.
  Thread-body sanitising and archive-not-delete landed in `56f5639`.
- Network sign-in arrival check and global sign-out: uncommitted; migration 164
  applied and six apps rebuilt 2026-09-25; signed-in browser test and
  fourthway/forum restarts open. `docs/sessions/2026-09-25_network-sso.md`.
- artdirect (3013) and forum (3003) are down (edge 502). forum was restarted 2026-09-26 and
  stopped again the same day at the developer's request; match light is in its source.
- Fourth Way reading circles (2026-09-26): circle page with session tabs, manage section,
  /manage/groups, Talk/doc embedding (`eac_embed` NC app); recording capture and transcripts
  not started. `docs/reference/apps.md` fourthwayBookreaders.
- Open briefs not started: forum switcher (B), hub tour (E), Silex 3.9 phases 2–3,
  person pages (built and deployed 2026-09-26 except IFAC's rebuild; Puck
  profile/featured pages on ArtDirect in progress;
  `docs/open/PERSON_PAGES_BRIEF_2026-09-26.md`).
- Astro Studio (2026-09-26): migration 167 applied, corpus imported, review deck live at
  /astro/hub/studio (owners); 150-question test set served first; export and scoring
  written; helper/scoring blocked on ANTHROPIC_WORKSPACE_ID. Book importer from the WSL chunker
  written; migration 176 written, unapplied (174 pending ahead of it). `docs/open/ASTRO_DIGESTION_BRIEF_2026-09-27.md`.
- Studio (2026-09-27): `packages/studio` + arts-collective `/studio` (Writing tab, autosave,
  Show on, blank piece on open, "New ▾" menu) deployed 2026-09-27 in its own light/dark
  identity (ten arts-collective rebuilds; signed-in render, screenshots, font and token
  probes checked). Center and landing link to it. Essay canvas ("Use blocks") deployed
  the same evening with migration 173 (`threads.body_doc`); article.css now lays the
  body on a breakout grid for every site (visible on their next rebuilds). Layout presets,
  series, Publish as, SEO and the Library followed (24 builds; all in `threads.metadata`).
  Root `pnpm.overrides` pin `prosemirror-*`. Focus mode (writing-room look, side menu) is
  the default since 2026-10-03 (brief §4.2a). Next: revisions, the `.docx` route
  (`docs/open/STUDIO_BRIEF_2026-09-27.md`, `docs/open/BLOCK_CANVAS_BRIEF_2026-09-27.md`).
- Services as offerings (2026-09-27, uncommitted): one service layer, `service` compose kind, OAD Services
  section, card booking via `@elkdonis/checkout/booking`, time scheduling (migration 174 written, not applied);
  containers not recreated. `docs/reference/commerce.md`.
- Analytics (2026-10-02): `packages/analytics` (beacon, `/api/pulse` collector, shared dashboard; migration 180) live on
  amrit-canada (`/manage/analytics`, owners) and arts-collective (`/hub/analytics`, admins + owners); other sites have no
  beacon; no GeoLite2 database yet. `packages/analytics/README.md`.
- Thread audiences (2026-10-03, source only): migration 188 `threads.min_role` **unapplied**; apply it before rebuilding any app
  (shared queries select it). innergathering/amrit `getThreadBySlug` served members-only posts to anyone; fixed in source.
  `docs/reference/data-model.md`.
- Studio Video (2026-10-03): arts-collective `/studio/video` (reels from Remotion templates in `packages/reels`,
  browser recorder, music in `users/<f>/Private/Music` + `oad/Private/Music`), worker `reel-render`, migration 189
  applied; verified signed in. 2026-10-04: Video is a Studio kind (`/studio?kind=video`, shared frame `@elkdonis/studio/frame`);
  reels publish to the ArtDirect page as writing pieces. `docs/reference/nextcloud.md` "Reels".
- Server OBS (2026-10-03): `obs` container + `/studio/broadcast` (admins), record/stream verified to a local RTMP
  server. 2026-10-28: renders on the iGPU (headless sway instead of Xvfb), ~0.1 core instead of 0.8-3.3.
  `docs/reference/nextcloud.md` "Server OBS".
- IFAC series (2026-10-11, uncommitted, deployed): `series` thread kind (IFAC series flipped), `series_sessions`
  sidecar (migration 203 applied) with cancel/move, compose "One meeting | Series", planner Weeks/Manage tabs (email
  list, stats), per-series letters and mailings in the email suite, subscriptions (migration 202). Designs:
  `docs/open/SERIES_KIND_DESIGN_2026-10-10.md`, `docs/open/SERIES_EMAIL_DESIGN_2026-10-10.md`; plan
  `docs/open/IFAC_SERIES_PLAN_2026-10-10.md`; debrief `docs/open/EMAIL_RSVP_DEBRIEF_2026-10-10.md`. Scratch DB
  `elkdonis_scratch` exists for series tests; drop when done.
- IFAC series covers (2026-10-13, deployed): migration 205 (week subtitle, rich write-up, cover framing), series cover
  image/video/embed and About; shared `CoverFramer` in cms-ui files. `docs/open/IFAC_SERIES_PLAN_2026-10-10.md`.
- IFAC several series (2026-10-18, source only, verified in the dev preview, not deployed): /series index (cards carousel,
  List | Calendar, Earlier series), series page reworked (general card + next band + rows), /hub/series editor, planner
  colour/listed/featured, share previews. No migration. ifac rebuild held: another session's /center + payouts work is in the tree.
- innergathering renamed "Elkdonis Arts Collective" (code + `organizations` row, 2026-10-08) and a third hub layout
  "Cards 2" (cards → pages with breadcrumbs, Nextcloud frames); built and deployed 2026-10-08. `docs/reference/apps.md`.
- Art auction (2026-10-18): org stores, artist credit, beneficiaries, 5% commission (`store.commission_rate`), auction
  mechanics, series on migration 190, "My art" hub. Decisions in `docs/open/ORG_STORE_BRIEF_2026-10-15.md`; plan
  `docs/open/ART_AUCTION_PLAN_2026-10-18.md` (phases A-G). Phases A-F built 2026-10-18/19 (migration 209; org stores, credit,
  beneficiaries, 5% commission, checkout support choice, admin money; ladder/proxy bids/buy-now/registration, `auction-clock`
  service; series admin + landing + presenter; "My art" tabs). G (PayPal, live call, shipping) open. Silent auction November 2026.
  Handover `docs/sessions/2026-10-19_art-auction-phases-a-f.md`; IFAC series row still to be created in Admin → Series.
- Housekeeping review with the developer (2026-10-18): site by site, notes only, no code changes yet; first pair
  ifac + innergathering. `docs/open/HOUSEKEEPING_2026-10-18.md`.
- Center journeys (2026-10-18, deployed on ifac + innergathering): `/center` has no site nav; the journeys are three
  gradient cards on a blue field, one per central site (sell your art on the market, your listing in the artist
  directory [services, art on your page, Stripe], create a collective [in development]); each opens a centered dialog
  (`cms-ui/center/JourneyTabs.tsx`, `surface/surfaces/journey-panels.tsx`). Owners and guides manage their org (Details,
  People) in the org section itself (`center/OrgManage.tsx`). Shared services: `org-people.ts`, `org-create.ts`.
  Stores default to 5% (migration 207, org stores 0). arts-collective rebuilt 2026-10-29 (whole tree). Open items in
  `docs/open/CENTER_JOURNEYS_2026-10-18.md`. Mock-ups: https://claude.ai/artifact/FGVA7UCtiKKCGYSBQeBBVa.
- Elkdonis Tours & Experiences (2026-10-18, uncommitted; container stopped 2026-10-19): `apps/elktours`, migration 208 applied
  (`tour` kind, stops, departures, party-size bookings), `createThreadOrder` quantity, sample tour only. Waiting on
  Dana's PDFs, her Stripe onboarding, a Google Maps key and a domain. `docs/open/ELKTOURS_BRIEF_2026-10-18.md`.
- Classifieds (2026-10-25, deployed on artdirect): `/classifieds` continuous section viewer, 155-template box catalog,
  thematic-centre topography, dials, worlds (`apps/artdirect/src/classifieds/`; specimens catalog in
  `apps/artdirect/classifieds/`). artdirect rebuilt and restarted 2026-10-25 with the whole uncommitted tree.
  Plan and open questions: `docs/open/CLASSIFIEDS_PLAN_2026-10-24.md`.
- Forum UI (2026-10-28): one rail, no right column, "Aa" reading menu, calmer type, in `packages/forum-ui`;
  rebuilt on amrit-canada, ifac, innergathering, sunjay, hidden-enneagram. `docs/reference/apps.md` forum.
- Collect Art landing + loft scene editor (2026-10-29): welcome band, frosted loft and white ground deployed on art-auction;
  scene editor phase 1 (scale handles, snapping guides, nudge, undo, cm inspector in `packages/three/hallway` + installations
  editor) deployed 2026-10-29 with migration 214; phase 2 (ratio + crop on placements, Framing section) deployed
  2026-10-29 with migration 215; phase 3 (lighting presets, room sliders, picture-lamp points) in source 2026-10-30,
  migration 218 **unapplied** (apply before the next art-auction build); phases 4-5 (`/admin/loft`) open. `docs/open/LOFT_SCENE_EDITOR_BRIEF_2026-10-29.md`.
- Meta publishing (2026-10-29, deployed on both): data policy `/data`, deletion `/data/delete`, callbacks
  `/api/meta/data-deletion` + `/api/threads/data-deletion` on innergathering and arts-collective (shared `@elkdonis/cms-ui/data-policy`,
  `@elkdonis/meta` signed requests; migration 216). Connections gained providers `meta` (Facebook Pages + Instagram, Page tokens in
  `user_connections.targets`, migration 217), `threads` and `instagram` (Instagram Login, no Page) using the collective's three apps
  (`META_*`, `THREADS_*`, `INSTAGRAM_*` in `.env`, passed in compose); callbacks also at `/api/instagram/data-deletion`;
  one-click connect in the profile Connections tab; Studio "Post to" (`apps/arts-collective/src/lib/share-actions.ts`, shares in
  `threads.metadata.shares`). Meta dashboard: Facebook Login redirect URI `https://arts-collective.com/api/connections/callback`;
  App Review screencasts not recorded. `packages/cms-ui/src/data-policy/README.md`. 2026-10-31: first live connect returned
  every permission but no Page (no Page ticked in the dialog's Pages step); error text and `auth_type=rerequest` fixed.
  `/center` gained a "View profile | Studio" bar over the journeys; "View profile" opens the `me` surface (listing journey's
  tabs + Connections, no rail; `?surface=me:connections`), served on arts-collective and innergathering
  (`api/center/connections`). Studio Post kind (`packages/studio/src/post`, `apps/arts-collective/src/lib/post-actions.ts`,
  table `social_posts`): text, up to ten pictures, link, per-platform text, Facebook/Instagram/Threads previews, Post to.
  Migration 219 applied 2026-10-31; editor verified signed in. The first successful post also mirrors the post to a
  network thread (blog for Just me, else the org's first postable feed; `threads.metadata.socialPostId`), unverified live.
  Webhooks (2026-10-31): `/api/{meta,instagram,threads}/webhook` on arts-collective (`@elkdonis/meta/webhook`; verify token
  `META_WEBHOOK_VERIFY_TOKEN`; deliveries kept in `meta_webhook_events`, migration 220 **unapplied**, inserts best effort).
  2026-11-01 (debate follow-through, `docs/open` has the debate): directory serves public `EAC_Network/oad/` media; owner-only
  `setPublishTarget`; `getConnectionAccessToken(id, userId?)`; `org_channels` (migration 221, **unapplied**) with a "Channel for"
  picker in Connections and a post-as-org guard in `post-actions.ts`; `publish_jobs` ledger (migration 222, **unapplied**, best
  effort) around both share paths; `centerRoutes()` factory, connections routes + connector added to ifac, amrit-canada, sunjay.
- Onboarding course (2026-10-30, deployed on arts-collective): LMS `task` steps that tick from platform state, Sophia
  mounted at `arts-collective.com/learn` with the Center journeys opening inside steps, course `getting-started` seeded
  (org `elkdonis`, public). Sign-ups get no default org and land on the course. Phase 4
  (default identity landing page, pin UI, Puck `puck:home` org pages with the editor at `/hub/sites/<slug>/design`, name on
  org creation) and phase 5 (hub course card, `components/hub/CourseCard.tsx`) deployed 2026-10-30 (second rebuild).
  `docs/open/ONBOARDING_COURSE_BRIEF_2026-10-29.md`.
- Known failing: `check-types` in `@elkdonis/cms-bindings` (hub template fails
  `validate:template`).

Update this section when work starts or finishes; keep it under ten lines.

## Documentation

- `docs/reference/` — current state per subsystem; start here (`/orient <area>`).
- `docs/open/` — briefs and boards with outstanding work.
- `docs/sessions/` — handovers (`/handover`).
- `docs/archive/` — reports before 2026-09-23; historical, often stale.
- Write in the neutral register described at the end of `docs/README.md`.
