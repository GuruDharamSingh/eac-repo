# Package catalogue and conventions

Every directory in `packages/` (41), with its purpose, how it is consumed
(built `dist/` or source export), its main consumers, and a status. Followed by
the conventions that decide whether a change to a package type-checks, builds
and renders in the apps that use it. Build mode is read from each
`package.json` `main`/`exports`; consumers are the workspaces declaring the
dependency. App-level facts are in [apps.md](apps.md). Last verified: 2026-09-23.

## Current state

### Build modes

- Source export (28 packages): `exports` point at `./src/*.ts(x)`; the app
  compiles the source. An edit is visible on the next compile.
- Built dist (9): `@elkdonis/db`, `types`, `auth-server`, `redis`, `email`,
  `hooks`, `three`, `reading-wizard`, `ui` — each has `tsup.config.*` and a
  `build` script, and apps resolve `dist/`. `openclaw-bridge` is also
  dist-mode, but its `dist/` does not exist on 2026-09-23.
- Not an npm module: `packages/silex` (Dockerfile + deploy config for the Silex
  container) and `packages/silex-nextcloud-connector` (plain JS, bind-mounted
  into that container as `SILEX_SERVER_CONFIG`).
- Leftover `tsup.config.*` files with no `build` script (source-exported):
  `blog-client`, `blog-server`, `cms-bindings`, `nextcloud`, `utils`.
- Staleness check 2026-09-23 (source files newer than the `dist/` directory):
  `email` 16, `auth-server` 2, `types` 1, `reading-wizard` 1; others 0. This is
  a directory-mtime comparison, so treat it as a prompt to rebuild, not proof.

### Catalogue

Status: active (used by a live app), legacy (only Mantine or retired
apps), unused (no consumer), dormant (consumers not running).

| Package | Purpose | Build | Main consumers | Status |
|---|---|---|---|---|
| astro | Natal-chart engine on `sweph`; root is client-safe, `/server` engine, `/svg`, `/wheel`, `/keywords` | src | elastrocal, arts-collective, sky-ui | active |
| auth-client | Browser auth calls (`/api/auth/*`, Google), basePath-aware | src | 16 apps, cms-ui, ui | active |
| auth-server | GoTrue session, route handlers (`handleSignup`, `handleOAuthCallback`, handoff) | dist | 19 apps | active |
| blocks | Page-block catalogue declared as data; `/server` resolvers | src | amrit-canada, art-auction, danamccool, ifac, innergathering, sunjay, page-builder | active |
| blog-client | Mantine blog components | src | blog-guru-dharam, blog-tester | legacy |
| blog-server | Blog server operations | src | blog-guru-dharam, blog-tester | legacy |
| chat | Org general chat over a Nextcloud Talk room; `/routes` | src | amrit-canada, ifac, innergathering, sunjay | active |
| checkout | Cart and checkout UI, `/server`, `/stripe` | src | art-auction, hidden-enneagram, ifac, innergathering | active |
| cms-bindings | Template binding engine (`manifest.json` bindings), workshop field registry | src | arts-collective, art-auction, artdirect, hidden-enneagram, silex-render | active |
| cms-ui | Shared authoring UI: surfaces, hub, compose, editor, profile, gallery, files, writing, whiteboard, email (38 subpaths) | src | 14 apps, blocks, forum-ui, page-builder, sky-ui | active |
| commerce | Stores, artworks, money, ledger, settlement, eTransfer; `/server` | src | art-auction and 9 other apps | active — [commerce.md](commerce.md) |
| config | Shared ESLint/Prettier config | none | admin, inner-gathering | legacy |
| db | Postgres client, baseline schema, migrations, runner | dist | every server-side app and 13 packages | active — [data-model.md](data-model.md) |
| email | SendGrid sending + React Email templates | dist | 12 apps, auth-server, commerce, newsletter | active — [email.md](email.md) |
| forum-ui | The Grand Forum as a package (`renderForumRoute`, connectors, CSS) | src | forum, amrit-canada, hidden-enneagram, ifac, innergathering, sunjay | active |
| hooks | React hooks for the Mantine apps | dist | inner-gathering, ui | legacy |
| live-editor | In-page CSS-variable editor (`StyleOverlay`, `CssPanel`, `data-theme-vars` pins) | src | artdirect, arts-collective, ifac | active |
| lms | Sophia course content, delivery and records | src | sophia, lms-ui | dormant — [workshops-and-lms.md](workshops-and-lms.md) |
| lms-ui | Sophia pages | src | sophia | dormant |
| messaging | User-to-user conversations; `/queries`, `/server` | src | art-auction | active |
| meta | Facebook Page / Instagram publish client | src | none | unused (built 2026-09-16, not wired) |
| newsletter | Org newsletter composer; `/editor`, `/server` | src | hidden-enneagram, ifac, innergathering | active — [email.md](email.md) |
| nextcloud | WebDAV/OCS client, Talk, Deck, file components | src | 13 apps, services, chat, pipeline | active — [nextcloud.md](nextcloud.md) |
| openclaw-bridge | Draft-only write surface for an external agent | dist (missing) | admin | dormant |
| page-builder | Puck adapter over blocks; `/server` page store | src | art-auction, danamccool, ifac, innergathering | active — [authoring.md](authoring.md) |
| payments | Payment rails (eTransfer, Stripe) | src | art-auction, hidden-enneagram, checkout | active — [commerce.md](commerce.md) |
| pipeline | Org kanban over a Nextcloud Deck board; `/routes` | src | amrit-canada, ifac, innergathering, sunjay | active |
| primitives | Token-driven UI primitives, plain CSS + Radix | src | amrit-canada, fourthwayBookreaders, ifac, sunjay | active — [frontend-ui.md](frontend-ui.md) |
| reading-wizard | Book-import / reading-programme wizard | dist | none | unused |
| redis | Redis client and cache helpers | dist | art-auction, arts-collective, danamccool, hidden-enneagram, inner-gathering, auth-server, services | active |
| services | Business logic: threads, profiles, org calendar, forum, media, galleries, dav, storage | src | 17 apps, 10 packages | active |
| silex | Silex container build files | n/a | Compose `silex` | active — [authoring.md](authoring.md) |
| silex-nextcloud-connector | Silex storage connector to Nextcloud | n/a (JS) | Compose `silex` | active |
| silex-render | Fetch → bind → render Silex-published org sites | src | arts-collective, hidden-enneagram | active |
| sky-ui | Current-sky face/surface/page components + `sky.css` | src | elastrocal, arts-collective | active |
| studio-ui | Non-Mantine Tailwind + Tiptap authoring components | src | art-auction, pigeonshoot | active |
| three | Three.js / R3F components (`/gallery`, `/inner-temple`, `/endless-runner`) | dist | art-auction, arts-collective | active |
| tokens | DTCG token file → CSS custom properties | src | arts-collective | active (no UI) |
| types | Shared TypeScript types | dist | 16 apps, 8 packages | active |
| ui | Mantine component library, `eac-theme.css` (`BaroqueSignup` also exists in `cms-ui/auth`) | dist | admin, blog-guru-dharam, blog-tester, elkdonis-arts-collective, inner-gathering, blog-client | legacy |
| utils | Pure helpers: recurrence maths, sanitise, reserved slugs, wiki render | src | 14 apps, 13 packages | active |

