# Elktours convergence: sunjay shape, ifac cues, direct-editor readiness (2026-11-02)

Senior Code Officer, read-only. Paths are relative to `~/eac`. Justin's direction: elktours "is going to take on more of what apps/sunjay
became, taking cues from apps/ifac and the direct editor readiness".

**Do not plan over** (Web Engineer is editing these now): `app/tours/[slug]/**`, the tour popup (`components/tours/tour-popup*`, the
`tour` key in `HubSurfaces.tsx`), `app/about/**`.

Already in elktours (spec `ELKTOURS_EXPERIENCES_SPEC_2026-11-02.md`, Phase A + Rounds 1–4):
- migrations 233–236 and 238;
- places, assets, fly-overs, experiences and reviews;
- the hub in Cards 2 (`app/hub/page.tsx` + `hub-cards.css`, on `@elkdonis/cms-ui/hubsite`), and `/center`;
- the payouts card;
- Puck installed (`@elkdonis/page-builder` + `@puckeditor/core@0.23.0`), with `/studio/{tour-detail,experience-detail,experience/[id]}`.

## (a) What apps/sunjay became

Para Theater, one member's site (org `sunjay`, `paratheater.arts-collective.com`). It was rebuilt 2026-11-02 and deployed. The rebuild is
uncommitted: `git status apps/sunjay` shows about 13 modified and 12 untracked paths.

- **Page structure.** The landing page is written in code, not Puck: `src/app/page.tsx` has three full-height snap panels.
  - **Banner + series stage**, using `EventStage`, `seriesStageSlide` and `JoinFrame` from `@elkdonis/series-site`.
  - **Community**: `StandingMeetingFace` (`cms-ui/hub`) and `ForumFace` (`cms-ui/surface`).
  - **Who we are**, with sign-up for visitors.
  - The old Puck `puck:home` row was deleted (copy in `~/eac-backups/site-config/`).
  - Other routes are `/about` + `/about/[slug]`, `/publications`, `/community`, `/series` + `/series/[slug]` (shared pages), `/journal/[piece]`,
    `/[feed]`, `/hub` (plus `hub/series` and `site-view.tsx`), `/center`, `/forum`, `/studio/[slug]`, and `/manage/{builder,pages,content,feeds,people,compose,analytics}`.
- **Site shell.**
  - `lib/series-site.tsx` `SiteShell` wraps pages in `<div className="ifs pts">`.
  - `.ifs` is IFAC's public-site stylesheet, now shared as `@elkdonis/series-site/site.css` (193 `--ifs-*` tokens).
  - `.pts` is sunjay's override: `components/site/pts.css` re-sets the `--ifs-*` tokens.
  - The header and footer are app-local (`components/site-header.tsx`, `site-footer.tsx`, `pts-header__*`). Nav is About · Publications ·
    Community, plus Hub, Manage and Account by role.
- **Editing model**, in three layers:
  1. **Words**: `org_site_sections` (hero, about, footer) through `/manage/pages` ("Site copy").
  2. **Banner**: "Change banner" on the page (`components/site/banner-editor.tsx`, `lib/banner-actions.ts`) writes `site_config`
     `image_spaces.hero = {path, alt, frame}`. The frame is a focal point and zoom, drawn with `coverFrameStyle` from `cms-ui/files`.
  3. **Direct editing (markers only)**: every panel carries `data-edit-section` and `data-edit-name` (in `page.tsx`, `about`,
     `community`, `publications` and `site-footer.tsx`). `@elkdonis/direct-edit` is **not** a sunjay dependency, so no edit mode is mounted yet.
- **Block/Puck usage.** Puck is kept for extra pages and **templates**.
  - `lib/puck/*` holds `catalogue`, `config.{client,server}`, `templates.ts` and `data-{event,service,writing}.ts` (data blocks fetch rows at render).
  - Templates are `event-detail` (one document draws every event detail page, in `app/[feed]/[slug]/page.tsx`), `services` and `journal-piece`.
  - The editors are `/manage/builder` and `/studio/[slug]` (`components/studio/page-editor.tsx`). `[feed]/page.tsx` draws a designed page if one exists.
  - elktours' `puck:tour-detail` / `puck:experience-detail` are the same "one template per kind" idea.
