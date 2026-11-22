# CLOSEOUT: ideas, assistant block list, action atlas (2026-11-21)

Engineer closing out the two-day build, for Manjushri and Justin. Source only: no commit, install, migration, rebuild or production write. Nothing was built or restarted in a live container. Scratch copies (before-states, check outputs) are in eris `~/scratch/closeout/`.

## Job 1: two ideas in the development app

Both are pages in plain words, status `exploring`, added 2026-11-21, listed first in `IDEAS`. Every path on them was opened in the code on 2026-11-21.

| Slug | Title | Files |
|---|---|---|
| `pickers-in-puck` | Pickers in Puck: media, thread, user | `apps/development/src/ideas/pickers-in-puck.tsx`, `pickers-in-puck.css` (prefix `pkr`) |
| `pattern-blocks` | Pattern blocks: between a block and a page | `apps/development/src/ideas/pattern-blocks.tsx`, `pattern-blocks.css` (prefix `pbk`) |

Registry: `apps/development/src/ideas/index.ts` (two import lines, one array hunk: `[pickersInPuck, patternBlocks, freePlacement, ...]`).

**Pattern blocks (what it says).** Templates today are whole pages (`packages/blocks/src/templates/store.ts`, `person.ts`; sunjay's `apps/sunjay/src/lib/puck/templates.ts`); the Templates tab (`packages/page-builder/src/templates/templates-plugin.tsx:63`, `setData` at :75) swaps the whole canvas. `ABOUT_PATTERN` (`apps/innergathering/src/lib/puck/landing-blocks.ts:57`) is written down and read by nothing else in the repo; its own comment says there is no insert-a-pattern step. Four real patterns in a table: about heading + two columns; a `pt-band` with `split-row` (sunjay's `band()` and `split()`, `templates.ts:25,:33`); a `store-frame` with `store-header` + `store-shelf` (`store.ts:33`); `person-columns` with `person-card` beside `person-portfolio` (`person.ts:22`). Box blocks `BOX_BLOCKS` (`packages/direct-edit/src/puck/blocks.tsx:141`) and the shared layout and small blocks are listed. The development app already bakes a block-order snapshot of every site page (`scripts/refresh-site-pages.mjs`), but it flattens containers, so it cannot show which slot a block sat in; that is stated as an open question.

**Pickers in Puck (what it says, and the honest answer).** What exists: `ImageField` / `MediaPicker` (`packages/page-builder/src/fields/image-field.tsx`, `packages/cms-ui/src/files/MediaPicker.tsx`); elktours' libraries (`apps/elktours/src/lib/media-libraries.ts`); the record pickers (`record-fields.tsx:431` `siteBindsFields`, `site-sources.ts`, `record-sources.ts:45`); the canvas drawer (`packages/direct-edit/src/canvas/records.ts:50`, `tree-editor.ts:1409`); that drawer mounted inside a Puck setting (`apps/sunjay/src/components/studio/person-picker.tsx:41`, `apps/elktours/src/components/studio/person-picker.tsx`); artdirect's `OfferingPickerField` and `ManageSpace`; the content library (`packages/content`, `docs/open/CONTENT_LIBRARY_COMPONENT_2026-11-08.md`) and its one use as a chooser (`apps/arts-collective/src/components/channel/Library.tsx:25`, `onPick`, "Use this piece").

