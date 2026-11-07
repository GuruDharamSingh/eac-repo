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
| elktours | 3021 | elktours | elkdonisexperiences.com | live, production mode since 2026-11-03 (source edits need a rebuild); Paris tour company, card bookings |
| sophia | 3020 | — | — | LMS; not deployed |
| signal-watch | — | — | — | Android app, outside the web platform |

Details, run modes and per-app traps: `docs/reference/apps.md`. Ports 3010 and
3017 are held by containers outside this repo.

Packages (43, in `packages/`): catalogue and conventions in
`docs/reference/packages.md`. Most-used: `db` (client, migrations), `services`
(business logic, source-exported), `auth-server`/`auth-client`, `cms-ui`,
`primitives`, `nextcloud`, `email`, `commerce`/`payments`/`checkout`,
`blocks`/`page-builder`.

## Current work (2026-09-25)

- Onboarding sprint, workstreams A–F: `docs/open/SPRINT_2026-09-18_onboarding.md`.
- `getServerSession()` verifies the token since 2026-11-01 (`verify-session.ts`); each app needs a rebuild and `JWT_SECRET` (fourthway lacks both; amrit-canada done 2026-11-04).
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
- Studio pipeline (2026-11-06): In → Make → Channel → Out, one channel per person; phase 1 lineage (`studio_items`, migration 248 applied 2026-11-07; `@elkdonis/services/studio-items`, wired in reels.ts + recordings.ts, source only). `docs/open/STUDIO_PIPELINE_DESIGN_2026-11-06.md`.
- Daily routines (2026-11-07): routine = a repeating course on the action layer, publishing ladder §3.0; Akhand Path day entries `paath-*` + `@elkdonis/services/paath-day` + LMS `task.repeat` deployed on arts-collective; course `akhand-path-daily` seeded 2026-11-07 (2 readers enrolled); arts-collective rebuilt 2026-11-07 01:00 EST (`ppb3r1Y96TNhxqbAQRN6x`), not yet opened signed in. `docs/open/DAILY_ROUTINE_BRIEF_2026-11-06.md`.
- Channel console (2026-11-07, source only): `@elkdonis/studio/channel` mounted at arts-collective `/studio/channel?org=` (posts, artwork with "Post this" → draft post, accounts, publish activity, link-outs); katie-the-potter `/channel` hands off to it and its `/hub` has a Channel card. Neither app rebuilt. `docs/open/CHANNEL_CONSOLE_DESIGN_2026-11-07.md` §0.
- Server OBS (2026-10-03): `obs` container + `/studio/broadcast` (admins), record/stream verified to a local RTMP
  server. 2026-10-28: renders on the iGPU (headless sway instead of Xvfb), ~0.1 core instead of 0.8-3.3.
  `docs/reference/nextcloud.md` "Server OBS". 2026-11-01: booth `/studio/broadcast/desktop` (full OBS window via noVNC,
  Listen, program picture) through the agent's token door on host port 4458; deployed; edge location `/obs/` on NPM
  proxy host 23; Talk audio through the browser source verified; OGraf graphics
  layers (lower third, title, bug, countdown, admin uploads) from a Graphics panel; a scene editor (scenes, sources,
  media, mixer) and webcams (into OBS, record to files) in the console. "Broadcast booth" / "… graphics" / "… scene editor and cameras".
  Studio Recordings kind, phone capture `/c/<code>`, guest cameras (WHIP) and a `clip` reel template with overlays:
  same doc, "Recordings, phone capture and guest cameras" and "Clip template and clip editor". Edge `/obs/` added
  and used 2026-11-01; later that day: clip cuts + timeline + seven overlay kinds, three more booth graphics,
  booth OBS recordings copied into the Studio's Recordings (admins).
  Then: cut-only clips render through ffmpeg (~10x faster), reel-render image with ffmpeg 9.0.2 + whisper.cpp
  (small.en), `text` and `subtitles` overlay kinds, transcripts (migration 229 applied 2026-11-01), Studio picture
  editor (Filerobot + sharp route `/api/studio/image`) on the Post kind. `docs/reference/authoring.md`.
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
- Housekeeping review with the developer (2026-10-18): site by site, notes first, removals only when asked; first pair
  ifac + innergathering; areas 1-2 of 7 done; document-link fix in source 2026-11-04, live on amrit-canada only; attendee reminders for innergathering in source 2026-11-04 (`attendee-reminders.ts`), not live; innergathering rebuild held. arts-collective rebuilt twice 2026-11-04 (org email limited to owners and guides; followers lost team files, roster and draft data in the hub, restricted threads). Notes areas 3-4 and "Follower access". 2026-11-06: /manage (and market /admin) pages on eight sites stream their data to signed-out visitors (layout-only gate); page gates in source on 80 pages, not rebuilt, live until each app is rebuilt (notes "Console pages served to signed-out visitors"). `docs/open/HOUSEKEEPING_2026-10-18.md`.
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
  2026-10-29 with migration 215; phase 3 (lighting presets, room sliders, picture-lamp points) deployed by
  2026-11-01 with migration 218; phase 4 (`/admin/loft`, landing drawn from an org-owned installation, opening view,
  visitors' free spot) deployed 2026-11-01 with migration 230 (nothing published yet: visitors see the starting hang);
  phase 5 open. `docs/open/LOFT_SCENE_EDITOR_BRIEF_2026-10-29.md`.
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
  `META_WEBHOOK_VERIFY_TOKEN`; deliveries kept in `meta_webhook_events`, migration 220 applied 2026-11-01).
  2026-11-01 (debate follow-through, `docs/open` has the debate): directory serves public `EAC_Network/oad/` media; owner-only
  `setPublishTarget`; `getConnectionAccessToken(id, userId?)`; `org_channels` (migration 221, applied 2026-11-01) with a "Channel for"
  picker in Connections and a post-as-org guard in `post-actions.ts`; `publish_jobs` ledger (migration 222, applied 2026-11-01) around both share paths; `centerRoutes()` factory, connections routes + connector added to ifac, amrit-canada, sunjay.
  Later 2026-11-01: network Terms (`network-terms` agreement under org `elkdonis`, migration 223 applied 2026-11-01; `/terms` on
  both hosts, checkbox at signup, hub notice for older members, `/api/terms/accept`); `/data` names the Center and Google
  Limited Use; `CONNECTIONS_KEY` (seal v2, lazy re-seal of v1 rows; in `.env` and compose for the eight connection
  services, containers recreated); `connection_events` (migration 224 applied 2026-11-01) with a Recent activity
  list in Connections; Threads/Instagram revoke attempted on remove (no documented endpoint).
  Daily connection maintenance in the video worker (`connection-maintenance.ts`: Meta-family refresh after 30 days,
  reconnect mail on failure or within 7 days of Facebook's data-access end; worker env gained mail + Meta vars;
  services now depends on `@elkdonis/email`). App Review prep: `docs/open/META_APP_REVIEW_2026-11-01.md`.
  Comments to threads (2026-11-01, deployed on arts-collective + artdirect): `thread_external_comments` (migration 225
  applied 2026-11-01), `external-comments.ts` (webhook feed/comments → rows, matched by `publish_jobs.external_id` or the share
  permalink), "From Facebook" block under the piece on ArtDirect, Page feed subscription after each Page post and daily
  (needs `pages_manage_metadata` in the login configuration + reconnect; Meta refused it on 2026-11-01 02:59).
  Go live card in the Studio Video kind (2026-11-01, deployed; admins): destination preset (YouTube Live, Facebook Live,
  custom RTMP) + key → claims the OBS lease, sets stream settings, starts/stops the stream (`packages/reels/src/editor/
  LiveCard.tsx`, `broadcastPeek`). Verified 2026-11-01 04:00 against a local MediaMTX receiver (1080p H.264 + AAC), including
  go live → reload → Stop (Stop re-takes the lease). `obs` container started 2026-11-01 and left running. Direction
  agreed: OBS as the hub, browser-source overlays for effects, Talk rooms via browser source, Zoom via an RTMP ingest. Plan for the
  next two day-sessions (booth = full OBS desktop in the browser; relay = one stream in, many out, feeds in):
  `docs/open/BROADCAST_BOOTH_AND_RELAY_PLAN_2026-11-01.md`.
  Stream relay (2026-11-01, deployed; session B of that plan): `relay` service (`docker/relay`: MediaMTX + ffmpeg copy fan-out +
  agent on `relay:4457`), `stream_destinations`/`stream_events` (migration 226 applied), Go live card shows saved destinations
  (`RelayPanel.tsx`, `relay-actions.ts`) and Feeds in; Go live → two local receivers verified signed in; Stop/lease fix deployed and verified
  2026-11-01 05:30 UTC. RTMP 1935 open to the internet (router forward, 2026-11-01). Twitch/Kick presets and Twitch chat
  (`stream-chat` service, migration 228 applied) the same day; YouTube chat through a connected channel in source
  (collector running; picker deployed 2026-11-02; the channel is not yet enabled for live streaming); chat on air as booth graphic `eac-chat` (2026-11-02, live in OBS). Not verified: a real YouTube/Facebook/Twitch key, a feed published
  from outside. `docs/reference/nextcloud.md` "Stream relay".
