# elktours media structure and the one picker (2026-11-26)

This document records how media is filed for elktours (elkdonisexperiences.com) in Nextcloud. It covers the rules for attaching media to tours and places, the plan to move the owner's `Stops/` folders into the tour folders, and the design of one shared media picker. That picker replaces the form "Library" tab and the hub Files card, and may later share a frame with the content library. It was written from a read-only survey on 2026-11-26: code, `SELECT`s on `elkdonis_dev`, and listing the Team folder on disk. Nothing has been built or moved yet.

## 1. Current state (verified 2026-11-26)

**Storage**

- `EAC_Network` is Team folder 2. The org folder is `EAC_Network/elktours/` (it is keyed by org id), and people's folders are `EAC_Network/users/<storage_folder>/` (`packages/nextcloud/src/org-folders.ts:33-38,111-148`).
- A path with any segment named `private` (in any letter case) is private. Every other path is public, served with `max-age=31536000, immutable` (`packages/services/src/media-authz.ts:60-104`, `media-serve.ts:80-84`).
- Contents of `elktours/` on disk:
  - `Media/Images`: 119 files.
  - `Media/Videos`: 16 files.
  - `Private/Media/Documents`: 4 PDFs.
  - `Stops/`: 11 folders that the owner filled by hand on 2026-11-19.
  - `Tours/` and `Places/` do not exist.

**Tour and place folders**

- The tour and place folder scheme is in code (`apps/elktours/src/lib/media-folders.ts:1-13`). Folder names are fixed when the folder is made, in `threads.metadata.mediaFolder` and `places.media_folder` (migration 280).
- No tour (0 of 13) and no place (0 of 95) has a folder, for two reasons:
  - Every tour and place was created before the folder code went live. The newest tour, `the-bluffy-mc-blluff-tour`, was created 2026-11-20 01:58 UTC; the folder code was deployed in the 2026-11-20 14:52 EST rebuild. No place was created after that.
  - `backfillFolders` (`media-folders.ts:154`) has never been run.
- `ensureFolderSoon` is not known to fail. The logs since the container was last recreated hold no folder errors.

**Stop pictures**

- The stage reads stop pictures live from `Stops/` by matching names (`tour-stage-data.ts:116-123`, `stop-folder-photos.ts:7-10`).
- 46 hidden `tour_assets` rows register 46 of those files as stop pictures. The files stay in `Stops/` (`registerInPlace`, `media-folders.ts:372`).
- Nothing else refers to a `Stops/` path: `threads`, `site_config` and `tour_stops` were each checked.

**Uploads and libraries**

- Uploads from tour, stop and take forms land in `elktours/Media/Images/`. The asset panel uploads to `Private/Media/<kind>/`.
- The form "Library" tab uses `/api/media/library`. That route returns a flat list (`Media/Images` plus rows from the `media` table) and no `browsable` flag, so `MediaBrowser` draws a single flat grid.
- elktours' own browsable libraries (Tours, Places, General, Stop folders; `apps/elktours/src/lib/media-libraries.ts`) are used only by the page and Puck picture chooser.
- No Nextcloud file id is stored anywhere. Rows point at files by path and URL. No two live rows share a file.
- No shared WebDAV COPY helper exists. COPY appears only inline, in `publishPrivateFile` (`apps/elktours/src/lib/assets.ts:514-557`, which also strips EXIF) and in `reels.ts`.

**Embedding**

- `eac_embed` sets frame-ancestors to `https://elkdonis-arts.org` only (`docker/nextcloud-apps/eac_embed/lib/Listener/CspListener.php:18-40`). A live Nextcloud document cannot be framed on elkdonisexperiences.com until that domain is added.

## 2. Decisions (developer, 2026-11-26)

1. **Homes.**
   - A tour's own media lives in `Tours/<slug>/`. `Tours/<slug>/Private/` holds guide notes and the shared live document.
   - A place's media lives in `Places/<slug>/`.
   - Images with no clear home go to `Media/Images`, named after the context they were uploaded from.
   - People's own files stay in `users/<f>/`.
2. **The context of an upload decides its home.** An upload on a place's panel files to the place. This holds on every page that shows the panel, including the tour details page and the stage surface in live edit.
3. **A stop links to its place, and a slot copies.**
   - A stop that includes a place shows the place's pictures live, as a shortcut; nothing is copied.
   - A slot, such as the cover, can be filled from any folder the org can see. The chosen file is copied into the tour folder.
