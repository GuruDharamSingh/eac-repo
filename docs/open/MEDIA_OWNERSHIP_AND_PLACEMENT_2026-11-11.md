# Media: ownership, sites and placement (2026-11-11)

Design note, written after Jason Ford's artworks showed as broken images on
ifacgroup.com. It covers where a file is stored (ownership), which site may serve
it, and how a site chooses what to show (placement). The current state comes from
the code, read-only queries on `elkdonis_dev`, and requests through the edge, all
on 2026-11-11. No code or data was changed. The decisions in section 5 belong to
the developer.

## 1. Summary

The documented rule is already "principal-canonical": a person's work goes in
`users/<storage_folder>/` and an org's assets in `<org_id>/`
(`docs/reference/nextcloud.md:61-66`). Three things work against it:

1. Uploads pick a folder by context, not by owner:
   - the acting org's slug (`/api/upload/image`);
   - `oad` for "Just me" in the Studio;
   - `artdirect/` from older ArtDirect imports.
2. Each app's media route serves only its own org folder plus `users/`. A stored
   `/api/media/...` URL therefore works on some hosts and returns 404 on others.
3. What a site shows is mostly derived, not chosen:
   - `users.portfolio` is one list, read by about seven apps;
   - `user_galleries.hidden_on` is opt-out, so a gallery shows everywhere unless
     it is hidden somewhere.

The model proposed here uses three nouns, each with one rule:

- **Library:** one per principal. A file is stored in its owner's library.
- **Site:** an org's public face. A host resolves to one org.
- **Placement:** a site's own list of references into libraries. It is opt-in per
  site and is never inferred from the storage path.

Pieces (threads) already work this way: a personal piece is homed in `oad` and
listed on orgs through `thread_orgs`, with approval since migration 261. Media
should follow the same pattern.

## 2. Current state

### 2.1 Broken images

Each case below was checked through the edge or against the database on
2026-11-11.