- Onboarding course (2026-10-30, deployed on arts-collective): LMS `task` steps that tick from platform state, Sophia
  mounted at `arts-collective.com/learn` with the Center journeys opening inside steps, course `getting-started` seeded
  (org `elkdonis`, public). Sign-ups get no default org and land on the course. Phase 4
  (default identity landing page, pin UI, Puck `puck:home` org pages with the editor at `/hub/sites/<slug>/design`, name on
  org creation) and phase 5 (hub course card, `components/hub/CourseCard.tsx`) deployed 2026-10-30 (second rebuild).
  `docs/open/ONBOARDING_COURSE_BRIEF_2026-10-29.md`.
  2026-11-06: direction to grow task steps into an action layer (registry first, then in-lesson actions, a dock on every
  site, runbooks per org/series). Phases 1-2 deployed 2026-11-06 (arts-collective + Sophia, uncommitted): `packages/actions` registry
  (17 entries, `runAction`, params, forms), studio task picker, no task step leaves the lesson; clicked through live. Brief §5a-5c.
  Registry pass deployed 2026-11-06 22:45 UTC (arts-collective only, uncommitted): 8 runners (incl. org draft posts), refusal codes, `check:registry`, `/api/actions` routes, `action_events` (migration 245 applied). §5d-5e.
  Post actions deployed 2026-11-06 23:30 UTC (arts-collective): scope `thread`, `thread-edit`/`-publish`/`-pin`, publish and pin only from host pages; migration 246 applied. §5f.
  Dock slice 1 deployed 2026-11-07 02:30 UTC (arts-collective, hub host only): `@elkdonis/dock`, `/api/actions/dock`; editors see drafts at their URL. §5g.
