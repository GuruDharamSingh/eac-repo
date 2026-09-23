# App catalogue

One section per directory in `apps/` (20). For each: purpose, `org_id`, port,
Compose service, run mode, live domain, UI stack, status, entry points and the
traps specific to that app. Run mode comes from `docker compose config` (base
file plus the untracked `docker-compose.override.yml`); domains come from the
`org_domains` table, the Nginx Proxy Manager (NPM) proxy-host files, and the
`*_URL` variable each Compose service reads into `NEXT_PUBLIC_APP_URL`.
Shared packages are in [packages.md](packages.md). Last verified: 2026-09-23.

## Current state

### Summary table

Status key: live = running and proxied on a public host; internal =
running, not proxied; retiring = running but superseded; not running =
no container on 2026-09-23 (`docker compose ps`).

| App dir | Port | Service | Mode | org_id | Public host | Status |
|---|---|---|---|---|---|---|
| admin | 3000 | admin | dev (override) | global | none | internal |
| sunjay | 3001 | sunjay | prod | `sunjay` | paratheater.arts-collective.com | live |
| blog-guru-dharam | 3002 | blog-guru-dharam | dev | `guru-dharam` | none | not running |
| forum | 3003 | forum | dev | all orgs | forum.arts-collective.com | live |
| inner-gathering | 3004 | inner-gathering | prod | `inner_group` | meetings.elkdonis-arts.org | retiring |
| elkdonis-arts-collective | 3005 | elkdonis-arts-collective | dev | `elkdonis` | eac.elkdonis-arts.org (502) | not running |
| amrit-canada | 3006 | amrit-canada | prod | `amrit_canada` | amritcanada.ca | live |
| arts-collective | 3007 | arts-collective | prod | network (all orgs) | arts-collective.com | live |
| ifac | 3008 | ifac | prod | `ifac` | ifacgroup.com | live |
| art-auction | 3009 | art-auction | prod | `market` | market.arts-collective.com | live |
| blog-tester | 3011 | blog-tester | dev | `elkdonis` | none | not running |
| hidden-enneagram | 3012 | hidden-enneagram | prod | `hidden-enneagram` | hiddenenneagram.com | live |
| artdirect | 3013 | artdirect | dev | network (no fixed org) | directory.arts-collective.com | live |
| pigeonshoot | 3014 | pigeonshoot | dev | `pigeonshoot` | none | not running |
| innergathering | 3015 | innergathering | prod | `inner_group` | elkdonis-arts.org | live |
| elastrocal | 3016 | elastrocal | dev | `elastrocal` | arts-collective.com/astro | not running |
| danamccool | 3018 | danamccool | prod | `danamccool` | danamccool.com | live |
| fourthwayBookreaders | 3019 | fourthway-bookreaders | dev | `fourth_way_book_readers` | elkdonis-arts.org/books | live |
| sophia | 3020 | sophia | dev | no fixed org | none (URL var set) | not running |
| signal-watch | — | — | — | — | — | not a web app |

Proxy mapping verified 2026-09-23 by reading `/data/nginx/proxy_host/*.conf`
inside the NPM container: host 16 carries `location /books` → 3019, host 23
carries `location /astro` → 3016. Ports 3010 and 3017 are held by non-Compose
containers on this host. Launch procedure and edge details:
[ops.md](ops.md).

### Shared facts

- **Container names do not always match the directory.** `eac-arts-collective`
  is the retired `apps/elkdonis-arts-collective`; `apps/arts-collective` runs as
  `eac-arts-network` (`docker-compose.yml:616`, `:678`). Use the Compose
  service name (`docker compose logs arts-collective`) to avoid the mix-up.
- Production-mode services build only when a sentinel file is missing. ifac and
  sunjay test `.next/BUILD_ID` and `.next/server/pages-manifest.json`; the other
  prod services test `pages-manifest.json` alone, which Next writes before type
  checking, so a build that compiles and then fails `tsc` is never retried
  (`docker compose config`). Rebuild procedure: [ops.md](ops.md).
- `NEXT_PUBLIC_APP_URL` is inlined at build time. On 2026-09-23 it resolves to a
  `localhost` value for hidden-enneagram (`HIDDEN_ENNEAGRAM_URL` unset) and
  fourthway-bookreaders (`FOURTHWAY_BOOKREADERS_URL` unset), although both are
  public. danamccool's `NEXT_PUBLIC_ELKDONIS_ARTS_URL` is `http://localhost:3005`.
