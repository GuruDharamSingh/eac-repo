# Moving Dana's Puck additions into shared code (plan, 2026-11-19)

**Status: a plan only. No code has been changed.**

Sources:
- two read-only deep dives (Dana's side; the shared code plus the house editor);
- an earlier pass over Dana's site on the same day.

**Order Justin set:** move Dana's Puck additions into shared code first; add the house editor (direct-edit canvas) to danamccool after that.

## 0. Ground rules

1. **Dana's stored data is not touched.** Each move changes code only. Shared code must read her current formats as they are:
   - the `textStyle` prop;
   - the `nav:main`, `theme:palette` and `theme:fonts` rows;
   - the `GridItem` fields (`fx`, `fy`, `zoom`, `saved`, `opens`, `link`).

   Readers come before any migration. Converting her data is a separate decision, made per format.
2. **Backups before any write or rebuild.** Taken so far:
   - eris `~/eac-backups/danamccool/site_config-20261119-2126.json` (31 rows);
   - eris `~/eac-backups/danamccool/user_galleries-20261119-2142.json` (23 galleries; the art-archive layout is in gallery `cjXGONvV7s2Byt0YzjDiS`).
3. **Never run `apps/danamccool/scripts/to-puck.mts`.** It overwrites `puck:<slug>` rows wholesale.
4. **Danamccool is the first consumer of each shared piece.** Each step replaces her local file with the shared one, with the same behaviour, checked against copies of her real rows. Katie and sunjay adopt afterwards.
5. **Rebuilds need Justin's yes, given directly to the session that builds.** They run when Dana is not editing (production build; anonymous `.next` volume).
6. **Collision check:** `page-builder`, `direct-edit` and `blocks` have no uncommitted changes. In `cms-ui` and `services` the uncommitted work is the forum/RSVP surface, which this plan does not touch. The one shared file is `services/src/index.ts`, if new exports go there.

## 1. The core idea: one "site sources" object used by both editors

Dana's additions are mostly **sources**: her pages, media, galleries, artworks and menu, each with a picker or a panel on top. Both editors need the same sources:
- the Puck side, through custom fields (the `binds` mapper in `page-builder/config.tsx:305-321`) and left-rail tabs;
- the canvas, through `choosePicture`, `records` ("From what?"), a page switcher and the Settings sheet.

So each app builds **one** sources object from shared factories, and both editors read it:

```
siteSources({ orgId, canEdit, owner }) -> {
  pages:     list / create / href       (services listSitePages)
  media:     upload + libraries          (services mediaUploadRoute + cms-ui MediaPicker)
  galleries: list / items / save         (services createGalleryActions)
  records:   binds kinds -> sources      (artwork, gallery, opens-gallery, gallery-pictures, page-link, record)
  menu:      load / save / candidates    (services nav store, key nav:main)
}
  Puck:   pagesPlugin, mediaPlugin, galleriesPlugin, menuPlugin (left rail) + binds fields
  Canvas: choosePicture, records, page switcher, editSettings -> Puck sheet (same plugins)
```

Server actions cannot live in a package, because they are bound to each app's auth gate. Each app keeps a thin `"use server"` file that calls the shared factories. The plugins take those actions as props, the same way `partsPlugin` does today.

## 2. Overlap table

| # | Capability | Dana (app-local) | Shared today | House editor | Canonical pick | Cost |
|---|---|---|---|---|---|---|
| 1 | Pages tab | `hud/pages-panel` (111) + `hud-actions.listPagesForHud` | `page-builder` `listPages(orgId)` (no UI); hub `site-builder/PagesTab`; sunjay `/manage/builder` (duplicate) | no switcher (`onDone` / `pageName` only) | `services.listSitePages(orgId)`, with an optional gallery join, used by a `pagesPlugin` **and** the canvas switcher | S-M |
| 2 | Galleries tab | `hud/galleries-panel` (669) + `lib/gallery-actions` (625), single owner, `SITE='danamccool'` | `services/galleries.ts` full CRUD; `cms-ui/gallery` | — | `services.createGalleryActions({site, scope, canEdit, revalidate})` + `galleriesPlugin` | L |
| 3 | Media tab and picker | `hud/media-panel` (227) usage catalogue; 4 `/api/media/*` routes | `cms-ui/files` MediaPicker / MediaBrowser; `page-builder` ImageField; `services.mediaRoutes()` (4 apps); the picture-chooser wrapper is copied in 3 apps | `PictureChooser` callback | `services.mediaUploadRoute({...})` beside `mediaRoutes`; one `makeChoosePicture()` in cms-ui, used by ImageField and the canvas; the usage catalogue becomes pluggable "usage providers" | M |
| 4 | Menu tab | `editor-tabs.MenuTab` + `nav-editor` + `navigation-store` (`nav:main`) | **none**; other sites have a nav array in code (`NAV_LINKS`) | none; the site-form plan wants nav as a sidebar field | Dana's model becomes the shared one: `services` nav store keyed `(orgId, nav:main)`, + `menuPlugin` + a canvas sidebar field. Other sites' `NAV_LINKS` become the default | S-M |
| 5 | Theme tab | `editor-tabs.ThemeTab` + `theme-studio` (647) + `theme:palette` / `theme:fonts` | — | `direct-edit/site` Site style (`site_themes` + `site-style:chrome`), in 4 apps | **Site style** (the site-form plan says danamccool is "site-style first"). Her tab stays local until mapped | L, last |
| 6 | Text style per block | `text-style.tsx` + `text-style-field` (`textStyle` prop, `--dm-font-*`, `.dm-ts` with `!important`) | `page-builder/style` `blkStyle` (spacing, colour, border; **no typography**); `@elkdonis/fonts` roles (built from Dana's pattern) | `morph` / `PartStyle` with library fonts | **Decision needed**, see §4 | M |
| 7 | Fonts per page | `page-settings.tsx` (root fontBody / fontHeading) | `@elkdonis/fonts`; per-page layer in `site_themes` | — | Fonts from `@elkdonis/fonts`; keep her root props through a reader; long-term, the per-page `site_themes` layer | S |
| 8 | Pickers as fields | artwork (208), gallery (45), record (76), tile-fields (100); katie has a **copy** of artwork-picker | `binds` declared on shared blocks (gallery-grid: `gallery`, `gallery-pictures`; `opens`, `record`) | `canvas/records.ts` `RecordSources` | Shared field controls in page-builder that take sources; the same sources register as canvas `records` | S |
| 9 | Grid arranging | `gallery-grid.client` (402) autosave + "Save as my layout"; `tile-arrange-field` (144) + `collection-nav-layout` (109, pure); `gallery-pictures-field` (709) | `blocks` gallery-grid + server (shared, has binds) | `canvas/arrange.ts`, `resize.ts` (box arranging) | The shared gallery-grid block takes a save action by injection. Widen `GalleryItem` to Dana's `GridItem` superset, never trim it | M-L |
| 10 | Editor's hub | `/hub` + `hud/hub-view` + `hud.css` (351, `dm-` classes); the live site has "Edit this page" + "Hub" links only | hub Site Builder card; `cms-ui/surface` | `panel/panel.ts` | The same plugins mount in the Site Builder card; neutral tokens (`--blk-*`) | S |

Where two stored formats exist for one idea:
- **Theme:** `theme:palette` (Dana) against `site_themes` (Site style).
- **Text style:** `textStyle` (Dana) against `morph` (direct-edit).
- **Fonts:** Dana's `lib/fonts.ts` and katie's `lib/fonts.ts` against `@elkdonis/fonts`.
- **Page lists:** three UIs over one store.

## 3. Phases (cheapest and safest first)

**Phase 0: safety (small, done first, helps every site)**
- **Stale-save guard in the shared `savePage`.** Add an optional `expectedUpdatedAt`; on a mismatch the save is refused with a "reload" message. Callers that don't pass it behave as today, so the change is backwards-compatible. Both editors pass it.
- **Daily backup cron on eris** for her `site_config` + `user_galleries` rows, keeping 14 days. Read-only. Needs Justin's yes.

**Phase 1: sources, pickers and media (S/M)**
- Lift the artwork / gallery / record / page-link / tile-key pickers into `page-builder/fields`, taking their sources as props. Remove katie's copy.
- `makeChoosePicture()` in cms-ui, replacing the 3 wrapper copies.
- `mediaUploadRoute()` in services. Danamccool and katie upload routes become 3-line binds. Keep Dana's rule that uploads go to the owner's folder as an option (`target: "owner" | "org"`).
- Register the same sources as canvas `records` kinds.

**Phase 2: Pages + Menu (S/M)**
- `services.listSitePages`, `pagesPlugin`, and a canvas page switcher (new, small).
- The shared nav store + `menuPlugin`. Her `nav:main` row is read as it is. `DEFAULT_NAV` is passed in per site.

**Phase 3: Text style + fonts (M; decision in §4 first)**
- Typography fields added to `page-builder/style`, using `@elkdonis/fonts` and role vars with neutral names.
- A reader keeps the `textStyle` prop she has already saved rendering exactly as now.
- Her `lib/fonts.ts` ids are mapped to library families. The mapping table is checked against every font she uses today, found by a query on the backup.

**Phase 4: Galleries + Media panels, grid arranging (L)**
- `createGalleryActions` with `scope: { kind: "owner" | "org" }`, replacing the single-owner `getSiteOwnerUserId` assumption. The 625 lines of her actions are reconciled with `services/galleries.ts`.
- The usage catalogue gets pluggable providers (artworks, galleries, pages).
- The shared gallery-grid block takes the save action by injection.
- `GalleryItem` is widened to her superset.
- Tests: load each of her 23 galleries from the backup through the shared loader and diff against the current loader. Any difference blocks the switch.

**Phase 5: Theme (L, last; decision in §4)**
- Map `theme:palette` roles (`--violet`, `--ink`, `--cyan`, `--orange`, `--dm-*`) to a `SiteStyleSchema` for danamccool.
- Add `data-chrome` parts to her sidebar.
- Her local Theme tab stays until the map shows the same rendering on her pages, compared by screenshots.

**Phase 6: house editor on danamccool**
- The earlier plan: canvas at `/studio/canvas/[...path]` beside her Puck editor, `BOX_BLOCKS` + `MorphMark`, `RESOLVED_KEYS` for the dm data blocks, no `metadata.canEdit`.
- It now reads the same sources for free: page switcher, choosePicture, gallery and artwork records, and the menu field.

## 4. Decisions for Justin

1. **Text style format.** One stored look per block.
   - (a) **Recommended:** direct-edit `morph` on the block root, with Dana's `textStyle` read through an adapter. Converting it later is optional.
   - (b) Make `textStyle` the shared format and teach the canvas to write it.
2. **Theme.** Put danamccool on Site style in phase 5 (the plan's stated direction), or keep her palette model as a supported second theme kind?
3. **Whose library.** For Galleries and Media "mine", is it the site owner (Dana today), the signed-in editor, or the org? This decides the default for `scope`.
4. **Menu.** Make Dana's data-driven menu the platform menu, and move katie and sunjay off code arrays?
5. **Rebuilds and backups.** One rebuild per phase or a batch? And a yes to the daily backup cron?

## 5. Things to check before starting

- Whether Dana's `api/media/[...path]` duplicates `services.mediaRoutes()`.
- How much of `gallery-actions.ts` is already in `services/galleries.ts`.
- page-builder `style/` and `config.tsx` internals, before adding typography.
- Whether the shared `blocks` gallery-grid already has an autosave path.
- The hub's host contract, if the plugins mount in the Site Builder card.

## 6. Decisions (Justin, 2026-11-19): yes to every recommendation
1. Text style: direct-edit `morph` on the block root. Dana's `textStyle` is read through an adapter; converting it is optional and comes later.
2. Theme: danamccool moves to Site style in phase 5. Her local Theme tab stays until her pages render the same.
3. Whose library: `scope` can be set per site. The default is the site owner (today's behaviour); sites with several members can pick `org`.
4. Menu: Dana's data-driven menu becomes the platform menu. Katie and sunjay move off their code arrays in phase 2.
5. One rebuild per phase, timed for when Dana is not editing. Daily backup cron installed: `~/eac-backups/danamccool/backup.sh`, 03:15, keeps 14 days.
Phases 0 and 1 started in source (agents A and B; see PROGRESS.md).
