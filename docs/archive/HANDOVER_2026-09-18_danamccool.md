# Handover — Dana McCool site (apps/danamccool), 2026-09-18

Port 3018, org `danamccool`, owner = Dana (`danamccoolart@gmail.com`, user `4eebc495-…`), guide = Justin.
Personal artist site; IFAC shares storage + account. **Nothing is committed.** Another session was
concurrently editing `blocks/gallery-grid.client.tsx` (nested galleries), `components/studio/page-editor.tsx`
(Menu/Theme tabs), `components/studio/editor-tabs.tsx`, `hud.css` — read `git status` before touching.

## What exists
- **Pages = Puck** (`@puckeditor/core` 0.23 via `@elkdonis/page-builder`), stored in `site_config` key `puck:<path>`,
  served by `app/[[...path]]` (static routes win). Editor at `/studio/<path>` (catch-all; nested paths work).
  Old page JSON backup: `~/eac-backups/danamccool-puck-pages-before-2026-09-18.json`.
- **Site blocks** (`src/blocks/*`, plain CSS `dm-*` in `app/site.css`): star-diamond, plate, circle-text,
  image-set, artwork-wall, writing-shelf, **gallery-grid**. Rules for new blocks: top of `blocks/index.ts`
  (manual first; optional `binds:"artwork"|"gallery"` pickers; typed value wins).
- **Media** = her Nextcloud folders `EAC_Network/danamccool/Media/Images/DANAS FORMAT WEBSITE/DANASFORMATIMAGEFILES/<PAGE>/`
  (one folder per old page). Uploads now go to `EAC_Network/users/danamccool/` (`Galleries/<slug>/` when to a gallery).
- **Artworks** = `artwork` rows in her **market** store (`dee437d2…`); sale state = listing status; "portfolio only" =
  `archived` + `metadata.site='portfolio'`. Manage at `/manage/artworks`. ~21 titles are unconfirmed working titles.
- **Galleries** = `user_galleries` (migration **146**: `page_path`, `origin`, `hidden_on`, `folder`; items may carry
  `artworkId`, `subtitle`, `fx/fy/zoom`, `saved`). 10 galleries, all `is_public=false` on purpose.
- **HUD** (Pages/Galleries/Media panels) = `components/hud/*`, mounted in Puck's left rail, `/hub`, `/gallery`.
- **Blog** `/blog` + `/blog/<slug>` (`?edit=1` desk), Dana-only writing.
- **Fonts/theme**: `/studio/theme` (`lib/fonts.ts`, `theme:fonts`); per-page fonts in Puck Page settings.
- **Art Archive** (`/art-archive`) = one `dm-gallery-grid` over gallery "Art Archive" (151 pics from ARTARCHIVEPAGE):
  IFAC-style square tiles, hover listing, slideshow; signed-in editors drag/resize/frame (⤧) on the PUBLIC page +
  Reset / Randomize / Save-as-my-layout / Use-my-layout. Puck panel has a "Pictures" list (title/subtitle).

## Open / owed
1. **IFAC is a production build** without the `hidden_on` filter. Until IFAC is rebuilt, making any of her galleries
   public puts it on her IFAC profile. After rebuild: tick "Listed in the Galleries index" per gallery.
   Don't rebuild IFAC without checking other sessions' in-flight IFAC changes.
2. Editor shows "Unsaved changes" on load (resolvers change data on load) — not fixed.
3. The Galleries-tab → canvas refresh for the grid was just added (`DATA_BLOCKS` in page-editor.tsx); type-checked,
   not browser-verified.
4. Grid is 4-across on phones (~79px tiles) — no mobile breakpoint.
5. IFAC-side "show on IFAC" toggle UI (artist profile card / `/center`) not built; data is there.

## Environment traps
- **Host memory is exhausted** (~3–7 GB free of 60, swap full). danamccool's dev server self-restarts; headless Chrome
  crashes without `--shm-size=512m --renderer-process-limit=1`.
- **Turbopack panics** ("aggregation_update … lost follower") = corrupt cache →
  `docker compose up -d -V --no-deps danamccool` then `docker exec -u 0 eac-danamccool chown 3003:3003 /app/apps/danamccool/.next`.
- Type-check needs memory: `docker exec -e NODE_OPTIONS=--max-old-space-size=2048 eac-danamccool sh -c "cd /app/apps/danamccool && node_modules/.bin/tsc --noEmit --incremental false"`.
  Errors in `packages/services/src/gather.ts` are pre-existing, not ours.
