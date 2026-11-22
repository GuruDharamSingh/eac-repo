# MEDIA lane report (2026-11-21)

Lane MEDIA, for Manjushri and Justin. Everything below was read from the code and the live database on 2026-11-21 (read only). No file in Nextcloud was moved, copied, renamed or deleted; no `tour_assets` row was written; no migration was run.

## For Justin, in plain words

### How it works today, and why it feels convoluted

Think of three shelves where pictures can live: a tour's shelf, a place's shelf, and the site's general shelf. On top of that, the site keeps a card index (the `tour_assets` table) with one card per picture or live feature, and each card says who it belongs to: a tour, a stop on a tour, or a place.

The trouble is that one card is doing two jobs. It says "this is a picture" (the file, who took it, the licence) and also "this stop shows it" (the caption, the order, switched on or off). To let a stop use a place's picture, the site makes a second card for the same file, so the picture exists as two cards and nothing keeps them in step. If you fix the credit on the place's card, the stop's card still has the old one. If you remove the place's picture, the stop's copy keeps showing it.

The folders menu (`/manage/media-folders`) was built for a real job. On 19 November you dropped 97 pictures into 11 folders called `Stops/<TOUR>/`. The site had been showing them by guessing from the file names which stop they belonged to. On 20 November the plan became "folders mirror the catalogue": every tour gets `Tours/<tour>/`, every place gets `Places/<place>/`, and the menu moves each of the 97 files into the right folder, with a choice per file. That choice is the confusing part. "Place", "stop" or "overview" is really the question "where should this picture show?", but the menu answers it by physically moving the file and making cards. Where a file is kept and where it is shown got mixed into one click.

Today the picture library is almost empty: the cards hold 1 picture a person added, 96 Street View stills the site makes itself, 8 film posters and 16 films. No place has a single picture card. The 97 pictures you dropped have not been moved yet; the tour page still finds them by name.

### How it would work

1. **A picture is kept once**, with whoever it belongs to: a place's pictures with the place, a guide's with the guide, the brand's with the site. It is never moved or copied to be used somewhere else.
2. **Using a picture is a note, not a copy**: "this stop shows that picture, second in line, with this caption." The note holds the order, the caption and the on/off switch. The picture keeps its own credit, licence and description, so fixing the credit once fixes it everywhere.
3. **A stop shows its place's pictures unless the guide picks their own.** The site works this out when the page is drawn. Nothing is copied. If a guide does not want one of the place's pictures on their tour, they switch that one off for that tour only.
4. **Folders are only for you to tidy things.** The site never decides what to show from where a file sits.
5. **The move menu stops moving files.** It becomes a way to say "register these 97 pictures where they already are", and later a read-only tidy-up view.

### What you will see in the picker

Anywhere you set a picture on a block (and, later, in the tour creation flow) the picture box has tabs: **Upload**, **Tours**, **Places**, **General**. You open a tab, open a folder (a tour or a place), and click a picture. Nothing is copied; the block simply points at the stored picture. In the creation flow the first tab will be **This tour**, and a fifth tab **My pictures** will show your own files.

Right now: **Tours** shows the 8 tours that have a picture or poster, **General** shows the 17 real pictures in the site's Media folder (the 96 Street View stills are hidden, they are not pictures to choose), and **Places** is empty until place pictures are registered. This is already live in source for the block picture setting; it goes live with the next rebuild.

### What it costs

- A small database change (one new column) is recommended before the 97 pictures are registered, so the notes are born linked. It is a proposal in this folder, not applied. It changes no existing data (0 rows are affected today).
- The tour page and the stage have to read the notes. That is a change to the code that draws pictures. It has to be done with care because published tours show through it.
- A rewrite of the folders menu so it registers pictures instead of moving them.

### The decisions that are yours

