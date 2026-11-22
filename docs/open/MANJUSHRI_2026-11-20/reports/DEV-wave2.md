# Lane DEV, wave 2 (2026-11-20 evening)

Status: all four tasks shipped in source; nothing was built or restarted; not seen in a browser. Check: `apps/development/scripts/check-sites.mts` 93 passed, 0 failed (written first; first run failed on the missing modules). `tsc` (`pnpm check-types`, apps/development): 0 errors before, 0 after. No other workspace touched. The first-hour rule was kept: no `src` edit before `rollout-wave1.log` ended (17:52:01); until then I only read, wrote the check and ran a staged copy of the new modules from `apps/development/scripts/_stage/` (deleted).

## 1. Site pages unblocked (contracts for every block)
- `src/lib/sites-manifest.ts`: `contractFromManifest`, `manifestContracts()` (184 contracts: settings with kind, limits, options, binds; part names with their setting; tokens; slots), `contractFromDeclaration` (the same shape from a real declaration).
- `src/lib/sites-contracts.ts`: `checkable()` now returns `{ blocks, contracts, config }`. `contracts` = the manifest's for every block, overlaid by the real declaration where this server can import the block (shared and box blocks: 51). `unknownTypesOn` means "in no manifest"; `hasLegacyZones` unchanged. Publish is refused only for those two reasons.
- `src/lib/sites-doc.ts`: `publishProblems(doc, known)` gives the plain reasons; `SitePageView.tsx` shows them under "Change this page" and in the draft section ("You can change this page here, but it cannot be published from here: ...").
- `sites-actions.ts`: the server checks with the same contracts and config. SitePageView gets `contracts` and `config` as plain props from the server page (no more client-side `contractOf` of loaded blocks).
- Proved (check): every manifest block has a contract; manifest contract agrees with the real one on kinds, limits, binds, part settings and (where the manifest has them) options; a words step, a number clamp, a bound-prop refusal, a look step on a declared part, a token (hex accepted, hostile string refused, font refused) on app-local blocks; a block in no manifest is still refused; legacy zones still not vouched for.

## 2. Structure steps
- `src/lib/sites-config.ts` is the one module that builds the small Puck config (`stepConfigOf(blocks, rules)`): slot fields with allow/disallow, `defaultProps` from the settings' defaults. `checkable().config` is built from the manifest plus slot `allow` lists read from the real declarations.
- Sites tab: a new "Blocks" hand in `SiteHands.tsx`: add (any block, at the top of the page or inside a slot of any block, optional position), move (to the place and position chosen), copy, remove. The door's refusals appear in plain words (`That place does not take this kind of block.`).
- Proved: insert honours allow (synthetic config built by the same function), disallow beats allow, unknown slot refused, top-level insert, move out of and into a slot; with a real shared slot allow list when one exists (none does today: the check says so); a page holding unknown blocks goes through insert/move/copy/remove and every unknown block, and what it holds, is byte-identical; steps aimed at an unknown block (remove, move) refused.
- Also in the Look hand: When (always, hover, focus, pressed) and Screen (every size, phones, tablets) switches, shown only when the build stores states and sizes (`hasStatesAndSizes()`), mutually exclusive as the door requires.

## 3. The development org's own pages
- `src/lib/sites-list.ts` (new, no gate): `listSitesFrom(sql)`; the org `development` is always listed (even with no pages), first. `sites.ts` keeps the gated `listSites`.
- `src/lib/sites-pages-core.ts` (no gate, testable on a transaction): `DEV_ORG`, `slugOfTitle`, `newPageDoc`, `createDraftPage` (a draft first, base null, refuses an existing page or draft).
- `src/lib/sites-pages-actions.ts` ("use server"): `createPageAction`, `pagesFieldsLoad`, `pagesFieldsSave`; each calls `adminOrThrow()` first; the lens's `authorize` calls the gate again. The save is the house `createSavePageAction` (gate, slug rule, resolver keys stripped) over `savePage` handing the store the version (no `storeGuard: false`): one `set_prop` step through `createBlockFields`.
- `/sites`: the development section has "New page" (`NewPage.tsx`) and a link per page to `/pages/<slug>`. A page that exists only as a draft is editable and publishable from `/sites/development/<slug>` (before, editing needed a published page).
- `/pages` (list) and `/pages/[...slug]` (`src/app/pages/**`): admin-gated, draw the PUBLISHED page only (never a draft) with the registry, the marked config (`buildPuckConfig({ marks: true })`) and `FieldsLens` ("Edit page"). The word-to-part map is built in the browser from the blocks the registry loads (real selectors).
- End to end, proved on the real database inside `BEGIN ... ROLLBACK` (made-up slug): New page as a draft (not live) -> three shared blocks added from nothing as steps -> words typed into all three -> a hover look on one part -> draft saved -> `publishDraft` -> stored under `puck:<slug>` with the hover look, draft row gone -> the lens's load/save changes one word -> reloaded, the word stayed and the other two blocks and the look are unchanged -> a save from an older screen is refused as stale and writes nothing -> a setting no part draws cannot be typed. The check leaves no row (counts before/after equal).

