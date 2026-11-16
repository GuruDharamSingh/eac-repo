# The clone-site form (lane siteform, 2026-11-16)

Research and synthesis. Read-only on code; nothing built, committed or migrated. Paths are under `~/eac` on eris, branch `work/2026-11-16`. Claims are marked **verified** (read or counted 2026-11-16), **reported** (stated in a doc, not re-checked), or **guess**.

## Summary

- **What the form is.** One app shape that a new site is a copy or configuration of. katie-the-potter is the closest today: a whole-site Puck page at `[[...path]]`, a Studio index and canvas under `/studio`, a site-style button for theme and header/footer, `/manage` as thin cards, `/channel` from the shared package, SSO and auth as one-line files. About 2,300 of its 16,300 app-local lines are that shell (counted by file list); the rest is the shop, shipping and its blocks.
- **Where each app is ahead.**
  - sunjay: surface pages and pop-ups (`cms-ui/surface`, `HubSurfaces`, `opens-popups`), the canvas editor with inception, the Site Builder hub card.
  - hidden-enneagram: canvas as the page editor (`boxify`), the `/publish` studio-forms door, site-style, record blocks.
  - katie: the cleanest shell, the shared Channel page, the `cms-ui/manage` kit, look presets, route templates (`piece-detail`).
  - danamccool: navigation as data (`/studio/navigation`), a page-level settings panel, the HUD in-place panels. Its theme is its own, not site-style.