1. **Is it right that the folders menu stops moving files?** Recommended: yes, register the 97 pictures where they are (`Stops/`), and let the folder tidy-up be optional. If you want them tidied into `Tours/` and `Places/` anyway, that can be a separate button later, it just no longer controls what shows.
2. **Pictures from a guide's own phone ("My pictures").** A phone photo carries where it was taken. A public page must not publish that. So the one exception to "never copied" is this: when a guide chooses one of their own phone photos, the site makes one clean copy (location removed) in the site's own files, as it already does. Alternative: refuse own pictures that have a location. Recommended: keep the clean copy. Blocks do not offer "My pictures" at all for now.
3. **Credits when a place picture is used on a block.** A block holds only the picture's address, so a picture with a required credit (the Wikimedia ones carry "author · licence") would show without it. Before place pictures are used on public blocks, the block should look the credit up from the stored picture when it draws. Recommended: do this before anyone uses the Places tab on a public page. It is not an issue today (no place has a picture).
4. **Who sees which tab.** Tours: owners all tours, guides only the tours they wrote. Places and General: owners and guides. My pictures: any member. Only pictures that are switched on are listed, so a picture still under review is never offered. Say if guides should see all tours.

## Technical design

### 1. What exists today, exactly

**`tour_assets`** (`\d tour_assets`; code in `apps/elktours/src/lib/assets.ts`): one row per file or live feature.

- Owner pointers: `thread_id` (tour), `stop_id` (stop, FK cascade), `place_id` (place, FK cascade). Check `tour_assets_owner`: `thread_id` or `place_id` must be set (or `source = 'photo_pending'`). So every row has an owner, and a picture with no tour and no place cannot be a row. That is why "General" pictures are not rows.
- File facts on the same row: `url`, `storage_key`, `storage`, `mime_type`, `bytes`, `width`, `height`, `seconds`, `sha256`; credit facts: `attribution`, `licence_note`, `alt_text`; use facts: `role`, `variant`, `visible`, `position`, `caption`. `meta` jsonb carries `fromPlaceAssetId` and `privateKey`.
- Kinds: `film poster image still map3d streetview document`. `map3d` and `streetview` have no file (`tour_assets_url_or_live`).
- Public reads use `visible AND archived_at IS NULL`, and drop Private keys (`assets.ts:138`, `publicTourAssets`).

**Row counts (2026-11-21):** 228 rows.

| kind | rows | owner | notes |
|---|---|---|---|
| film | 16 | tour | role hero, source import, 8 visible |
| poster | 8 | tour | role hero, 7 visible |
| map3d | 11 | tour | live, no file |
| streetview | 96 | stop | live, no file |
| still | 96 | stop | role card, source streetview-static, all visible |
| image | 1 | stop + tour | role gallery, source upload |

- 0 rows have `place_id`; 0 carry `meta.fromPlaceAssetId`; 0 are archived; 0 are under `Private/`. All 121 rows with a storage key sit under `EAC_Network/elktours/Media/`.
- Around them: 13 tours (8 published, 3 draft, 2 archived), 103 stops (102 with a place), 95 places (`media_folder` null on all 95), 2 `media` rows for elktours, 6 tours with `metadata.coverImageUrl`.
- In storage: `Media/Images` has 113 files (96 are the Street View stills), `Tours/` and `Places/` exist and are empty, `Stops/` has 11 folders holding 97 files.

**How each surface finds its pictures**