- **How a member's site is built.** It is one org with a fixed `siteConfig.orgId` (`src/config/site.ts`).
  - The person comes from their **network profile**: `guideSlug: "jason-ford"` is read with `getProfileBySlug`, so a bio written on ArtDirect arrives as is.
  - `guideShortName` is stated explicitly, because a short name can't be derived from the display name.
  - Their store is a window onto art-auction (`users.profile_sections.store`). Services and bookings use `lib/booking-actions.ts` and
    `lib/payout-actions.ts` (Stripe per person).
  - Series run on the shared series pages, routes and planner.
  - Template stack: Tailwind for hub and manage, plain CSS (`.ifs.pts`) for public pages.
- **Shared vs app-local.**
  - **Shared:** `@elkdonis/series-site` (**untracked package**, extracted from ifac; used by ifac + sunjay) covers pages, routes, hub
    planner/editor, mail, share and `site.css`. Also cms-ui `hub`, `hubsite`, `surface`, `files`, and `page-builder` + `blocks`.
  - **App-local:** header/footer, `pts.css`, `lib/public-site.ts` (teasers: `latestThread`, `featuredThread`, `currentSeries`), `lib/landing.ts`
    (`getImageSpaces`, `mediaSrc`), the banner editor, the `lib/puck/*` catalogue and templates, and `series-site.tsx` (the `SeriesSite` config object).

## (b) What to take from apps/ifac (beyond Cards 2 and /center)

- **Public-site kit**: `.ifs` styles + `components/site/{chrome,social-row,session-list,art-gallery}.tsx`, now shared through
  `@elkdonis/series-site` (`site.css`, `components/*`). sunjay shows the right way to consume it: a wrapper class plus a token-override sheet. Don't fork it.
- **Series machinery** (`@elkdonis/series-site`), for recurring experiences (a weekly sketching session):
  - `SeriesSite` config (`src/config.ts`): `orgId`, names, audience, `alsoZones`, `hostHref`, `getViewer`, and `chrome` {Shell, Header, Footer};
  - `pages/{SeriesIndexPage,SeriesPage,SeriesWeekPage}`;
  - `routes/*` (rsvp, subscribe, calendar, comment, hub*);
  - `hub/{SeriesPlannerPage,SeriesPageEditorPage}`.
  - The data is `kind='series'` + `series_sessions` (203).
- **Hub views**: `app/hub/views.ts` `HUB_VIEWS = ["cards2","classic","site"]`, remembered per browser (`hub_view` cookie; sunjay does the same).
- **Appearance**: `/manage/appearance` with `lib/theme-tokens.ts` (`CssVarDef[]` for `@elkdonis/live-editor`, stored in `site_themes.vars`) and
  `lib/hub-skin*.ts`. A skin is a named CSS arrangement, not variables. `hub-skin.ts` is data-only on purpose: importing the db into a client bundle 500'd the hub.
- **Person pages**:
  - `app/artists/[slug]` + `components/person-view.tsx`;
  - `profile-editor-panel.tsx`;
  - `lib/profile-sections.ts` (`users.profile_sections`: writing, Elkdonis feed and store are opt-in; galleries opt-out);
  - `/hub/profile`.
  This is the model for guide/artist pages that list a person's experiences and services.
- **Manage sections**: `/manage/sections` (which landing sections show). Also `/manage/{directory,store,submissions,cloud,email}`.
- **Email suite**: `lib/email-suite.ts`, `series-letters*.ts`, `series-mail.ts`, `/hub/email`. This is the per-series letters and mailings layer, for
  departure reminders and newsletters.
- **Share previews**: `lib/series-share.ts` (now `@elkdonis/series-site/share`), `slug-redirect.ts` (old slugs keep working).
- **Galleries and showcase**: `components/{galleries-section,gallery-editor,showcase-grid}.tsx`, the picture grid whose editing is built in
  (resize tiles, crop in place). CANVAS_FRAMEWORK names it the model for "components with editing built in".

## (c) Direct-editor readiness

Sources: `docs/sessions/2026-11-02_direct-editing.md`, `docs/open/CANVAS_FRAMEWORK_2026-11-02.md` "Progress", and `packages/direct-edit`.
`packages/direct-edit` is **untracked and still being edited today**. Exports: `.`, `./richtext`, `./block`, `./visual`, `./layers`, `./puck`,
`./puck/blocks`, `./direct-edit.css`.

