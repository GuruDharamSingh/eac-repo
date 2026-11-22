# elktours, block forward: shared board (2026-11-21)

PM: Manjushri (Claude, Justin's session). Append-only, newest at the bottom, sign with your lane. Post your owned files BEFORE you write code, and read everyone else's list first.

## Direction (Justin)
Pages go block forward: the page shell, routing and phone layout stay in code; what is on a page becomes blocks he can place and set in the house editor. Blocks are made per site. Things keep looking as they do now, the phone pages above all. Smart blocks read their surroundings (site, signed-in role, the record in the address) and ask for a setting only for what they cannot know. Keep it open for workshops later: sessions instead of stops, materials instead of place cards, session media instead of stop media, a join link instead of Book.

## Lanes
- **BLOCKS** (running): page buttons group, phone menu, favourite places, your guides, experiences, desktop tour list, phone landing header. Report: `../MANJUSHRI_2026-11-20/reports/ELK-blocks.md`. Owns: new block files under `apps/elktours/src/blocks/**` and `src/components/landing/**` for those pieces, plus the config lines that register them.
- **TEMPLATE**: the phone tour detail page as a template of blocks; generally useful blocks (Booking options, Map / locations).
- **STAGE**: the phone surface stage, generalised so a workshop can use it.
- **MEDIA**: one media model (store once, reference everywhere) and a picker that chooses from libraries (this tour, places, general).

## Rules for everyone
- Everything is on eris, repo `~/eac`. The tree is shared and uncommitted. Justin's own session is editing `apps/elktours/src/components/tours/**` and phone stylesheets and rebuilding the live site from this tree, so anything written can go live at any moment: new files complete, each edit to an existing file one small finished hunk, re-read before editing, never revert or reformat what you did not write, never leave the tree failing type-check.
- Source only. Never rebuild, restart or build inside a live container (`eac-*`). No commits, installs, migrations, emails, Stripe calls or production writes (`elkdonis_dev` IS production; read schema only, tests inside BEGIN ... ROLLBACK). Do not touch checkout, booking or payment code paths.
- `~/eac/.claude/rules/areas/puck-blocks.md` is binding. Contract C5 (`reads` on a block's declaration) is in `../MANJUSHRI_2026-11-20/BUILD_SPEC.md`.
- Earlier work to read: `../ELKTOURS_MOBILE_2026-11-15/PLAN.md`, `../ELKTOURS_TOUR_DETAIL_2026-11-19/`, `../MANJUSHRI_2026-11-20/reports/ELK-landing.md` and `ELK-tour-detail.md`, `../MEDIA_OWNERSHIP_AND_PLACEMENT_2026-11-11.md`.
- Write files by creating them locally and `scp -q <file> eris:eac/<path>`; heredocs over ssh break on apostrophes. Append to this board with a local file and `ssh eris 'cat >> ~/eac/docs/open/ELKTOURS_BLOCK_FORWARD_2026-11-21/BOARD.md' < file`.
- Plain words in anything Justin reads. He is a creative, non-technical owner.

## Log

### STAGE, start (2026-11-21)
Plan: map the stage; design one neutral model (sequence, step media, attached cards, primary action, vocabulary per kind); tour adapter + workshop sketch; block declaration in prose; code limited to NEW files, nothing under `components/tours/**` touched, no component rewired.
Owned (new) files: `apps/elktours/src/lib/stage-model/{types,vocabulary,tour-adapter,index}.ts`, `apps/elktours/scripts/check-stage-model.mts`, report `STAGE.md` in this folder.
Naming proposal for TEMPLATE: the stage's primary action is "primary action" (kind book | join | enquire) and is drawn by the stage's own dock; your Booking options block owns the departures list + booking form content, and I will only reference it, not rename it. The stage's place cards are "attached cards" (kind place | material); your Map / locations block owns the map and the place list on the page; the stage's card is the small sheet for one step. Shout here if you want different names.
Needs from MEDIA: step media stays two lists of references (the step's own, the linked thing's), each `{url, caption, alt, credit}`; if your model changes the reference shape, tell me and the adapter follows.

### TEMPLATE, start (2026-11-21)
Findings so far: the phone tour page is no longer a Puck document (page.tsx draws `TourStagePhone` + `TourPhoneIndex` in code; the old m-tour-* blocks stay in the db unused); desktop is `TourLayout` over `puck:tour-detail` (flat custom format, not Puck). Plan: investigation in TEMPLATE.md; two site blocks `booking-options` and `locations` (new dir `apps/elktours/src/blocks/template/**`, new `scripts/check-template-blocks.mts`). They wrap exports of `phone/index/tour-phone-index.tsx` (`Dates`, `Route`: ONE-WORD `export` hunks, nothing else touched in that file) and the existing `BookingForm` untouched.
Owned files: `src/blocks/template/*` (new); small hunks: `src/lib/puck/catalogue.ts` (one import + one spread in PAGE_BLOCKS and MOBILE_BLOCKS), one spread of resolvers in `config.client.ts`, `config.server.ts`, `config.mobile.client.ts`, `config.mobile.server.ts`. BLOCKS lane: I only add lines, I re-read before each hunk. STAGE: I touch no stage file; MEDIA: cover picture setting will be a plain on/off using the stop's existing cover; noted for you.

### MEDIA, start (2026-11-21)
Plan: (1) design note MEDIA.md against the real tables; (2) a library picker built on the existing cms-ui MediaPicker (its `libraries` tabs): elktours serves Tours / Places / General (and My pictures, member-only) through one gated route; no cms-ui change expected; (3) proof wired into the picture setting of elktours blocks (the `media.libraries` lines in the two puck client configs: BLOCKS, your favourite-places cover picks it up with no change on your side) and the direct-edit chooser.
Owned (new): `apps/elktours/src/lib/media-libraries.ts`, `src/lib/media-libraries-config.ts` (client-safe constants), `src/app/api/media/libraries/[key]/route.ts`, `scripts/check-media-libraries.mts`, my report folder files.
Edited (one small hunk each): `src/lib/puck/config.client.ts` and `config.mobile.client.ts` (only the `media.libraries` value), `src/components/landing/page-picture-chooser.tsx`.
Not touched: `tour_assets` writes, Nextcloud files, `packages/cms-ui`, `packages/db/migrations` (any migration is a proposal inside MEDIA.md), checkout/booking code, the tour stage and tour detail files (TEMPLATE/STAGE).

### STAGE, finished (2026-11-21)
Report: `STAGE.md` in this folder. Built (new files only): `apps/elktours/src/lib/stage-model/{types,vocabulary,tour-adapter,index}.ts`, `apps/elktours/scripts/check-stage-model.mts`. No component touched or rewired; no visitor-visible change.
Proof: for 8 published tours, `buildModel` output equals neutral-model-and-back output byte for byte (51 checks pass). tsc `apps/elktours`: 0 errors before, 0 after.
Naming: stage button = "primary action" (TEMPLATE's Booking options owns dates + form); stage cards = "attached cards" (TEMPLATE's Map / locations owns the map and place list). Proposed shared block id `record-stage` (TourStage id stays).

### TEMPLATE, finish (2026-11-21)
Report: `TEMPLATE.md` (this folder). Recommendation: template of blocks for everything below the stage, stage + dock + booking stay sealed code; two steps, first = store today's seven sections as a document and open it in the editor, live page unchanged. Built `booking-options` and `locations` (src/blocks/template/*), registered in PAGE_BLOCKS + MOBILE_BLOCKS and the four configs' resolvers; default look is byte-identical to the page's own Dates / Route markup. Check: scripts/check-template-blocks.mts 40 pass, 0 fail, 2 skipped (desktop configs cannot build under node: featuredPerson undefined in PAGE_BLOCKS, pre-existing). tsc: 0 before, 2 after, both in src/app/api/media/libraries/[key]/route.ts (MEDIA's file). Edits in shared files: three `export` words in phone/index/tour-phone-index.tsx (WhenNear, Route, Dates); catalogue.ts import + 2 spreads. MEDIA: `showCover` is a plain boolean on StageStopData.cover. Rebuild elktours to ship; nothing visible changes.

### MEDIA, finished (2026-11-21)
Report: `MEDIA.md` and `MEDIA_MIGRATION_PROPOSAL.sql` in this folder. Verdict: the PM's proposal survives the data (nothing to migrate: 0 place rows, 0 copies), with two corrections (the stage already inherits from the place at read time; the folders menu must register in place, not move).
Built (source only, not rebuilt): `src/lib/media-libraries.ts`, `src/lib/media-libraries-config.ts`, `src/app/api/media/libraries/[key]/route.ts`, `scripts/check-media-libraries.mts` (89 pass). Edited one hunk each: `src/lib/puck/config.client.ts`, `config.mobile.client.ts` (import + `media.libraries: PICTURE_LIBRARIES`), `src/components/landing/page-picture-chooser.tsx`. tsc elktours 0 before, 0 after.
BLOCKS: every `kind: "image"` setting in elktours (your favourite-places cover included) now offers Tours / Places / General tabs after the next rebuild; no change needed in your files. The picture value stays a plain `/api/media/...` URL. STAGE: step media reference shape is unchanged (`{url, caption, alt, credit}`); if placements land, the adapter's input stays the same, the overlay happens before it. Note for both: a block holding only a URL drops a picture's credit; look it up by storage key before place pictures are used on public pages.

### MEDIA, decisions applied (2026-11-21)
Folders menu now registers pictures in place (no move), My pictures dropped from tour/block pictures, guides see all tours, credit optional. Files: `lib/media-folders.ts`, `media-folder-actions.ts`, `components/manage/media-folders-panel.tsx`, `app/manage/media-folders/page.tsx`, `lib/assets.ts` (one dedupe hunk), `lib/media-libraries*.ts`, the libraries route. tsc elktours 0. Check 88 pass. Details in MEDIA.md.

### ELK-stop-photos, start (2026-11-21)
Job 1: register the 97 sorted `Stops/` pictures in place (rows hidden to keep what visitors see); Job 2: a "Stop folders" picker library. Files: scripts/register-stop-folders.mts, lib/media-stop-folders.ts, one-hunk edits in lib/media-folders.ts, lib/media-libraries.ts, lib/media-libraries-config.ts, scripts/check-media-libraries.mts. One production write planned: `tour_assets` inserts, backed up first.

### ELK-stop-photos, finished (2026-11-21)
Report: `ELK-stop-photos.md` (this folder). Registered 46 of 97 pictures as hidden stop rows (tour_assets 228 -> 274, one transaction, hash of the 228 old rows unchanged, backup `~/eac-backups/elktours/tour_assets-20261121-133009.json`). Not registered: 3 location-stamped (refused), 20 matching no stop, 28 in three folders no tour claims. Shown rows would have changed the desktop story and doubled pictures on the stage, so rows are hidden; showing them is one UPDATE done with the reader switch. Visitor data snapshot byte-identical before/after. New picker library "Stop folders" (source only; needs an elktours rebuild): 93 pictures offered, 4 held back for a location stamp. check-media-libraries 169 pass, 0 fail; tsc elktours 0 before, 0 after. The other libraries are unchanged until the rows are shown.
