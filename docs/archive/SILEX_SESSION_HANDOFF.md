# Silex Session Handoff

Date: 2026-04-25

This file is the durable handoff for the Silex + Arts Collective work done in this session. The original working plan is still stored at:

`/home/elkdonis/.vscode-server/data/User/workspaceStorage/cde6f38e3dbd010de918818d30397f8f/GitHub.copilot-chat/memory-tool/memories/YzBjNDZmNzItN2UyNC00NzM5LTg3ZWUtNjA5NTVlZGJjZTBh/plan.md`

Main repo path:

`/home/elkdonis/dev-enviroment/eac-repo`

## Current Result

We moved from the original Phase 0 plan into a working integrated architecture:

- Silex is an opt-in custom public layout for an organization, not an iframe inside Arts.
- Silex runs as a sibling Docker service on `http://localhost:6805`.
- Arts owns auth, role checks, token minting, hub controls, subdomain routing, and public rendering.
- Silex owns visual editing and stores/publishes through a custom Nextcloud connector.
- Nextcloud stores each org's editable Silex project and published output under the org folder owned by the editing user's Nextcloud account.
- Public Arts pages can switch between the default Arts layout and the published Silex layout.
- Published Silex HTML can contain `eac-embed` placeholders that Arts replaces with trusted React server components for feed/workshops/RSVP/polls/live/resources.
- Silex canary `v3.7.3-canary.4` was researched and kept as an inactive Dockerfile, but active integration was restored to stable Silex because the canary binary did not load the Node connector.

## Plan Coverage

The saved `plan.md` expected Phase 0 only in the next coding session. Actual work completed significantly more than that.

Done from the plan:

- Added layout columns on `organizations` in `/home/elkdonis/dev-enviroment/eac-repo/packages/db/migrations/035_layout_mode.sql`. The plan expected `034_layout_mode.sql`, but actual numbering is `035` because other migrations already existed.
- Extended org lookup and role logic in `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/lib/org.ts`.
- Added the public route fork in `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/app/sites/[slug]/page.tsx`.
- Added the Silex public renderer in `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/components/silex-layout.tsx`.
- Added hub Silex controls in `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/components/hub/SilexSurfaceControls.tsx` and surfaced them from `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/app/hub/page.tsx`.
- Added the active Silex Docker service in `/home/elkdonis/dev-enviroment/eac-repo/docker-compose.yml`.
- Added a full custom Silex Nextcloud storage/hosting connector under `/home/elkdonis/dev-enviroment/eac-repo/packages/silex-nextcloud-connector`.
- Added one-time Silex token mint/redeem routes in `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/app/api/silex/token/route.ts` and `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/app/api/silex/auth/route.ts`.
- Added layout activation/deactivation in `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/app/api/silex/layout/route.ts`.
- Added published asset proxying in `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/app/api/silex/assets/[slug]/[...path]/route.ts`.
- Added published Nextcloud reference helpers in `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/lib/silex-published.ts`.

Not done or intentionally deferred:

- Deterministic `artist_profiles` to Silex seed transform is not implemented yet.
- `/design` page and `/api/design/*` seed/reset endpoints from the original plan were superseded by `/hub` controls and `/api/silex/*` routes.
- Silex publish callback into Arts DB is not implemented. Current activation flow detects existing `front.html` or `index.html` when the user clicks `Use Silex site`.
- AI-assisted generation is still conceptual. Best next path is to generate editable Silex/GrapesJS project JSON and trusted `eac-embed` placeholders, not to replace the connector with canary.
- Full HTML sanitization is not done. Current public renderer strips script tags, inline event handlers, and `javascript:` URLs, but it is not a full allow-list sanitizer.

## Stability Map

Stable enough to build on:

- Arts routing, role checks, hub controls, token mint/redeem route structure.
- Nextcloud folder ensure logic and project/published path convention.
- Public Silex renderer and asset proxy design.
- Silex stable image configuration in Docker Compose.
- One-time token bridge model.
- Owner/admin edit semantics: owner and admin can edit; owner is higher than admin and is treated as the strongest per-org role.

Recently verified during the session:

- `/eac-silex-blocks.js` returned HTTP 200 and contained compound block markers such as `Arts Compound`, `Workshop Launchpad`, `Community Pulse`, `eac-slot-poll`, and `function slot`.
- Earlier `pnpm --filter arts-collective exec tsc --noEmit` passed before the final connector injection changes.
- Public Silex rendering previously replaced raw `<eac-embed>` tags with Arts components instead of leaking raw tags.
- VS Code `get_errors` found no editor errors in key TS/JS files after earlier edits.

Needs immediate smoke testing before calling it fully stable:

- `/home/elkdonis/dev-enviroment/eac-repo/packages/silex-nextcloud-connector/src/editorBlocksMiddleware.js` now has both a guarded `res.send` injector and a dedicated `editorRootMiddleware()` that reads `/silex/dist/client/index.html` and injects `/eac-silex-blocks.js`.
- `/home/elkdonis/dev-enviroment/eac-repo/packages/silex-nextcloud-connector/index.js` hoists the block script, block injection, and root middleware ahead of Silex routes, while token redemption is placed after cookie-session.
- That design is sane, but the Silex editor root should be tested with both `/?t=<token>` and `/` because middleware hoisting/order was the most fragile part of the session.
- TypeScript should be rerun after the latest middleware work: `pnpm --filter arts-collective exec tsc --noEmit`.
- Public smoke should be rerun for `test.localhost:3007` after the latest connector changes.

Update after troubleshooting Justin's editor launch:

- Symptom: opening Silex from `/hub` redirected to `http://localhost:6805/?t=<token>&slug=guru-dharam-singh`, but Silex showed its own `Nextcloud (artist)` login prompt and the browser console reported `API error 401 Not logged in`.
- Root cause: the hoisted Silex middleware was checking `req.query.t`. In the Silex/Express route position where our middleware runs, `req.query` was not reliable, so fresh `?t=` launches could fall through to the editor/root HTML without redeeming the one-time token.
- Patch: `/home/elkdonis/dev-enviroment/eac-repo/packages/silex-nextcloud-connector/src/auth.js` now parses query params directly from `req.originalUrl || req.url`, and `/home/elkdonis/dev-enviroment/eac-repo/packages/silex-nextcloud-connector/src/editorBlocksMiddleware.js` now checks `url.searchParams.has("t")` before serving the injected root HTML.
- Verification: after `docker compose restart silex`, a fake-token request to `http://127.0.0.1:6805/?t=fake-token-after-patch&slug=guru-dharam-singh` returns our explicit `401 Editor session expired` page instead of the Silex editor/login prompt. That proves the token middleware is intercepting launch URLs again.
- Next user action: open the editor from `/hub` again to mint a fresh token. Previously-used tokens are single-use and will correctly return `410 Gone` / expired-token behavior.

Known dirty/generated noise:

- `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/.next.root-owned-20260425024517/*` contains generated Next/Turbopack files that appeared during local runs. Treat these as generated build artifacts, not intentional source.
- There are many broader app/forum changes in the working tree from the larger session. Do not revert unrelated user or generated changes without explicit instruction.

## Connection Map

### Runtime Services

- Arts app: `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective`
- Arts container/service: `eac-arts-network` / `arts-collective`
- Arts dev port: `3007`
- Silex stable service: `silex`
- Silex container: `eac-silex`
- Silex editor port: `6805`
- Silex active image: `silexlabs/silex:latest`
- Nextcloud container: `nextcloud-app`
- Postgres container: `eac-postgres`
- Database: `elkdonis_dev`

### Silex Service Wiring

Active Compose service is in:

`/home/elkdonis/dev-enviroment/eac-repo/docker-compose.yml`

Important values:

- `image: silexlabs/silex:latest`
- `SILEX_SERVER_CONFIG: /silex/extensions/silex-nextcloud-connector/index.js`
- `./packages/silex-nextcloud-connector:/silex/extensions/silex-nextcloud-connector:ro`
- `6805:6805`

Inactive canary reference is kept at:

`/home/elkdonis/dev-enviroment/eac-repo/packages/silex-canary/Dockerfile`

Canary lesson: `v3.7.3-canary.4` exposed different built-in storage/hosting behavior and did not load the Node `SILEX_SERVER_CONFIG` connector path, so it is not the active editor.

## Auth And Roles

User session source:

`/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/lib/session.ts`

Role and org source:

`/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/lib/org.ts`

Role expectations:

- Roles are per organization through `user_organizations`.
- `owner` is higher than `admin`.
- `owner` and `admin` can edit Silex/org site surfaces through `canEditOrgSite()`.
- `isOrgOwner()` remains stricter and only returns true for owner.
- `getEditableOrgsForUser()` returns orgs where the user is `owner` or `admin`, preferring owner when duplicates exist.

Token bridge:

1. Hub calls `/api/silex/token` with `{ slug, mode }`.
2. Arts checks session, Nextcloud credentials, and `canEditOrgSite()`.
3. Arts ensures the org folder exists in Nextcloud.
4. Arts stores a short-lived single-use token in Redis via `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/lib/silex-tokens.ts`.
5. Browser goes to `/edit/{slug}?t=<token>`.
6. `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/app/edit/[slug]/page.tsx` verifies the user and redirects to Silex at `http://localhost:6805/?t=<token>&slug=<slug>`.
7. Silex connector middleware in `/home/elkdonis/dev-enviroment/eac-repo/packages/silex-nextcloud-connector/src/auth.js` redeems the token from `/api/silex/auth`.
8. Silex stores `ncUser`, `ncPass`, `ncBaseUrl`, `projectPath`, `publishedPath`, `slug`, `orgId`, and `userId` in Silex's Express session.
9. The token is stripped from the editor URL and cannot be used again.

## Nextcloud Folder Model

Folder helper:

`/home/elkdonis/dev-enviroment/eac-repo/packages/nextcloud/src/org-folders.ts`

Defaults:

- Root folder: `EAC-Network`, unless `NEXTCLOUD_ORG_ROOT_FOLDER` overrides it.
- Per-org folder: `<rootFolder>/<orgId>`.
- Example for `test`: `EAC-Network/test`.

Automatic creation expectation:

- `organizations.nextcloud_folder_path` is the canonical per-org folder path.
- If the org already has `nextcloud_folder_path`, Arts verifies/creates that exact tree with `ensureOrgFolderPath()`.
- If it is missing, Arts creates `<root>/<orgId>` using `ensureOrgFolder()` and writes it back to `organizations.nextcloud_folder_path`.
- This happens on first editor token mint in `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/app/api/silex/token/route.ts` and also during `Use Silex site` activation in `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/app/api/silex/layout/route.ts`.
- The folder is created through the current user's per-user Nextcloud credentials, so Silex reads/writes as that Nextcloud user.

Silex project convention:

- Project directory: `<orgFolder>/silex/project`
- Project data file: `<orgFolder>/silex/project/website.json`
- Metadata file: `<orgFolder>/silex/project/meta.json`
- Assets directory: `<orgFolder>/silex/project/assets`

Silex published convention:

- Published directory: `<orgFolder>/silex/published`
- Public entry candidates: `<orgFolder>/silex/published/front.html` or `<orgFolder>/silex/published/index.html`
- Public DB reference: `nextcloud://<ncUser>/<path-to-front-or-index-html>` in `organizations.silex_published_path`.
- Activation API stores `silex_project_path`, `silex_published_path`, and `silex_published_at` on the org row.

Public render expectation:

- Public viewer does not need Nextcloud credentials.
- Arts parses `organizations.silex_published_path` using `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/lib/silex-published.ts`.
- Arts looks up the owning `users.nextcloud_user_id` and `users.nextcloud_app_password` for the `nextcloud://` user.
- Arts downloads the published HTML from Nextcloud server-side and renders it inside the normal org page shell.
- CSS/assets referenced from `/css/...` or `/assets/...` are rewritten/proxied through `/api/silex/assets/{slug}/...`.

## Public Site And Subdomain Flow

Subdomain middleware:

`/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/middleware.ts`

Flow:

1. Request to `test.localhost:3007` is rewritten to `/sites/test`.
2. `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/app/sites/[slug]/page.tsx` loads the org by slug.
3. If `org.layout_mode === 'silex'` and `org.silex_published_path` exists, it renders `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/components/silex-layout.tsx`.
4. Otherwise it renders the default Arts/network layout.
5. Switching back to default does not delete the Silex project or published files.

This means Silex takes over the public surface only while `layout_mode='silex'`. The default Arts/network layout remains recoverable by switching `layout_mode` back to `default`.

## Test User / Test Org

Important test identity from this session:

- Email: `gurudharamsingh@gmail.com`
- Nextcloud user id: `3aca4343-492e-48f8-a26d-1bbf1db2cafa`
- Org slug: `test`
- Host: `test.localhost:3007`
- Expected org folder: `EAC-Network/test`
- Expected Silex project: `EAC-Network/test/silex/project/website.json`
- Expected Silex published HTML: `EAC-Network/test/silex/published/front.html` or `EAC-Network/test/silex/published/index.html`

A test Silex-backed page was created for this user/org during the session. Public smoke previously showed Silex HTML rendering with Arts live embeds, but it should be rechecked after the latest middleware changes.

## Important Source Files

Silex connector:

- `/home/elkdonis/dev-enviroment/eac-repo/packages/silex-nextcloud-connector/index.js`
- `/home/elkdonis/dev-enviroment/eac-repo/packages/silex-nextcloud-connector/src/auth.js`
- `/home/elkdonis/dev-enviroment/eac-repo/packages/silex-nextcloud-connector/src/NextcloudStorage.js`
- `/home/elkdonis/dev-enviroment/eac-repo/packages/silex-nextcloud-connector/src/NextcloudHosting.js`
- `/home/elkdonis/dev-enviroment/eac-repo/packages/silex-nextcloud-connector/src/webdav.js`
- `/home/elkdonis/dev-enviroment/eac-repo/packages/silex-nextcloud-connector/src/editorBlocksMiddleware.js`
- `/home/elkdonis/dev-enviroment/eac-repo/packages/silex-nextcloud-connector/src/editor-blocks.js`
- `/home/elkdonis/dev-enviroment/eac-repo/packages/silex-nextcloud-connector/README.md`

Arts Silex APIs:

- `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/app/api/silex/token/route.ts`
- `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/app/api/silex/auth/route.ts`
- `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/app/api/silex/layout/route.ts`
- `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/app/api/silex/assets/[slug]/[...path]/route.ts`
- `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/app/api/silex/publish/route.ts` (legacy direct HTML upload path; not the main connector path)

Arts Silex UI/rendering:

- `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/app/edit/[slug]/page.tsx`
- `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/app/hub/page.tsx`
- `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/components/hub/SilexSurfaceControls.tsx`
- `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/app/sites/[slug]/page.tsx`
- `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/components/silex-layout.tsx`
- `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/components/silex-embeds.tsx`

Arts Silex helpers:

- `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/lib/org.ts`
- `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/lib/session.ts`
- `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/lib/silex-tokens.ts`
- `/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/lib/silex-published.ts`

Nextcloud and DB:

- `/home/elkdonis/dev-enviroment/eac-repo/packages/nextcloud/src/org-folders.ts`
- `/home/elkdonis/dev-enviroment/eac-repo/packages/db/migrations/035_layout_mode.sql`

Docker/canary:

- `/home/elkdonis/dev-enviroment/eac-repo/docker-compose.yml`
- `/home/elkdonis/dev-enviroment/eac-repo/packages/silex-canary/Dockerfile`

## GrapesJS / Editor Blocks State

Injected script:

`/home/elkdonis/dev-enviroment/eac-repo/packages/silex-nextcloud-connector/src/editor-blocks.js`

Middleware serving/injecting it:

`/home/elkdonis/dev-enviroment/eac-repo/packages/silex-nextcloud-connector/src/editorBlocksMiddleware.js`

Current block categories:

- `Arts Compound`
- `Arts Live Slots`

Compound blocks include:

- `eac-workshop-launchpad`
- `eac-gathering-room`
- `eac-community-pulse`
- `eac-rsvp-card-deck`
- `eac-resource-library`
- `eac-network-surface`

Live slots include:

- feed
- workshops
- RSVP
- poll
- live
- resources

The block output intentionally uses `<eac-embed data-eac-component="..." data-variant="inline">` placeholders. Public Arts rendering replaces those placeholders with trusted server-rendered React components in:

`/home/elkdonis/dev-enviroment/eac-repo/apps/arts-collective/src/components/silex-embeds.tsx`

## Next Best Steps

1. Run a focused smoke test on the current middleware:
   - `curl -i http://127.0.0.1:6805/eac-silex-blocks.js | head`
   - open or curl `http://127.0.0.1:6805/` and confirm the HTML contains `/eac-silex-blocks.js`
   - launch from `/hub` with a fresh token and confirm token redemption still wins before the root HTML handler serves the editor
2. Run typecheck:
   - `cd /home/elkdonis/dev-enviroment/eac-repo && pnpm --filter arts-collective exec tsc --noEmit`
3. Public smoke:
   - `curl -H 'Host: test.localhost:3007' http://127.0.0.1:3007/`
   - confirm no raw `<eac-embed>` tags leak in public output
   - confirm compound sections and live components render
4. Decide whether to keep the root HTML injection approach or instead serve a custom Silex client build/index file if middleware remains fragile.
5. Implement deterministic seed generation for first-time orgs so Silex opens with a useful starter project instead of an empty page.
6. Add a real publish callback or database update path from the Silex hosting connector, so `Use Silex site` does not rely only on detecting existing files.
7. Add stronger HTML sanitization before wide production exposure.

## Current Mental Model

The intended stable architecture is:

Arts session -> owner/admin hub -> one-time Redis token -> Silex editor origin -> connector redeems token -> Silex reads/writes as user's Nextcloud account -> Silex publishes static files to org folder -> Arts stores `nextcloud://` published ref -> public subdomain renders Silex HTML with Arts embeds -> owner/admin can switch public surface back to default Arts layout anytime.

That model is good. The main unstable edge is only the editor-side script injection/order inside Silex, not the broader Arts/Nextcloud/public-rendering architecture.