| What | Stored under | Result |
|---|---|---|
| Jason Ford's 4 portfolio images (`users.portfolio`) | `EAC_Network/artdirect/` | 404 on ifacgroup.com; served by ArtDirect only |
| `astrology-reading` service cover (org `inner_group`) | `EAC_Network/inner-gathering/` (the org's slug) | 404 on elkdonis-arts.org, 200 on arts-collective.com |
| Personal (`oad`) writing pieces, 4 sampled | `ifac/Media/Images`, `hidden-enneagram/studio/covers`, `4th-way-book-readers/studio/covers` | 404 through directory.arts-collective.com, which is where a "Just me" piece is shown |

Two of the four sampled pieces are tests (`test`, `untitledsdfsdf`). The other two
were published 2026-11-09 and 2026-11-11.

Per-host results come from requesting the image URL directly. The rendered pages
were not inspected.

### 2.2 Where references point (row counts, 2026-11-11)

**`users.portfolio`**
- 104 items across 16 people point into `users/`.
- 4 items (Jason only) point into `artdirect/`.

**`users.avatar_url`**
- 22 point into `users/`.
- 4 point into `inner_group/`.
- 3 are external URLs.
- 90 are empty.

**`org_profiles.photo_override`**
- 5 are bare app paths (`/steph-1.jpg`).
- 1 points into `amrit_canada/`.

**Images in threads that are outside the thread's own org folder**

These come from `body`, `metadata` and `body_doc`. 11 groups of threads are
affected, mostly personal pieces using an org's file:
- `ifac` 8
- `inner-gathering` 15
- `4th-way-book-readers` 9
- `inner_group` 4
- `amrit_canada` 4
- `hidden-enneagram` 2
- `oad` 3

**`media` table**
- Most rows point into the row's own org folder.
- 11 `ifac` rows and 2 `danamccool` rows point into `users/`. These are personal
  files, indexed under the org where they were uploaded.

**`user_galleries`**
- Dana has 10 galleries with `origin=danamccool` and `hidden_on={ifac}`.
- She also has 12 `is_backing` galleries with `origin=ifac` (the IFAC store panel).

**Top-level folders compared with org ids**
- `artdirect` exists beside `oad`.
- `inner-gathering` exists beside `inner_group`.
- `4th-way-book-readers` exists beside `fourth_way_book_readers`.
- Test folders: `brief_a_test`, `claude-test-*`.
- Orgs whose slug is not their id: `amrit_canada`, `elkdonis` (slug
  `arts-collective`), `fourth_way_book_readers`, `inner_group`, `BuddhasEngines`.

### 2.3 Serving bounds per app (`allowedPrefixes`)

| App | Serves |
|---|---|
| arts-collective, art-auction | all of `EAC_Network/` |
| artdirect | `artdirect/`, `users/`, `oad/` |
| ifac | `ifac/`, `users/`, plus orgs owned by IFAC-listed people |
| danamccool, innergathering, katie-the-potter, fourthwayBookreaders | own org, `users/` |

Every route then applies `canReadMedia` (`packages/services/src/media-authz.ts`),
which is the same function on every host:
- Public paths are open to anyone.
- `Private/` org paths need affiliation with that org.
- `Private/` user paths need the owner or a shared org (`oad` excluded since
  2026-11-11).

The `serveMedia` comment calls the prefix list "a subtree bound only". Two
consequences follow:
- **Public files gain no confidentiality from the per-app bound.** Every public
  file is already readable through arts-collective.com/api/media/ (verified above:
  200).
- The bound adds defence in depth only for `Private/` paths, in case
  `canReadMedia` has a bug.

### 2.4 Upload paths: where each one files a person's work

**Into the person's library (correct)**
- ifac `/api/upload` and artdirect `/api/upload`.
- danamccool and katie-the-potter `/api/media/upload`. These file into the
  *site owner's* library.
- art-auction uploads.
- `center/avatar` (7 apps).
- arts-collective `/api/my-files`, `studio/recordings`, `broadcast/camera-upload`.
- Studio reels for "Just me" (`reels.ts` `personalRoot`).

**Into an org folder by context (the source of the strays)**
- arts-collective `/api/upload/image` writes to `EAC_Network/<org.slug>/<context>/{covers|videos}/`.
  - Callers: Studio, compose, Puck, `CoverImageUpload`, the silex embed.
  - With "Just me" the acting org is `oad`, so a person's covers land in
    `oad/studio/covers` or `oad/social/covers`.
  - The slug differs from the id for five orgs, so the files land in folders that
    the org's own app does not serve.
  - Another session edited this route on 2026-11-11 (uncommitted): it added
    validation of `context` and switched to `org.slug` from the database.
- Older ArtDirect imports wrote to `artdirect/`. The current route writes to
  `users/` (its header comment describes this bug).

**Org uploads (correct by owner)**
- amrit-canada, elktours and sunjay `/api/upload` (byte-identical).
- innergathering and hidden-enneagram `/api/upload`.
- series-site `/api/media/upload`.
- `uploadOrgFile` users: ifac `hub/upload`, arts-collective `org/[slug]/files`,
  fourthway `/api/upload`.

**Security finding.** `packages/blog-server/src/media.ts:191` takes `orgId` from the
form and checks only that the request is signed in. Any signed-in user could write
into any org's tree. Only blog-guru-dharam and blog-tester use it, and neither is
running.

### 2.5 Placement today: what decides what a site shows

| Content | Mechanism | Opt-in or derived |
|---|---|---|
| Pieces (threads) | homed in one org; `thread_orgs` lists them on others, with approval (261) | opt-in |
| Person on an org | `org_profiles.is_public`, `self_hidden`, listing requests (149) | opt-in |
| Person-page sections per org | `org_profiles.sections` over `users.profile_sections` (166, `presence.ts`) | switch per org |
| Portfolio | `users.portfolio`, one list read by ifac, artdirect, arts-collective `/artists`, innergathering and sunjay `/about`, blocks `person-page` | derived: an upload anywhere shows everywhere |
| Galleries | `user_galleries.hidden_on`; empty means "every site that reads it" | opt-out; Dana's own-site galleries are hard-coded to start with `{ifac}` |
| IFAC store panel | `user_galleries` rows with `origin=ifac`, `is_backing` (158/160) | per-site list (a working example of a placement) |
| Site imagery | `site_config` (`puck:*`, `image_spaces`, `home_hero`), `threads.metadata.coverImage` | per-site |

The "Where you show" matrix (`packages/services/src/presence.ts`) is the person's
control surface for all of this. Its gallery row writes both `org_profiles.sections`
and `hidden_on`.

### 2.6 Pickers and libraries

**Current shared components (`packages/cms-ui`)**
- **`MediaPicker`** (`files/MediaPicker.tsx`) has an Upload tab and library tabs.
  Its header names it the replacement for `@elkdonis/ui` `MediaUpload` and
  `FileBrowser`. It is used in 8 apps, Puck `image-field`, series-site, `CoverField`
  and the Studio forms.
- **`MediaBrowser`** browses folders. It powers the Studio drawer "Library"
  (tabs `mine` = `/api/my-files`, `org` = `/api/media/library?org=`) and the reels
  slot library.
- **`LibraryPicker`** is a multi-select picker. Only `ProfileGallery` uses it
  (ifac, artdirect, danamccool, blocks).

**Older components still in use**
- `components/manage/media-field.tsx` ×4 (amrit-canada, elktours, innergathering,
  sunjay). `MediaPicker` says it replaces these, but they are still imported by
  `content-form.tsx`.
- ifac `image-upload-field.tsx`.
- ifac's own `hub/FilesCard.tsx`. It has the same name as the cms-ui component but
  is a different one.

**Older components with no importer**
- `packages/ui` `profile-gallery.tsx`.
- `packages/hooks/useNextcloudFiles`.
- `packages/nextcloud` `FileUploader`.
- admin `file-browser.tsx`.

**Two meanings of "my library"**
- On innergathering and sunjay, `media/library/mine` means the *viewer's* files.
- On danamccool and katie it means the *site owner's* files.

**Content library**
- `@elkdonis/content` (`ContentLibrary`, `ContentDetail`;
  `CONTENT_LIBRARY_COMPONENT_2026-11-08.md`) lists pieces (threads, artwork), not
  files.
- Its model already carries `owner`, `presentedBy` and `site`. These are the same
  three nouns as this note, applied to pieces.
- `studio_items` (248) records file lineage. No UI reads it.

## 3. Proposed model

### 3.1 Library: where a file is stored

- One library per principal:
  - a person: `EAC_Network/users/<storage_folder>/`;
  - an org: `EAC_Network/<org_id>/`, by **id, never slug**. `orgStorageRoot`
    already does this.
- Choose the folder by who owns the work, not by which app or acting org received
  the upload:
  - **A person's own work** (portfolio, gallery, avatar, a "Just me" Studio piece
    and its pictures, social post images) goes in the person's library, whichever
    site they are on.
  - **An org's assets** (logo, banners, site imagery, covers of the org's own
    events and pages, workshop materials), uploaded by an owner or guide, go in
    the org's library.
  - **A personal site org** (danamccool, katie-the-potter, stonebalancing, saw,
    surrealistwriting) puts the person's work in the owner's library, as the
    danamccool and katie upload routes already do. The org folder holds site
    chrome only.