- Tenancy floor (2026-11-01, phase 1 of the one-app review; arts-collective rebuilt and recreated with JWT_SECRET 2026-11-01 22:40 UTC, tenant-smoke 9/9; rebuilt again 2026-11-02 04:25 UTC, tenant-smoke 9/9, forged cookie rejected; other apps not rebuilt):
  session verification (`packages/auth-server/src/verify-session.ts`, used by getServerSession, logout, /api/auth/session and the
  three OIDC authorize routes; `JWT_SECRET` added to 15 app services in compose, recreate with `up -d` when rebuilding);
  migration 227 applied (`eac_tenant` role + RLS on 21 org-owned tables, policies bind only that role, postgres unaffected);
  `withOrg(orgId, fn)` in @elkdonis/db (dist built; no caller yet); arts-collective middleware 404s /sites/<other org> on an org
  host. `scripts/tenant-smoke.sh` checks it through the edge (fails until arts-collective is rebuilt).
- Org classifieds page (2026-11-01, experiment; on arts-collective; checked 2026-11-02 04:25 UTC: visitor 404 without a page, editor redirects to login): `<org>.arts-collective.com/classifieds`, editor at
  `/hub/sites/<slug>/classifieds` (owners/guides). Direct-editing engine `lib/classifieds/editor-engine.ts` over `catalog.ts`; stored in
  site_config `classifieds:page` through `withOrg`; each ad links to an org thread or any http(s) URL. Plan: `docs/open/DIRECT_EDITING_LAYER_2026-11-01.md`.
