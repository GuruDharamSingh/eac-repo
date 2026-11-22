# innergathering: what is dead, duplicated or legacy (read-only audit, 2026-11-20)

Scope: `apps/innergathering` (live at elkdonis-arts.org, org `inner_group`, container `eac-innergathering`, :3015). Nothing was edited, built or written to the DB. Another agent is editing CSS, `site-style*`, `layout.tsx`, `site-header/footer`, `puck/*`, `studio/*`, `package.json` and `next.config.ts` right now (all show `M` or `??` in git), so every batch below that touches those files must wait for that work or be rebased onto it.

Evidence sources: import-graph greps over `apps/innergathering/src` and `packages/*/src`; the NPM proxy access log for the elkdonis-arts.org host (`proxy-host-16_access.log` plus `.1.gz`, 2026-11-09 to 2026-11-20, bots and scanners filtered by user agent, status 200/307/308 only; the app's own container log has no request lines, so the proxy log is the only hit source); `atlas:q --app innergathering`; `reports/drift.md`; `site_config` row counts for `inner_group` and `elkdonis`. Limits: the window is 11 days, so "0 hits" means "rare", never "proven dead". Links built from template strings could hide callers from grep; each such case is called out.

## 0. /books is not part of this app

- `/books` is `apps/fourthwayBookreaders` (container `eac-fourthway-bookreaders`, :3019, org `fourth_way_book_readers`). NPM proxy host 16 has `location /books` pointing at it; `location /` goes to innergathering. `innergathering` has no `books` route, import or link (grep of `src`: only an English "books" in a comment at `lib/cms/own-service-actions.ts:9`).
- Fully separate: own `src/app/layout`, own CSS (`src/app/site.css` 1568 lines, `src/app/akhand-path/paath.css` 227, `globals.css`, `components/paath/admin-details.css`), own `[feed]`, `manage/*`, `login`, `api/*`, `granth`, `akhand-path`, `groups`, `suggest`, `archive` routes, own components (`circle/`, `paath/`, `home/`) and own `lib/`. `lib/base-path.ts` drives Next `basePath` from `NEXT_PUBLIC_BASE_PATH=/books` (`docker-compose.yml:2009`). It shares only workspace packages (`@elkdonis/*`) and the Supabase auth cookie. Private parts (Akhand Path, manage) sit behind its own `lib/auth.ts`; I did not test the gates.
- Live: 10 hits on `/books/groups`, 9 on `/books` in the window.
- Own-app question: it already is its own app (own container, image target, port, org). Only the shared hostname and the `/books` proxy path tie it to elkdonis-arts.org, and the compose comment says it can move to `books.elkdonis-arts.org` by unsetting one env var. Nothing in this report touches it. I did not look for dead code inside it beyond the structure above (out of scope).

## 1. Routes (`src/app/**`)

Hit counts are successful GETs from non-bots, 2026-11-09 to 2026-11-20. "Linked" means a code reference found in the app or a package.

| Route | Evidence (links, hits, data) | Class | Action | Risk |
|---|---|---|---|---|
| `/` (`page.tsx`, 429 lines) | 1936 hits; real data; Puck/landing tree plus code page | live | keep; see section 4 for its unread config | n/a |
| `/[feed]`, `/[feed]/[slug]` | `/blog` 198, `/enneagram-foundations` 80, `/general` 13, many slugs; real threads | live | keep | n/a |
| `/about`, `/about/[slug]` | 208 and about 330 hits; header link | live | keep | n/a |
| `/artists`, `/artists/[slug]`, `.../writing`, `.../writing/[piece]` | `/artists/jg` 60, writing about 45; linked from `writing-actions`, `blog-actions`, cms-ui `host-links` | live | keep | n/a |
| `/forum/[[...segments]]` | about 900 hits across `/forum/*`; real | live | keep | n/a |
| `/login`, `/account`, `/data`, `/data/delete`, `/terms`, `/unsubscribe` | header/footer links; 1083, 85, 175, 19, 17 hits; unsubscribe linked from the newsletter package | live | keep | n/a |
| `/hub` (`hub/page.tsx` 427 lines, `cards-view.tsx` 182, `site-view.tsx` 264) | 114 hits. Three hub layouts chosen by cookie: `classic` (the inline branch of `hub/page.tsx`, from about line 84 to the end), `site` (default), `cards2`. Comments say Page is the default since 2026-09-26 and classic was kept off phones because it crashed (no `.catch`, no error boundary) | legacy-replaced (classic branch only) | merge: drop the `classic` branch and the `classic` entry in `HUB_VIEWS` (`hub/views.ts:4`). The toggle labels live in `packages/cms-ui/src/hubsite/HubViewToggle.tsx:16` and the cookie type in `view-cookie.ts:3`, so this also touches the shared package. A stale comment in the branch says "this app serves no /forum route", which is wrong now | medium: anyone who chose "Cards" has the cookie set and would fall to Page; about 330 lines and about 11 service calls go away. Ask Justin first |
| `/hub/calendar`, `/documents`, `/files`, `/organization`, `/pipeline`, `/publish`, `/whiteboard`, `/newsletter`, `/newsletter/[slug]`, `/email`, `/email/[key]`, `/email/[key]/edit` | 0 direct hits (the hub is mostly in-page surfaces) but each is linked: cms-ui `connectors.ts`, `FileBrowser`, `PipelineFace`, `WhiteboardFace`, `HubTools`, `HubSurfaces.tsx`, `email-suite.ts` | live (rarely used) | keep | n/a |
| `/hub/chat` | 8 hits. Page comment says the hub ChatCard links its "expand" here, but no literal `/hub/chat` appears in app or packages, so the link is built from a template | rarely used | keep; verify the ChatCard link before touching | low |
| `/hub/compose` | linked from cms-ui `PublishDoors`, `writing-room`, `catalogue`, `ComposeGroupSwitch` | live | keep | n/a |
| `/manage/compose` (`manage/compose/page.tsx`, 45 lines) | 0 hits; no link anywhere (only `lib/cms/questionnaire-actions.ts:32` passes the string as a login `next` argument); page says "The hub's Compose card lands here" but the card lands on `/hub/compose`. `components/manage/compose-workspace.tsx` (69 lines) is a second copy of `components/hub/compose-workspace.tsx` (198 lines). Not in the `/manage` tab bar (`manage/layout.tsx:11-18`) | duplicate | delete the page and `components/manage/compose-workspace.tsx`; change `questionnaire-actions.ts:32` to `/hub/compose` | low |
| `/manage`, `/feeds`, `/pages`, `/people`, `/video`, `/center`, `/analytics`, `/content/new`, `/content/[id]`, `/content/[id]/attendees` | tab bar in `manage/layout.tsx`; 18 to 299 hits each; editor-gated in the layout | live | keep (their fate belongs to the house-editor plan) | n/a |
| `/studio` (index), `/studio/[slug]`, `/studio/[slug]/canvas` | about 21 hits; editor-gated; two editors on one `puck:<slug>` doc (Puck at `[slug]`, bare canvas at `/canvas`). Files are being edited by another agent | live (editor), duplicate surfaces | keep for now; the house-editor doc already plans `/canvas` to become a redirect | n/a |
| `/p/[slug]` | only hit in the window: `/p/astrology-reading` x2, both 404. Stored `puck:*` pages for `inner_group`: `showcase` (Sep 16), `try-it` (Sep 15), `whats-on` (Sep 15). No nav links; `/studio` index lists them | rarely used | keep the route (the Puck publish target); ask Justin whether the three stored pages are trials | low |
| `/center` | 0 hits; linked from the cms-ui center rail; real data (`loadCenter`) | rarely used | keep | n/a |
| `/meetings/[id]`, `/posts/[id]`, `/profile/[userId]`, `/workshops/[id]` | redirect pages for the retired app's URL shapes (`lib/legacy.ts`). `/meetings/:id` got 55 hits (still in inboxes); the other three 0 | legacy-replaced (intentional) | keep all four; 19 to 20 lines each | high if removed (breaks old emailed links) |
| `next.config.ts` redirects (`/home`, `/feed`, `/manifesto`, `/profile`, `/workshops-eac`, `/admin*`, `/calendar`, `/files`, ...) | `/feed` 12 hits, `/home` 2, `/profile` 2, `/files` 10; others 0 | legacy-replaced (intentional) | keep | high if removed |
| `global-error.tsx` | Next special file | live | keep | n/a |

### API routes (`src/app/api/**`, 88 files)

| Route(s) | Evidence | Class | Action | Risk |
|---|---|---|---|---|
| `/api/center/quotes` (18 lines) | zero references in `src` or `packages/*/src` (cms-ui center code does not mention it); `quoteRoutes` itself is a shared service | dead (probable) | delete after a re-check of `packages/cms-ui/src/center` for a base-path-built URL | low-medium |
| `/api/hub/email/addresses`, `identity`, `messages/[id]`, `preview/[key]` | 0 literal references, but `use-email-connectors.ts:29` builds URLs as `${base}/...` from `/api/hub/email` | live | keep | n/a |
| `/api/meta/data-deletion`, `/api/instagram/data-deletion`, `/api/threads/data-deletion`, `/api/data/delete` | Meta/Threads callbacks and the deletion form; configured outside the repo | live (external caller) | keep | high if removed |
| `/api/oidc/authorize|token|userinfo` | 2 authorize and 1 token hit (Nextcloud SSO). `authorize/route.ts:63` accepts issuers `inner-gathering`, `innergathering`, `arts-collective` on purpose | live | keep | high if removed |
| `/api/work-question` | called by `GuestAnswer.tsx:26` | live | keep | n/a |
| `/api/chat/messages` | 28606 hits (hub chat poll) | live | keep | n/a |
| rest (`auth/*`, `center/*`, `hub/*`, `pipeline/*`, `threads/*`, `newsletter/*`, `checkout/return`, `media/*`, `upload`, `pulse`, `rsvp`, `contact`, `workshops/*`, `forum/[action]`, `network/arrival`) | referenced from hosts or packages | live | keep | n/a |

Cross-app duplication (not an innergathering clean-up, but the biggest slab of "build-out" by volume): `reports/drift.md` lists the pipeline routes (11 files in `api/pipeline/**`), `ig-profile-save` (`api/center/profile`, 188 lines), `payout-*`, `post-save` and `profile-section-toggle` as copies shared with amrit-canada, elktours, hidden-enneagram, ifac and sunjay. They belong in a shared route factory in a package, which is a cross-app change.

## 2. Components and lib (no importers)

Method: basename import grep over `src` and `packages/*/src`, then export-by-export grep for lib, components and config. Dynamic imports were checked (`page-editor-mount` is loaded by `EditPageButton.tsx:14`; `lib/reminders` by `instrumentation.ts:20`).

| Item | Evidence | Class | Action | Risk |
|---|---|---|---|---|
| `components/manage/compose-launcher.tsx` (77 lines) | 0 importers; its doc describes a hub popup that no longer exists | dead | delete | none |
| `components/landing/WorkQuestion.tsx` (110 lines) | 0 importers (only `GuestAnswer.tsx` is used by `app/page.tsx`); landing.css line about 2669 "WorkQuestionBox (ported for the marketing route)" | dead | delete, with its CSS (section 3) | none |
| `lib/page-edits-actions.ts` (18 lines) | 0 importers; atlas action `page-edits-save` has no caller; confirmed by the sunjay doc | dead | delete; regenerate the atlas | low |
| `components/ui/dialog.tsx`, `form.tsx`, `popover.tsx`, `radio-group.tsx`, `separator.tsx`, `sheet.tsx`, `tooltip.tsx` (about 870 lines) | 0 importers each (`form.tsx` is the only user of `react-hook-form`). shadcn leftovers | dead | delete | none (tsc proves it) |
| `lib/landing.ts`: `listFeaturedThreads` (l.203), `listMiniFeed` (l.228), `LandingThread` | exported, 0 callers; old landing "mini feed in the featured initiative panel" | dead | delete | none |
| `lib/landing.ts` `getLandingConfig` reads `initiative`, `featured_artist`, `featured_events` | `app/page.tsx` and `app/about/page.tsx` use only `imageSpaces`, `fundraising`, `aboutDocument`; `initiative`, `featuredArtist`, `featuredThreadIds` are never read, yet 3 extra `site_config` queries run on every home render | dead (reads) | delete the three reads and the `InitiativeConfig`, `FeaturedArtistConfig` types | low |
| `lib/data.ts`: `getNextInFeed` (l.187), `getThreadsByAuthor` (l.584) | 0 callers | dead | delete | none |
| `lib/writing-actions.ts`: `loadPieceListingAction`, `setPieceListingAction`; `lib/cms/blog-actions.ts`: `getStoreStateAction`, `setStoreSectionAction` | server actions with 0 callers in this app | dead (check atlas) | delete after checking they are not atlas-registered for other hosts | low |
| `lib/cms/schema.ts`: `postFormSchema`, `meetingFormSchema` and input types | exported, only used inside the file's own combined schema | dead exports | unexport | none |
| `forumHrefs` (`lib/forum.ts`), `torontoInputToDate` (`lib/format.ts`), `emailRoutes` (`lib/email-suite.ts`), `OidcClient`/`ValidatedAuthCode`/`signHs256` (`lib/oidc.ts`), `MemberCard`, `GuideSocialLink`, `EDITOR_ROLES` | 0 external references | dead exports | unexport or delete | none |
| rest of `components/hub/*`, `components/manage/*`, `ui/*`, `lib/forms/*` | single or multiple importers, all live | live | keep | n/a |
| `.next.bak.20260920161658/` (212 MB, gitignored by `.next*/`) | stale build from 2026-09-20. `tsconfig.json:9` includes `**/*.ts`, so its `types/*.ts` (`validator.ts`, 1069 lines) may be pulled into `tsc`; the top-level `node_modules` exclude may not cover its nested `standalone/node_modules` (unverified) | dead | delete the directory (not in git, filesystem only); optionally exclude `.next*` in tsconfig | none, confirm nothing uses it |

## 3. CSS

Method: every class token in each stylesheet looked up as a literal in `apps/innergathering/src` and `packages/*/src`. Template-built class names would be missed, so "unused" counts are upper bounds. Line numbers are approximate because another agent is editing these files.

| Stylesheet | Evidence | Class | Action | Risk |
|---|---|---|---|---|
| `app/landing.css` (4048 lines, imported at `globals.css:65`) | 298 classes, 170 with no literal match. Dead families (CSS lines using the prefix / TSX files using it): `initiative-*` (38 / 0; 21 classes unmatched), `grant-*` (18 / 0), `philosophy-*` (17 / 0), `signup-*` (22 / 0 here; cms-ui `BaroqueSignup` uses `eac-bq-*`), `cwq-*` (35; only the orphan `WorkQuestion.tsx`), `fundraising-*` (18; 1 TSX file, mostly unmatched), `featured-*` (21; 5 files, 11 unmatched), `inquiry-*` (30), `member-*` partly (9 unmatched), `wq-*`, `footer-*` (7 unmatched; the real footer is `ig-*`), `animate-*` and `delay-*` utilities (14 unmatched), 15 `mantine` mentions (`--mantine-*` vars at about lines 36-37, `.wq-rte .mantine-RichTextEditor-root` at about 3021). Legacy section headers: "Hero / About / Features / Team / Email signup / Footer" (about 281-1040), "Landing Hero / Board Row / Gallery / Featured Initiative / Fundraising / Philosophy / Contact Form / Join Section / Artist Directory CTA" (about 1041-2178), "WorkQuestionBox" (about 2669), "Mini feed in the Featured Initiative panel" (about 2864). The current home page uses `ig-*`, `landing-*`, `about-section`, `fundraising-section`, `marketing-root`, offerings and forum bands | legacy-replaced | delete by family, one per commit, each followed by screenshots of `/`, `/about`, `/forum` | medium: grep cannot see classes arriving from stored Puck trees; the scan already includes `packages/*/src` (blocks, cms-ui) |
| `app/globals.css` (487 lines) | 91 classes, 4 unmatched; holds `@source`/`@import` lines and the "(marketing) route group as it stood" comment at about line 64 | live | keep; the colour-variable agent owns it | n/a |
| `components/landing/offering-call.css` (75 lines) | imported at `globals.css:67`, used by `OfferingCall.tsx` | live | keep | n/a |
| `public/*` | every file is referenced by name in `src` or `packages` | live | keep | n/a |

## 4. Data leftovers (`site_config`, counts only)

`inner_group` has 7 rows; `elkdonis` (the landing config org, `config/site.ts:20`) has 8 relevant ones.

| Row | Size | Reader | Class | Action | Risk |
|---|---|---|---|---|---|
| `inner_group` / `page-edits:home` (1 row; the only `page-edits:*` row in the table) | 124 B, last written 2026-11-08 | `lib/page-edits.ts:14` via `loadPageEdits("home")` at `app/page.tsx:46`; patch CSS at `:376-379`. Writer `savePageEdits` is only called by the dead `page-edits-actions.ts` | legacy-replaced (read-only) | keep the row until the tree editor carries the patches (`EditPageButton` passes `edits` into `openLandingEditor`); then delete the row, `lib/page-edits.ts` and the `patchCss`/`patchFontsHref` block in `page.tsx` | low, but it is the only copy of owner edits; export it first |
| `inner_group` / `puck:showcase`, `puck:try-it`, `puck:whats-on` | 1780 B, 1812 B, 336 B | `/p/[slug]`, `/studio` index | rarely used | ask Justin; delete rows only on his say-so | low |
| `inner_group` / `whiteboard`, `standing_meeting`, `email:identity` | 3947 B, 42 B, 206 B | whiteboard service, hub `getStandingMeeting`, `packages/email/src/identity.ts` | live | keep | n/a |
| `elkdonis` / `initiative`, `featured_artist`, `featured_events` | 483 B, 152 B, 79 B | innergathering no longer renders them (section 2); `apps/elkdonis-arts-collective` still reads and writes them (admin page, `api/featured-events`) | live elsewhere | keep the rows; only drop innergathering's reads | none |
| `elkdonis` / `feed_tab_order` | 53 B | readers only in retired `apps/inner-gathering/src/lib/feed-tabs.ts` | dead row | leave (53 bytes); delete with the retired app if wanted | none |
| `elkdonis` / `about_document`, `fundraising`, `image_spaces`, `email:identity` | | read by `getLandingConfig` | live | keep | n/a |
| Storage folder `EAC_Network/inner-gathering/...` | 4 hits on `/api/media/EAC_Network/inner-gathering/content/covers/*.png` | `api/media/[...path]/route.ts:40` serves it on purpose | live legacy path | keep | n/a |

## 5. Dependencies (`apps/innergathering/package.json`)

Method: literal import search in `src`, `next.config.ts`, `postcss.config.mjs`. Another agent has `package.json` modified right now.

| Package | Evidence | Class | Action | Risk |
|---|---|---|---|---|
| `@dnd-kit/core`, `/sortable`, `/utilities` | 0 imports | dead | remove | low |
| `@tiptap/react`, `starter-kit`, `pm`, `extension-link`, `extension-placeholder`, `extension-underline` | 0 imports | dead | remove | low |
| `@excalidraw/excalidraw` | 0 imports here; `packages/cms-ui/package.json:64` declares its own | dead here | remove | low |
| `date-fns` | 0 imports | dead | remove | none |
| `@hookform/resolvers`, `react-hook-form` | 0 and 1 (`ui/form.tsx`, itself orphan) | dead | remove with `ui/form.tsx` | none |
| `@radix-ui/react-checkbox`, `-label`, `-radio-group`, `-select`, `-separator`, `-slot` | 0 imports; the code imports the umbrella `radix-ui` package (16 files) | duplicate | remove the six scoped packages | low |
| `@elkdonis/types` | only named in `next.config.ts` `transpilePackages`; no import in `src` | dead | remove from `dependencies` | low (let tsc confirm no type-only imports) |
| `@elkdonis/payments`, `@elkdonis/fonts` | in `transpilePackages`, not in `package.json` | stale config | check they resolve; drop if not | low |
| `next-themes`, `nanoid`, `zod`, `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `tw-animate-css` | each imported | live | keep | n/a |

Removal needs a `pnpm-lock.yaml` update and a `pnpm install` in the dev image.

## 6. Leftovers that still name `inner-gathering` (hyphen)

| Item | Evidence | Class | Action | Risk |
|---|---|---|---|---|
| `apps/inner-gathering/` (12 MB, 262 tracked files, own Mantine deps, `(marketing)` and `(app)` routes) | still in the pnpm workspace (`pnpm-workspace.yaml: apps/*`) and `pnpm-lock.yaml:1953`; compose comments say the source is kept "for reference" | legacy-replaced | later: move out of `apps/` so installs and turbo skip it, once anything worth porting (e.g. `workshop-sections-nav`, `reminders.ts`) is confirmed ported | medium: sibling apps cite it in comments only |
| `Dockerfile.prod:13,28,44-80` | builds and runs `apps/inner-gathering/server.js`; no compose service uses it | legacy-replaced | delete or repoint at `apps/innergathering` | low |
| `scripts/status-production.sh:31`, `scripts/migrate-production.sh:23` | `docker compose -f docker-compose.prod.yml ... inner-gathering-prod`; that service was removed 2026-11-16 (`docker-compose.prod.yml:127`) | dead scripts | delete or fix | low |
| `scripts/workspace-graph/build.mjs:35` | lists `inner-gathering` as `retired` | intentional | keep | n/a |
| Comments naming it in innergathering and sibling apps | e.g. `workshop-view.tsx:6`, `lib/legacy.ts:7`, `lib/oidc.ts:9`, `layout.tsx:43`, `page.tsx:31` | history | keep | n/a |
| OIDC issuer allow-list at `api/oidc/authorize/route.ts:63` | accepts the old issuer in existing tokens | intentional | keep until tokens from the old app have expired | high if removed early |

## 7. Ordered clean-up plan

Each batch: `pnpm --filter innergathering check-types`, a rebuild where the batch touches build output, then the page checks named. Hold any file the other agent has modified (`package.json`, `layout.tsx`, `site-header.tsx`, `site-footer.tsx`, CSS, `puck/*`, `studio/*`, `next.config.ts`) until that work lands.

1. **Pure dead code, no behaviour change.** Delete `components/manage/compose-launcher.tsx`, `components/landing/WorkQuestion.tsx`, `lib/page-edits-actions.ts`, `components/ui/{dialog,form,popover,radio-group,separator,sheet,tooltip}.tsx`, and the dead exports in section 2. Check: tsc passes; `/`, `/manage`, `/hub`, `/blog` render. Regenerate the atlas (the `page-edits-save` entry goes).
2. **Duplicate compose page.** Delete `app/manage/compose/page.tsx` and `components/manage/compose-workspace.tsx`; point `questionnaire-actions.ts:32` at `/hub/compose`. Check: tsc; `/hub/compose` opens and creates a draft; `/manage/compose` now 404s (expected).
3. **Landing config reads.** Remove the `initiative`, `featured_artist`, `featured_events` reads and types from `getLandingConfig`. Check: tsc; `/` and `/about` render the same; three fewer `site_config` queries per home render.
4. **Dependencies.** Remove the unused packages in section 5, update the lockfile, rebuild. Check: tsc, a production build, `/` and `/studio` open (Puck still bundles).
5. **Stale build dir and tsconfig scope.** Delete `.next.bak.20260920161658`; optionally exclude `.next*` in `tsconfig.json`. Check: tsc time and output unchanged.
6. **Dead CSS families**, after the colour-variable agent finishes. One family per commit (`cwq-*`, `initiative-*`, `grant-*`, `philosophy-*`, `signup-*`, then `fundraising`/`featured`/`inquiry` leftovers, then `--mantine-*` and `.wq-rte`). Check: before/after screenshots of `/`, `/about`, `/forum`, `/offerings/<slug>`, `/login` at desktop and phone width.
7. **`/api/center/quotes`.** Re-grep `packages/cms-ui/src/center` for a built URL, then delete. Check: `/center` renders, tsc.
8. **Retired-app leftovers** (repo level, separate commit): `Dockerfile.prod`, the two scripts, and whether `apps/inner-gathering` leaves the workspace. Check: `pnpm install --frozen-lockfile` and `pnpm -r check-types` in a worktree.
9. **Needs a decision from Justin:** drop the hub `classic` view (touches shared cms-ui toggle); the three trial Puck pages; when to delete `page-edits:home` and `lib/page-edits.ts` (after the tree editor carries the patches); the cross-app route factory for the pipeline, profile and payout copies.

## 8. Uncertain points

- 11-day log window; the app logs no request lines; scanners were filtered by user agent only.
- Class-usage greps cannot see classes assembled at runtime or arriving from stored Puck documents, so CSS deletions need a visual check.
- The `/hub/chat` link and the four email API routes are reached by built URLs, not literals; callers inferred, not traced.
- `/api/center/quotes` is probably dead, not proven.
- I did not run `tsc`, a build or any browser check.