- `oad` is not a storage location for a person's work. Network-wide libraries
  (`oad/Private/Music`, `Sounds`) stay where they are. A "Just me" upload goes to
  the person.

### 3.2 Site: who may serve it

Any network site should be able to display any public file a placement points at.
The per-app bound stays only where it adds protection:

- **Public paths:** every app serves all of `EAC_Network/`. This costs no
  confidentiality (section 2.3).
- **`Private/` paths:** keep the per-app bound (own org, `users/`), with
  `canReadMedia` deciding as now.

This would be one option on `serveMedia`, for example `privatePrefixes` beside or
in place of `allowedPrefixes`, plus one line in each app's route. It fixes every
row in section 2.1 without moving a file. Each app picks it up on its next rebuild.

### 3.3 Placement: what a site shows

A placement is a site's own list of references into one or more libraries:

- It is opt-in. Nothing appears on a site until someone chooses it there.
- It is stored with the site context, never inferred from the folder.
- Uploading on a site files the file in the owner's library **and** adds it to
  that site's list only.
- "Add from library" on a site uses the picker to add files the person already
  owns. That covers Dana's case: her danamccool work is in her library and is
  offered on IFAC, not shown there automatically.

Concretely:

- **Portfolio per site.** Add `org_profiles.portfolio jsonb` (`org_profiles` is
  already the per-person, per-org presentation row: `bio_override`,
  `photo_override`, `sections`).
  - NULL or empty means nothing is shown. It does not fall back to the person's
    list.
  - Seed it once from `users.portfolio` for each org where the person is shown
    today, so nothing changes visibly at cutover.
  - `users.portfolio` stays as the list for the person's own page (ArtDirect
    `/<slug>`, decision 5 of `PERSON_PAGES_BRIEF_2026-09-26.md`).