- **The diff.** Across the four apps, 2,229 lines in sunjay and 2,243 in hidden-enneagram are byte-identical to another of the four (almost all sunjay and hidden-enneagram sharing); katie has 295 and danamccool 144. The shell shape repeats, but each app has edited it: the same ten or so files exist everywhere and differ by 20 to 120 lines. That is config plus drift, not true site features.
- **The form I propose.** A site is `site.ts` (`defineSite`), a theme (site-style schema), content in `site_config` and the thread tables, and optional features (shop, bookings, forum, hub). Everything else is a package or a kit mount. This is the `org-site` kit in `docs/open/ORG_SITE_KIT_BRIEF_2026-11-06.md` (option B) with katie as the shell reference and the Puck catch-all included from the start.
- **Per-page header and footer** (elktours): a small set of named chrome variants, chosen per page in the Puck page settings, applied with `:has()` on a marker element. elktours already does this for `.elk-m`. Free per-page theming stays out of scope except through the per-page theme layer that already exists in `site_themes`.
- **House editor.** Three tools, three jobs: direct-edit canvas for page layout and words, Puck sheet for sealed blocks and page settings, and a generated field-box sidebar (artdirect's pattern) for record fields. The sidebar is the piece that also becomes the dock's module UI and the MCP tool input form, because it is generated from a declaration.
- **New site.** Copy plus config now, shell orgs for sites with no custom blocks, and no generator until the kit mounts exist. A multi-tenant single app is the later step; the shell already serves 14 orgs but only `puck:home`, not whole sites.

## 1. Survey

All counts are lines under `src`, excluding `components/ui`, generated code, `node_modules` (verified, `wc -l`, 2026-11-16).

| | sunjay | hidden-enneagram | katie-the-potter | danamccool | artdirect |
|---|---:|---:|---:|---:|---:|
| App-local lines | 23,519 | 20,262 | 16,300 | 15,064 | 12,846 |
| of which `app/api` | 2,739 | 1,847 | 525 | 464 | n/a |
| `blocks/` | 3,811 | 2,207 | 3,734 | 3,165 | 0 |
| `components/` | 5,897 | 6,879 | 2,179 | 5,067 | ~4,700 |
| `lib/` | 6,405 | 5,607 | 5,274 | 3,406 | ~3,700 |

artdirect is a product (directory, dossiers, classifieds, booking); it has no Puck catch-all and no site-style. It is included only for its editor pattern.

### 1.1 Route trees (verified, `find`)

- **sunjay.** `/`, `/[feed]`, `/[feed]/[slug]`, `/about(/[slug])`, `/community`, `/forum`, `/journal/[piece]`, `/series/*`, `/publications`, `/channel`, `/center`, `/account`, `/login`, `/hub/{calendar,chat,pipeline,series,site,whiteboard}`, `/manage/*` (builder, compose, content, feeds, pages, people, analytics), `/studio/[slug]` (canvas), `/studio/[slug]/blocks` (Puck), 71 API files.
- **hidden-enneagram.** `/`, `/[page]`, `/[page]/[slug]`, `/about(/[slug])`, `/enneagram`, `/readings`, `/music`, `/services/[slug](/book)`, `/publish`, `/hub/*`, `/manage/*` (content, contacts, music, newsletter, orders, pages, site), `/studio/[slug]` and `/blocks`, `/channel` (redirect to the network Channel), `/center`, 54 API files.
- **katie-the-potter.** `/[[...path]]` (whole-site Puck), `/pieces/[slug]` (route template), `/preview`, `/cart`, `/checkout`, `/orders/[id](/shipping)`, `/manage/*` (pieces, orders, payouts, shipping, site, people, analytics), `/channel` (shared page), `/hub` (cards), `/center`, `/claim/[token]`, `/studio` and `/studio/[...path]`, 19 API files.
- **danamccool.** `/[[...path]]` (whole-site Puck), `/gallery/[gallery]`, `/blog/[slug]`, `/about`, `/credits`, `/vimeo`, `/manifesto`, `/radical-renaissance`, `/manage/{artworks,messages}`, `/studio` (+ `/studio/navigation`, `/studio/theme`, `/studio/[...path]`), `/hub`, 16 API files.
- **artdirect** (live edit only). `/[slug]` (the profile, with the owner's sidebar), `/[slug]/{edit,design,writing,services,featured}`, `/classifieds`, `/bookings`, `/new`.

### 1.2 Surface pages and pop-ups

| App | Surface use | Where |
|---|---|---|
| sunjay | Heaviest. 18 `cms-ui/surface` imports; one provider with connectors and hub-card surfaces; feature cards open records in pop-ups; `channel/site` and `channel/hub` | `src/components/hub/HubSurfaces.tsx` (263), `src/components/surfaces/opens-popups.tsx`, `src/lib/opens.ts`, `src/lib/surface-thread.ts`, `src/components/hub/hub-card-host.tsx` |
| hidden-enneagram | 10 surface imports; the nine types open as surface pop-ups; no Channel (redirect only) | `src/components/hub/HubSurfaces.tsx` (192), `src/components/exposition/type-surface.tsx` |
| katie | No surface provider. Pieces open as a pop-up through its own block (`cardClick: page \| popup`). Channel is the shared page with an "Edit here" quick form | `src/blocks/popup-host.client.tsx`, `src/blocks/piece-popup.tsx`, `src/app/channel/page.tsx` |
| danamccool | None. In-place edit is the HUD (galleries, media, pages panels) | `src/components/hud/*` |
| artdirect | `ManageSpace`: surface provider with the shared compose form in a pop-up | `src/components/oad/ManageSpace.tsx` |

Reported (`docs/open/EDITING_LANDSCAPE_2026-11-12/detail.md`): sunjay's blocks are classed a (surface parts), b (sealed) or c (plain route). A surface recipe was taken from Forum and Next gathering.

### 1.3 House editor and direct-edit

| App | Page editor | Notes (path) |
|---|---|---|
| sunjay | `/studio/<slug>` is the canvas; `/studio/<slug>/blocks` is Puck. Inception (canvas to Puck sheet to canvas) is on | `src/components/studio/CanvasEditor.tsx` (172), `components/studio/page-editor.tsx`, `app/studio/[slug]/{page,blocks/page}.tsx`; home edited in place via `components/landing/page-editor-mount.ts` |
| hidden-enneagram | Same two doors; canvas first. Word blocks are turned into boxes on open (`boxify`) | `src/components/studio/CanvasEditor.tsx` (162), `src/lib/puck/boxify.ts` (294) |
| katie | Puck with the parts plugin and look panel; no canvas door | `src/components/studio/page-editor.tsx` (47), `src/lib/puck/config.client.ts` (156) |
| danamccool | Puck, page settings, plus HUD panels, nav editor, theme studio | `src/components/studio/*` (3,200 lines of fields, `theme-studio.tsx` 647, `gallery-pictures-field.tsx` 709), `src/lib/puck/page-settings.tsx` |
| artdirect | No Puck on profiles by default; a field-box sidebar and a LiveEditor bar; `/[slug]/design` is a Puck designer | `src/components/oad/DossierSidebar.tsx`, `ProfileEditorPanel.tsx`, `src/components/design/*` |

### 1.4 Puck and kits

- All four share `@elkdonis/page-builder` (store, `buildPuckConfig`, `PuckEditor`, parts plugin) and `@elkdonis/direct-edit/puck/morph` (a block's stored look). Pages are `site_config` rows keyed `puck:<path>` (`packages/page-builder/src/store.ts`).
- Per-app catalogue: a curated id list over `SHARED_BLOCKS` plus site blocks (`src/lib/puck/catalogue.ts` in sunjay, hidden-enneagram, katie; danamccool lists its own in `src/blocks/index.ts`).
- Record kit: `@elkdonis/blocks/record` (placement rules, layout choice, looks). Used by sunjay (3 imports), hidden-enneagram (8), katie (5).
- Manage kit: `@elkdonis/cms-ui/manage`. Used by katie (11) and hidden-enneagram (7); not sunjay, not danamccool.
- Route templates: katie `piece-detail`; sunjay `event-detail`, `post-detail`, `journal-piece`; hidden-enneagram service, post and person templates (`src/lib/default-pages.ts`).
- "Code until saved" defaults: `src/lib/default-home.ts` (katie), `src/lib/default-pages.ts` (hidden-enneagram), `src/lib/puck/home-template.ts` (sunjay).

### 1.5 Theming

| App | Mechanism | Path |
|---|---|---|
| sunjay, hidden-enneagram, katie (and elktours) | site-style: a code schema of vars plus chrome parts; values in `site_themes` (`page_key ''`), chrome looks in `site_config 'site-style:chrome'`; one `<style data-site-style>` in the root layout; "Style" button for editors | `packages/direct-edit/src/site/style.ts` (247), `SiteStyleEditor.tsx` (320); per app `lib/site-style.ts`, `lib/site-style-schema.ts`, `lib/site-style-actions.ts`, `components/site-style/SiteStyleButton.tsx` |
| danamccool | Its own palette: roles written to her own CSS vars, stored in `site_config 'theme:palette'` and `'theme:fonts'`; separate `/studio/theme` | `src/lib/theme.ts`, `theme-store.ts`, `components/studio/theme-studio.tsx` |
| artdirect | `@elkdonis/live-editor/theme` (user theme vars) | 6 imports |
| gradients | `packages/gradients` is not imported by any of the four (verified by import count) | n/a |

The atlas already records the split: `site-style-save` (8 hosts, 4 apps) against `site-theme-save` (`areas/orgapps.site-style.ts`). Its drift note for `site-style-save` says katie does not revalidate. **Correction, verified 2026-11-16:** katie's `src/lib/site-style-actions.ts` is byte-identical to hidden-enneagram's (md5 607303ab) and calls `revalidatePath("/", "layout")`. Only sunjay and elktours (md5 f2092db3) lack it.

### 1.6 Header and footer

- sunjay (77/27 lines), hidden-enneagram (134/30), katie (121/24), elktours: each has its own `site-header.tsx` and `site-footer.tsx` with `data-chrome="header|footer"` and `data-part` names that site-style addresses. Nav links are an array in code in sunjay and katie (`NAV_LINKS`).
- danamccool: a fixed left sidebar (157 lines); nav is data (`src/lib/navigation.ts`, `navigation-store.ts`, editor at `/studio/navigation`). No `data-chrome`, so site-style cannot address it.
- artdirect: `components/site/SiteHeader.tsx` (27 lines).
- No app has per-page chrome. The only page-dependent chrome is elktours' `html:has(.elk-m)` rules in `src/components/mobile/mobile.css`, which hide header and footer where a page has a mobile tree.

### 1.7 Where content lives

All database, none in files (verified by reading stores).

- Pages: `site_config` `puck:<path>` (`page-builder/src/store.ts`).
- Theme: `site_themes` (site-style) or `site_config theme:*` (danamccool).
- Chrome looks: `site_config site-style:chrome`.
- Posts, events, meetings: `threads` via `@elkdonis/services` (sunjay, hidden-enneagram).
- Pieces: market store rows through `@elkdonis/commerce` (katie `src/lib/artworks.ts`, `site-store.ts`; danamccool keeps artworks in her `market` store rows, `.claude/rules/apps/danamccool.md`).
- Nav: code (sunjay, katie), DB (danamccool).
- Org identity, roles: `organizations`, `user_organizations` (every app's `lib/auth.ts`).

### 1.8 App-local against package

- Shared packages carry the weight: `@elkdonis/services` (79 imports in sunjay), `blocks`, `cms-ui/*`, `direct-edit/*`, `page-builder`, `studio-forms`, `channel/site`, `commerce`, `checkout`.
- Package sizes (lines in `src`, verified): `cms-ui` 39,121; `direct-edit` 10,291; `blocks` 10,491; `page-builder` 6,175; `series-site` 5,464; `channel` 4,890; `gradients` 2,164; `site-forms` 662; `studio-ui` 343.
- What stays app-local in the shell is the wiring: org binding, catalogue, header, footer, schema, `layout.tsx`, and the actions that re-gate and revalidate.

### 1.9 What each does best (and where "more advanced" shows)

- **katie-the-potter**
  - Shell hygiene. `src/lib/site-org.ts` is the single seam for org resolution (`currentOrgId()`), with the host-based future written in the comment. `src/lib/puck/store.ts` binds the shared store to the org in four lines.
  - Whole-site Puck catch-all with route templates and a code default home (`src/app/[[...path]]/page.tsx`, `src/lib/default-home.ts`).
  - Shared Channel page with an "Edit here" slot (`src/app/channel/page.tsx`).
  - `/manage` is `cms-ui/manage` pages, short (30 to 250 lines each).
  - Look presets as a site choice in site-style (`SITE_LOOK_VAR`).
- **hidden-enneagram**
  - Canvas as the editor and boxify (`src/lib/puck/boxify.ts`). Publish studio door (`src/components/publish/*`). Record blocks. Site-style plus a look watcher (`components/site-style/look-watcher.tsx`).
  - Verticals done as blocks plus routes (ÆON figure, sound, reading, course); these are site features, not shell.
- **sunjay**
  - Surface pages and pop-ups, hub cards (Site Builder card host), inception on the editor, event, post and journal templates. Most connected to the registry and packages (series-site, channel, hub).
  - Heavy local code: `lib/cms/actions.ts` (557), `lib/data.ts` (757), `app/globals.css` (695). These are drift candidates, not features.
- **danamccool**
  - Origin of the catch-all pattern; navigation as data; page-level settings (`src/lib/puck/page-settings.tsx`, body and heading font per page); HUD panels for in-place edit.
  - Its own theme path and no `data-chrome` mean it cannot adopt site-style unchanged.

## 2. Diff

Method: md5 of each file under `src` across the five apps (verified, script run on eris 2026-11-16), plus `diff | grep -c '^[<>]'` for pairs.

### 2.1 Byte-identical across apps (the template's fixed core)

| File | Apps |
|---|---|
| `app/api/auth/handoff/route.ts` | sunjay, hidden-enneagram, katie, artdirect |
| `app/api/auth/logout/route.ts`, `session/route.ts` | sunjay, katie, danamccool |
| `app/api/blocks/thread-feed/route.ts` | hidden-enneagram, katie, danamccool |
| `app/api/media/[...path]/route.ts` | katie, danamccool |
| `app/global-error.tsx` | sunjay, hidden-enneagram; katie, danamccool, artdirect (second family) |
| `app/center/page.tsx` | sunjay, hidden-enneagram |
| `app/manage/analytics/page.tsx` | sunjay, hidden-enneagram |
| `lib/auth.ts` | sunjay, hidden-enneagram (katie 114 lines differ, danamccool 97) |
| `lib/site-org.ts` | hidden-enneagram, katie, danamccool |
| `lib/site-style.ts`, `lib/site-style-actions.ts`, `components/site-style/SiteStyleButton.tsx` | hidden-enneagram, katie (sunjay 8, 26 lines differ; actions md5 f2092db3 as elktours) |
| `proxy.ts` | sunjay, katie, artdirect |
| `components/hub/CalendarGrid.tsx`, `CalendarPageView.tsx`, `lib/pipeline.ts`, `lib/utils.ts` | sunjay, hidden-enneagram |

These move to packages (lane `onelogic`). Nothing here argues against that.

### 2.2 Same file, config-sized differences

Lines differing between katie and the other app (verified, `diff`):

| File | vs hidden-enneagram | vs sunjay | vs danamccool |
|---|---:|---:|---:|
| `lib/puck/store.ts` | 60 | 40 | 27 |
| `lib/puck/actions.ts` | 21 | 83 | 35 |
| `lib/puck/config.server.ts` | 121 | 117 | 167 |
| `components/studio/page-editor.tsx` | 75 | 64 | 125 |
| `lib/site-style-schema.ts` | 81 | 75 | n/a |
| `components/site-footer.tsx` | 32 | 31 | 30 |
| `app/login/page.tsx` | 40 | 29 | 21 |
| `config/site.ts` | per-site | per-site | per-site |

Reading the diffs (katie's `store.ts`, `actions.ts`, `page-editor.tsx`, `catalogue.ts`): the differences are the org id, the template slugs, the resolved-keys list, block ids, and local names. The logic is the same. These are where a `defineSite` object plus a few hooks would replace copies. Guess: 80% of those diff lines disappear with `site.ts` as input.

### 2.3 Site-specific

- katie: shop (`lib/shop*.ts`, `shop-actions.ts`, `components/add-to-cart.tsx`), checkout, orders, shipping (`lib/shipping/*` 2,300 lines), payouts, claim link, piece blocks (`blocks/*` 3,700).
- hidden-enneagram: ÆON (`components/aeon/*` 1,800), sound (`lib/sound/*`), reading, music web, course, exposition, booking, newsletter.
- sunjay: series/event stage, Para Theater hub surfaces, the offering card, booking blocks.
- danamccool: gallery and HUD, her sidebar, art blocks (`blocks/*` 3,165), vimeo, radical-renaissance.

## 3. The form

### 3.1 What a site reduces to

```
apps/<site>/src/
  site.ts                  defineSite({ orgId, names, timeZone, features, nav, footer })   ~50 lines
  site-style.ts            the schema: vars, fonts, chrome parts, chrome variants         ~80 lines
  blocks/                  site blocks only (optional)
  app/layout.tsx           <SiteShell site> (header, footer, style, fonts, beacon)        ~25 lines
  app/[[...path]]/page.tsx kit: Puck page by path, code default home
  app/studio/**            kit: pages index, canvas, blocks
  app/api/[...kit]/        kit: auth, media, pulse, blocks/thread-feed
  app/<domain>/            real files for the site's own pages (shop, readings, tours)
```

- **Config** (`site.ts`): org id, names, tagline, time zone, feature flags, nav, footer links. Today these are `config/site.ts` (37 to 53 lines) plus `NAV_LINKS` in the header. nav moves into `site.ts`; danamccool's nav-as-data is the stronger shape, so nav is stored (`site_config`) with `site.ts` supplying the default.
- **Theme**: the schema in code, values in `site_themes`. danamccool migrates its palette into site-style vars (the atlas drift note already says so).
- **Content**: pages (`puck:*`), threads, pieces. Nothing to change.
- **Optional features**: shop, bookings, forum, hub surfaces, Channel, newsletter. Each is a package plus a feature flag; the kit mounts only enabled ones.

This is `defineSite` and option B in `docs/open/ORG_SITE_KIT_BRIEF_2026-11-06.md` §2.1. Two additions to that brief:

1. The kit includes the Puck catch-all, the Studio routes, the site-style trio and the root shell. The brief put Puck "later" and kept katie out. katie is the best reference for these files, so it is the first extraction source, not the last.
2. `SiteShell` replaces each app's `layout.tsx` body. The `layout.tsx` files of katie (59 lines) and elktours both do the same: load viewer, load site style, emit `<style data-site-style>` and the fonts link, draw header, main, footer, the editor button, the beacon.

### 3.2 Shared packages it consumes

Already shared: `page-builder`, `direct-edit/{site,puck,block}`, `blocks`, `cms-ui/{manage,surface,hubsite,files,editor}`, `services`, `auth-server`, `studio-forms`, `channel/site`, `analytics`, `commerce` and `checkout` for shop sites.

New or extended (guess at names, for the lead to rename):
- `org-site` (planned): `defineSite`, `SiteShell`, page and studio routes, auth and media route handlers, site-style actions, `kit` table.
- `hub` (`packages/hub`, planned in `docs/open/hub-cards-handoff/PLAN.md`): the Site Builder and Members cards that replace per-app `/manage/site` and `/manage/people`.

### 3.3 Per-page header and footer theming (elktours)

**Options.**

A. **Named chrome variants, chosen per page.** The site schema declares, say, `default`, `overlay` (transparent over a hero, solid after scroll), `minimal` (brand only), `dark`, `hidden`. A page picks one in its Puck root props ("Page settings", next to the title). Each variant is a CSS block keyed on a marker the page draws, `<div data-page-chrome="overlay">`, and applied with `body:has([data-page-chrome="overlay"]) [data-chrome="header"] { ... }`.
B. **Free per-page theming.** Any colour, font, position or visibility per page for each chrome part.

**Weights.**

- A needs no layout change: the layout cannot read the child page's data, but `:has()` can, and elktours already relies on it (`html:has(.elk-m)`, `components/mobile/mobile.css:17`). It works in Puck's canvas, which mirrors host styles, so the editor shows the variant.
- A keeps the vocabulary closed. site-style's chrome part schema bans position, size and transform on purpose (`packages/direct-edit/src/site/style.ts:95`: "the header must stay where the site put it"). Overlay, sticky and hidden are position changes, so they must come from the variant list, not from free values.
- B needs a per-page style store and an editor for it. The store half exists: `site_themes` is keyed `(org_id, page_key)` and `resolveTheme({ pageKey })` layers a page over the site (`packages/services/src/themes.ts:86-100`). The chrome half (`site-style:chrome`) is one row per org. B would also need position vocabulary and a contrast check per page.
- danamccool's `page-settings.tsx` shows the page-level pattern already works for fonts (a wrapper div with its own variables).

**Pick: A, with colour tokens.** Variants are named in `site-style.ts` (the site declares which exist), selected per page in page settings, and each variant exposes the existing chrome tokens so a page may also take a `page_key` theme layer for colour only (the `site_themes` path, no new store). This covers "elktours might have a different header on tour pages" without a free-form header editor. **Unknown:** how many distinct headers elktours needs. If more than five or six variants appear, the design should be reviewed (guess).

Footer takes the same variant mechanism (`default`, `minimal`, `hidden`), chosen in the same setting.

**Smallest first step** (one session): add `chrome` and `footer` select props to the root of Puck pages in katie (`PageSettings` as in `danamccool/src/lib/puck/page-settings.tsx`), a marker element in the page renderer, two variants in CSS, and prove it on `/preview`. Then lift to the kit.

### 3.4 The house editor's shape

Three surfaces, each for what it does well:

| Tool | Use for | Not for |
|---|---|---|
| **direct-edit canvas** (`/studio/<slug>`) | Page layout, words and pictures in place; look of parts; moving blocks. Sunjay and hidden-enneagram open it first | Choosing data sources and options on sealed blocks (use Settings…, which opens the Puck sheet) |
| **Puck sheet** (`/studio/<slug>/blocks`, and the one-block sheet) | Sealed block settings, page settings (title, chrome variant), whole-page structure | Fine layout of words |
| **Field-box sidebar** (artdirect `DossierSidebar`) | The fields of a record or of the site's identity: name, tagline, links, sections on or off, layout choice, nav | Free layout |

artdirect's sidebar (verified, `src/components/oad/DossierSidebar.tsx`):
- opens beside the page from a tab; the page moves over (`data-dos-side` on `<body>`);
- every control is generated from a declaration, `dossierFieldGroups` in `packages/cms-bindings/src/dossier/field-registry.ts` (groups with `title`, `blurb`, `fields[{ trait, label, input, hint, col }]`, `sectionKey`, `managedElsewhere`);
- fields save on blur through one action, `saveDossierFieldAction`, and the page reloads when the structure changes;
- a section authored elsewhere gets an explanation and a link, not a control.

Where it fits the site form: the sidebar is the editor for **site-level and record-level fields**, which today are scattered across `/manage/site`, `/manage/people`, `/studio/navigation`, `/studio/theme`, the site-style dialog and header link arrays. One declaration of site fields (name, tagline, nav, footer links, chrome variants, features on or off) renders as the sidebar on any page of the site, for editors only. Page layout stays with the canvas and Puck.

Open design note: four field vocabularies exist today (`DossierFieldMeta`, `SiteVar` in `direct-edit/site/style.ts`, `PropDef` in `blocks`, `ContentFieldSpec` in `cms-ui/compose`). A fifth should not be added. The sidebar renderer should read one of them (guess: `ContentFieldSpec`, since `studio-forms` already reads it, `packages/studio-forms/src/forms/contract.ts:1-12`) with the others adapted.

### 3.5 Creating a new site

| Route | Pros | Cons |
|---|---|---|
| **Generator** (script that writes `apps/<site>` from a template) | Fast; each site is independent; custom blocks are easy | Every generated app is a copy that drifts (the 82 byte-identical files across amrit, sunjay and elktours came from this); N containers at 5g each; N builds per shared change (`NETWORK_SERVING_ARCHITECTURE_2026-11-08.md` §3); the generator itself needs upkeep |
| **One multi-tenant app** (the shell, `apps/arts-collective` `/sites/[slug]`) | No new container; a shared fix is live once; sites become rows (`org_domains`, `org_capabilities`) | The shell serves only `puck:home`, a fixed three-tab `SiteNav`, no site-style, no custom blocks (verified: `app/sites/[slug]/page.tsx`, `components/sites/SiteNav.tsx`); custom code per org does not fit; one failure takes all sites |
| **Copy plus config** (copy a starter app, edit `site.ts`) | Simple, no new machinery; same as how katie was made ("copied shell from sunjay, Puck plumbing from danamccool") | Drift again unless the shell is in the kit first |

**Recommendation.** Two tiers, no generator:

1. **Sites with no code of their own** (most orgs): shell orgs. Close the shell's gap in three steps: whole-site pages at `puck:<path>`, site-style and chrome variants per org, nav as data. These are the same kit files, mounted host-resolved (`loadSiteContext`), which is the rule in `NETWORK_SERVING_ARCHITECTURE` §5 ("site can come from either `defineSite` or `loadSiteContext`").
2. **Sites with their own blocks, shop or domain pages** (katie, danamccool, hidden-enneagram, elktours, sunjay): app per site from a copy of a starter, with the shell in the kit. The starter is katie stripped of the shop, kept as a checked-in checklist (`site.ts`, compose service, `org_domains`, migration for org and owner, SSO redirect, Turnstile). Write the generator only after the kit mounts exist, when the copy is about twelve files and a script is cheaper than a checklist (guess).

## 4. The MCP angle

### 4.1 One host per capability

The atlas models a capability with a list of hosts; drift is when hosts differ (`packages/actions/atlas/types.ts`, `README.md`). Site capabilities today (verified in `reports/drift.md`):

- `page-save` ("Publish a page from the visual editor"): 11 hosts in 7 apps (art-auction, danamccool, elktours, hidden-enneagram, innergathering, katie, sunjay). The curator already wrote the target: one kit action that gates, `cleanBoxDoc`, strips resolved keys, checks reserved slugs, calls `savePage`, revalidates by a per-app route map (`drift.md:273`).
- `site-style-save`: 8 hosts in 4 apps. `site-theme-save`, `landing-save`, `landing-restore`, `page-edits-save` are the same family (`areas/orgapps.site-style.ts`, `areas/orgapps.editing.ts`).

The clone form turns "7 copies of `savePageAction`" into "the kit's `savePage` host, mounted by 7 sites". Each capability then has:
- one host in `packages/org-site` (hook points: reserved slugs, resolved keys, revalidation map, all taken from `site`),
- one registry entry (`packages/actions`, `atlas/entries.ts`),
- one dock or MCP tool.

The MCP tool does not need to know which site: `site` comes from the org id the tool is called with, resolved through `org_domains` (host to org) and `org_capabilities` (feature flags). `ActionRegistryEntry.params` and `agent: 'read' | 'draft'` (`packages/actions/src/types.ts:99-130`) already carry the shape; `risk`, `roles` and `confirm` come from the atlas row.

The three that matter first: `page-save` (draft only for agents: write drafts, publish stays human), `site-style-save`, and a new `site-chrome-set` (per-page variant) once variants exist.

### 4.2 Dock module UI and the sidebar

`DOCK_RAILS_PLAN.md` §5b: the dock renders a module UI (`dockForm`) from the entry's input schema before routing to a page (`address`).

The sidebar in 3.4 is generated from a field declaration, as a `dockForm` is generated from an input schema. If both read one field spec:

- `SiteFieldGroup[]` renders as the on-page sidebar (house editor),
- the same groups render in the dock as a module (a form, with `status.values` prefilling, `packages/actions/src/types.ts:140`),
- a field group's save is one entry, so the MCP tool input schema is derived from it (JSON schema from `input`, `hint`, `list`).

Components to share (all exist): `studio-forms/src/forms/fields/*` (`Field`, `Input`, `Chips`, `Switch`, `MediaField`, `Seg`), already the "one set of forms" direction (`HANDOVER_TEAM_2026-11-14.md` §1). The sidebar and dock module both mount `FormShell` from `studio-forms` with a `FormHost`; the artdirect panel is a third host ("sidebar") beside Studio focus, site pop-up and the Channel quick sheet. This matches the missing pieces listed there (a surface wrapping FormShell, shared server actions with org checks, per-site `viewHref`).

Guess: the sidebar's `managedElsewhere` rows map directly to `address` on an entry ("where the real control lives").

## 5. Adoption and order

### 5.1 Who adopts

| App | Adopts? | Why |
|---|---|---|
| katie-the-potter | Yes, first (source of the shell) | Cleanest shell; smallest |
| hidden-enneagram | Yes | Same shell, identical files with katie and sunjay; verticals stay local |
| sunjay | Yes, later | Most local drift (`lib/cms/actions.ts` 557 lines); leads the hub direction; moves second per the kit brief |
| danamccool | Yes, after site-style adoption | Needs `data-chrome` on its sidebar and its palette migrated into site-style vars; keeps navigation-as-data and the HUD |
| elktours | Partly | The shell (layout, style, auth, Puck) yes; tours, places and experiences stay as a vertical (`NETWORK_SERVING` §2: "custom on the kit"); first user of chrome variants |
| artdirect | No for the shell; yes for the sidebar pattern | A product; it is the directory source (lane `families`) |
| amrit-canada | No | Left behind per Justin; do not extend it |
| art-auction | No | Separate product |
| innergathering, ifac, fourthway, forum, elastrocal | Out of scope | Products or IdP |

### 5.2 Order of moves (each one session)

1. **Chrome variants on katie.** Page-settings props plus marker and two variants, proven on `/preview`. No package change. Gives elktours its answer early.
2. **Declare the site field spec.** One `site.ts` shape and one sidebar group list for katie (name, tagline, nav, footer links, chrome variants). No new editor yet; read-only against the existing pages. Settles the vocabulary question in 3.4.
3. **Extract katie's `SiteShell`** (layout body, header and footer frames, site-style trio, `site-org`, `store`) into `org-site`. katie consumes it; hidden-enneagram's byte-identical files (`site-style*`, `site-org`) are removed in the same pass. Coordinate with `onelogic`, which is lifting byte-identical copies: this move reuses their output.
4. **Extract the Puck catch-all and Studio routes** (katie `[[...path]]`, `/studio`, `/studio/[...path]`, `savePageAction` with hooks). Registry entry `page-save` gets its one host.
5. **Sidebar from the declaration** on katie (house editor sidebar), using `studio-forms` fields. First mount of the "sidebar" form host.
6. **Dock module for one entry** (`site-style-save` or the site identity group): same groups render in the dock. Proves 4.2 with one capability.
7. **Adopt in hidden-enneagram**, then **sunjay** (each one rebuild, `kit-coverage` check from the brief).
8. **danamccool**: add `data-chrome`, migrate palette to site-style, keep nav.
9. **elktours**: shell on the kit; chrome variants for tour pages.
10. **Shell orgs**: whole-site pages and site-style per org on `apps/arts-collective` (host-resolved). Revisit generator vs copy.

Rebuilds, migrations and prod actions in these steps need Justin's go as before.

## For Justin to look at

1. **artdirect's owner sidebar and "Manage your space" pop-up.** Open `artdirect.arts-collective.com/<your profile slug>` signed in as the profile owner. The tab labelled "Your file" opens the sidebar (`src/components/oad/DossierSidebar.tsx`); the "Manage your space" button opens the offerings list pop-up (`ManageSpace.tsx`). You said you like the live-edit pattern and the sidebar layout. Which parts of it should the house editor keep: the boxes grouped by section, the blur-save, the section on/off switches, the layout picker?
2. **The three studio doors on katie.** `pottery.arts-collective.com/studio` (index) then `/studio/home`: Puck with the look panel. Compare with sunjay `/studio/<slug>` (canvas first). Decide if katie should get the canvas door (it has none).
3. **Chrome variants for elktours.** List the headers and footers you want on elktours pages (for example: normal, over-a-hero, tour page, minimal). That list sets the variant names.
4. **danamccool's sidebar nav and HUD.** `danamccool` `/studio/navigation` and the HUD panels (`src/components/hud/*`): which of these do you want in the shared editor?

## Open questions and guesses

- Whether the shell can serve arbitrary `puck:<path>` pages is **unverified**; `app/sites/[slug]/page.tsx` draws only `puck:home`, and `[contentSlug]/page.tsx` has no Puck reference.
- Whether `:has()` is acceptable for every browser the sites target is **unverified**; elktours already relies on it.
- Number of variants elktours needs: **unknown**.
- "80% of store, actions, page-editor diff lines disappear with `site.ts`" is a **guess** from reading four files.
- Which field vocabulary the sidebar reads is a **guess** (`ContentFieldSpec`).
- The drift note for `site-style-save` (katie lacks revalidate) is wrong for katie; the atlas row and `JOURNAL.md` line 33 (9) need a dated correction (not edited here: read-only).
- The `.claude/rules/apps/` folder has no katie-the-potter or hidden-enneagram rules file. Not checked whether one is wanted.

## Overlap with other lanes

- `onelogic`: the byte-identical list in 2.1 is theirs to lift. Step 3 reuses it; nothing here changes a file they own.
- `families`: artdirect as directory source and the studio tiers. This doc touches artdirect only for the sidebar pattern. The shared field spec (3.4) may also serve their forms; flagging for them.

## Sources

`apps/{sunjay,hidden-enneagram,katie-the-potter,danamccool,artdirect,elktours}/src`; `packages/direct-edit/src/site/*`; `packages/services/src/themes.ts`; `packages/cms-bindings/src/dossier/field-registry.ts`; `packages/actions/atlas/{README.md,types.ts,JOURNAL.md,reports/drift.md,areas/orgapps.site-style.ts,areas/orgapps.editing.ts}`; `packages/actions/src/types.ts`; `docs/open/ORG_SITE_KIT_BRIEF_2026-11-06.md`; `docs/open/NETWORK_SERVING_ARCHITECTURE_2026-11-08.md`; `docs/open/EDITING_LANDSCAPE_2026-11-12/{detail,strokes,ROUND1,HANDOVER_TEAM_2026-11-14}.md`; `docs/sessions/{2026-11-02_direct-editing,2026-11-07_katie-the-potter,2026-11-14_studio-create-summary}.md`; `docs/open/hub-cards-handoff/PLAN.md`; `docs/open/mcp-foundations/{DOCK_RAILS_PLAN,RECOMMENDATIONS_2026-11-16}.md`. Not read in full: `publishing-forms-handoff/PLAN.md`, `2026-11-07_discussion-block-contract.md` (existence verified only).