4. **The owner's `Stops/<FOLDER>/` folders move into their tours' folders** and are connected to those tours. This supersedes the 2026-11-21 decision "register where it sits" (`media-folders.ts:362-371`).
5. **One picker.** Its look follows the innergathering Files card: org and personal folders, list/grid. It replaces the single-folder Library tab. The content library is a candidate to share its frame later.
6. **Each tour gets a file describing it.** The site writes it on save and never reads it back (posture A: export only). The database stays the record.

Superseded statements in code comments, to be updated when the code changes:

- `media-libraries.ts:3-11`: "choosing one … never moves, copies or writes anything" and "There is no My pictures library here" (2026-11-21). Under decisions 3 and 5, a pick that crosses a boundary copies, and My files is a source.

## 3. Rules

- **Attach by copy** when the pick crosses a boundary:
  - Owner: a person's folder, another org's folder, or a business's folder.
  - Privacy: out of any `Private/` folder.
  - Stability: a slot that must not change underneath the tour (cover, hero, share image). Public files are cached for a year, so a public path must keep its content.
- **Attach by link** when the source is the org's own public place library. This is the stop case.
- How a copy is made:
  - WebDAV COPY with `Overwrite: F`. On a name clash, add `-2`, `-3` and so on: an existing file is never replaced.
  - Images are re-encoded without EXIF and GPS, as `publishPrivateFile` does.
  - The row records `meta.copiedFrom` (source path) and `sha256`.
  - Within one tour folder, a file with the same hash is reused instead of copied again.
- **Upload naming in `Media/Images`:** `<context-slug>-<yyyy-mm-dd>-<nn>.<ext>`, for example `pont-neuf-2026-11-26-01.jpg`. When a place gets its own folder, files with its prefix can be moved in by exact prefix match, not by guessing.
- **The tour file** goes to `Tours/<slug>/Private/tour.md`: Markdown with YAML front matter (id, slug, title, status, stops in order with place slugs, media keys per slot). It lives under `Private/` because draft tours and guide fields must not be served publicly (§1). It is written by the save path, carries a "generated, edits are not read back" line, and links places as `[[place-slug]]`.
- **Read scope:** the picker lists only what the server's source rules allow. The client sends a source key, a folder path and a search word. The server resolves the root from the session and the deployment, as `media-libraries.ts` does now.

## 4. Moving `Stops/` into the tour folders (done 2026-11-26 ~18:30 EST, on the developer's go-ahead, no dry run)

Done:

- For each of the 8 matched folders: made `Tours/<slug>/` and `Tours/<slug>/Private/`, then one WebDAV MOVE (`Overwrite: F`) of `Stops/<FOLDER>/` to `Tours/<slug>/Stops/`. File names are unchanged.
- In one transaction:
  - the 46 `tour_assets` rows got their new `storage_key` and `url`, plus `meta.movedFrom` (the old key) and `meta.movedAt`;
  - the 8 tours got `metadata.mediaFolder` (empty before).

Verified:

- No row and no other table refers to `elktours/Stops/` for these folders. Checked before the move in threads, site_config, tour_stops, media, places, business_listings and tour_guide_takes, and for the rows after.
- Each of the 8 public tour pages shows the same picture names before and after, now from `Tours/<slug>/Stops/` (signed out, through the edge).
- The picture URLs and the rows' URLs serve 200.
- `Stops/` now holds only the three folders without a tour.

Rollback:

- The rows' old keys are in `meta.movedFrom`, and a copy of the 46 rows from before is in `~/eac-backups/stops-move-20261126/tour_assets-before.txt`.
- To undo, MOVE each `Tours/<slug>/Stops/` back to `Stops/<FOLDER>/`. The stage falls back to the old folder whenever `<mediaFolder>/Stops/` has no pictures.

Side effect: links to the old picture URLs (shares already scraped, browser caches) now get 404.

The plan as proposed before the move:

Mapping. "Matched" is the number of files the name-matcher has registered to stops; the rest show in the tour's overview gallery.

