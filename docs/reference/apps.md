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
| elastrocal | 3016 | elastrocal | dev | `elastrocal` | arts-collective.com/astro | live (started 2026-09-26) |
| danamccool | 3018 | danamccool | prod | `danamccool` | danamccool.com | live |
| fourthwayBookreaders | 3019 | fourthway-bookreaders | prod | `fourth_way_book_readers` | elkdonis-arts.org/books | live |
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
  public. danamccool's `NEXT_PUBLIC_ELKDONIS_ARTS_URL` comes from `ELKDONIS_ARTS_URL` in `.env`, set to `https://elkdonis-arts.org` (claude, 2026-09-25; was the `http://localhost:3005` compose default).
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
  via `forum_mode` cookie, also set by the match light in the left rail
  (`matchLight: true`, 2026-09-26). Tiptap wiki editor island.
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
- Studio (2026-09-27): `/studio` mounts `@elkdonis/studio` (`StudioShell`) with
  actions in `src/lib/studio-actions.ts`; `?org=<org_id>` preselects "Writing
  as", `?id=` opens a piece. Linked from the landing masthead and each org
  Center (`CenterLinks.studioHref`). Writing only; other kinds are tabs marked
  "soon". Deployed 2026-09-27 (verified: signed-in render through the edge,
  screenshots at 1440 and 400px, no page errors). Restyled the same day to
  the mockup's own identity: `studio.css` carries its palette (light and
  dark, ◐ toggle in the shell, remembered per browser) and maps the editor's
  `--sf-*` and the article's `--read-*` tokens onto it; the page loads
  Newsreader and IBM Plex Sans with `next/font` as `--studio-serif` /
  `--studio-sans`. Two traps found on the way: Tailwind `@theme inline`
  variables such as `--font-serif` are not real custom properties, and
  `article.css` resolves `--eac-*` on `:root`, so only the `--read-*` tokens
  can be overridden lower down. Later the same day: opening lands on a blank
  piece (the row is created on its first autosave, titled "Untitled" until
  it has a title), "New ▾" in the top bar replaces the kinds row and the
  title-then-Start form, and the cover is a thin row with a thumbnail. Token
  contrast is measured and recorded at the top of `studio.css`.
  Brief: `docs/open/STUDIO_BRIEF_2026-09-27.md`.
- Essay canvas (2026-09-27, builds 11–13): "Use blocks" in the Studio's
  settings switches a piece to `packages/studio/src/canvas/` (TipTap block
  document: image, pull quote, aside, divider, per-kind cards with a picker
  over the writer's own threads and artworks; margin drag handle; Library
  and desktop drops). The doc is saved as `threads.body_doc` (migration 173)
  and rendered to `body` on the server by `@elkdonis/utils/essay`
  (`renderEssayHtml`), then sanitised; `body_format = 'doc'`. Sites render
  `body` as before; `cms-ui/article/essay.css` (imported by article.css)
  carries the content/wide/full grid and block styles. Traps found: send a
  JSON-cloned doc to the server action (ProseMirror attrs have a null
  prototype and become "temporary references" that throw on access); jsonb
  reorders keys, so compare against what was sent, not what came back.
  Builds 15–17 (same evening): wider canvas column, a `+` at the foot of
  the hovered block opening the block menu (the top bar keeps formatting
  only), the margin grip kept inside the editor's box so it no longer hides
  on approach, width toggles on cards, Picture-with-text and Gallery blocks,
  artwork cards with the store's primary image (`artwork_media`, served from
  the market host). Two more traps: `@tiptap/extension-drag-handle-react`'s
  element is moved out of React's tree by tippy, so it and any conditional
  siblings need wrappers of their own or React throws `insertBefore`
  DOMExceptions; and `next/font/google` failed two Turbopack builds out of
  four on the fetch, so the Studio loads its faces by `<link>`.
  Build 18: `canvas/schema/keys.ts` makes blocks behave like paragraphs
  (typing on a selected block starts a paragraph after it; Enter leaves a
  pull quote, aside or picture-with-text; Backspace in an empty one
  removes it; Escape steps out; the document always ends with an empty
  paragraph), a Paragraph entry and a `+ Block` button in the bar (works
  from the cursor, on touch too), a permanent "Add a block at the end",
  half a screen of bottom room, the cover control in the kicker row, and no
  bleeds or hover chrome below 1000px.
  Builds 19–21: `/` on an empty line opens the block menu (replacing the
  line), Ctrl/Cmd-Alt-↑/↓ moves a block, the width toggle and tools sit in
  one row above the block; layout presets (`metadata.layout`, `ArticleView`
  `layout` prop, `data-layout` presets in article.css: feature, note,
  announcement, document) and series (`metadata.series`, `listWritingSeries`,
  a kicker above the title) in the settings panel. Org sites show a
  piece's layout and series once their piece pages pass `layout`/`series`
  to `ArticleView` (not yet wired). Root `pnpm.overrides` now pin the
  `prosemirror-*` packages: see `.claude/rules/areas/packages.md`.
  Build 22: "Publish as" lists the account's acting identities
  (`listActingIdentities`: self, pen names, orgs owned or guided) and saves
  `metadata.byline {userId,name}`; `author_id` stays the account, so
  ownership and listing are unchanged. IFAC's piece view passes
  `post.byline?.name`, `layout` and `series` to `ArticleView` (pending its
  rebuild).
  Builds 23–24: "Search and sharing" (`metadata.seo`: title, description,
  share image, noindex; IFAC's piece `generateMetadata` reads it) and the
  drawer's Library (`MediaBrowser` over `/api/my-files?path=Media/Images`
  and `/api/media/library?org=<slug>`; tiles drag onto the canvas as an
  image block or onto the cover row). The user's pictures live under
  `Media/Images`, not `Images`, in their storage.
  Brief: `docs/open/BLOCK_CANVAS_BRIEF_2026-09-27.md`.
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
- Trap: on 2026-09-27 the dev server kept serving the old
  `src/app/globals.css` chunk after edits (and after `touch`), while TSX and
  newly imported CSS files compiled. Verified by fetching the chunk inside the
  container. Put new rules in a CSS file imported by a component (e.g.
  `components/oad/person-frame.css`), or restart the service. (claude, 2026-09-27)

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
- Every block carries a "Text style" (font by name or site role, weight,
  capitals, spacing, colour, presets), via page-builder's opt-in `blockStyle`
  option: `lib/puck/text-style.tsx`, control `components/studio/text-style-field.tsx`,
  CSS in `app/theme-hooks.css`. Block `dm-collection-nav` stores its tiles in
  the page and its arrangement in a `layout` JSON prop set in the "Arrange tiles"
  window. Both written 2026-09-25; type-checked and rendered to HTML with a
  script, not yet built or seen in a browser. (claude, 2026-09-25)