- Direct-editing panel (2026-11-01; pass 1 on arts-collective since the 22:40 UTC rebuild; pass 2 since the 2026-11-02 04:25 UTC rebuild; pass 3 on arts-collective since the 2026-11-02 17:05 UTC rebuild (tenant-smoke 9/9),
  not committed): `packages/direct-edit` (slot schema + freedom levels, history, plain-DOM panel, overlay, click-deeper, drags, view, text bar,
  menu, richtext) plus pass 3: `block/` (subpath `@elkdonis/direct-edit/block`: style vocabulary + cleanStyle, node tree + cleanTree, layout grid, {{token}}
  binding), smooth grid resize (`canvas/resize.ts`), node drag between containers (`canvas/nodedrag.ts`), palette colour popover. Classifieds ads are node
  trees (boxes stack/grid, dividers, pictures; parts drag, nest, move between ads; absent tree = template's, old docs read unchanged); each sheet picks its grid
  (doc.grid). Feed cards: `lib/cards/` (site_config `cards:feed`), editor `/hub/sites/<slug>/cards`, drawn by `components/cards/FeedCards.tsx` in
  OrgDefaultPage "What's on" when saved; getOrgFeed adds cover_image_url. Harness drive1 64/64, drive2 197/197, drive3 141/141; check-types 0 in direct-edit,
  fonts, page-builder, arts-collective. Next: Phase 4; tour stops; Puck mounting; font_library. Plan + "Pass 3 progress": `docs/open/DIRECT_EDITING_PANEL_PLAN_2026-11-01.md`.
  Handover for a fresh session (state, paths, docs, artifacts, Justin's direction, ordered next steps): `docs/sessions/2026-11-02_direct-editing.md`.
- Canvas framework (2026-11-02): direct-edit is the editor layer on Puck: Puck keeps storage, catalogue and published rendering. Source only since innergathering's last rebuild: right panel, thin bar and tool pills, move and resize, picture chooser, right-click tools, box tree (`box`, `words`, `picture`, `part` blocks, `/studio/<slug>/canvas`, editable Code tab), Detach, and the landing page as a stored tree with nine live parts (`puck:landing`; none saved yet; saving one freezes hero, about and other copy against /manage/pages). Live on elkdonis-arts.org: click-through and the small bar on nine declared landing sections (`page-edits:home`). `docs/open/CANVAS_FRAMEWORK_2026-11-02.md`. Developer space proposal: `docs/open/DEV_SPACE_PROPOSAL_2026-11-02.md`. Synthesis (2026-11-04): model and stones in `docs/open/canvas-synthesis-2026-11-02/3-synthesis.md`. Stone 1 (a sealed block's settings in the right column, sample data) is source only and on the private test page; no host passes a contract, and hosts without one compared unchanged in the harness. Stone 2 (click into a block; edits `packages/blocks` and `page-builder/src/config.tsx`) started 2026-11-04, also `apps/sunjay/src/blocks/layout-blocks.tsx`. Developer, 2026-11-04: test on live sites, no private copy. Stone 2 (`props.morph`, parts on six blocks) is on the private test page and in source; no-morph markup identical, 93/93 in three modes, rerun 2026-11-04 16:19 EST. Testing per stone is one good pass, not a matrix (developer, 2026-11-04). Popup for sealed blocks (`canvas/popup.ts`) and Arrange (`canvas/arrange.ts`), moved ahead of stone 3 on the developer's word, are on the test page and in source (2026-11-04 16:55 EST): markup identical with no morph 93/93, type checks 0 in five workspaces, trial build passes; no review yet. Go-live for Para Theater is `packages/direct-edit/harness/sunjay-go-live.sh`; ran 2026-11-04 18:02 and 18:53 EST and 2026-11-05 09:11, 09:51 and 09:59 EST (80 signed-out pages compared each time; only the Zoom removals, content edits and the home page's new markers differ). Live on Para Theater since then: canvas at `/studio/<slug>/canvas`, popup, named parts on the live blocks (feed cards, next gathering, profile, calendar, forum, writing, gallery; `apps/sunjay/src/blocks/data-blocks.tsx`), `/try` with those blocks, Zoom links hidden from signed-out visitors and the row `ritual-theatre-lab` cleaned. Run with sample rows in `harness/sunjay-live/`; not yet signed in on the live site. Picture left and right on a card (`canvas/arrange.ts`) live since 2026-11-05 09:11 EST. Developer, 2026-11-05: highly experimental, keep it to Para Theater for now. Home page editing (stone 15a, `/` only; live since 2026-11-05 09:51 EST, no `puck:landing` row yet; first signed-in open failed on a redirect, fix deployed 09:59 EST; its request verified in a real browser, editor not yet opened signed in since): `apps/sunjay/src/app/page.tsx`, "Edit page" for editors, tree in `puck:landing`, opened from the signed-out HTML (`openVisitorPage`), four live pieces as sealed blocks (`blocks/home-blocks.tsx`) that open in the popup. Rendered and compared in `harness/sunjay-live/`; not yet opened signed in on the site.
- ArtDirect social (2026-11-01, deployed): Instagram and YouTube sections on the standard person page (off by default), Connect and
  switches in the owner's drawer, "Open Studio" button; `packages/services/src/social-feeds.ts`. `docs/reference/apps.md` artdirect.