| `Stops/` folder | Files | Tour | Matched |
|---|---|---|---|
| ELKDONISEXPERIENCES_FOODTOUR | 7 | `parisian-food-tour-rue-montorgueil` | 4 |
| ELKDONISEXPERIENCES_FRENCHREVOLUTION | 10 | `the-french-revolution-from-the-bastille-to-the-invalides` | 3 |
| ELKDONISEXPERIENCES_ILEDELACITE | 8 | `discover-the-heart-of-paris-ile-de-la-cite` | 7 |
| ELKDONISEXPERIENCES_LATINQUARTER | 6 | `the-latin-quarter-medieval-charm-scholars-jazz` | 6 |
| ELKDONISEXPERIENCES_LEGENDS | 13 | `legends-symbols-saints-the-hidden-soul-of-paris` | 7 |
| ELKDONISEXPERIENCES_MARAIS | 7 | `the-marais-medieval-streets-royal-squares-jewish-paris` | 5 |
| ELKDONISEXPERIENCES_MONTMARTRE | 9 | `montmartre-from-village-to-moulin-rouge` | 8 |
| ELKDONISEXPERIENCES_NAPOLEON | 9 | `l-heritage-de-napoleon-bonaparte` | 6 |
| ELKDONISEXPERIENCES_PERELACHAISECEMETARY | 6 | none | — |
| ELKDONISEXPERIENCES_TuileriesGardens | 8 | none | — |
| ELKDONISTOURS_ARCHITECTURALADVENTURE | 14 | none | — |

Proposed steps, in this order:

1. **Code first.** The stage and the libraries read stop pictures from `<mediaFolder>/Stops/`, falling back to the old `Stops/<FOLDER>/` while a tour has no folder. elktours runs in production mode, so this needs a rebuild before anything moves.
2. **Make the 8 tour folders** with `ensureTourFolder`. The backfill would also make folders for the 4 other unarchived tours and the 95 places. Places follow the lazy rule (a folder on first upload) unless the developer says otherwise.
3. **Move each folder** with one WebDAV MOVE per folder: `Stops/<FOLDER>/` → `Tours/<slug>/Stops/`. File names are kept.
4. **Rewrite the 46 rows** in the same step: `storage_key` and `url` for the moved paths, filtered by `org_id`. The old→new path list is printed for review first (dry run).
5. Check: render the 8 tour pages signed out and compare the picture count per stop before and after.

Side effects:

- Old public URLs return 404 after the move. No database row refers to them. Share previews already scraped by Facebook and others keep the old picture until they are scraped again.

## 5. The one picker

### What exists

| Component | Path | What it does well | What it lacks |
|---|---|---|---|
| `FileBrowser` (Files card) | `packages/cms-ui/src/hubsite/FileBrowser.tsx` | Source tabs, Back/Forward/Up, breadcrumbs, List/Grid, file-family icons, size and date, last folder remembered per source | Read-only; no picking, upload or search |
| `MediaBrowser` | `packages/cms-ui/src/files/MediaBrowser.tsx` | Browsable `{path, items, browsable}` contract, search across folders, single and multiple pick, drag (`writeMediaDrag`) | No list view; images and video only; no Back/Up |
| `MediaPicker` | `packages/cms-ui/src/files/MediaPicker.tsx` | Upload plus one tab per library, drop anywhere, used by about 30 callers | Each tab is one endpoint; the flat `/api/media/library` gives one folder |
| `FilesCard` | `packages/cms-ui/src/files/FilesCard.tsx` | Upload into `Media/<folder>`, delete | List only; `remove()` uses the wrong endpoint (:160, impact not checked) |
| `LibraryPicker` | `packages/cms-ui/src/gallery/LibraryPicker.tsx` | Multiple pick for galleries | Flat; no folders |
| App copies | `components/manage/media-field.tsx` (innergathering, elktours, amrit-canada, sunjay); IFAC `FilesCard`; Mantine `packages/ui` | — | Duplicates |

### Built 2026-11-26 (source only, not used by any app yet)

The developer decided on 2026-11-26 that the picker should follow the content library's look, which is becoming the platform's browser for both files and threads. So the component lives beside `ContentLibrary`, not in cms-ui.

- **`MediaLibrary`**: `packages/content/src/ui/MediaLibrary.tsx`, exported from `@elkdonis/content/ui`.
  - It reuses the library's classes: `eac-c-lib-bar`, `chn-search`, `chn-seg` (sources as the scope toggle, plus a kind filter), `eac-c-viewseg`, `chn-bricks`/`chn-brick`, `eac-c-rows`/`eac-c-row`, `chn-lightbox`.
  - New styles: the "MediaLibrary" section of `packages/content/src/content.css` (path row, folder chips, selected ring and check). Contrast ratios are recorded beside those rules.
  - Modes are `browse`, `pick` and `pickMany`. Sources can be shortcut entries, history works across sources, and upload is a button or a drop anywhere. A browsable listing keeps the server's order.
  - It still reads the two older listing shapes.