- The shared Card (`feature-card`) has a "Filled from (live)" record here:
  `artwork:<id>` or `gallery:<id>`, read by `lib/card-records.ts` (server
  resolver) and `/api/blocks/card-record` (editor). Threads are not offered:
  the org has none and no route to show one (2026-09-25). (claude, 2026-09-25)
- Traps: see `.claude/rules/apps/danamccool.md`. History:
  `docs/archive/HANDOVER_2026-09-18_danamccool.md`.

### fourthwayBookreaders (3019)
- Purpose: Fourth Way Book Readers reading-group site. Package
  `fourthway-bookreaders`, service `fourthway-bookreaders`; supersedes the
  deleted `fourth-way-book-readers` stub.
- Served at elkdonis-arts.org/books via basePath (`FOURTHWAY_BASE_PATH`,
  default `/books`); bare root 404s. Production mode since 2026-09-26: guarded
  `next build` (heap 3072) with the two-file sentinel, then `next start` (heap
  1024); source edits need a rebuild (claude, 2026-09-26; was `next dev`).
- UI: plain CSS `src/app/site.css`, not Tailwind.
- Entry: `src/lib/data.ts` (`mapThread`), `src/lib/manage-actions.ts`,
  `src/lib/base-path.ts`, `components/manage/section-form.tsx`, `seed.sql`
  (idempotent starter copy, not a numbered migration).
- Model: a `kind='reading_group'` thread is the group; a `yes` RSVP is joining;
  sittings become `post` rows linked by `thread_gathers` relation `produced`.