- Template stack for org sites (amrit-canada, sunjay, innergathering, ifac,
  pigeonshoot, elastrocal, fourthwayBookreaders): Tailwind v4 CSS-first, shadcn
  "new-york" vendored in `src/components/ui/*` where present, `@elkdonis/cms-ui`
  surfaces, fixed `siteConfig.orgId` in `src/config/site.ts`, role helpers in
  `src/lib/auth.ts`, `/[feed]` routes over `org_feeds`, `/manage` console, `/hub`.
  Styling rules (surface tokens, `@source`, contrast): [frontend-ui.md](frontend-ui.md).
- Legacy Mantine stack (`@mantine/core` + `@elkdonis/ui`): admin,
  blog-guru-dharam, blog-tester, elkdonis-arts-collective, inner-gathering.
- Roles, signup landing role and `defaultOrgs`: [identity-and-tenancy.md](identity-and-tenancy.md).

### admin (3000)
- Purpose: network operator console — users, orgs, events audit, moderation,
  orders, org grants, email templates, Nextcloud user tab.
- Global admin (`users.is_admin`); no fixed org. No proxy host; reachable on
  the LAN only. Mode: `docker-compose.yml` defines the service; the untracked
  override forces `NODE_ENV=development` + `pnpm dev`.
- UI: Mantine + `@elkdonis/ui` + Tailwind. Entry: `src/app/{users,orders,org-grants,events}`, `src/app/api/*`.
- Traps: imports `@elkdonis/openclaw-bridge`, whose `dist/` does not exist
  (`apps/admin/src/app/api/agent/post/route.ts`); `tsconfig.json` is standalone
  and `strict: true`. It still has an `api/oidc` copy; the live Nextcloud OIDC
  provider is innergathering's.

### sunjay (3001)
- Purpose: Para Theater, one member's site. Replaced `apps/blog-sunjay`
  (deleted 2026-09-19). Org id stays `sunjay`; display name "Para Theater"
  (migration 152) must agree in `organizations.name`,
  `org_site_sections.hero.title`, `org_site_sections.footer.body` and
  `siteConfig.orgName` (`src/config/site.ts:16`).
- Domain: `SUNJAY_URL`; `org_domains` row from migration 154.
- UI: template stack, dark palette on `:root`, square corners (`--radius: 0`).
- Entry: `src/app/page.tsx` (landing bands), `src/lib/data.ts`, `/hub` with
  card and page layouts chosen by the `hub_view` cookie.
- Traps: `org_profiles.bio_override` is read only by this app
  (`src/lib/data.ts:543`); the shared profile query ignores it.

### blog-guru-dharam (3002)
- Purpose: personal blog on the Mantine blog packages. Not running. UI:
  Mantine, `@elkdonis/blog-client`/`blog-server`. Rejected as a template for
  new sites; use amrit-canada. Domain var `BLOG_GURU_DHARAM_URL` (localhost).

### forum (3003)
- Purpose: the Grand Forum — the network-wide board over `threads`, the thin
  host for `@elkdonis/forum-ui`. It owns wiki editing (`/wiki/*`) and the
  dictionary (`/dictionary`); arts-collective's `/hub/wiki` console was deleted.
- Domain: `FORUM_URL`; sign-in forwards to `NETWORK_URL/login?next=…` and
  returns through `/api/auth/handoff/accept`.
- UI: plain CSS from forum-ui (no Tailwind), steel/silver design; light/dark
  via `forum_mode` cookie. Tiptap wiki editor island.
- Entry: `src/app/(site)`, `src/app/embed/[[...segments]]` (iframe mode,
  `frame-ancestors` from `FORUM_EMBED_ANCESTORS`), `src/lib/connectors.ts`,
  `src/lib/viewer.ts`.
- Traps: `FORUM_DEV_VIEWER_ID` impersonates a user when `NODE_ENV` is not
  production (`src/lib/viewer.ts:18`) — the live container runs dev mode, so
  keep it unset there (the passthrough is declared and empty on 2026-09-23). Cross-site iframes are anonymous (no cookie). Heap 4096 /
  6 GB limit; less made the dev server restart on the Tiptap route. Org sites
  mount the same package in-process at `/forum`. Plan history:
  `docs/archive/GRAND_FORUM_PLAN.md`.