Honest answer: **yes, it is possible**, and the shape (a chooser that pops up inside Puck's panel) already exists. What it would take: a Puck setting that opens the library and stores the pick; an address or server action on each site that returns the library's pieces for the person asking (the loader `listContent` reads the database; Puck's preview runs in the browser); an adapter between the library's key (`thread:<id>`, `artwork:<id>`) and what each block stores (a bare id on the offerings band). What stands in the way: the library lists threads and artwork only, no pictures and no people, so it cannot be the media or user picker without growing; its styles lean on Channel's or the content stylesheet; only arts-collective, sunjay and katie-the-potter depend on `@elkdonis/content` (innergathering, where the featured gathering block is, would need an install and a rebuild); the lightbox is built for a wide surface, not Puck's side panel. The cheaper route for the named blocks: the drawer picker already used by sunjay and elktours with a per-site list, and `MediaPicker` for pictures. Two facts found: the offerings band's `featured` setting (`binds: "thread"`, `offerings-block.tsx:30`) is a plain id box on innergathering because its Puck config passes no string field (`config.client.ts:80`); there is no block called "profile picture" (nearest: `featured-person.tsx:35`, `person-card.tsx`), so the page asks which Justin meant.

**Type-check:** `apps/development` `pnpm check-types` 0 errors before and 0 after.

## Job 2: the block list for assistants

Steps, in order:
1. Backed up `docs/open/DEVELOPMENT_APP_2026-11-20/blocks.json`, `blocks.apps.json` and `blocks.generated.ts` to `~/scratch/closeout/`.
2. Re-ran `extract-blocks.js` as its header says (node in the `eac-dev` image, `ROOT=/app`, `NODE_PATH` to the repo's typescript): **192 blocks** (was 184). Added: elktours `m-page-buttons`, `m-phone-menu`, `booking-options`, `locations`, `hero-city-title`, `tour-cards`; innergathering `grand-forum`, `offerings-band`. Removed: none. New settings found on `m-masthead` (cover, coverVideo, wash, textAt, coverHeight), `m-places-shelf` (from, picks), `m-experiences-panel` (mode, which, count, picks), `m-guides` (who, order, limit, bioLines, showTours, onTap, people), `m-link-rows` (showButtons).
3. `apps/development/scripts/refresh-data.mjs`: run with a source folder holding only the new `blocks.json` (`~/scratch/closeout/src`), so `themes.json` was not touched (the copy in `src/data` differs from the one in the docs folder, an older extract; the script's default source would have replaced it). `src/data/blocks.json` is now byte-identical to the docs one.
4. `build-manifest.mts` (admin compose service): wrote `blocks.generated.ts`, **192 blocks, 171 visible to assistants**. `--check`: `ok manifest is current (192 blocks)`.
5. `scripts/test.mts`: **259 passed, 0 failed** before my edit, **260 passed, 0 failed** after (one test added).

**Counts.** 192 blocks, 171 visible, 21 hidden by reason `{"id":1,"person":5,"secret":2,"no-declaration":9,"unresolved":3,"markup":1}`. The hidden set is identical to the 21 before (compared by id): **none of the eight new blocks is hidden**; the deny list does not name any of them.

**Role-aware blocks.** The "who sees it" setting of `m-page-buttons` (`buttons[].who`, `swapWho`, `swap2Who`) and `m-phone-menu` (`items[].who`) is a column of a `rows` setting. `packages/mcp/src/manifest/deny.ts` did not cover it (the name rule needs a top-level boolean or select and the word is `who`). The door already refuses a `rows` setting as an unsupported kind (`packages/house-editor/src/steps/words.ts:53`), so an assistant could not set it today. Added anyway, so a row-aware door cannot slip past: `READ_ONLY_SETTINGS` now has `m-page-buttons: [buttons, who, swapWho, swap2Who]`, `m-phone-menu: [items, who]` (`deny.ts:88-94`), and `grand-forum: [showAnswer]` (one I added on judgement: "show the answer box to visitors who are not signed in" decides who may answer on the forum; named here so it can be removed if unwanted). Test: `packages/mcp/scripts/test.mts:369` (the entries are refused with the plain reason; ordinary settings of the same blocks are not; each named setting or column exists in the manifest).

**check-sites.** `apps/development/scripts/check-sites.mts` through the admin service: **102 passed, 0 failed**. The slot-rules check ("every app-local slot in the manifest has an entry in the slot-rule table") passes: none of the eight new blocks has an app-local slot, so `sites-slot-rules.ts` needed no change.

**tsc:** `packages/mcp` 0 errors. (`apps/development` 0, above.)

## Job 3: the action atlas

How it is regenerated: `atlas:inventory` regenerates `atlas/inventory.json`; areas under `atlas/areas/` are curated; `check-atlas` ties them together; `--accept <capability id | file>` re-baselines fingerprints; the journal gets a dated entry (`atlas/README.md`, `.claude/rules/atlas.md`). Run through the admin compose service (the `atlas:*` scripts' own commands).

**Before** (`check-atlas`, old inventory, 1958 hosts): `Atlas check: 105 error(s)`: 101 `apps.inner-gathering.legacy: ignored key not in inventory`, 2 `orgapps.commerce.shop/workshop-join: claimed key not in inventory`, 2 danamccool (`dana-media-upload` and `dana-navigation-save` sql keys). 12 unclaimed (warning), 12 needs review. These are the three known items. Not touched.

**Regenerated:** 2003 hosts (+45). Against it: the same 105 errors, 57 unclaimed (warning), 19 needs review.

**After** (`check-atlas --strict`): `Atlas check: 105 error(s)`: the same 101 + 2 + 2, nothing else; **0 unclaimed**; 1713 claimed, 290 ignored.

**New area files** (new files, `added: 2026-11-21`; none moves an existing row):

| File | Capabilities | Hosts |
|---|---|---|
| `atlas/areas/apps.development.sites.ts` | dev-site-draft-save, dev-site-draft-publish, dev-site-draft-discard, dev-page-create, dev-page-words-save, dev-versions-save, dev-versions-discard, dev-versions-keep | `sites-actions.ts` (3), `sites-pages-actions.ts` (createPageAction, pagesFieldsSave), `versions-actions.ts` (4) and `versions.ts` sql twins (5); reads ignored: pagesFieldsLoad, versionsList, versionsCounts |
| `atlas/areas/pkg.page-builder.drafts.ts` | pkg-page-builder-draft-save, -publish, -discard | `packages/page-builder/src/drafts.ts` saveDraft, publishDraft, discardDraft (sql) |
| `atlas/areas/orgapps.fields.ts` | fields-block-save, elktours-tour-fields-save | `saveFieldsAction` of sunjay, hidden-enneagram, innergathering, elktours (two claims with `case` on the elktours one), elktours `restoreFieldsAction`, `tour-fields.ts` saveTourFields and saveStopLine; four loadFieldsAction ignored |
| `atlas/areas/apps.elktours.media-folders.ts` | elktours-media-folders-make, elktours-media-folder-scan, elktours-media-register-in-place | `media-folder-actions.ts` (3), `media-folders.ts` ensureTourFolder, ensurePlaceFolder, registerInPlace; ignored: ten picker/list server actions and dead `runStopsMove` |
| `atlas/areas/orgapps.site-chrome.ts` | art-auction-site-style-save, innergathering-site-style-save, site-menu-save, katie-cart-drop-paid | the two apps' site-style actions and sql, sunjay and katie `saveNavAction`, katie `dropPaidOrderFromCart`; the two `loadNavForEditor` ignored |

Existing rows touched (one `updated: '2026-11-21'` line each, then `--accept`): `page-save` (`areas/orgapps.editing.ts`), `landing-save` (same file), `pkg-page-builder-page-save` (`areas/pkg.page-builder.ts`). Fingerprints accepted for those three and for all 20 new capability rows (the new rows were written from the code as it stands).

**Does the atlas match the code, action by action** (every new row's gate, risk and confirm text was written from the code; the matches and the findings):

| Action | Gate in the code | Risk | Atlas matches? |
|---|---|---|---|
| saveSiteDraft / publishSiteDraft / discardSiteDraft | `getNetworkAdmin()` (users.is_admin) via `adminOrThrow`; the org must exist | none / public / irreversible | Yes. Notes in the rows: publish reaches the live page of any organisation and writes no audit row; discard has no version check |
| createPageAction, pagesFieldsSave | network admin; org fixed to `development`; the save is the shared `createSavePageAction` with the stale guard | none / public | Yes |
| versionsSave, Autosave, DiscardDraft, Keep | `getNetworkAdmin()` in each, answers "denied" | none, irreversible (discard) | Yes; writes only `dev_versions` |
| saveFieldsAction (sunjay, hidden-enneagram, innergathering, elktours) | `authorize()` = signed in and `canEdit` (owner or guide) on every call; then the site's own page save | public | Yes. Finding: no audit row for a block-words save; on sunjay the two routes that run through the hub runner and `thread-edit` do leave one |
| elktours tour fields (save, restore) | `canEdit`, then `mayEditTour` per tour on every call: an owner, the tour's author, or a guide leading a coming date; the tour must be published and public | public | Yes; narrower than the office actions (which let any guide change any tour). One previous version is kept per field. No audit row |
| elktours media register-in-place | `requireOrgEditor` (owner or guide), no per-tour check | public | **Row says public; the existing MEDIA.md reads as "hidden until shown": the INSERT sets `visible = true`**, so registered pictures show on the public tour page at once. Scan, by contrast, registers hidden. Recorded in the row's `open` |
| scan folder, make folders | `requireOrgEditor`, no per-tour check (any guide may scan any tour or place) | none | Yes; noted |
| art-auction site-style save | `getPagesEditor`: platform admin, or owner or guide of the marketplace org | public | Gate matches; the refusal text says "owners and editors", the gate is owner or guide (or admin) |
| innergathering site-style, site menu (sunjay, katie) | `getApiEditor` = owner or guide | public | Yes |
| katie dropPaidOrderFromCart | the visitor's own cart token and a paid order id | none | Yes (claimed late; from 2026-11-17) |

Changed rows re-checked: `page-save` gate unchanged (owner or guide on every app); what is new is the optional `expectedUpdatedAt` stale guard (absent = unguarded) and that the copies now come from one `createSavePageAction`; innergathering now also strips resolver keys, which the row's drift text says it does not. The three rows' drift text was not rewritten (it still says seven copies); each carries `updated`.

**Left unaccepted, still "needs review" (12 hosts), other sessions' work:** tour-save (sa and sql; saveTourAction now also creates the booking offer, calls ensureFolderSoon and keeps `city` and `via`), elktours-asset-copy-to-stop, elktours-place-create-from-pin, elktours-place-save, capture-from-phone, dana-media-upload, danamccool listPagesForHud (an ignored read), questionnaire-create, shop-checkout (three katie hosts). The check lists them; they do not fail it.

**Journal:** appended a dated entry to `packages/actions/atlas/JOURNAL.md`.

**tsc:** `packages/actions` 0 errors.

## What I could not do

- Nothing was viewed in a browser (the two idea pages are server-rendered text and tables; type-checked, not rendered).
- The 12 hosts above stay "needs review": reviewing them is the owning sessions' call.
- The 105 existing atlas errors are untouched, as asked.
- Not run: `apps/arts-collective` tsc (only the generated manifest file there changed in effect; `packages/mcp` 0 errors).

## Every file, new or edited

New (eris `~/eac/`):
- `apps/development/src/ideas/pattern-blocks.tsx`, `pattern-blocks.css`, `pickers-in-puck.tsx`, `pickers-in-puck.css`
- `packages/actions/atlas/areas/apps.development.sites.ts`, `pkg.page-builder.drafts.ts`, `orgapps.fields.ts`, `apps.elktours.media-folders.ts`, `orgapps.site-chrome.ts`
- `docs/open/MANJUSHRI_2026-11-20/reports/CLOSEOUT.md`

Edited:
- `apps/development/src/ideas/index.ts` (imports and the `IDEAS` line)
- `apps/development/src/data/blocks.json` (regenerated copy)
- `docs/open/DEVELOPMENT_APP_2026-11-20/blocks.json`, `blocks.apps.json` (regenerated by the extractor)
- `packages/mcp/src/manifest/blocks.generated.ts` (regenerated)
- `packages/mcp/src/manifest/deny.ts` (`READ_ONLY_SETTINGS`, three entries and a comment)
- `packages/mcp/scripts/test.mts` (one check, line 369)
- `packages/actions/atlas/inventory.json` (regenerated), `fingerprints.json` (accepted)
- `packages/actions/atlas/areas/orgapps.editing.ts`, `pkg.page-builder.ts` (`updated` lines only)
- `packages/actions/atlas/JOURNAL.md` (appended)
- `docs/open/MANJUSHRI_2026-11-20/BOARD.md` (start and finish entries)

## Must be rebuilt

- **development app:** the two idea pages and the regenerated `blocks.json` (Blocks tab, Sites tab contracts).
- **arts-collective:** the regenerated block manifest and the deny-list entries (assistants read them there, `/api/mcp`).
- Nothing else: the atlas files are read by the packages' scripts and by arts-collective's dock registry (`atlas:emit` was not run, because no registry data changed), so a rebuild for the atlas is not needed unless the dock is to show the new rows.