## Decisions
- Prefer the real declaration over the manifest where the server can import the block: the manifest's static scan lacks select options for the box blocks (`box.tag`, `words.tag`), part selectors, slot allow lists and token types. For other sites' blocks: token types are read off the name (font / length / colour); a select with no options in the manifest refuses every value (stricter, not looser).
- No Pages tab (TopBar untouched): the Sites tab links to `/pages`. 
- `/pages` writes the PUBLISHED page directly (Justin's "change a word in place, see it stay"); every other change goes via a draft. The in-place check stores through a transaction-bound copy of the store's guarded UPDATE (`savePage` has no `{ tx }`); the real `savePage` was not run against production.
- The org id is the literal `development`.
- `listSites` split into `sites-list.ts` so it can run on a transaction without the Next gate.
- `draw.tsx` now holds the pieces the two views share (block loading, boundary, placeholder, sample rows); SitePageView imports them.

## DraftReview (ASSIST) mounted
`SitePageView.tsx` imports `./DraftReview` and mounts it in place of my own draft section (it carries Publish and Discard through the same gated actions): `draft` = data, savedAt, base, author kind and label, note, steps; `canPublish` and `publishBlockedBecause` from `publishProblems`; `renderPage` draws each side with the registry; `labels` from the contracts. `DraftView` and the server page now pass `base`, `authorKind` and `steps`. tsc 0, check 93/0 after the mount. Not seen in a browser.

## Cuts
- In-place editing for blocks the registry cannot load (mocks) is not offered on `/pages` (they are still editable in the Sites tab).
- Rich text, rows and list settings stay out of the words door (door rule, unchanged).

## What the PM must do
Rebuild apps/development. Risk to look at first: `PagesView.tsx` and `sites-pages-actions.ts` import house-editor by relative path (`../../../../packages/house-editor/src/...`) like `sites-door.ts` does; if the build refuses it, add `@elkdonis/house-editor` to the app's dependencies and `transpilePackages` and switch the three import lines. Then open `/development/sites`, make "My test page", follow the end-to-end list above.

## Files
NEW (apps/development): `src/lib/sites-manifest.ts`, `sites-config.ts`, `sites-list.ts`, `sites-pages-core.ts`, `sites-pages-actions.ts`; `src/components/sites/draw.tsx`, `PagesView.tsx`, `NewPage.tsx`; `src/app/pages/page.tsx`, `src/app/pages/[...slug]/page.tsx`.
EDITED: `src/lib/sites.ts`, `sites-actions.ts` (config passed to the door), `sites-contracts.ts`, `sites-doc.ts` (appended `publishProblems`); `src/components/sites/SitePageView.tsx`, `SiteHands.tsx`; `src/app/sites/page.tsx`, `src/app/sites/[org]/[...slug]/page.tsx`; `scripts/check-sites.mts` (wave 1's 29 checks kept; `pt-band` in them renamed to a made-up type because it is now a known block).
Run: `sudo -n docker run --rm -u 3003 --network guru-eac_eac-network --env-file $HOME/eac/.env -e DATABASE_URL=<the .env value with host postgres> -v $HOME/eac:/app -w /app/apps/development eac-dev node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/check-sites.mts`


## Wave 2 review fixes (2026-11-21)
Check: `check-sites.mts` 102 passed, 0 failed (the new checks were written first and failed on the missing table). tsc apps/development 0 -> 0.
1. Slot rules of app-local blocks: new `src/lib/sites-slot-rules.ts`, a hand-kept table (`ktp-piece-row.pieces` and `ktp-quick-landing.feature` allow `ktp-piece`, with `path:line` beside each; `pt-band.content` listed as unrestricted), fed into the config in `sites-contracts.ts` (declarations of importable blocks still win). Checks: the manifest cannot gain an app-local slot the table omits; every rule names a source line; any other block inserted or moved into either Katie slot is refused, `ktp-piece` allowed.
2. Lost update on drafts: WIRED. DOOR's `expected` landed in `saveDraft`; `saveSiteDraft` passes `expected: draft?.savedAt ?? null`, and `draft_changed` answers `stale` with a plain message telling the person to reload. `createDraftPage` passes `expected: null`, which also fixes the "New page" overwrite minor.
3. Minors fixed: token type guess is anchored to the end of the name (`--x-sizing-ink` is a colour); `/pages` now says a waiting draft goes out of date when a word is typed there.
Minors left (not my files): all `packages/mcp` and `house-editor` items, and DraftReview's look wording (ASSIST's file).

## Full check output
```
ok   saveSiteDraft calls the admin gate as its first statement
ok   publishSiteDraft calls the admin gate as its first statement
ok   discardSiteDraft calls the admin gate as its first statement
ok   listSites calls the admin gate as its first statement
ok   loadSitePage calls the admin gate as its first statement
ok   sites-actions.ts is a server-action module
ok   sites-actions.ts exports only async functions and types
ok   sites/page.tsx calls requireNetworkAdmin
ok   sites/[org]/[...slug]/page.tsx calls requireNetworkAdmin
ok   sites.ts says why it may read across organisations
ok   a draft never keeps the admin's address (author label names the door)
ok   Publish is refused for a page with blocks this app cannot check
ok   listBlocks finds every block, nested ones too, in page order
ok   listBlocks gives the path and depth
ok   forDrawing turns a block it cannot load into a labelled placeholder, keeping its place
ok   forDrawing keeps the blocks it can draw, with their settings
ok   forDrawing never touches the stored document
ok   the door can check the shared blocks and the box blocks
ok   typesOnPage walks into slots
ok   unknownTypesOn names what the door cannot check
ok   a page of checkable blocks only has none unknown
ok   a words step on a checkable block is accepted
ok   the blocks the step was not aimed at are byte-identical, the unknown one too
ok   a step aimed at a block the door cannot check is refused, in words
ok   the look cannot be written through the words door
ok   a part the block does not declare is refused
ok   structure steps are refused here (no block list is given), in words
ok   a list of steps stops whole at the first refusal and hands back the original page
ok   a look step on a declared part is accepted and writes only the look
ok   the door can check every block in the manifest
ok   manifestContracts has one contract per manifest block, with its label
ok   every contract carries its block's settings, part names and token names, in order
ok   the manifest-built contract agrees with the real one on kinds, options, limits, binds and part settings (51 shared blocks)
ok   where the app can import a block, its real options, tokens and part selectors are in the contract the door uses
ok   the manifest has app-local blocks with a typeable setting (the case this lane unblocks)
ok   a words step on an app-local block (ExperienceGallery.heading) is accepted
ok   a look step on a declared part of an app-local block (he-contact.root) is accepted; an undeclared part is refused
ok   a colour of an app-local block (he-contact --he-aurum) takes a hex colour and refuses anything else
ok   a font token is still refused (fonts come from the library)
ok   a block type in no manifest is still unknown, and its step is refused
ok   a page of app-local and shared blocks has no unknown types, so it can be published
ok   legacy zones are still not vouched for
ok   the contracts are plain data (they can cross to the screen as a prop)
ok   the small config has every manifest block
ok   every slot of every block is a slot field
ok   defaults come from the block's own settings
ok   a setting with no default has none in the config
ok   an insert into a slot takes a block its allow list names
ok   an insert into a slot refuses a block its allow list does not name, in words
ok   an insert into a slot refuses a block its disallow list names, even when allow names it
ok   an insert into a slot the block does not have is refused
ok   an insert at the top of the page takes any block of the catalogue
ok   a move out of a slot to the top of the page works
ok   a move into a slot that allows it works
ok   no shared block declares a slot allow list yet (nothing to carry over)
ok   structure steps (insert, move, copy, remove) run on a page that holds blocks nobody here knows
ok   an unknown block, and what it holds, comes out byte-identical after every structure step
ok   a structure step aimed at an unknown block is refused
ok   moving an unknown block is refused as well
ok   the development org is the one this app builds in
ok   a page name is made from a title in plain letters, or refused
ok   a new page holds its title and no blocks
ok   /pages/[...slug] calls requireNetworkAdmin
ok   /pages draws only the published page (it never loads a draft)
ok   sites-pages-actions.ts is a server-action module that exports only async functions
ok   createPageAction calls the admin gate as its first statement
ok   pagesFieldsLoad calls the admin gate as its first statement
ok   pagesFieldsSave calls the admin gate as its first statement
ok   the in-place save is gated by the network admin check and keeps the stale guard (it hands the store the version)
ok   the in-place save never turns the store guard off
ok   the Sites list always includes the development org, even with no pages
ok   the development org exists
ok   a new page is made as a draft
ok   the draft starts from nothing (base null), by a person, with the page's title
ok   a new page is not live until published
ok   a second New page with the same name is refused, in words
ok   a page name that is not usable is refused
ok   the Sites list holds the development org, with its waiting new draft
ok   there are at least three shared blocks with a typeable part
ok   three blocks are added to the empty page as steps
ok   words are typed into all three
ok   a hover look on one part is accepted and stored under its block
ok   the draft with three blocks, words and a hover look is saved
ok   the draft publishes
ok   the page is stored under puck:<slug> with its three blocks and the hover look
ok   publishing clears the draft
ok   the lens loads the block's words and the page's version
ok   a word typed on the page is saved as one set_prop step
ok   after a reload the changed word is still there, and the other blocks and the look are as they were
ok   a save from a screen that opened before that change is refused as stale, and writes nothing
ok   the stale save left the page alone
ok   a setting no part draws cannot be typed on the page
ok   the database checks left no row behind
ok   every app-local slot in the manifest has an entry in the slot-rule table (add one with its source line)
ok   every table entry with a rule names its source path:line
ok   ktp-piece-row.pieces: any other block is refused, ktp-piece is allowed
ok   ktp-quick-landing.feature: any other block is refused, ktp-piece is allowed
ok   moving another block into a restricted slot is refused as well
ok   a token named --x-sizing-ink is a colour, --x-card-size a length
ok   /pages says a waiting draft goes stale when a word is typed on the published page
ok   a draft save hands the store what it started from (compare-and-set), and a changed draft is answered in plain words
ok   a new page is started only if no draft exists (compare-and-set with none)

102 passed, 0 failed
```