### inner-gathering (3004)
- Purpose: the previous `inner_group` app (Mantine), superseded by
  `apps/innergathering`. Still running in prod mode for NPM host 14
  (`meetings.elkdonis-arts.org`); that name's DNS is reported stale (**assumed**).
- Traps: do not add compatibility work here. No `check-types` script, so turbo
  skips it. `packages/db/src/queries/forum.ts` reply functions and a SQL twin of
  the recurrence maths (`data.ts`) exist only for it.

### elkdonis-arts-collective (3005)
- Purpose: the former public landing page of the collective. Its landing moved
  into innergathering's `/` (copy still read from `site_config` under org
  `elkdonis`). Not running; NPM host 8 (`eac.elkdonis-arts.org` → 3005) answers
  502. `EAC_URL` in `.env` still points at elkdonis-arts.org. Mantine stack.

### amrit-canada (3006)
- Purpose: Amrit Canada's site; the reference template for new org sites.
- Domain: `AMRIT_CANADA_URL`; `org_domains` amritcanada.ca (+ www).
- UI: template stack; `@elkdonis/primitives`, blocks, forum-ui, chat, pipeline.
- Entry: `src/config/site.ts`, `src/lib/auth.ts`, `src/lib/format.ts`,
  `src/app/api/auth/{signup,callback}/route.ts` (wrapped, with `defaultOrgs`).
- Traps: containers run UTC — convert `datetime-local` input with
  `torontoInputToDate` (`src/lib/format.ts:21`). `threads.recurrence_pattern`
  accepts `DAILY|WEEKLY|MONTHLY|CUSTOM` or NULL, not `'NONE'`. Plain http is not
  redirected to https at the edge, so GoTrue's allow-list carries both schemes.

### arts-collective (3007)
- Purpose: the network site — newsroom landing, `/hub` (tabs `organization`,
  `network`, `elkdonis`), `/hub/admin` cross-org consoles, `/sites/[slug]`
  org subdomain pages, signup wizard, Silex editing bridge, network SSO host.
- Domain: `ARTS_COLLECTIVE_URL`, `NEXT_PUBLIC_NETWORK_HOST`; NPM host 23 also
  forwards `/astro` to elastrocal.
- UI: Tailwind + shadcn + cms-ui, `@elkdonis/sky-ui`, `@elkdonis/three`,
  `@elkdonis/silex-render`, `@elkdonis/tokens`.
- Entry: `src/middleware.ts` (host → `/sites/<slug>` rewrite),
  `src/lib/org-console.ts`, `src/lib/org-forum.ts`, `src/lib/cms/draft-actions.ts`,
  `src/app/hub/(tabs)/*`.
- Traps: production mode since 2026-09-18 (the override that pinned it to
  `next dev` was removed), so edits need a rebuild. Hub connectors use per-org
  routes `/api/org/[slug]/…`, not `siteConfig`. `@import` of cms-ui CSS in
  `globals.css` has been dropped by this app's CSS pipeline; import from the
  component. Container name is `eac-arts-network`.

### ifac (3008)
- Purpose: International Fine Art Collectors — artist/dealer directory,
  members' hub, `/manage` console, galleries, showcase.
- Domain: `IFAC_URL`; `org_domains` ifacgroup.com (+ www).
- UI: Tailwind + `@elkdonis/primitives` (in `layer(components)`) + cms-ui
  `fields.css`/`compose.css`/`hub.css`; hub skins `basic`/`salon` from
  `site_config` key `hub:skin`.
- Entry: `src/lib/directory.ts`, `src/lib/manage.ts`, `src/lib/hub-data.ts`,
  `src/lib/hub-skin.ts` (data only) + `hub-skin-store.ts` (queries),
  `src/app/api/media/upload` (org media) vs `src/app/api/upload` (artist portfolio).
- Traps: see `.claude/rules/apps/ifac.md`. Owners exist since 2026-09-18
  (2 `owner` rows); the email allowlist is gone (`src/lib/auth.ts:10`).