- **cms-ui:** new export `@elkdonis/cms-ui/file-types` (file-family icons), used by `MediaLibrary`.
- **Services:**
  - `packages/services/src/dav.ts`: `davCopy` (Overwrite: F), `davGetBytes` and `davPutNew` (`If-None-Match: *`).
  - `packages/services/src/media-copy.ts`: `copyIntoFolder`, `putUniqueFile`, `stripPictureMetadata`, `safeFileBase` and `contextFileBase`.
  - `packages/services/src/media-source.ts`: `listMediaSource`, which keeps MIME type, size and date, filters by family, and hides `Private/` unless the caller allows it.
  - All are exported from `@elkdonis/services`.
- **Nextcloud rule:** `.claude/rules/areas/nextcloud.md` says to MOVE and never COPY, because a COPY loses file ids and version history. `davCopy` is limited to deliberate attach-by-copy, where a new file is the intent; its comment says so.

Verified on 2026-11-26:

- `check-types`: 0 errors in `@elkdonis/content` and `@elkdonis/cms-ui`. `@elkdonis/services` has 17 errors, none in the new files (they are in `nextcloud/`, `social-feeds.ts` and `utils/sanitize*`).
- Rendered from source with esbuild against fixture sources in headless Chrome 124, at 1280, 900 and 390 px:
  - grid, list, the Places shortcuts and the phone layout;
  - the lightbox in browse mode ("Use as cover", Open);
  - a shortcut → place folder → pick, which reported `places:sacre-coeur/cover-sacre-coeur.jpg`;
  - a name search.
  - No page errors, and no horizontal overflow at any width.
- The harness is in the session scratchpad and not in the repo.

Not verified: `copyIntoFolder` and `listMediaSource` against Nextcloud (nothing calls them yet); upload; dark mode.

### Original proposal (2026-11-26, before the decision to follow the content library's look): `MediaLibrary` in `packages/cms-ui/src/files/`

One component in three modes:

- `browse`: the Files card. Files open; nothing is picked.
- `pick`: one file, for a form field or slot.
- `pickMany`: galleries.

The frame comes from `FileBrowser`:

- source tabs;
- Back/Forward/Up and breadcrumbs;
- List/Grid toggle, remembered (with try/catch around storage);
- family icons and file metadata.

Picking comes from `MediaBrowser`:

- search across folders;
- selection, and drag between fields.

Upload is an action inside the frame: a button, or a drop anywhere on it. It is not a separate tab.

**Sources.** Each app declares its sources on the server, as `librariesFor` does now. For an elktours cover, in order:

1. This tour (`Tours/<slug>/`).
2. Places. Inside a tour, its stops' places come first, as shortcut entries that open `Places/<slug>/`.
3. Org (the whole `elktours/` tree, public folders only).
4. My files (`users/<f>/`).
5. Stop folders, while `Stops/` exists.

A business's folder becomes a source when one exists.

**One listing contract.** This is a superset of the two shapes that exist now:

```
GET <endpoint>?source=<key>&path=<rel>&q=<search>
→ { path, browsable: true,
    items: [{ name, path, isFolder, url?, thumb?, mimeType?, size?, lastModified?,
              shortcut?: { source, path } }] }
```

**Pick and attach.**

- The field gives the picker a destination token, for example `{ kind: "tour", id, slot: "cover" }` or `{ kind: "place", id }`.
- On pick, the client sends `{ source, path, destination }` to the app's attach route.
- The server decides between link and copy by the rules in §3 and returns the URL to store.
- The client never decides whether a file is copied.
- An upload goes straight to the destination's folder, named by the §3 rule.

**Server pieces in `packages/services`:**

- `copyIntoFolder(srcKey, destFolder, { stripExif })` in `dav.ts`: COPY with `Overwrite: F`, suffix on a clash, sha256 returned.
- A source-listing helper built from `browseMediaFolder` that keeps `mimeType`, size and date (it drops them today) and filters by an `accept` list.

**Moving existing callers.**