- Reading circles (claude, 2026-09-26; migration 165, applied 2026-09-26):
  - `/groups/<slug>` for a `reading_group` is the circle page
    (`src/components/circle/circle-page.tsx`, loader `src/lib/circle-page.ts`).
    Head (cover, group box) and progress/structure are public; the three
    session tabs (previous / this / next), session folders and discussion are
    org members only; "Manage this circle" (`circle-manage.tsx`) is
    owners/guides. The header drops its form shelf on this route (`data-slim`).
  - Sessions, not chapters, divide the page. Each sitting (an occurrence of
    the circle thread) gets a `post` topic in the circle's feed with
    `metadata.circleSession {circleId, occurrenceAt, number}`, gathered onto
    the circle as `produced`; RSVP, comments (forum replies) and the session
    document live on it. Host = `meeting_hosts` (role `host`); host notes,
    plan line and stop point = `meeting_occurrence_notes`
    (`note`, `plan`, `stop_unit_id`, `stop_position`). Topics are made on
    first use or by "Stage".
  - Plan = `circle_units`; a sitting covers `metadata.circle.pace` units from
    where the previous sitting stopped.
  - Session document: `ensureCircleSessionDocument` writes
    `Private/Circles/<slug>/Meeting Recordings/<YYYY-MM-DD> Session NN/Session notes.md`
    with an editable public share; members only.
  - Pop-ups: cms-ui `SurfaceProvider` mounted on this page only
    (`circle-surfaces.tsx`): thread (`/api/hub/threads/[id]`), compose
    (saves via `createSessionThread`, gathered onto the sitting), define
    (`src/lib/dictionary-actions.ts`).
  - PDF reader: a pop-up drawn with pdf.js in the browser (`src/components/circle/pdf-reader.tsx`), works on phones; worker, WASM decoders and fonts are served from `public/pdfjs/<version>/` — recopy them from `node_modules/pdfjs-dist` when the version changes, and update `PDFJS_VERSION`. Talk call and
    session document embed in the page (Nextcloud app `eac_embed`, see
    nextcloud.md).
  - Access (2026-09-26, owner's call): the circle's space is for anyone with a
    role in the org, `viewer` included; "Join the group" (RSVP on the circle)
    grants `viewer` to a signed-in person with no role. The circle's feed has
    no `min_role`; session topics and threads started from a session are
    `ORGANIZATION`-visible (off public listings, hidden from anonymous).
    Circle files under `Private/Circles/` are served by `/api/circle-file/…`,
    which checks the role itself and calls `serveMedia({ preAuthorized })`
    (new option; `/api/media` still admits members only). Editing, staging,
    host notes and "Where did we stop?" are in the manage section
    (owners/guides; stop and notes also the sitting's host).
  - Session topic default title: "Session N · <unit label — title>" (the unit
    the sitting starts in).
  - `/manage/groups`: every group with readers, progress, sessions, next date,
    and "Feature" (org_site_sections `featured_group` = { threadId }).
  - Featured group on the home page (`src/lib/featured.ts`): "The page we're on"
    shows the passage a host or editor posted (`metadata.circle.excerpt`
    {text, where, page, at}; from the stop form or "Where we are" in the
    manage section), else the site's own book; "What we're reading" shows the
    circle's cover and the unit the next sitting starts. Automatic PDF page
    rendering was built and dropped at the owner's request (2026-09-26).
  - Listings use `PUBLIC_FILTER` (excludes feeds with `min_role`); the
    single-feed and single-thread reads use `PUBLISHED_FILTER` and their pages
    check `canViewFeed`.
  - Seed: `scripts/seed-totm-circle.mts` + `seed/totm-units.json` created
    "Talk of the Month" (`UK6Akh87Iyq51mzSr3dXh`, 99 units, material in
    `Material/TOTM-Collection/`, cover in `Media/Images`). No schedule yet.
  - Recording (2026-09-26; `packages/services/src/circle-recording.ts`,
    scheduled in `apps/fourthwayBookreaders/src/instrumentation.ts`):
    every 30 s, during a sitting's window (10 min before to 30 min after its
    scheduled end), once 2+ people are in the circle's call, the service
    account (room owner) starts a video recording via
    `POST spreed/api/v1/recording/{token}`. Talk stores it in the starter's
    `Talk/Recording/<token>/`; every 2 min the filer moves the service
    account's settled files (3 min unchanged) into
    `Private/Circles/<slug>/Meeting Recordings/<date> Session NN/`. Recordings
    started by hand stay in that person's own Talk folder. Consent: a notice
    under "Join the Talk room" (owner's choice). `DISABLE_CIRCLE_RECORDING=1`
    turns it off. Verified: API reads and an authorised start refused only
    for "no call"; not yet verified in a live call.
    `packages/nextcloud/src/talk.ts` `startRecording`/`stopRecording` use a
    wrong endpoint and have no callers.
  - Not built: transcripts (Whisper container, later).
  - `src/components/group-panels.tsx` (old bookmark + write-up forms) is no
    longer rendered.
- Akhand Path (claude, 2026-10-03; migration 191): a private complete reading of
  the Sri Guru Granth Sahib at `/akhand-path` (+ `/akhand-path/day/<YYYY-MM-DD>`).
  - A `reading_group` thread (slug `akhand-path`) with `visibility INVITE_ONLY`
    and no schedule, so every listing, feed, forum and calendar query hides it.
    Readers = the author + `yes` RSVPs (Justin, Guru Dharam Singh); made PUBLIC,
    anyone with an org role may read. Access: `src/lib/paath.ts` `getPaathReader`.
  - 3,921 passages are `circle_units` (text in `metadata.english/gurmukhi`, from
    the WSL chunker's `chunker/sggs.py`), seeded by `scripts/seed-akhand-path.mts`
    from `~/sggs-corpus/chunks.jsonl` on stdin. Check mark = status `done`,
    `done_at`, `done_by` (191); thoughts = `circle_unit_notes` (191). A day's entry
    = passages done that day (site zone) + its `meeting_occurrence_notes` row keyed
    by local midnight (note, stop point) + `<folder>/Meeting Recordings/<date> Day N/`.
  - Recording: in-browser MediaRecorder upload (`/api/akhand-path/recording`), or
    "Record the call" in its Talk room (service account, audio); call files are
    moved from `Talk/Recording/<token>/` into the day folder when the page loads
    (the circle watcher/filer skip it: no `scheduled_at`).
  - `/api/circle-file` asks `paathFileAllowed` first, so the private folder is
    readers-only, not org-wide.
  - Public `/granth` (index) and `/granth/<ang>` read the same passages, text only (`getGranthIndex`, `getAng`); nothing of the private reading. (claude, 2026-10-03)

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