## Rules and constraints

### Source-exported packages

- Treat `packages/services/src` as part of every app: since 2026-09-17 it has
  no build step (`packages/services/package.json` `main` = `./src/index.ts`), so
  one half-written file fails `tsc` in all 17 consuming apps. Keep it compiling
  between edits.
- Keep Node `Buffer` out of `fetch` bodies in services: under an app's DOM lib
  it is not a `BodyInit`; use `asBody`/`asBodyOrBlob` from
  `packages/services/src/bytes.ts`.
- Add a new source-exported package to the consuming app's `transpilePackages`
  in `next.config.ts`. **Assumed**, not proven necessary: Next 16 builds with
  Turbopack; amrit-canada imports `@elkdonis/primitives` and `@elkdonis/blocks`,
  and ifac imports `@elkdonis/blocks` and `@elkdonis/commerce`, without listing
  them, and both build. The list is the convention every `next.config.ts`
  documents.
- Never put a backtick inside a `db\`…\`` SQL template, comments included: it
  closes the template literal. Explain the query in a JS comment above it.

### Dist packages

- Rebuild a dist package after editing its source, before trusting any app's
  type check: `tsc` in an app checks the built `.d.ts`, so a syntax error in
  `src` passes silently. Build inside a container
  (`docker compose exec <svc> sh -c 'cd /app/packages/<pkg> && pnpm build'`).
  `db`, `types`, `auth-server`, `redis`, `email`, `hooks`, `three`,
  `reading-wizard`, `ui` are affected.
- A package that re-exports services from a dist build must bundle it:
  `openclaw-bridge`'s tsup config sets `noExternal: ['@elkdonis/services']`.

### `@elkdonis/ui` and React copies

- Keep `@elkdonis/ui` out of `transpilePackages` in non-Mantine apps: it
  declares React as a devDependency (`packages/ui/package.json:74`), pnpm gives
  it a second physical React, and transpiling its source binds hooks to that
  copy ("Cannot read properties of null (reading 'useContext')" at prerender).
  The five Mantine apps list it today and are left as they are.
- `cms-ui` must not import `@elkdonis/primitives`: it has no such dependency and
  not every host has the package.
