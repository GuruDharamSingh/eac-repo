# ELK-stop-photos (2026-11-21)

Job 1: register the sorted pictures where they sit. Job 2: a "Stop folders" library in the picker.

## Decision that shapes Job 1: the rows are written hidden

The rule was that visitors must see exactly what they see now. Writing the rows as shown (`visible = true`) cannot keep that:

- A shown image row on a stop is read by `publicTourAssets` (`lib/assets.ts:176-181`) and drawn by the desktop tour story (`components/tours/tour-story.tsx:31`) and, for tour-level rows, by the phone gallery (`lib/puck/mobile-tour.ts:50`). Those readers do not read the Stops folder today, so shown rows would add pictures to the desktop page.
- On the phone stage the same picture would also arrive a second time: the folder reader's URL ends `?w=1024` and a row's URL does not, so `tour-stage-data.ts:153-160` (dedupe by URL) would not drop it.
- A place-owned row would additionally show on other tours that stop at the same place (`placePhotos`) and on the place's page.

So `registerInPlace` was used with `visible: false` and an explicit `position` (the stage's order: file-name order within each stop). A hidden row is read by none of those readers, so no page changes. When the stage and tour story move to rows, one UPDATE (`visible = true` for these ids) plus switching the folder reader off in the same release completes it; the rows already carry the stage's caption, credit and order. No option with shown rows keeps today's output, so shown rows were not written. Because the picker's Tours and Places libraries list only shown rows, they do not list these pictures yet; the new Stop folders library lists them now.

Owner of each row: the stop (`choice: "stop"`, thread + stop). The place-owned choice was not used, for the leak into other tours described above, so Places is unchanged.

## Dry run (what the plan said)

Source of truth for "which tour and stop": the stage itself (`loadTourStageData` -> `stopFolderPhotos` -> `matchStopFolder`), run for every non-archived tour with the stage's own stop list. No second matcher. 97 files in `Stops/`: 69 in the 8 folders a tour claims, 28 in 3 folders no tour matches.

| Folder | Tour (published) | Stop: files |
|---|---|---|
| ILEDELACITE | Île de la Cité | Sainte-Chapelle 2, Conciergerie & Palais de Justice 3, Place Dauphine 1, The bouquinistes 1 (1 unplaced) |
| NAPOLEON | L'héritage de Napoléon | Place Vendôme 1, Rue de Rivoli and the Tuileries 3, Hôtel des Invalides 2 (3 unplaced) |
| LEGENDS | Legends, Symbols & Saints | Notre-Dame 1, Sainte-Chapelle 1, Tour Saint-Jacques 2, Maison de Nicolas Flamel 1, Square du Temple 2 (6 unplaced) |
| MONTMARTRE | Montmartre | Clos Montmartre 1, Rue de l'Abreuvoir 1, La Maison Rose 1, Place du Tertre 1, Place des Abbesses 3, Moulin Rouge 2 (0 unplaced) |
| FOODTOUR | Parisian Food Tour | Top of Rue Montorgueil 3, Stohrer No. 51 1 (3 unplaced) |
| FRENCHREVOLUTION | The French Revolution | Place de la Bastille 1, Les Tuileries 1, Hôtel des Invalides 1 (7 unplaced) |
| LATINQUARTER | The Latin Quarter | Place Saint-Michel 1, Rue de la Huchette 1, Panthéon 1, Saint-Étienne-du-Mont 2, Rue Mouffetard 1 |
| MARAIS | The Marais | Place des Vosges 2, Rue des Rosiers 2, Rue François Miron 1, Maison de Nicolas Flamel 2 |

Totals: 49 placed on a stop, 0 already had rows, 46 to register, 3 refused (location stamp), 20 unplaced, 0 shared between tours.

## What was registered (real run)

One transaction, committed. `tour_assets` rows: 228 before, 274 after (+46 = the plan). Hash of all 228 pre-existing rows (md5 over every row's text, ordered by id): `5aff77a5cc8e1d40aca5452fe1c93240` before and after, identical. 0 updated, 0 already, 0 failed. Rows: kind image, source `folder`, storage_key and url as the file sits, `visible = false`, position 0..n per stop, caption and credit as the stage draws them. Nothing in Nextcloud touched.

Per tour: Île de la Cité 7, Napoléon 6, Legends 7, Montmartre 8, Food Tour 4, French Revolution 3, Latin Quarter 6, Marais 5. Running the dry plan again afterwards: 46 already have rows, 0 to register (idempotent).

Undo, if ever wanted: `scripts/register-stop-folders.mts --undo <comma-separated ids>` (deletes exactly those hidden folder rows in a transaction). The ids are the `added` list in the run output (`~/scratch/elk-stop/run.txt`, on eris).

## Backup

`~/eac-backups/elktours/tour_assets-20261121-133009.json` on eris: 228 rows, org `elktours`, taken just before the run.

## Refused, unplaced, not reached

Refused (location stamp, not overridden; for Justin to move into Private/ or replace):
- `ELKDONISEXPERIENCES_MONTMARTRE/Moulin_Rouge_in_Paris_-_6.jpg`
- `ELKDONISEXPERIENCES_MARAIS/Rue_des_Rosiers_1,_Paris_September_23,_2012.jpg`
- `ELKDONISEXPERIENCES_MARAIS/Détail_de_la_façade_de_la_Maison_Nicolas_Flamel.jpg`
- The Stop folders library also holds back `FOODTOUR/Planche_charcuterie-fromage_Café_de_la_Crèche_(Lyon)_juin_2023.jpg` (found to carry a location when listed; it is one of the unplaced files).

Unplaced (no stop name matches; not registered; the stage shows them in the overview as it does today): 20 files: Île de la Cité 1 (`Pont_Neuf,_Paris_1er_001.jpg`); Napoléon 3 (Appiani portrait, `Napoléon_à_Brienne-1.png`, `Tombeau_de_Napoléon.jpg`); Legends 6 (`$_57.jpg`, `Alchemy.webp`, King Louis IX, Lutetia map, `images.jpg`, `namausensis.webp`); Food Tour 3 (Brisolée, Planche charcuterie, Torta Baba); French Revolution 7 (Marie-Antoinette, `3a8085_...mv2 copy.jpg`, Arrestation de Robespierre, Robespierre, Bouchot, `images copy.jpg`, `images-1 copy.jpg`). Reason for all: the file name (and its Wikimedia Commons title) shares no distinctive word with any stop or its place.

Not reached by any tour: 28 files in three folders no tour name matches: `ELKDONISEXPERIENCES_PERELACHAISECEMETARY` 6, `ELKDONISEXPERIENCES_TuileriesGardens` 8, `ELKDONISTOURS_ARCHITECTURALADVENTURE` 14. The stage does not show them today. They are offered in the Stop folders library under "Not matched to a tour".

## Before and after proof

- Data: `--snapshot` prints what the tour pages are built from (stage stop pictures, place pictures, overview pictures, covers, `stopImages`, gallery images, stills, poster) for the 8 published tours. Two runs before the write were byte-identical (md5 `d72d3bb7...`); the run after the write is byte-identical to them.
- Screenshots (signed out, public site, Île de la Cité and Marais tour pages, 390 and 1440 wide, two "before" sets, three "after" sets): the pages carry parts that change between visits on their own. At 390 wide the map/hero block at the top (to about 230 px) differs between any two visits; in the "after" sets Île de la Cité at 390 also differs down to 817 px and the Marais at 1440 in a map panel (549,1647)-(875,2041) differs, but those same regions differ between two "after" sets that have identical rows, and the crop shows a map panel with different tile state. Everything else is pixel-identical, and Île de la Cité at 1440 was identical in four of five comparisons. The data snapshot above is the exact test; the screenshots show nothing else moved. Output in `~/scratch/he-test/shots/` on eris (`elk-before-1`, `elk-before-2`, `elk-after`, `elk-after-2`, `elk-after-3`).

## Picker counts, per library (listed to an owner or guide)

| Library | Before | After the run | After rebuild (Job 2) |
|---|---|---|---|
| Tours | 8 tour folders, 8 pictures | 8, 8 (rows are hidden) | same |
| Places | 0 | 0 | same |
| General | 17 pictures (21 when checked later; another session's uploads) | n/a | same |
| Stop folders | not there | not there | 9 top folders (8 tours + "Not matched to a tour"), 93 pictures offered, 4 held back |

Tours and Places only grow when the rows are shown; that is the one UPDATE described above, to be done together with the reader switch.

## Job 2: the Stop folders library

Source only; goes live at the next elktours rebuild.

- `apps/elktours/src/lib/media-stop-folders.ts` (new): `listStopFolders` (`:177`). Grouped tour -> stop, with "Not on a stop" and "Not matched to a tour". Same matcher and stop list as the stage (`matchStopFolder`, `gather` `:78`). Readable paths (tour slug, `<n>-<stop-slug>`), only ever compared with names from storage and the database. A name search across all pictures. Pictures that record a location are not offered; they show under "Not offered (n)" with the reason (`screen` `:131`, uses `hasGps`, remembered 6 hours). File names a URL cannot carry (`# ? % \`) are never offered.
- `apps/elktours/src/lib/media-libraries.ts`: import `:24`, key and key list `:32-33`, `librariesFor` `:55`, `case "stops"` `:215` (owners and guides, `viewer.canEdit`; the org is `siteConfig.orgId`; the URL must pass `isOfferablePicture`, so never `Private/`).
- `apps/elktours/src/lib/media-libraries-config.ts:18`: tab "Stop folders", endpoint `/api/media/libraries/stops`. The route (`app/api/media/libraries/[key]/route.ts`) is generic and needed no change.
- Choosing returns the picture's `/api/media/EAC_Network/elktours/Stops/...` URL, the same kind of reference the other libraries return. It does not move or copy. No row is created at choosing: a block or tour picture field keeps only the URL, so a row is not needed to use the picture, and the picker (shared `packages/cms-ui`, not changed) has no hook at choosing. The location-stamp rule is applied at listing instead, so a stamped picture cannot be chosen here.
- `apps/elktours/src/lib/media-folders.ts` (three small hunks, existing behaviour unchanged by default): `hasGps` exported (`:207`); optional `position` on `StopsPlanItem` (`:293`); optional `visible` option and `position` written by `registerInPlace` (`:370`, `:415`).
- `apps/elktours/scripts/check-media-libraries.mts`: KEYS and the three expectations extended; new "stop folders" section: owner and guide list the same, every picture an org `Stops/` URL and never Private, every walk of tour -> stop -> held-back opens, 10 hostile paths and two searches return nothing unsafe, the database is byte-identical at the end.

## Checks and types

- `scripts/check-media-libraries.mts`: 169 passed, 0 failed (was 88). Output saved on eris at `~/scratch/elk-stop/check.txt`. It listed 93 pictures offered and 4 held back (97 in all).
- `pnpm check-types` apps/elktours: 0 errors before, 0 after (also 0 after Job 1's edits and after the final edit).

## Files

New: `apps/elktours/scripts/register-stop-folders.mts` (modes `--dry`, `--snapshot`, `--run`, `--undo`), `apps/elktours/src/lib/media-stop-folders.ts`.
Edited: `apps/elktours/src/lib/media-folders.ts`, `media-libraries.ts`, `media-libraries-config.ts`, `apps/elktours/scripts/check-media-libraries.mts`.
Production write: one transaction on `tour_assets` (46 inserts). Backup above. No migration, no commit, no install, no container rebuilt or restarted, nothing changed in Nextcloud.
