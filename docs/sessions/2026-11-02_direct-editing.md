# Handover: direct editing, classifieds, feed cards and the tenancy floor (2026-11-01 to 2026-11-02)

One session thread (2026-11-01 to 2026-11-02) built the security and tenancy floor, the org classifieds
page, the canvas-grade direct-editing package (passes 1-3), the shared font library and feed cards over live
data. This file is meant to be enough to start a fresh session. Labels: verified (checked by this session,
with date), reported (stated by the coordinating session, not re-checked here), assumed, unknown. Nothing
from this thread is committed; the working tree also holds many other sessions' uncommitted changes.

## 1. Where things stand

Live (production containers):
- arts-collective (container `eac-arts-network`) was rebuilt with pass 3 and restarted 2026-11-02 at about
  17:05 UTC (reported; the container showed "Up 30 minutes" at 17:38 UTC, verified 2026-11-02).
- `scripts/tenant-smoke.sh` passed 9/9 after that restart (reported).
- Signed out, `/hub/sites/<slug>/classifieds` and `/hub/sites/<slug>/cards` redirect to login (reported).
- No org has saved a classifieds page or a card design: `site_config` has no `classifieds:page` and no
  `cards:feed` rows (verified 2026-11-02 17:38 UTC, read-only query). The first real save is the first
  real-data run of both editors.
- Backup of the build replaced at 17:05: `~/eac-backups/next/arts-collective-20261102-1205.tgz` (verified to
  exist). Restore recipe: `docs/reference/ops.md:325`.
- Other apps that use `@elkdonis/auth-server` (ifac, innergathering, artdirect and the rest) still run the
  old session code until each is rebuilt (reported). Only arts-collective has the verified-session code live.

Source only, not live anywhere: nothing. Everything listed below is in the arts-collective build, except
the other apps' copies of the auth-server change.

Not committed: all of it. `git status` shows `packages/direct-edit/`, `packages/fonts/`, `apps/arts-collective/src/lib/{classifieds,cards}/`,
`apps/arts-collective/src/components/{classifieds,cards}/` and the new hub route as untracked, and edits to
`CLAUDE.md`, `docker-compose.yml`, `packages/auth-server/src/{index,api-routes}.ts`, `packages/db/src/index.ts`,
`packages/page-builder/{package.json,src/editor.tsx}`, `packages/services/src/themes.ts`,
`apps/arts-collective/src/{middleware.ts,lib/org.ts,components/sites/OrgDefaultPage.tsx}` (verified 2026-11-02).

## 2. What was built, with paths

### Security and tenancy floor (2026-11-01)
- Session verification: `packages/auth-server/src/verify-session.ts`. `getServerSession` used to trust what
  Supabase `getSession()` read from the cookie; it now calls `getVerifiedSession` (`verify-session.ts:133`), which checks the access token's HS256 signature,
  expiry, audience and subject with `JWT_SECRET`, or asks GoTrue when the secret is absent. Wired at
  `packages/auth-server/src/index.ts:285` and `api-routes.ts:477`, `:503`. `docker-compose.yml` passes
  `JWT_SECRET` to the app services (lines 103, 184, 233, 289; verified).
- Migration 227 (`packages/db/migrations/227_tenant_role.sql`, applied 2026-11-01): role `eac_tenant`
  (NOLOGIN, no BYPASSRLS), `app_org_id()`, RLS on 21 org-owned tables with policies that bind only
  `eac_tenant`. `postgres` bypasses RLS, so existing queries are unchanged; code opts in.
- `withOrg(orgId, fn)`: `packages/db/src/tenant.ts:18` (transaction with `set_config('app.org_id')` and
  `SET LOCAL ROLE eac_tenant`; fails closed without an org). Callers today: only
  `apps/arts-collective/src/lib/classifieds/store.ts` and `lib/cards/store.ts` (verified by grep 2026-11-02).
- Cross-tenant guard: `apps/arts-collective/src/middleware.ts:141-165`. On an org host, `/sites/<its own
  slug>/…` redirects to the canonical path and `/sites/<any other org>` is a 404.
- `scripts/tenant-smoke.sh`: through the public edge, per org subdomain: home 200, another org's path 404,
  own nested path 308. Exit status = number of failures.
- Page designer save recovery: `packages/page-builder/src/editor.tsx` (stash key at `:113`). Unsaved Puck
  work is kept in the browser and restored after a reload; a save that fails because the site was rebuilt
  says so instead of losing the work.