### art-auction (3009)
- Purpose: The Collective Market — marketplace, studio, orders, lots, 3D
  `/gallery`. Store reference implementation; see [commerce.md](commerce.md).
- org_id: `marketplaceOrgId: "market"` (`src/config/site.ts:13`). Domain `ART_AUCTION_URL`.
- UI: Tailwind + shadcn + cms-ui, `@elkdonis/studio-ui`, page-builder, three.

### blog-tester (3011)
- Sandbox for the Mantine blog packages, `orgId: 'elkdonis'`. Not running.

### hidden-enneagram (3012)
- Purpose: The Hidden Enneagram — a Silex-published site
  (`organizations.layout_mode = 'silex'`) rendered by `@elkdonis/silex-render`,
  plus hub, forum, services, newsletter. Prod. Domain hiddenenneagram.com, but
  `HIDDEN_ENNEAGRAM_URL` is unset. Silex details: [authoring.md](authoring.md).

### artdirect (3013)
- Purpose: ArtDirect, the cross-org artist directory and profile editor
  (`/[slug]`, `/new`). No fixed org (an `oad` org row exists); reads `users`.
- Runs `next dev` behind a public host. Photon geocoder via `PHOTON_URL`.
- Trap: `src/app/api/auth/signup/route.ts:11` is the last bare
  `export { handleSignup as POST }` in the repo.

### pigeonshoot (3014)
- Purpose: street-pigeon photos as crowdsourced trading cards (migration 077).
  Not running; no domain. UI: Tailwind + shadcn + `@elkdonis/studio-ui`.
- Traps: see `.claude/rules/apps/pigeonshoot.md`. `tsconfig.json` sets
  `strict: true`. `pigeon` threads reach network feeds (not in `OFF_FEED_KINDS`).

### innergathering (3015)
- Purpose: the site of `inner_group` — the core member group, private by
  default — and, since 2026-09-16, the public site at elkdonis-arts.org
  (NPM host 16). Replaces `apps/inner-gathering`.
- UI: template stack with its own navy/parchment/gold palette and fonts in
  `public/fonts`; Puck pages (`/p/<slug>`) via `@elkdonis/page-builder`.
- Entry: `/` landing (copy from `site_config` under `siteConfig.landingConfigOrgId = "elkdonis"`,
  `src/config/site.ts:20`), `/about`, `/[feed]`, `/hub`, `/forum`, `/artists`,
  `src/lib/oidc.ts` + `src/app/api/oidc/*` (Nextcloud "Sign in with Elkdonis"
  provider — see [nextcloud.md](nextcloud.md)).
- Traps: `elkdonis` and `inner_group` are two org rows; landing copy lives under
  the first, content under the second. `/feed` 308s to `/general`
  (`next.config.ts:92`), and `inner_group/general` is `is_public = false`, so the
  redirect lands on a 404.

### elastrocal (3016)
- Purpose: natal-chart app (migrations 117, 119–121) over `@elkdonis/astro`;
  public sky page, `/calculate`, `/charts`, hub. Not running on 2026-09-23.
- Served under basePath `/astro` (`ELASTROCAL_BASE_PATH`); `ELASTROCAL_URL`
  is localhost. UI: Tailwind + shadcn + `@elkdonis/sky-ui`; `strict: true`.
- Traps: see `.claude/rules/apps/elastrocal.md`.

### danamccool (3018)
- Purpose: Dana McCool's personal artist site — a remake of her previous
  site's design. Pages are Puck documents in `site_config` `puck:<path>`,
  served by `src/app/[[...path]]`, edited at `/studio/<path>`.
- Domain: `DANAMCCOOL_URL`; `org_domains` danamccool.com (+ www).
- UI: Tailwind for chrome, plain CSS `dm-*` blocks in `src/app/site.css`
  (imported into `layer(base)`), unlayered `theme-hooks.css`.
- Entry: `src/blocks/index.ts` (block rules at the top), `components/hud/*`,
  `components/studio/*`, `lib/theme.ts`, `lib/fonts.ts`, `/manage/artworks`.
- Traps: see `.claude/rules/apps/danamccool.md`. History:
  `docs/archive/HANDOVER_2026-09-18_danamccool.md`.