- `MediaPicker` keeps its props and becomes `MediaLibrary` in `pick` mode. A caller that passes only a flat `libraryEndpoint` still gets a flat grid, so the ~30 callers keep working, and switching a site to browsable sources is a config change per site.
- `FileBrowser` becomes `browse` mode.
- `FilesCard`, `LibraryPicker` and the app `media-field.tsx` copies move over later, one site at a time.
- elktours is the first host.

**CSS.** Plain CSS on namespaced custom properties (`.claude/rules/areas/css-ui.md`). Grep `packages/*/src` and `apps/*/src` for the class prefix before choosing it; `eac-lib-` is already used by `packages/cms-ui/src/gallery/gallery.css` (LibraryPicker). `FileBrowser` uses `.eac-hs-seg`; `ContentLibrary` uses Channel's `.chn-seg`. The picker should settle on one segment control.

### Content library: a later merge

`ContentLibrary` (`packages/content/src/ui/ContentLibrary.tsx`) lists records (posts, artworks, meetings), not files. Its items come in as props and are filtered on the client, and opening one shows `PieceLightbox`.

Shared with the picker:

- the bar: search, a scope toggle ("All yours | You | org", which matches the picker's "Org | My files"), a view toggle (bricks/list), and a count with "Show more";
- a lightbox.

Different:

- the picker walks a tree from an endpoint; the content library filters a flat list by kind, status and series.

Proposed: do not merge the components now. Build `MediaLibrary` with the same bar layout and the same scope and view idioms. When a second real consumer exists, extract a shared `LibraryFrame` (bar, scope, view, count, lightbox slot). Two links are worth planning for:

- a file's lightbox lists where the file is used (the `tour_assets` rows and their `copiedFrom`);
- a content piece can be a source in the picker (the pictures of a post).

## 6. Build order

1. This document; the developer confirms §4. Done when confirmed.
2. Shared `copyIntoFolder` and the source-listing helper in `packages/services` (source only). Done 2026-11-26.
3. `MediaLibrary`, with a harness page at three widths. Done 2026-11-26, in `@elkdonis/content/ui` (§5 "Built").
3a. elktours needs `@elkdonis/content` as a dependency (`docker compose run --rm install`), `transpilePackages`, and `@elkdonis/content/content.css` before step 4. Done 2026-11-26.
4. elktours: sources and attach route; the cover and the stop and place fields switched over; uploads filed by context; stage reads `<mediaFolder>/Stops/` with the fallback. Live 2026-11-26 (build `DejveCe8aGwwCnQia5HyY`); see "Wired in elktours" below. Place fields (a place's own page, the stage's place panel in live edit) are not switched yet.
5. `Stops/` move and row rewrite (§4). Done 2026-11-26 (no dry run, on the developer's word).
6. `tour.md` export on save.
7. Later: other sites' Library tabs, Files cards and app copies; `eac_embed` frame-ancestors for elkdonisexperiences.com if the shared document is to be framed there.

### Wired in elktours (live 2026-11-26, build `DejveCe8aGwwCnQia5HyY`, uncommitted)

Code:

- `apps/elktours/src/lib/media-picker.ts`: sources, attach and upload.
  - Sources: `tour`, `place`, `places`, `org`, `mine` and `stops`.
  - Who may use them: owners and guides. For a tour's folder, owners may use any tour and guides only the tours they wrote, matching `getTourSheet`.
- Routes:
  - `GET /api/media/sources/[key]`: listing. Opening the `tour` source makes the tour's folder.
  - `POST /api/media/attach`: link or copy.
  - `POST /api/media/upload-to`: context-named upload.
- `components/manage/media-field.tsx` now draws `MediaLibrary`, and every caller gets it. Destinations are passed for:
  - the cover in the create-tour description step (once the tour is saved; until then it goes to Media/Images under the title);
  - the cover in `tour-form.tsx`;
  - the stop pictures in the create-tour details step (stop slot: a pick from the stop's place folder or the tour folder is linked; anything else is copied into `Tours/<slug>/Stops/`).
- The stage reads `<mediaFolder>/Stops/` when it holds pictures, and falls back to the old `Stops/<FOLDER>/` (`lib/stop-folder-photos.ts`, `lib/tour-stage-data.ts`).
- `copyIntoFolder` reuses an earlier copy when the name clashes and the content is identical.
- Atlas row `elktours-media-picker-file`.

Verified 2026-11-26:

- Through the edge, signed out: all three routes answer 401. The Montmartre tour page still serves its `Stops/` pictures.
- Through the edge, with a temporary test account as guide:
  - `org` lists `Media` and `Stops`, with Private hidden.
  - `stops` lists 11 folders, with MIME type and size.
  - `places?tour=<Montmartre>` lists its 11 stops in tour order.
  - `path=Private` and `path=../users` answer 404.
  - The tour source and attach for a tour the guide did not write answer 404.
- The same test account as owner, on the draft tour "the-bluffy-mc-blluff-tour":
  - A pick from `Stops/` was copied into `Tours/the-bluffy-mc-blluff-tour/`. The copy has no EXIF segment and no GPS, and is served 200.
  - Picking the same file again reused that copy.
  - A pick from the tour's own folder was linked, not copied.
  - An upload was stored as `the-bluffy-mc-blluff-tour-2026-11-26-01.jpg`.
- Headless Chrome at 1280 and 390 px, as owner: the picker opens under "Cover image" in `/hub/tours/edit`, and the Places tab lists the stops. The page is wider than 1280 px because of the site header nav, not the picker.
- Cleanup: the three test files were deleted, and the test account was removed from `user_organizations`, `org_profiles`, `users` and GoTrue.
- Left by design: the draft tour's empty folder `Tours/the-bluffy-mc-blluff-tour/` (with `Private/`) and its `metadata.mediaFolder`.

Not verified: a real person's first use; uploading through the browser (only through curl); dark mode; the details-step stop pictures in a browser.

Seen in the log, not from this change: `ReferenceError: document is not defined at editPageHref` during server render (from another session's uncommitted `EditPageButton.tsx`).

## 7. Open items

- Three `Stops/` folders have no tour (Père Lachaise, Tuileries, Architectural Adventure). Proposed: leave them in `Stops/` until their tours exist. Developer to confirm.
- Whether a stop's chosen subset of its place's pictures stays a link (rows with selection and order) or becomes a copy. The proposal is a link.
- Place folders: made lazily on the first upload (proposed), or for all 95 at once by the backfill.
- Folders for business accounts: out of scope. `place_businesses` has 34 rows; `business_listings` has 30 shell rows with no photos.
- Whether the Org tab shows `Private/` folders to editors. The proposal is no; `Private/` is shown only on the tour's own Private tab.
- Removing a picture from a tour archives its row and leaves the copy in the folder (proposed).
- `docs/reference/nextcloud.md` says Nextcloud 33. `occ status` reports 35.0.3.

## Cornerstone note (PM, session system32-43, 2026-11-26 18:10)

Justin made the content library the platform's one search and one component (`docs/open/CONTENT_CORNERSTONE_2026-11-26/`, read CONTRACT.md §0 and §7). This changes §5's "Content library: a later merge": the merge is happening now.
- `MediaLibrary` folds into `ContentLibrary`. The file browser becomes `<ContentLibrary view="files" lockView folders={…} />`.
- The listing contract `{path, browsable, items}`, the folder navigation, upload, drag and the pick/pickMany modes are kept and moved, not rewritten.
- `@elkdonis/content/media-library` and the `MediaLibrary` export stay as a wrapper with the same props, so elktours `media-field.tsx` does not have to change.
- Please add no new `MediaLibrary` features. Send needs to the cornerstone LEDGER instead.
- The media lane still owns upload paths, `media-copy.ts`, `dav.ts` and the elktours attach flow. `listMediaSource` is the backend of the new `/api/content/folders` route.

## Cornerstone note 2 (PM, session system32-43, 2026-11-26 late)

Cornerstone Step 5 has started: files are being added to the one search (CONTENT_CORNERSTONE CONTRACT §1, §4, §5; LEDGER "Step 5 files").
- File entries go into `content_index` as `store='file'`, keyed by the Nextcloud file id, with read rights that mirror `canReadMedia`. **No rows are added to `media`.**
- An incremental reindex walks folder listings only and never reads file bytes.
- The `registerLibraryItem` seam in `uploads.ts` gains one indexing call; it is additive and cannot fail an upload.
- `dav.ts` may gain `oc:fileid` in its PROPFIND, also additively.
- Please don't rename or remove `registerLibraryItem`, `listMediaSource` or the `dav*` listing helpers while this lands. If your upload work changes them, post to the cornerstone LEDGER.