- **Tour page (desktop story and Tour data):** `lib/tours.ts:315` calls `publicTourAssets`. Per-stop pictures are rows with `kind = image`, `visible`, not Private, grouped by `stop_id` (`assets.ts:176-181`); `TourStory` reads them as `stopImages` (`components/tours/tour-story.tsx:30-33`). It never reads place rows.
- **Phone stage:** `lib/tour-stage-data.ts` builds two lists per stop. `stopPhotos` is, in order: the `Stops/` folder's pictures (read live from Nextcloud and matched to stops by file name, `lib/stop-folder-photos.ts`, `tour-stage-data.ts:117,160`), then the stop's own image rows, then `tour_stops.image_url`, then the Street View still. `placePhotos` is the place's visible rows (`tour_assets.place_id`, no thread, no stop) plus the place's businesses' photos (`tour-stage-data.ts:84-110,168`). Duplicates by URL are dropped across the two lists. So **the stage already computes "the place's pictures" at read time and never copies them**; the desktop story (`TourStory`) does not use place pictures yet.
- **Landing and cards:** the tour cover is `threads.metadata.coverImageUrl` (a URL string, read through `lib/cover.ts`, set by `setTourCoverAction`); the film is `threads.metadata.film`, a cache rewritten by `writeFilmCache` whenever the hero film changes (`assets.ts:307`). Neither is a row reference.
- **Bookings pages:** `app/bookings/[token]/page.tsx` imports no picture code (booking-lookup, formatting, mobile shell). They do not depend on `tour_assets`.
- **Block pictures:** a Puck or direct-edit block holds a plain URL string in its props. The picker sets it from `buildEditorConfig({ media })` (`lib/puck/config.client.ts`, `config.mobile.client.ts`) and from `components/landing/page-picture-chooser.tsx`. That is already a reference to a stored file; the file is never copied. What it lacks is the credit.
- **Creation flow (wizard) Details step:** `components/office/create-tour/details-step.tsx` lists a stop's rows, adds one with the old flat `MediaField` ("This site" library), or "From the place's pictures" calls `copyPlaceAssetToStopAction` (`details-step.tsx:96`).

**Where a picture is duplicated today**

1. `copyPlaceAssetToStop` (`assets.ts:419`) inserts a second row for the same file: copies url, key, credit, licence, alt, caption into a stop row with `place_id` set and `meta.fromPlaceAssetId`, `visible = false`. Nothing links the two afterwards. Archiving the place row (`archiveAsset`, `assets.ts:261`) leaves the copy shown; correcting the credit on one does not reach the other. (The asset panel works around the drift by matching on `meta.fromPlaceAssetId` or equal url, `components/manage/asset-panel.tsx:159`.)
2. `runStopsMove` (`lib/media-folders.ts:355`) physically `MOVE`s each of the 97 files and, for choice "place", writes a place row plus a stop row that points at the same file (`media-folders.ts:393`), so the move menu is the main producer of those pairs.
3. `importPhotoToOrg` (`assets.ts:489`) copies a file for real: a person's own picture is re-encoded without EXIF and written to `Media/Images`. This one is legitimate (privacy, below).

**The folders menu** (`app/manage/media-folders/page.tsx`, `components/manage/media-folders-panel.tsx`, `lib/media-folders.ts`, `lib/media-folder-actions.ts`): (a) "Make missing folders": creates `Tours/<slug>/` (+ `Private/`) and `Places/<slug>/` for records that have none and records the name in `threads.metadata.mediaFolder` / `places.media_folder`; (b) the reviewed Stops move: plans 97 files by name matching, offers per file `place | stop | overview | leave`, then MOVEs and writes rows (shown). Separately "Scan folder" (`scanFolder`, `media-folders.ts:220`) registers unregistered pictures in a tour or place folder as hidden rows with the Commons credit, and refuses any picture with a GPS position (`hasGps`, `:207`).

**Why it was built:** `media-folders.ts:1-16` states it: option C, folders mirror the catalogue; "the database decides what a file belongs to; the folder is filing". It is right about the principle and wrong about the mechanism: the Stops move makes the *folder* carry a *use* decision.

### 2. Testing the PM's five points against the data