- Theme values: `packages/services/src/themes.ts:40` `VALUE_RE` accepts quoted font stacks
  (`"Source Sans 3", sans-serif`) and rejects `url(` / `image(` / `image-set(` / `cross-fade(` / `element(` /
  `src(` / `expression(` and line breaks.

### Org classifieds page and editor (2026-11-01, extended in passes 2-3)
- Public page `<org>.arts-collective.com/classifieds`: `apps/arts-collective/src/app/sites/[slug]/classifieds/page.tsx`
  (404 for visitors when the org has none). Editor `/hub/sites/<slug>/classifieds` (owners and guides,
  `canEditOrgSite`, checked again in `lib/classifieds/actions.ts`).
- Data: `lib/classifieds/catalog.ts` (families incl. the pass-3 "Plain site" family at `:165`, templates incl.
  card templates from `:208`, `effective` `:353`, the render plan `planAd` `:438` / `planHTML` `:489`,
  `cleanDoc` `:587`); stored in `site_config` key `classifieds:page` (`:41`) through `withOrg`.
- Slot schema per kind and freedom level: `lib/classifieds/schema.ts` (`STRUCTURE` `:116`, `PART_SCHEMA`
  `:314`, page grid `PAGE_SCHEMA` `:330`, colour palettes `paletteGroups` `:91`, `colourSlot` `:104`).
- Editor host: `lib/classifieds/editor-engine.ts` (`mountClassifiedsEditor` `:111`; pattern mode
  `PatternOptions` `:47`; structure edits `moveNodeTo` `:370`, `insertNew` `:415`, `wrapInBox` `:482`;
  `setGrid` `:320`; `dragNode` `:1355`; `applyResize` `:1513`), mounted by
  `components/classifieds/ClassifiedsEditor.tsx`.
- Public renderer: `components/classifieds/ClassifiedSheet.tsx` over `BlockView.tsx` (React elements built
  from the plan; no `dangerouslySetInnerHTML`).

### `packages/direct-edit` (passes 1-3, plain DOM, no new dependencies)
- Pass 1: slot schema and freedom levels (`model/schema.ts`), history (`model/history.ts`), the panel
  (`panel/panel.ts`), overlay, click-deeper, inline text, ghost drags (`canvas/`).
- Pass 2: rich text `model/richtext.ts` (subpath `/richtext`: b, i, u, a[http(s)], ul/li, br), floating text
  bar `canvas/minibar.ts`, right-click menu `canvas/menu.ts`, viewport `canvas/view.ts`, export
  `canvas/export.ts`, Tweaks tab, computed values, whole-page layer tree.
- Pass 3: the block model `src/block/` (subpath `@elkdonis/direct-edit/block`, no DOM): `style.ts` (node style
  vocabulary, `BOUNDS` `:50`, `cleanStyle` `:212`), `tree.ts` (`moveNode` `:119`, `canPlace` `:151`, `cleanTree`
  `:164`), `grid.ts` (`GridSpec`, `scaleSpan`, `cleanGrid`), `bind.ts` (`fillTokens` `:51`, `safeSrc` `:66`).
  Smooth resize on the chosen grid `canvas/resize.ts:76`; node drag between containers
  `canvas/nodedrag.ts` (`findDropSpot` `:42`, `startNodeDrag` `:94`); nested click-deeper (`model/nodes.ts`
  `hitChain`, `deeperIn`); palette colour popover with Recent and eyedropper (`panel/panel.ts`).
- Data compatibility: a block without its own tree follows its template's (default: the five original parts,
  whose names stay their ids); pass-1/2 saved docs clean byte-for-byte unchanged (verified on three docs).

### `packages/fonts` (2026-11-01)
503 curated Google families plus 8 system faces (`src/catalogue.ts`, generated by
`scripts/build-catalogue.mjs`), `fontStack`, `googleFontsHref` (only the fonts a page uses ship), roles,
browser loader. danamccool keeps its own `fonts.ts`.

### Feed cards (pass 3, 2026-11-02)
- One card design drawn for every item of an org's feed; words name fields as `{{tokens}}`.
  `lib/cards/catalog.ts` (`CARDS_KEY = "cards:feed"` `:23`, `feedItem` `:97`, `SAMPLE_ITEMS` `:116`,
  `cardsToSheet` `:128`, `cleanCards` `:143`), `lib/cards/{store,actions}.ts` (`withOrg`, `canEditOrgSite`).
- Designer `/hub/sites/<slug>/cards`: `app/hub/sites/[slug]/cards/page.tsx` (the org's newest 24 public posts,
  sample items when it has none), `components/cards/CardsEditor.tsx` (the editor in pattern mode).