- Series for every org site (2026-11-02; sunjay and ifac rebuilt and live, nothing committed): `packages/series-site` holds the public series pages, routes, mail, reminders and planner
  pages moved out of `apps/ifac` (IFAC mounts them; signed-out HTML compared before and after, same structure except deliberate wording). `MONTHLY` now means the same weekday of the month
  (series clock, calendar grid, RRULE). apps/sunjay (Para Theater): landing, `/about`, `/publications`, `/community`, series routes, `/hub/series`, banner upload and framing; deployed 2026-11-02, verified through the edge.
  Thread `running-the-script` (8 sessions) is live; `sunjay/puck:home` deleted (copy: `~/eac-backups/site-config/sunjay-puck-home-20261102-1747.json`). "I'm coming" and Subscribe now make the person a follower (`followOrg`), so a network account arriving by SSO gets the join details; Subscribe verified through the edge on both. 2026-11-03: sunjay edits a series only in the planner (`/hub/series/<id>#settings`; hub card, "Edit series" links, `seriesEditHref` connector); `saveContentAction` refuses a series and merges metadata instead of replacing it. Same guard not yet in other template apps (amrit-canada, innergathering…) before they get series; no compose path to start a first series on sunjay (planner "+ New series" only). ifac not rebuilt with these. `packages/series-site/README.md`.
- Direct editor on elktours landing (2026-11-03, pilot, uncommitted, live; app in production mode since 2026-11-03): "Edit page" for owners and guides; `puck:landing` absent until first saved, Restore deletes it.
  Real save and Restore verified signed in on the LAN URL. Public password sign-in verified through the edge the same day; Google sign-in there not tested. `docs/open/ELKTOURS_BRIEF_2026-10-18.md`. `CLASS_RE` now keeps Tailwind arbitrary values.
- Site style on elktours (2026-11-06, uncommitted, live since the 12:15 rebuild): "Site style" button for owners and guides; theme in `site_themes`, header/footer looks in `site_config` `site-style:chrome`. First signed-in save by the developer 2026-11-06 17:58 UTC (rows written, public page carries the sheet); signed-out save refused. `packages/direct-edit/harness/site-style/README.md`.
- Parts plugin in Puck Studio (2026-11-06, source only, kept wired on the developer's word): `packages/page-builder/src/parts/` + `mountLookPanel` (direct-edit), wired in `apps/sunjay/src/components/studio/page-editor.tsx` (`developer: false`); live on sunjay since the 2026-11-06 16:23 EST rebuild (first build failed: `parts/store.ts` lacked "use client"; backup restored in place, fixed, rebuilt). Harness 58/58 and 30/30; checklist `packages/direct-edit/harness/frankenstein/PARITY.md`. Also in source (2026-11-06): the "Edit look" popup from Studio (double-click or action-bar button; typing into `pt-steps` rows; forum block with real rows; hand-back as one undo), `drive-popup.cjs` 56/56; brief `docs/open/EDIT_LOOK_POPUP_BRIEF_2026-11-06.md`. Featured person (a block chosen from a record, with a "From what?" chooser) is live on the elktours landing editor since the 2026-11-06 18:29 EST rebuild (harness 41/41; not yet used signed in): `packages/direct-edit/harness/featured/README.md`. elktours page builder live since the 2026-11-06 21:20 EST rebuild (not yet used signed in): `/manage/builder`, `/studio/<slug>` (parts plugin, popup, person chooser in Puck's panel), pages at `/<slug>`; Getting paid moved off /manage/tours (Stripe returns to /hub). Opens (a Button, Card or Featured person opens a page or a popup: tour, experience, reviews with a Then button, person) live since the 2026-11-06 21:59 EST rebuild (not yet used signed in): `docs/open/COMPONENT_CONNECTIONS_2026-11-06.md` section 6. 2026-11-07: Para Theater rebuilt 00:55 EST with Featured person, Opens, Card from a record, three shared layout blocks (Sticky side, Tabs, Sections that open) and canvas tree-row dragging; elktours rebuilt 2026-11-07 07:18 EST with the tour popup's phone map (sticks over the stops), lazy popups and other sessions' Stripe changes (handover section 5a). Handover: `docs/sessions/2026-11-06_editor-house.md`.
- Turnstile (2026-11-06, source + compose, not rebuilt): widgets on every signup form; secret parked as
  `TURNSTILE_SECRET_KEY_PENDING` in `.env` until each app is rebuilt with the site key. `docs/reference/identity-and-tenancy.md`.
- Known failing: `check-types` in `@elkdonis/cms-bindings` (hub template fails
  `validate:template`).

Update this section when work starts or finishes; keep it under ten lines.

## Documentation

- `docs/reference/` — current state per subsystem; start here (`/orient <area>`).
- `docs/open/` — briefs and boards with outstanding work.
- `docs/sessions/` — handovers (`/handover`).
- `docs/archive/` — reports before 2026-09-23; historical, often stale.
- Write in the neutral register described at the end of `docs/README.md`.