1. **Stored once under the owner.** Mostly true already: tours' own and places' own files. Exceptions: (1) and (2) above (row copies, not file copies), and `importPhotoToOrg`. Correction: "under whoever owns it" cannot be a `tour_assets` row for site-wide brand pictures (the owner check needs a tour or place), so those stay `media`/folder files referenced by URL. The row-level change is small, the file-level principle already holds.
2. **A reference: picture, place, role, caption.** Right, and it is half there: a stop row with `place_id` and `meta.fromPlaceAssetId` is already a placement in everything but name. Block props and `metadata.coverImageUrl` are already references (URL strings). So a placement needs no new table.
3. **A stop shows its place's pictures by default.** Wrong as stated for the code: the stage does show the place's pictures (`placePhotos`) but as a separate list, with the stop's own leading; the desktop story shows none of them. The rule needs to be made explicit, and the stage already follows it.
4. **Folders are filing; the site never decides from a path.** Right, and today it does decide from a path in one place: `stopFolderPhotos` matches `Stops/<TOUR>/` file names to stops at read time and *leads* the stage's photos. That is the live violation, and the reason the move menu exists.
5. **The move menu becomes a picker.** Close, but the menu does two things: filing (moving) and registering (making rows). Registering is needed (97 files) and should happen in place; the picker is the other direction (choosing something already registered). See section 6.

Also from the data: nothing needs migrating (0 place rows, 0 copies), so the decision is cheap now and expensive after the 97 files are registered the old way.

### 3. The smallest model

**Picture** = a `tour_assets` row owned by a place (`place_id`, no `thread_id`) or a tour (`thread_id`, no `stop_id`), kind `image` (or `poster`). It owns the file facts and the credit facts: `url`, `storage_key`, `mime_type`, `width`, `height`, `attribution`, `licence_note`, `alt_text`, `caption` (default), and a `visible` that means "reviewed and allowed to be offered".

**Placement** = a `tour_assets` row with `thread_id` + `stop_id` (a stop) or `thread_id` alone (a tour's own list) that points at a picture. It owns `role`, `position`, `caption` (override, null means the picture's), `visible` (on for this tour), and the stop/tour. It does not own the file or the credit.

Existing columns can carry it today: `thread_id`/`stop_id` say where, `place_id` + `meta.fromPlaceAssetId` say which picture. The needed change is on the **read side** (overlay the source's file and credit at read time; drop the placement when the source is archived, hidden or Private), not in storage. The recommended hardening is one nullable column, `placed_from uuid references tour_assets(id) on delete cascade`, plus an index and a no-self check, so the pointer is a real foreign key and the 97 registrations are born linked. Proposal: `MEDIA_MIGRATION_PROPOSAL.sql` in this folder (backfill updates 0 rows today). A separate placements table was rejected: it would duplicate `position`, `role`, `visible`, caption and stop/thread pointers that `tour_assets` already has and every list query already filters on (`idx_tour_assets_thread`), and it would split the page's single read into a join across two tables for no gain.

Where a placement has nowhere to live in a row, it needs none: a block's picture is its URL; the creation flow's cover is `metadata.coverImageUrl`.

**Inherit from the place, at read time.** For stop S with place P: `own = placements on S that are visible, whose picture is visible, not archived, not Private`. `shown(S) = own` when it is non-empty (the guide chose); otherwise `shown(S) = P's visible, non-archived, non-Private pictures minus any picture that has a placement on S with visible = false`. With a place picture present *and* own pictures, the place's follow under "more from this place" (what the stage's `placePhotos` list already is). Never inserted, never copied. A switched-off placement is the per-tour way to leave out one place picture. No new column is needed for that.

**Libraries in data terms (elktours)**

| Library | What it lists | Who may list it |
|---|---|---|
| Tours (one folder per tour) | visible, non-archived `image`/`poster` rows with `thread_id` | owner: every tour; guide: tours where `threads.author_id` is them (same rule as `addTourPhotoAction`) |
| This tour | the same, narrowed to one tour id (creation flow) | same |
| Places (one folder per place) | visible image rows with `place_id`, no thread, no stop, on public non-archived places | owner, guide |
| General | the org's `Media/Images` in storage, minus files registered as Street View stills | owner, guide |
| My pictures | `listUserMediaLibrary(session user)` | any member (owner, guide, member) |