- Public: `components/cards/FeedCards.tsx`, used by `components/sites/OrgDefaultPage.tsx:52`, `:141`
  ("What's on" is drawn with the cards once a design is saved; otherwise the old list). `getOrgFeed` selects
  `metadata->>'coverImageUrl' AS cover_image_url` (`lib/org.ts:248`, `:265`).

## 3. Docs to read, in order
1. `docs/open/DIRECT_EDITING_PANEL_PLAN_2026-11-01.md`: Context, Direction, Work plan (phases 1-5), Progress,
   Gap analysis, live canvas tests, "Pass 2 progress", "Pass 3 progress" (decisions and known limits).
2. `docs/open/DIRECT_EDITING_LAYER_2026-11-01.md`: the canvas teardown ("Reference: the claude.ai design canvas").
3. `docs/open/EDITING_NICHE_RESEARCH_2026-11-01.md`: what exists elsewhere, licences, which libraries were
   considered (none adopted so far).
4. `docs/open/PATTERNS_VERSIONS_REVIEW_PROTOTYPES_2026-11-01.md`: the data model for org patterns with
   instances, revisions with a published pointer, and the review queue (Phase 4).
5. The one-app review: claude.ai Doc "Arts Collective: One App Reform Review",
   https://claude.ai/artifact/X4UzFg2UffJTnbpDCko1DU, and its phase plan (in that Doc; not mirrored in the repo,
   verified by grep 2026-11-02). Decision 5 there is the home for freedom levels (`org_capabilities`).
6. Operating rules: repo `CLAUDE.md`, `docs/reference/ops.md` (rebuild one app), `docs/reference/testing.md`.

## 4. Artifacts
- Test page (pass 3, real code, sample data, saves run the server cleaners in the browser):
  https://claude.ai/artifact/Tj5dDXsKcxoEuYQ14szwD9. Views `#sheet`, `#cards`, `#stops`; add `-borrow` or
  `-free` (e.g. `#cards-free`). Artifact slug `d86db182-72e1-48be-96d7-df556f26d5c0`.
- First prototype (classifieds, freedom levels, graft): https://claude.ai/artifact/2RjNrmiF7zYFAF2k3UCJkB
- Phase 4 prototypes: patterns with instances https://claude.ai/artifact/HgYs7WAoQZtc3UgbYC6pPL,
  drafts and revisions https://claude.ai/artifact/R2X9C3sbPcx7uE1iZ72dqM, review queue
  https://claude.ai/artifact/JW7NnaNkBVyL8BQKhWbRZ5 (sources: Windows scratchpad `prototypes\{p1,p2,p3}.html`).