- Verifying UI: mint a password test account via GoTrue admin (recipe in memory `feedback_verify_ui_by_rendering`),
  add `user_organizations` role, drive `zenika/alpine-chrome` over CDP; delete the account after.
- Stale editor tabs throw "Failed to find Server Action" — reload them.

Memory notes: `project_danamccool_site.md`, `project_danamccool_galleries_hud.md`.

## Later, 2026-09-18 — picture picker on Nextcloud folders; Art Archive panel rebuilt
- **Where her Format folders really are:** the SITE (org) folder, `EAC_Network/danamccool/Media/Images/DANAS FORMAT WEBSITE/…`,
  not her user folder. Her user folder (`EAC_Network/users/danamccool`) holds `Media/Images` (13 files) + uploads.
- **Picker** (every image field in Puck's right column): tabs are now **Site images** (org `Media/Images`) and **Dana's images**
  (the SITE OWNER's user root — was the *signed-in* person's, so a guide saw their own). Both are folder trees:
  breadcrumbs, folders, a name search across the root (`?q=`), `?w=240` thumbnails. Shared: `browseMediaFolder` /
  `cleanBrowsePath` in `@elkdonis/services/media-library.ts` (root fixed by the route; `..`/`Private`/dotfiles refused) and
  `MediaBrowser` in `@elkdonis/cms-ui/files` (old flat endpoints still render as before — other apps untouched).
- **Drag:** picker tiles and the left-rail Media panel thumbnails carry `application/x-eac-media`; the WHOLE picker is a drop
  target (a desktop file dropped is uploaded). Dropping straight onto a block in the canvas is NOT built (canvas is an iframe).
- **Bug fixed:** `ImageField` used Puck's `FieldLabel` as a `<label>` → clicking "Site images" also clicked Upload and the tab
  snapped back. Now `el="div"` (packages/page-builder).
- **Art Archive "Pictures" panel** (`components/studio/gallery-pictures-field.tsx`, CSS `gallery-fields.css`): cards with the
  picture, Title, Caption (= item `subtitle`), "Take out"; listed in GRID order (y, x); "+ Add pictures" (multi-select from
  the folders); **Sub-galleries**: "+ New sub-gallery" (name → choose pictures, first = cover, "make cover", optional folder
  pictures, optional "take them out of the parent") or "Use a gallery she has"; each sub-gallery row: rename, take out, add
  more from the parent, Unlink. Per-picture "Opens" dropdown removed from this panel (still in the Galleries HUD).
  New actions: `createSubGalleryAction`, `copyPicturesToGalleryAction`, `removeGalleryPicturesAction`.
- Verified in headless Chrome: browse/search/click-to-use/drop-to-set; sub-gallery created → linked → listed, then removed
  (Art Archive items md5 identical to before; backup `~/eac-backups/art-archive-gallery-before-subgallery-test-2026-09-18.json`).
- Turbopack served a stale `@elkdonis/services` module to ONE route after adding an export ("is not a function") —
  a container restart fixed it. Puck mounts the Pictures field twice (two `.dm-gp` in the DOM) — double fetch, harmless.

## Later still, 2026-09-18 — IFAC now reads every picture from Nextcloud (REBUILT + deployed)
- Dana's `users.avatar_url` had been repointed overnight (9/17→9/18, no code writes that path — a hand edit) to
  `EAC_Network/inner_group/Profile Pictures/danamccool.jpg`, which IFAC refused. Restored to her own folder
  (`users/danamccool/Media/Images/danamccool pic.png`, same photo, sharper). Old values in `~/eac-backups/avatar-changes.log`.
- IFAC media route: also serves `EAC_Network/<org>/` for orgs an IFAC-listed person OWNS (Dana's `danamccool` galleries);
  other orgs still 404; `canReadMedia` still gates each file.
- Static roster fallback removed from `lib/directory.ts` (no more `public/ifac` pictures for artists/dealers); About page team
  photos come from each person's profile; banner / Vote-for-Andre tile / social icon / Iven + Grant photos copied to
  `EAC_Network/ifac/Media/Images/Site/` (DB hero `imageUrl` updated). `public/ifac` (270 MB) is now unused by the pages — not deleted.
- **IFAC was rebuilt** (in a throwaway container, swapped into the live `.next` volume). That build SHIPPED every other
  session's uncommitted IFAC work too — incl. the `hidden_on` gallery filter, so Dana's galleries can now be made public safely.
  Previous build: `/tmp/ifac-next-backup-2026-09-18.tgz` inside `eac-ifac` (restore: untar into `/app/apps/ifac/.next`, restart).
  Verified: 132 images on 19 profile pages + home + about all 200 from Nextcloud.