- **Galleries per site.** Replace opt-out `hidden_on` with opt-in `shown_on text[]`.
  The origin site is implied.
  - Seed it from the current effective state: every site that shows the gallery
    today.
  - Dana's hard-coded `{ifac}` default disappears, because every gallery now starts
    on its origin site only.
- **Site-specific collections** (the IFAC store panel) stay as `user_galleries`
  rows with `origin=<site>`. They are already placements.
- The "Where you show" matrix writes these lists. Its Portfolio and Galleries rows
  per org become "N of M shown — choose".

### 3.4 One picker, two named libraries

- The picker is `MediaPicker`, with a multi-select mode taken from `LibraryPicker`.
  `ProfileGallery` then uses `MediaPicker` too.
- Its tabs are named libraries, not "mine" or "org":
  - **Your files:** always the viewer's library.
  - **`<Site>` files:** the site's library. That is the org folder for a group
    org, and the owner's library for a personal site, offered only to the owner
    and the site's editors.
- One listing route per library, shared through a route factory: the viewer's
  library and the site's library. This replaces the 8 copies of `media/library`,
  the 4 meanings of `mine`, ifac `my-media` and arts-collective `my-files` GET.

## 4. Path, in phases

**Phase 0: serving (no file moves, no schema)**
- 2026-11-11: the ten live apps' media routes serve all of `EAC_Network/`
  (decision 1). `check-types` passes in all ten. Rebuilt and restarted the same
  day: ifac (`lW7b4dufFEZH12dvwPdTP`), artdirect (`yidTWxjut8MYFafrp5Cgn`) and
  innergathering (`AyY1fZfdbm-s1W6XgRMhM`); `.next` backups in
  `~/eac-backups/next/*-20261111-160[28].tgz`. Verified through the edge:
  - Jason's 4 images return 200 on ifacgroup.com, and `/artists/jason-ford`
    references them;
  - the 4 sampled personal-piece images return 200 on
    directory.arts-collective.com;
  - the `astrology-reading` cover returns 200 on elkdonis-arts.org (the page that
    shows it was not located);
  - a real `Private/` file (`inner_group/Private/Media/…/eac-logo.jpg`) still
    returns 404 to a signed-out request on all three hosts.

  The other seven apps (danamccool, katie-the-potter, fourthwayBookreaders,
  amrit-canada, elktours, hidden-enneagram, sunjay) carry the change in source
  and pick it up on their next rebuild.
- ~~Add a public-path bypass to `serveMedia` and use it in every app's route.~~
- Fixes Jason's images, the `astrology-reading` cover and personal pieces on
  ArtDirect.
- Each production-mode app needs a rebuild.

**Phases 1-2 status (2026-11-11)**
- Migration 264 applied at 21:22 UTC, by itself, through a one-file copy of the
  runner's apply step. 263 (`own_app_domains`, another session) was left pending.
  Seeded 45 `org_profiles.portfolio` rows and 23 `shown_on` arrays. A dry run
  first found 0 visibility differences over 170 gallery/site pairs.
- In source and type-checked in 12 apps:
  - `/api/upload/image`: files by org id; "Just me" goes to the person's
    `Media/Images|Videos`.
  - blog-server upload: the deployment's org only, members only.
  - `ORG_PROFILE_COLS` reads `org_profiles.portfolio`.
  - `setOrgPortfolio` and `appendOrgPortfolio`.
  - `mergeProfile` carries the org portfolio.
  - Galleries filter on `origin` or `shown_on`.
  - The presence matrix counts and toggles `shown_on`, keeping `hidden_on` in
    step.
  - IFAC: upload, editor, directory admin and hub-data use IFAC's list; "Add from
    library" on the artist portfolio; galleries created with `origin = 'ifac'`.
  - Dana's "Show on IFAC" toggle uses `shown_on`.
- Live:
  - ifac: `uR9mJhZBGY3iboS-5-zcn`.
  - danamccool: `uo2F17Blqx0QeFxE_Ml4-`.
  - arts-collective: `e10zbHNAoPmdvGqbp5h6Q`, built by the Studio form session
    from the tree at about 16:30 EST, including the upload route and presence
    changes.