### fourthwayBookreaders (3019)
- Purpose: Fourth Way Book Readers reading-group site. Package
  `fourthway-bookreaders`, service `fourthway-bookreaders`; supersedes the
  deleted `fourth-way-book-readers` stub.
- Served at elkdonis-arts.org/books via basePath (`FOURTHWAY_BASE_PATH`,
  default `/books`); bare root 404s. Runs `next dev` publicly (heap 2048).
- UI: plain CSS `src/app/site.css`, not Tailwind.
- Entry: `src/lib/data.ts` (`mapThread`), `src/lib/manage-actions.ts`,
  `src/lib/base-path.ts`, `components/manage/section-form.tsx`, `seed.sql`
  (idempotent starter copy, not a numbered migration).
- Model: a `kind='reading_group'` thread is the group; a `yes` RSVP is joining;
  sittings become `post` rows linked by `thread_gathers` relation `produced`.

### sophia (3020)
- Purpose: the network LMS host over `@elkdonis/lms` + `lms-ui`. Not running;
  `SOPHIA_URL` is set but no proxy host exists. See
  [workshops-and-lms.md](workshops-and-lms.md).

### signal-watch
- An Android app kept in the repo, outside the web platform. Not in Compose.

## Rules and constraints

- Copy amrit-canada, not the blog apps, when starting a new org site: the blog
  apps are on the retired Mantine stack. Replace copy, palette and feed rows;
  keep `siteConfig.orgId` fixed.
- Set `<APP>_URL` in `.env` before building: `NEXT_PUBLIC_APP_URL` is inlined.
- Do not build features into `apps/inner-gathering` or
  `apps/elkdonis-arts-collective`: both are superseded.
- Put a cross-org capability in a shared package or arts-collective's
  cross-org console, not in `apps/ifac`: IFAC accumulated one-off code because it
  was built first.
- Back up `.next` and read `git status` before rebuilding a production-mode app:
  the build ships every uncommitted change in the shared tree ([ops.md](ops.md)).
- Query `\d <table>` before naming columns in app SQL: `org_profiles` has no
  `kind` or `headline` column (`role_title`, `tags`), and TypeScript does not
  catch it.

## Open items

- innergathering `/feed` → `/general` redirect lands on a 404; retarget in
  `apps/innergathering/next.config.ts:92` and rebuild.
- `HIDDEN_ENNEAGRAM_URL` and `FOURTHWAY_BOOKREADERS_URL` unset in `.env`.
- artdirect signup route still bare-exports `handleSignup`.
- admin's `@elkdonis/openclaw-bridge` import has no built `dist/`.
- forum and artdirect serve `next dev` on public hosts.
- Whether `meetings.elkdonis-arts.org` still resolves: **unknown**; decide when
  to stop `inner-gathering`.
- elastrocal's `/astro` location exists in NPM host 23; whether nginx was
  reloaded after the hand edit is **unknown** (the app is not running either way).
- sophia needs a proxy host and DNS before launch.

## Sources

Supersedes, for app-level facts: memory `amrit_canada_template`,
`project_sunjay_site`, `project_danamccool_site`, `project_danamccool_galleries_hud`,
`project_fourthway_bookreaders`, `project_ifac_hub_frontend`,
`project_ifac_hub_buildout`, `project_ifac_manage_console`,
`project_ifac_galleries_live_edit`, `project_pigeonshoot`, `project_astrology_app`,
`project_rosicrucian_keywords`, `project_arts_collective_hub`,
`project_elkdonis_hub_tab`, `project_innergathering_app`, `project_grand_forum`
(app parts), `project_eac_state` (stale). Archive:
`docs/archive/HANDOVER_2026-09-18_danamccool.md`,
`docs/archive/DEBRIEF_2026-09-06_org_presence.md`,
`docs/archive/NEXT_AGENT_BRIEF.md`, `docs/archive/SESSION_BRIEF_2026-07-20.md`,
`docs/archive/GRAND_FORUM_PLAN.md`, `docs/archive/AUDIT_2026-09-06_network_state.md`,
`docs/archive/INNERGATHERING_CUTOVER_2026-09-09.md`. Context:
`docs/open/BRIEF_B_FORUM_SWITCHER_2026-09-18.md`,
`docs/open/BRIEF_C_IFAC_ONBOARDING_2026-09-18.md`.