**Usable on elktours now** (source exists and type-checks):
- **Markers**: `data-edit-section`, `data-edit-name`, `data-edit-atom`, `data-edit-skip` (`canvas/layers.ts`). They are inert attributes, so adding
  them is safe and immediately useful, as sunjay did.
- **Visual edit mode over code-built pages** (`./visual`, `canvas/visual-editor.ts`): click-through, right panel (layout, spacing, text with the
  font library, appearance, effects), move/resize within a parent, right-click tools, pictures through the `cms-ui/files` `MediaPicker`
  (Private paths refused). Edits are stored as one stylesheet (`block/patch.ts` `cleanPatches`/`patchCss`) that the public page also gets.
  - The host pattern to copy is innergathering's (uncommitted): `src/components/landing/{EditPageButton.tsx,page-editor-mount.ts,
    page-picture-chooser.tsx}`, `src/lib/page-edits.ts` (`site_config` `page-edits:<page>` through `withOrg`), and `src/lib/page-edits-actions.ts`
    (owners and guides). The editor is loaded only when opened.
- **Box tree on Puck documents** (`./puck`: `openPageAsTree`, `TreeCanvas`, `BOX_ROOT`, blocks `box`/`words`/`picture`). The storage stays
  Puck `{root, content}` in `site_config` `puck:<slug>`, and the save runs `cleanBoxDoc`. Hosts opt in per page. The innergathering example route is
  `/studio/<slug>/canvas`.

**Blocked or not ready:**
- **Not verified signed in with a real save, anywhere.** innergathering was not rebuilt (the production deploy was refused), so the visual layer is
  live nowhere. arts-collective's live direct-edit is only classifieds and cards (pass 3).
- elktours runs `next dev` publicly, so whatever is mounted is live at once. It would become the first live run of the visual layer.
- Needs `@elkdonis/direct-edit` (and `@elkdonis/fonts`) in `apps/elktours/package.json`, plus one coordinated `docker compose run --rm install`.
- **Known limits.**
  - Stored edits are keyed by DOM position, so a code change that restructures a section can orphan or move edits. That makes it a poor fit for
    pages being rewritten now (the tour page).
  - It can't edit words or data (those stay with declared fields).
  - No touch support and no right-click on phones.
  - There is no contrast warning.
  - `order`-based moves change what is seen, not the reading order.
- **Box tree:** there is no fields section for sealed blocks, so the tour and experience blocks' own settings still need the Puck editor. Resolver rows in
  the canvas are untested. `{{tokens}}` and the Tweaks tab (not wired to `site_themes`) are open.
- **Out of scope by guardrail:** the platform block/template catalogue and freedom levels (classifieds only). The board and free objects are not built.
- **Puck version:** the plan's Phase 5 upgrades to 0.24. Keep elktours on `0.23.0` until that is done repo-wide.

## (d) Gap list for elktours, in order

Tags: **reuse** (wire up existing code), **small** (≤1 day, app-local), **big** (needs a decision, a shared change, or several days).

1. **Lint config.** **small.** There is no `eslint.config.mjs`, so `pnpm lint` fails at config load. Add a flat config (copy sunjay's, if it has one). Area: `apps/elktours/` root.
2. **Section markers on the landing page and other non-WE pages.** **reuse.** Add `data-edit-section`/`data-edit-name` to `app/page.tsx` sections,
   `site-footer.tsx`, `app/experiences/page.tsx` and `app/tours/page.tsx` (the listing, not `[slug]`). The attributes are inert.
3. **Banner and image spaces.** **reuse.** Port sunjay `components/site/banner-editor.tsx` + `lib/banner-actions.ts` + `lib/landing.ts`
   (`site_config` `image_spaces.hero`, `coverFrameStyle`). Area: `app/page.tsx` hero, new `lib/banner-actions.ts`.
4. **Public shell decision: `.ifs` + an elktours override class (sunjay's way) or keep Tailwind zinc/brass.** **big** if adopted: it restyles
   every public page and adds the `@elkdonis/series-site` dependency. Area: `app/layout.tsx`, `site-header.tsx`, `site-footer.tsx`, new
   `components/site/elk.css`. Wait until the WE finishes the tour page and About.
5. **Landing page rebuilt in code as snap panels.** **small–big**, depending on 4. Featured tour/experience stage, upcoming departures, guides,
   reviews summary. Teaser helpers on the sunjay `lib/public-site.ts` pattern. Area: `app/page.tsx`, new `lib/public-site.ts`.
6. **Direct-edit visual mode on the landing page.** **reuse + install.** innergathering's four files map onto elktours (`components/landing/*`,
   `lib/page-edits{,-actions}.ts`; `site_config` `page-edits:home` through `withOrg`). Blocked on the dependency install and on one signed-in
   verified save (this would be the first). Do it after 5, so stored edits don't orphan.
7. **Hub view toggle.** **reuse.** `HUB_VIEWS` / `hub_view` cookie from ifac `app/hub/views.ts` + `site-view.tsx`. Area: `app/hub/`. Small
   (Cards 2 is in already).
8. **Appearance (theme variables).** **small.** ifac `/manage/appearance` + `lib/theme-tokens.ts` over `@elkdonis/live-editor`
   (`site_themes`). This needs the live-editor dependency. Area: `app/manage/appearance/`, `lib/theme-tokens.ts`.
9. **Builder pages and templates (sunjay `/manage/builder`, `/studio/[slug]`, `[feed]` drawing a designed page).** **small.** Puck is already
   installed. Wire `onSaveDraft` (the spec gap: `/studio/tour-detail` publishes at once to every tour). Area: `app/studio/`, `app/manage/`, new `lib/puck/*`.
10. **Guide/artist person pages with sections** (experiences, services, store, reviews). **small–big.** ifac `person-view.tsx` + `lib/profile-sections.ts`
    + `PageSectionsCard`. Lives under `/about/[slug]`, which the WE owns now, so schedule it after.
11. **Recurring experiences as series** (`@elkdonis/series-site` pages, routes and planner via a `SeriesSite` object, as sunjay's `lib/series-site.tsx`).
    **big.** It overlaps `/manage/schedule` and tour departures, so decide whether recurring experiences are series or departures first.
12. **Services feed.** **small** once decided. `/services` is always empty (no `services` feed). Fold it into Experiences or create the feed.
    Area: `app/services/**`, `org_feeds`.
13. **Share previews and old-slug redirects.** **reuse.** `@elkdonis/series-site/share` pattern, ifac `lib/slug-redirect.ts`. Area: `generateMetadata`
    in listing and experience pages.
14. **Email letters for departures and experiences.** **big.** ifac `lib/email-suite.ts`, `series-letters*`. Elktours has only EmailSurface and reminders.
15. **Box-tree canvas over `puck:experience-detail`.** **reuse, blocked.** `@elkdonis/direct-edit/puck` `openPageAsTree`. Sealed experience blocks have no
    fields panel yet. Do it after 6 is proven. Not on `puck:tour-detail` while the WE is editing the tour page.
16. **Small UI follow-ups from Round 4.** **reuse.** Payout return to `/hub` (`app/api/payouts/return/route.ts`, one line). A Reviews Puck block (so the
    layouts can place it).

## (e) Suggested rounds

- **Round A: groundwork, no visual change.**
  - Items 1, 2, 3, 7, 13, 16.
  - Prepare one coordinated install adding `@elkdonis/direct-edit` + `@elkdonis/fonts` (+ `@elkdonis/live-editor`, + `@elkdonis/series-site` if
    item 4 is yes).
  - Justin decides: item 4 (sunjay `.ifs` look, or keep elktours' zinc/brass), and whether the install can run now (it touches every container's `node_modules`).
- **Round B: the landing page and editing.**
  - Item 5 (landing in code, panels), then item 6 (visual edit mode on it), then one signed-in save verified by Dana or Justin.
  - Then item 9 (drafts for `/studio/*`).
  - Justin decides: who gets Edit on the live page (owners only, or guides too), and the landing's panels and their order.
- **Round C: people and appearance.**
  - Item 10 (guide/artist pages, after the WE's About work lands), item 8 (appearance), item 12 (services).
  - Justin decides: which person sections are on by default; whether artists (non-members) get pages here or link out to ArtDirect only.
- **Round D: recurring and outreach.**
  - Item 11 (series for recurring experiences), item 14 (letters), item 15 (box-tree canvas on experience pages).
  - Justin decides: series vs departures for recurring experiences, and whether artists edit their experience pages in the canvas.

Checks per round: `sudo -n docker exec -w /app/apps/elktours eac-elktours pnpm -s check-types` (0 baseline). Public 200s for `/`, `/tours`,
`/experiences` through `https://elkdonisexperiences.com` (localhost now 308s). `sudo -n docker compose logs --tail 100 elktours`.