- Verified:
  - through the edge: Jason's 4 images on `/artists/jason-ford`, Kevin Meadows'
    first IFAC item on `/dealers/kevinmeadows`, Dana's front page, a signed-out
    `/api/upload/image` returning 401;
  - read-only service probes: org-profile portfolio, person page, gallery
    listing, presence.
- Not verified signed in: no upload, portfolio save or gallery toggle has been
  exercised.

**Review findings (2026-11-11, after phases 1-2)**
1. **Resolved 2026-11-11 (developer chose "build choosers").** Each site
   that draws the shared person page now has a chooser.
   - Shared code:
     - `sitePortfolioRoutes({ orgId, who })` in
       `packages/services/src/site-portfolio.ts`, mounted at
       `app/api/center/portfolio`: GET library, PUT save, POST upload into the
       person's folder.
     - `SitePortfolioEditor` in `@elkdonis/cms-ui/gallery`: a ProfileGallery
       with "Add from files" (the ArtDirect list plus their own
       `Media/Images`).
     - Shown to the person or a global admin only (`canEditProfile`).
   - Wired on:
     - sunjay and innergathering `/about/[slug]` (`featured` prop);
     - hidden-enneagram's `HePerson` page shape (not inside the Puck canvas).
   - Live:
     - sunjay `FyPO7dyVjV1EiYDYePgi2`, built with
       `NODE_OPTIONS=--max-old-space-size=4096 NEXT_BUILD_CPUS=2` after the
       default build ran out of heap;
     - innergathering `7U2mfk_b6WTe6ha3gXsoj`.
   - Verified on sunjay with a throwaway password account (removed afterwards
     from `public.users` and GoTrue):
     - page 200 with the editor signed in, 404 signed out;
     - library GET 200;
     - another person's slug 404 (GET and PUT);
     - a foreign URL refused 400;
     - an SVG refused 415;
     - a screenshot of the editor and the library picker, with no console
       errors.
   - Source only, not built (a rebuild command was refused by the permission
     check):
     - PUT accepts only the person's own folder, their home list or the site's
       current list. The live builds still accept any
       `/api/media/EAC_Network/` path.
     - The hidden-enneagram chooser.
   - Not exercised: a real upload (it would create a folder and an ArtDirect
     listing for the test account).
   - 2026-11-11 17:15-17:25 EST, rebuilt on the developer's word:
     - sunjay `GG_g-_iEjJynUxsPCOq4C` and innergathering
       `CNYmH_t5q4NRepZTACU9u`, both with the tighter save rule; pages and
       the route checked through the edge.
     - hidden-enneagram built (`zv7VRwZIpfe85zV2Ls_2v`): the chooser route
       returned 401 signed out, and the record-blocks session's service page
       passed its checks. But `/` returned 500. I restored
       `x1208XcyQNNKDLCCERj2y` (16:08) and `/` still returned 500, so the
       cause is the stored `puck:home` (saved 16:25 EST): a box `look.items`
       collides with the box's `items` slot in Puck's `resolveAllData`
       (rule added to `.claude/rules/areas/puck-blocks.md`). Reported to the
       editor-first session.
     - Fixed by the editor-first session (a5d0b696: `buildPuckConfig` gives
       `look` a hidden object field). Rebuilt 17:22 EST
       (`gOu_Jk0nrmPOt8j_70rH3`) with the chooser and the record-blocks
       service page. Checked through the edge: `/` 200,
       `/api/center/portfolio` 401 signed out. The hidden-enneagram
       chooser has not been opened signed in.

   Original finding: **Only IFAC can choose its portfolio.** innergathering, sunjay and
   hidden-enneagram `/about/<slug>`, amrit-canada, elktours and elastrocal read
   `OrgProfile.portfolio` too, but have no chooser. innergathering's page links
   "Edit your profile on ArtDirect", and ArtDirect writes `users.portfolio`. On
   each of those apps' next rebuild, its list freezes at the 2026-11-11 seed and
   new members show none. Open decision:
   - keep "NULL follows the home list until the site chooses", with IFAC's rows
     its own; or
   - build a chooser for every site (shared person page or the presence matrix).
2. Fixed: IFAC created galleries with no `origin`, so under `shown_on` a gallery
   made on IFAC would not have shown there. No gallery was created between 264
   and the fix.
3. "Just me" uploads no longer need `oad` membership. Through `createUserFolder`
   they mark the person as an artist (`markArtistByFolder`), which is the existing
   rule for every upload to a person's folder. People who were refused before are
   now listed on ArtDirect when they upload.