The org is `siteConfig.orgId` (the deployment); the person is the session; the request carries only a folder slug, a search word and a tour id, all validated. A guide's own library for tours they wrote is the same Tours library, filtered. Unregistered files in `Tours/`, `Places/` and `Stops/` are not listed: "the site never decides from a path", a file becomes a picture when someone registers it (Scan folder, or the registration step below).

**Credit, licence, alt text, `visible`.** They belong to the picture. A placement overrides the caption only. `visible` is two switches: the picture's (offered anywhere) and the placement's (shown here); both must be true. A picture's alt text is read at render time from the picture (the block can look it up by storage key).

**Privacy.**
- A `Private/` path is never served or offered: filtered in SQL (`NOT ILIKE '%/private/%'` on `storage_key` and `url`), again in code on the decoded path (`isOfferablePicture`, handles `private/`, `%50rivate`, `..%2FPrivate`), and `browseMediaFolder` skips `Private/` and dotfiles. `/api/media` applies `canReadMedia` on top. `publishPrivateFile` (`assets.ts:509`) stays the only way a Private picture becomes public (it copies, strips EXIF, and changes the *picture's* url: a read-time overlay then follows it, a copied row would not).
- Location stamps: files dropped in `Tours/`, `Places/` or `Stops/` have no `Private/` segment, so anyone with the path can fetch them. `scanFolder` therefore refuses GPS pictures (`hasGps`); the registration of `Stops/` must apply the same refusal (it does not today: `runStopsMove` moves without checking). Person-owned pictures ("My pictures") are not offered to blocks; the creation flow's server action must keep copying them through `importPhotoToOrg` (re-encoded, GPS removed).

**Existing rows.** Nothing moves and nothing is rewritten: each row's current owner is its first placement and its own picture. The 1 `image` row stays; the 96 stills, 96 streetview, 11 map3d, 16 films and 8 posters are not pictures to choose and are left out of the libraries (stills, streetview, films, map3d), except posters, which Tours lists.

**What breaks if it is done wrong**
- **Published tours (`publicTourAssets`):** if placement rows lose their own `url` before every reader overlays, the page filters them out (`a.url` is required) and a stop goes blank. Keep the cached `url` on the row (the proposal does) and overlay on top.
- **Archiving a picture:** the overlay must drop placements whose source is archived or hidden, or a withdrawn picture keeps showing (it does today with copies).
- **The stage:** `stopPhotos` currently leads with `Stops/` folder photos; if registration is switched on while that reader is still live, the same picture shows via both paths (deduped by URL: the order and captions may change). Switch the reader off in the same release.
- **Film cache:** `writeFilmCache` must still run for hero film changes; films are not part of this model and must not be turned into placements.
- **Bookings pages:** unaffected (no picture code). **Checkout/booking code:** untouched.
- **Credit:** a block that holds only a URL drops the credit; add a lookup by storage key before the Places tab is used on public pages.

### 4. The picker (built, source only)

Built on the shared one: `packages/cms-ui/src/files/MediaPicker.tsx` already takes `libraries: {key,label,endpoint}[]` and shows each as a tab beside Upload, over `MediaBrowser` (folders, search, thumbnails). So **no change to `packages/cms-ui` was needed** (no additive prop either). elktours provides the libraries:

- `apps/elktours/src/lib/media-libraries.ts` (server): `librariesFor`, `listLibrary(viewer, key, {path, q, tourId})`, `isOfferablePicture`. Takes the viewer as an argument so it is testable without a session.
- `apps/elktours/src/lib/media-libraries-config.ts` (client-safe): `PICTURE_LIBRARIES` (Tours, Places, General) and `pictureLibraries({tourId, mine})` ("This tour" first and no separate Tours when a tour is known; "My pictures" only when asked).
- `apps/elktours/src/app/api/media/libraries/[key]/route.ts`: GET `?path=&q=&tour=`; viewer from `getViewer()` (session); 401 signed out, 403 not allowed, 404 bad key/folder, `Cache-Control: private, no-store`.
- Wired into **one place as proof, which covers every elktours picture setting:** `lib/puck/config.client.ts` and `config.mobile.client.ts` now pass `libraries: PICTURE_LIBRARIES` to `buildEditorConfig({ media })` (one import line and the one value changed in each), so every `kind: "image"` prop of every block (Puck and house editor), including BLOCKS' favourite-places cover, gets Tours / Places / General with no change in their files. `components/landing/page-picture-chooser.tsx` (the direct-edit canvas chooser) is switched the same way. The old route `/api/media/library` is untouched and still used by the other forms.

**What the picker does today:** Tours lists 8 tours with registered pictures; General lists the 17 real pictures in `Media/Images` with the 96 Street View stills hidden; Places is empty because no place has a registered picture. Choosing returns the picture's `/api/media/...` URL; nothing is copied or written.

**What waits on the design decision:** (a) Places will stay empty until place pictures are registered (Scan folder after "Make missing folders", or the in-place registration); (b) the creation flow wiring: `details-step.tsx` uses the old `MediaField` and `copyPlaceAssetToStopAction`; replacing them needs the placement write (a stop row carrying the picture's pointer, not a copy of its credit), so it is described, not done. Sketch: `<MediaPicker libraries={pictureLibraries({ tourId, mine: true })} … onChange={(url) => addPlacementAction(stopId, url)} />`, where `addPlacementAction` resolves `url` to the picture row by `storage_key`, refuses a url that is not an offered picture or the person's own file, and inserts the stop row with `placed_from`. It is not a two-line change. Same for `components/mobile/tour-photos.tsx` (which already has `tourId` in scope): swapping its two tabs for `pictureLibraries({tourId, mine: true})` is two lines, but it would let a credited place picture land on a tour row without its credit, so it waits for the placement write; (c) "My pictures" is built and checked but not offered to blocks.

### 5. The move menu: what becomes of it

Do not delete it yet. What it should become, in steps, each with what must be true first:

1. **Registration in place** replaces "Move": for each of the 97 files, create the picture row where the file already is (place's picture if the file names a stop with a place, else the tour's), and a placement on the stop; no `MOVE`. Must be true first: the placement read overlay (or at least the `placed_from` column) is in; `hasGps` is applied; the stage drops `stopFolderPhotos` in the same release. Until then the old Move is the only registrar and should not be run again with `place` choices (it makes copy pairs).
2. **Retire `stopFolderPhotos`** (the path-name reader at `tour-stage-data.ts:117`) once registered, so what shows comes from rows only.
3. **The menu becomes a read-only filing view**: where each picture is stored, what uses it, which files in `Tours/`/`Places/`/`Stops/` are not yet registered (with Scan). "Make missing folders" stays (it only creates empty folders). The Move choice list (`media-folder-choices.ts`) goes away.
4. A tidy-up move (into `Places/`) can stay as an optional single button: filing only, never changes what shows, because rows then point at the file's *current* url and the move would rewrite the picture row's url in the same transaction (the overlay carries it to every placement). That is the one case where a move is safe, and it is a later option, not needed.

### 6. Migration

`MEDIA_MIGRATION_PROPOSAL.sql` (this folder): `tour_assets.placed_from uuid references tour_assets(id) on delete cascade`, a no-self check, a partial index, and a backfill from `meta.fromPlaceAssetId`. Updates 0 rows today. Optional for correctness, recommended before the 97 registrations. Not in `packages/db/migrations`.

## What was built, and proof

Files (all new unless marked):
- `apps/elktours/src/lib/media-libraries.ts`
- `apps/elktours/src/lib/media-libraries-config.ts`
- `apps/elktours/src/app/api/media/libraries/[key]/route.ts`
- `apps/elktours/scripts/check-media-libraries.mts`
- edited, one small hunk each: `apps/elktours/src/lib/puck/config.client.ts`, `apps/elktours/src/lib/puck/config.mobile.client.ts`, `apps/elktours/src/components/landing/page-picture-chooser.tsx`
- this folder: `MEDIA.md`, `MEDIA_MIGRATION_PROPOSAL.sql`

Not touched: `packages/cms-ui`, `packages/db/migrations`, any `tour_assets` row, any Nextcloud file, checkout or booking code, the tour stage and `components/tours/**`.

Type-check (`pnpm check-types`, apps/elktours): **0 errors before** (before my change, baseline clean), **0 errors after**. (One error appeared mid-way in my own route: `!res.ok` does not narrow a union without strict mode; fixed with `"listing" in res`.)

Check (`scripts/check-media-libraries.mts`, run from `~/eac` as specified): **89 passed, 0 failed.** Highlights from the output:

```
PASS  signed out: tours/places/general/mine refused (401)
PASS  outsider (no role here): tours/places/general/mine refused (403)   (no libraries offered, even asking for mine)
PASS  viewer role: tours/places/general/mine refused (403)
PASS  guide sees only tours they wrote
PASS  author 4eebc495 as guide: sees exactly their 7 tours with pictures
PASS  author fbf699b9 as guide: sees exactly their 1 tours with pictures
      owner sees 8 tour folders with pictures; guide sees 0 (wrote 0 tours)
      8 pictures across the owner's tour folders
PASS  guide cannot open a tour they did not write (empty)
PASS  owner: 'This tour' (?tour=) opens straight into the pictures, flat
PASS  guide: ?tour= of someone else's tour lists nothing
      0 place folders with registered pictures (no place has any row today)
      general lists 17 pictures and 0 folders (Street View stills hidden: 96 registered)
PASS  general: path "Private" / "private/Media" / "../Images" / ".." / "/etc" / "a/../../x" / "Media/Private" / ".hidden" returns no pictures
PASS  general: searching 'private' returns nothing from a Private folder
PASS  my pictures: only the users/ tree, none Private
PASS  isOfferablePicture: Private, private, %50rivate, ..%2FPrivate, ../Private, foreign org, http:, javascript: all refused
PASS  tour_assets, places and media are byte-identical after all of this
89 passed, 0 failed
```

Not covered by the check: the HTTP route itself (it is a thin wrapper over `listLibrary` and `getViewer`; no signed-in browser session was available), and the picker's look in a browser. A rebuild is needed for the live site to show the new tabs (not done: source only).

## Decisions applied (2026-11-21)

Source only; tsc `apps/elktours` is 0 errors; `check-media-libraries.mts` 88 passed, 0 failed (read-only, plus the register test inside BEGIN ... ROLLBACK). The migration proposal is NOT applied.

1. **The folders menu registers in place.** `/manage/media-folders` now asks "What is each picture of?": of the place (every stop there shows it), of the stop, of the tour as a whole, or "not yet". `registerInPlace` (`lib/media-folders.ts`, action `registerStopsAction`) records that on the picture's row, or makes the row if the file has none; one row per storage key (running it twice changes nothing), the file's key and url never change, nothing is moved, copied or deleted. A picture that records where it was taken is refused. Files already registered no longer appear in the list. The old `runStopsMove` stays in the source, marked retired and not called; the only move still right is a file leaving `Private/` to be shown, which `setAssetVisible` does (copy, location removed). The menu says so in plain words. `copyPlaceAssetToStop` now also refuses a second row for a file the stop already has (same source or same url). Not fully removed: until the placement link is approved it is still the one writer of a stop row that mirrors a place picture (a place picture put on a stop in the wizard or asset panel is still two rows); the menu no longer uses it.
2. **My pictures dropped** from the tour and block pictures (no library, no tab, no route key). Profile photos untouched. No new copy step; `importPhotoToOrg` and the existing `/api/media/library/mine` (phone media screen) are as before.
3. **Credit is optional.** No lookup machinery built; a later improvement: read the credit by storage key when a block draws a place picture.
4. **Guides see all tours** in the Tours library (owners too); Places and General stay open to owners and guides.