- Justin's canvas design: https://claude.ai/artifact/Qtq1RiwzjvXkUp1gVM2K1y
- His recording `C:\Users\Justi\Videos\canvas on claude.mp4` (153 s); frames `f_001`-`f_031.jpg` in the Windows
  scratchpad `vid\` folder (path below).
- Windows scratchpad of this thread:
  `C:\Users\Justi\AppData\Local\Temp\claude\C--Windows-System32\2344c705-1237-43a2-b9cd-3df0b9d605fa\scratchpad\`
  (`harness3\` pass-3 harness and suites, `testpage3\` test page source, `p3\` working copy of the edited files).

## 5. Justin's direction and preferences (from this thread)
- Canvas-grade editing (click into nested boxes, a mature right-hand panel, many fonts, alignment, column spans),
  stored as block data `{ template, overrides, link }`, never free HTML, so improving a template improves every page.
- Constraint is a dial, not a wall: freedom levels Family / Borrow / Free; values outside a level are kept and
  flagged amber with "Snap to family", never silently changed.
- A font library the group curates and grows (proposals, uploads with licences, approval).
- Org-specific blocks, templates and patterns that go under review and can be promoted into network templates.
- Versions and review rather than instant canonical edits.
- Every element is its own box: a heading or price gets the full box sections plus Text (pass 3).
- Real colour choice at every level: family palette, tints and shades, wider curated palette, recent colours,
  eyedropper; out-of-family allowed at Borrow, flagged at Family (pass 3).
- Smooth resize that lands on a grid the sheet chooses (pass 3).
- Beyond classifieds: a card over a live feed, and a guided-tour page with its stops (pass 3: feed cards live;
  tour stops harness demo only).
- One-app direction (from the one-app review): org sites cloned from one template (ifac / innergathering as the
  org-site model), products kept separate, a shared network shell. Justin's reply: the security floor comes first
  (done 2026-11-01 for arts-collective; other apps pending rebuild).

## 6. Next steps, in order
1. Watch the first real saves of `/hub/sites/<slug>/classifieds` and `/hub/sites/<slug>/cards` (logs:
   `docker compose logs --tail 100 arts-collective`; rows in `site_config`). The card surface has never run
   against a real org's feed with a saved design.
2. Blocked on Justin (open questions): default freedom level for members; whether Free (raw CSS, absolute
   position, exact sizes) is for members or admins only (today the level is a toggle in the editor's top bar,
   open to every owner and guide; the server validates bounds, not levels); who reviews promotions; font uploads
   and licence checks; how long drafts and revisions are kept.
3. Phase 4: `page_revisions` with a published pointer (follow `lms_course_versions`), org patterns with
   instances, the review queue. Prototypes and data model: `PATTERNS_VERSIONS_REVIEW_PROTOTYPES_2026-11-01.md`.
   A migration is allowed (next free number 230; 228 and 229 belong to other sessions); add new org tables to
   the `eac_tenant` policy set as 227 does.
4. Tour stops on real tour pages: move the render plan renderer (`components/classifieds/BlockView.tsx` and the
   plan parts of `lib/classifieds/catalog.ts`) into a package elktours can import, then add a stops block to its
   tour layout. Another session edits `apps/elktours`; coordinate before touching it.
5. Puck mounting (plan Phase 5): upgrade Puck 0.23 to 0.24 first, then mount the panel through
   `overrides.iframe` / `overrides.fields`; `packages/page-builder/src/drag/item-focus.tsx` shows the hook.
6. Smaller gaps from pass 3: auto-scroll while dragging near the canvas edge; the drag ghost keeps the grab offset
   (a wide part's ghost can sit over the left rail); layer-tree drag only reorders beside rows; Recent colours are
   per browser; Tweaks is not wired to `site_themes`; `font_library` table.
7. Rebuild the other apps that use `@elkdonis/auth-server` so they verify sessions (ops.md recipe, one at a time,
   tenant-smoke and sign-in check after each).
8. The stream FX session needs `reel-render` and `obs` restarted to pick up its work (reported; not done here,
   not this thread's change; check with that session before restarting).
9. Remaining tenancy work: convert org-scoped reads and writes to `withOrg` (two callers today), and the other
   decisions of the one-app review.

## 7. Environment lessons
- Access: `ssh eris` from Git Bash; repo `~/eac`. No node on the host: run tooling as
  `sudo -n docker exec -w /app/<path> eac-admin <cmd>` (repo mounted at `/app`), e.g.
  `pnpm -s check-types` per workspace (0 errors in direct-edit, fonts, page-builder, arts-collective on 2026-11-02).
- Dependencies: only via `cd ~/eac && sudo -n docker compose run --rm install` (node_modules belong to the
  containers).
- Editing files remotely: heredocs over ssh mangle quotes. Write locally and `scp`, or pipe a node patch script
  to `docker exec -i ... node`. In JS `String.replace`, `$$` in the replacement string becomes `$` (it turned
  `page.$$eval` into `page.$eval` once); use split/join or a function replacement. The pass-3 working copy synced
  files with `p3/sync.sh` (tar of files newer than `.base`).
- Production rebuild of one app (`docs/reference/ops.md:266-300`): check the tree for other sessions' fresh edits
  (a build compiles everything on disk); back up `.next` to `~/eac-backups/next/`; build inside the live container
  by name (`docker exec eac-<container> ...`; arts-collective needs
  `NODE_OPTIONS=--max-old-space-size=3584 NEXT_BUILD_CPUS=2`); `docker compose restart <svc>`, or `up -d <svc>`
  after `.env` changes; then `scripts/tenant-smoke.sh` and `docker compose logs --tail 50 <svc>`. Rebuild only
  when Justin asks.
- Testing without a dev server: an esbuild bundle of the real engine, panel and cleaners
  (`harness3\hb.sh` builds in the container), served locally (`harness3\serve.cjs`, port 4792) and driven with
  Playwright from the npx cache (`drive1.cjs` 64/64, `drive2.cjs` 197/197, `drive3.cjs` 141/141 on 2026-11-02).
  Public output: `harness3\ssr3.sh` (renderToStaticMarkup over the real components in the container).
- Migrations are allowed any time (`packages/db`, `node scripts/migrate.mjs`); next free number 230.
- Other sessions are active in `packages/studio`, `packages/reels`, `packages/services` and `apps/elktours`;
  stay out unless coordinated.
- Artifacts: hashes must be plain names (`#cards-free`, not `#cards/free`); storage may throw in the viewer's
  sandboxed frame (wrap every `localStorage` access, including `typeof localStorage`).