4. IFAC directory admin no longer writes `users.portfolio` for new placeholder
   artists. Their ArtDirect page shows no portfolio until claimed or set there.
5. Builds made before 264 still filter galleries on `hidden_on`. Presence and
   Dana's toggle write both columns; a new gallery shows everywhere on those
   builds until they are rebuilt.
6. Existing, not caused by this change: `/api/media` on any host serves
   `fourth_way_book_readers/Private/Circles/akhand-path/…` to any affiliate of
   that org (`canReadMedia`), while `circle-file` admits only its readers
   (`paathFileAllowed`). Assumed from the code; not requested.
7. IFAC manage text said the portfolio is edited on ArtDirect; corrected
   (`manage/page.tsx`, `directory-manager.tsx`).

**Phase 1: filing new uploads by owner**
- `/api/upload/image`:
  - use `org.id`, not `org.slug`;
  - send "Just me" (`oad`) uploads to the uploader's library.
- Fix or remove `blog-server` `createMediaUploadHandler`.
- Reword "Just me" in the Studio host comment (`studio/page.tsx:187-190`).
- Coordinate with the session that is editing `/api/upload/image` today.

**Phase 2: placement**
- One migration: `org_profiles.portfolio`, `user_galleries.shown_on`, and seeds
  from the current effective state, dry-run first.
- Readers switch: ifac directory, `person-view`, `hub-data`; innergathering and
  sunjay `/about`; blocks `person-page.server.ts`.
- ifac `/api/upload` `target=gallery` appends to IFAC's list, not to
  `users.portfolio`.
- The presence matrix gains choose-from-library for both rows.

**Phase 3: moving strays (optional after phase 0)**
- Copy files from `artdirect/`, the slug-named folders, `oad/studio`, `oad/social`
  and Jason's `artdirect/` images into the owners' libraries, then rewrite the
  references (users, threads, `site_config`, `media`) in one transaction per batch.
- Worth doing for ownership reasons (export, deletion, quota, private moves). Not
  needed for display once phase 0 is in.

**Phase 4: components**
- Retire `manage/media-field.tsx` ×4 in favour of `MediaPicker`.
- Fold `LibraryPicker` into `MediaPicker`.
- Delete the unimported legacy components.
- One upload route factory per library kind, over `uploadUserFile` and
  `uploadOrgFile`.

## 5. Decisions for the developer

1. ~~Serving: public files from all of `EAC_Network/` on every app, with `Private/`
   bounded per app (recommended), or the full `EAC_Network/` bound everywhere, or
   keep the per-app bounds and move files instead.~~ Decided 2026-11-11 (developer):
   every app serves all of `EAC_Network/`; `Private/` is a separate space from
   other media, not a vault that needs a per-app bound. `canReadMedia` still makes
   the per-file decision on every host. Phase 0 below.
2. Per-site portfolio: `org_profiles.portfolio` (recommended), or one
   `user_galleries` row per site. **Decided 2026-11-11 (developer):
   `org_profiles.portfolio`.**
3. Whether `users.portfolio` stays the person's home list (ArtDirect `/<slug>`,
   arts-collective `/artists/<slug>`), or ArtDirect also gets a per-site list.
   **Decided 2026-11-11 (developer): it stays the home list.**
4. Galleries: flip to opt-in `shown_on`, seeded so nothing visible changes.
   **Decided 2026-11-11 (developer): opt-in `shown_on`.**
5. Personal site orgs: confirm that the person's work is stored in the person's
   library and the org folder holds site chrome only (current practice on
   danamccool and katie). **Decided 2026-11-11 (developer): confirmed.**

## Open questions

- The role of the `media` table:
  - It is an org-library index plus `attached_to`.
  - Personal uploads write no row (`uploadUserFile`), except ifac's, which index
    personal files under org `ifac`.
  - Options: keep it as the org-library index only, or add `owner_kind` and
    `owner_id`.
- The 4 `inner_group/` avatars and the 5 bare-path `photo_override` values (app
  `public/` files) were not checked on each host.
- Whether `parseMediaPath` should map a legacy slug folder (`inner-gathering`) to
  its org for `Private/` checks. Today such a path fails closed for everyone.
- `org_profiles` and `user_organizations` disagree on who is shown and who is a
  member (`media-authz.ts:20-22`). Placement keyed on `org_profiles` inherits that.