- Two `prosemirror-view` versions are installed (1.41.3, 1.42.3). Type
  `EditorView` structurally in shared code (see
  `packages/cms-ui/src/editor/wikilink-suggest.ts:76`): the nominal type differs
  between copies and `next build` fails where `next dev` does not.

### Client and server graphs

- Keep database imports out of anything a client component can reach: one
  import of a module that touches `@elkdonis/db` pulls `postgres` into the
  browser bundle and the page answers 500 while `tsc` stays green. Split data
  from queries (`apps/ifac/src/lib/hub-skin.ts` vs `hub-skin-store.ts`) and use
  a package's `./server` entry for server-only code (`astro`, `blocks`,
  `checkout`, `commerce`, `messaging`, `newsletter`, `page-builder`).
- Put pure maths that both sides need in `@elkdonis/utils`
  (`packages/utils/src/recurrence.ts`), not in services.
- Form defaults used by a server component must not live in a `"use client"`
  module: a server component cannot call a function exported from one.

### TypeScript

- Write `if (result.ok === false)` rather than `if (!result.ok)` for
  `{ ok: true } | { ok: false; error }` results: the root `tsconfig.json:7` sets
  `strict: false`, so boolean discriminants do not narrow. Only admin,
  pigeonshoot and elastrocal (and most packages) set `strict: true`.
- Name the type-check script `check-types` in every workspace: turbo runs only
  that task name (`turbo.json`). `apps/inner-gathering` has none.
  `cms-bindings` and `email` carry both `check-types` and `type-check`.

### Auth route handlers

- Wrap `handleSignup` and `handleOAuthCallback` in a local
  `export async function POST(request)`/`GET` instead of
  `export { handleSignup as POST }`: each takes an optional second options
  parameter, which Next 16's route-handler type check reads as the `{ params }`
  context and rejects at `next build`.
- Pass `defaultOrgs: [siteConfig.orgId]` in org-scoped apps (see
  `apps/amrit-canada/src/app/api/auth/signup/route.ts:19`): without it a new
  account joins the network default orgs instead of the site's org.

### basePath apps (fourthwayBookreaders `/books`, elastrocal `/astro`)

- Let Next prefix `<Link>`, `useRouter`, `_next` assets and `redirect()`; do not
  wrap `redirect()` in `withBase()` or the path is prefixed twice
  (`apps/elastrocal/src/lib/auth.ts:70`).
- Pass every hand-built absolute path through `withBase()`
  (`src/lib/base-path.ts`): `fetch`, `<form action>`, `window.location`,
  `history.replaceState`, plain `<a>`, `CenterLinks` paths.
- Store media URLs canonical (`/api/media/...`) and prefix them on output, so
  rows stay portable between hosts.
- Shared code reads `process.env.NEXT_PUBLIC_BASE_PATH`, which Next inlines per
  app (`packages/auth-client/src/index.ts:23`,
  `packages/auth-server/src/api-routes.ts:458`); for apps on their own domain it
  is empty and a no-op.

### Where new code goes

- Build a capability that more than one org could use in a shared package
  (usually `@elkdonis/services` + a `cms-ui` subpath) and mount it from each
  app, not in `apps/ifac/src/lib`: IFAC was built first and kept absorbing
  one-off code. Cross-org administration belongs in arts-collective's `/hub/admin`
  with an org picker.

## Open items

- `openclaw-bridge` has no `dist/`; admin's `/api/agent/post` cannot resolve it
  (**assumed** runtime failure; not exercised).
- `email`, `auth-server`, `types` show source newer than `dist/`; rebuild and
  re-check consumers.
- `reading-wizard` and `meta` have no consumers; decide whether to wire or remove.
- Leftover `tsup.config.*` in five source-exported packages.
- Deduplicate `prosemirror-view` with a pnpm override (root change + reinstall).
- `apps/artdirect/src/app/api/auth/signup/route.ts:11` is still a bare export.
- `apps/inner-gathering` has no `check-types` script (retiring; low priority).
- `user_organizations.role` defaults to `'member'` (verified in the live
  schema); any insert that omits `role` grants membership. See
  [identity-and-tenancy.md](identity-and-tenancy.md).

## Sources

Supersedes, for package facts: memory `services_source_export`,
`feedback_stale_dist_hides_errors`, `feedback_generalize_beyond_ifac`, the
package notes in `amrit_canada_template`, `project_fourthway_bookreaders`,
`project_sunjay_site`, `project_ifac_hub_frontend`, `project_astrology_app`,
`project_meta_integration`. Archive: `docs/archive/AUDIT_2026-09-06_network_state.md`
(package adoption findings, partly outdated), `docs/open/HYGIENE_SWEEP_BRIEF_2026-09-03.md`
(bare `handleSignup` exports; now reduced to one).
