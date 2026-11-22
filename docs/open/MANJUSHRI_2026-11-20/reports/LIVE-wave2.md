# Lane LIVE, wave 2 (2026-11-20): report

Status: items 1, 2 and 3 shipped and proven; item 4 answered (no catalogue entry exists, so gatherings and series stay read only). Nothing built, restarted, saved to a live site, committed or staged. Started editing at 17:52, after `rollout-wave1.log` ended (` end` line at 17:52:01); before that only check scripts and harness files were written.

## Checks (all green)

| Check | Result |
|---|---|
| `packages/direct-edit/scripts/check-look.mts` (extended; was 93) | 140 passed, 0 failed |
| `packages/house-editor/scripts/check-fields.mts` (extended; was 47) | 102 passed, 0 failed |
| `packages/house-editor/scripts/check-steps.mts` (untouched, rerun) | 74 passed, 0 failed |
| headless Chromium, new `harness/frankenstein/drive-where.cjs` (look panel in Puck, Style clash, block popup) | 44 passed, 0 failed |
| existing drivers rerun: `drive-look.cjs` / `drive-pkg.cjs` / `drive-popup.cjs` | 30/30, 58/58, 56/56 |
| existing canvas drivers `drive13.cjs` / `drive14.cjs` | 417 pass 6 fail / 198 pass 3 fail, **identical to a baseline run with every direct-edit hunk of mine reversed** (see "Not mine") |

`tsc --noEmit` error counts, before and after, for every workspace touched: direct-edit 0 / 0, house-editor 0 / 0, elktours 0 / 0, hidden-enneagram 0 / 0, innergathering 0 / 0. (Before-lists in `~/scratch/live/tsc-before-*.txt`, after-lists `tsc-after-*.txt`.)

The failing-first step: `check-look.mts` and `check-fields.mts` sections were written and run before any source change; they failed (5 and 1 failures, plus the missing modules) and passed after.

## Item 1. When and Screen switches

What shipped:
- `packages/direct-edit/src/panel/where.ts` (new, 140 lines): `whereMarks` (which places hold a look), `nextWhere` (where a click leads), `cleanWhere`, `lookAtWhere`, `editLookAt` (the one writer both panels use, over `partLookAt` / `setPartLookAt`), `whereHtml` (the two switches), `Forcer` (shows the chosen look in the editor), `clashLine` (item 2).
- `panel/panel.ts`: `PanelContext.where` and `.clash`, handler `where`, the switches drawn in the sticky head (`:289-296`), click handling (`:589`). A context with no `where` draws no switches: every other panel is as before.
- `puck/look-panel.ts` (Puck's "Edit look" panel): reads and writes at the chosen place (`:102`, `:198`), forces the preview (`:243`, `:273`), resets to Always when another part is picked (`:269`).
- `canvas/tree-editor.ts` (the canvas panel, and the block popup, which is the same code): `whereNow`/`forcer` (`:254-255`), part panel (`:869-877`), a sealed block's root panel (`:1049-1061`), `writeLook(id, fn, at)` (the three panel handlers pass `whereNow()`: `:1204`, `:1214`, `:1222`; the eye, free move, align and the rest still write the base look).
- Labels: When = Always / On hover / On focus / On press; Screen = Every size / Phones / Tablets. A small dot on any option that holds a look (Always and Every size show it for the base look). Choosing a state drops any size and the other way round; "Always" while on Phones stays on Phones (checked).
- Forcing a state in the editor only: `block/morph.ts:191-264`. With `editor: true`, each state rule also gets an attribute selector (`[data-de-force~="hover"]`), and each size rule an unwrapped copy (`[data-de-at~="sm"]`) placed before the states, so a real hover still wins as on the page. The panel marks the part's elements with `data-de-force` / `data-de-at` (a phone look sets `"sm md"`, a tablet `"md"`). `editor: false` never names them.
- `direct-edit.css` (appended), `puck/morph-mark.tsx` (re-exports `declsFromStyleObject`, `BlkStyleDecls`).

Proof that nothing moves with the defaults (Always, Every size):
- `check-look.mts`: ten new state and size fixtures with a golden file made by the compiler BEFORE my change (`scripts/look-golden-states.mts` / `.json`): `morphCss(..., { editor: false })` byte-identical on all ten, plus the existing 20 v1 golden fixtures (public and editor output) still identical, plus "a public page's CSS never names the editor's attributes" over all 30.
- Through the panel's writer with `where = {}`, an edit on every stored v1 look stores the same JSON and compiles to the same CSS as `setPartLook` did (12+ looks); the read equals `partLookOf`.
- Browser (`drive-where.cjs`): Always + Every size, a Size 60 is stored as `morph.parts.title.size`, no `states`/`at` keys, one history step.
- Browser: On hover, Size 80 stored under `states.hover`, base kept, the title draws 80px with no mouse over it, one history step, a dot on On hover; back to Always draws 60px and the mark is gone; Phones (24px drawn on a 1500px canvas), Tablets, On focus; the reset arrow removes only the look at that place; another part resets to Always; undo takes a hover edit back; the stored look passes `cleanMorph` unchanged; the public CSS has the media rules and no forcing selector.
- Block popup (the canvas's panel): same two switches, the mark on the stage, a Size typed on hover draws, "Use on this page" hands `states.hover` back into Puck's data.

## Item 2. Show clashes

- `readLook(...).conflicts` read in `where.ts:130` `clashLine`. One line, in the amber note style, when Style (`blkStyle`) and the look set the same thing at the root: "Style and this look both set the background. The look wins." (several: "the text colour, the background and the space outside"; plain words for the properties). Read-only: nothing stored or emitted changes (checked: stored props before and after are equal).
- Shown on the block's root in both panels. direct-edit may not import page-builder, so the host passes the reader: `mountLookPanel(host, { blkStyleDecls })`, `mountTreePage({ blkStyleDecls })`, `openStudioPopup({ blkStyleDecls })`. Wired in `house-editor/src/open.ts` and `HouseWholePage.tsx` (additive hunks outside my named files; said here).
- Decision: "the look wins" is the rule I used. A look is a `!important` rule on the block's own root; Style is inline on a wrapper around it. They are different elements, so for most properties both draw and stack (the root's paints over the wrapper's); for inherited ones the inner look wins outright. "The look wins" is true everywhere both reach, and it is the one sentence a person can act on. Not measured in a browser beyond the line itself.
- Browser proof: a block with `blkStyle.bg` and a root `fill` shows the line; remove Style and the line goes.

## Item 3. Live field editing on elktours, hidden-enneagram, innergathering

One shared bind, a thin bind per site (each file under 45 lines; the check enforces it):
- Shared: `packages/house-editor/src/fields/site.ts` (74 lines: `createSiteFields`: block words through `createBlockFields`, and `record:thread:<id>:title` through the catalogue's `thread-edit` door when the site supplies one, bound to the site's org; a gathering, tour or series is read only with the reason) and `site-registry.ts` (the pure `thread` declaration the client lens reads). Exported from `fields/server.ts` (door) and `fields/index.ts` (registry only).
- Per site (`<app>/src/`): `lib/fields-site.ts` (about 25 lines: contracts, page loader, the site's own `savePageAction`, an `authorize` that needs `canEdit`), `app/fields/actions.ts` ("use server", two exports), `components/fields/FieldsLensGate.tsx` (server: returns null unless the viewer may edit) and `FieldsLensMount.tsx` (client), one line in `app/layout.tsx`, `markedPuckConfig` and `serverBlocks` in `lib/puck/config.server.ts`, and the draw sites choose `viewer?.canEdit ? markedPuckConfig : serverPuckConfig` and add `<template data-blk-page>` for editors only.
  - elktours: `lib/puck/render.tsx` (pages at `/<slug>`). Feature-card record marks (a card filled from a tour or experience shows its title read only). The landing page is NOT marked: its slug (`landing`) is reserved for the canvas, so `savePageAction` would refuse the save; wiring it would need a second save path without the stale guard. Cut.
  - hidden-enneagram: `lib/puck/render.tsx` `PuckPage` (every studio page draws through it). No record marks (no block fills a setting from a record).
  - innergathering: `app/p/[slug]/page.tsx` and the landing tree in `app/page.tsx` (its save goes through `savePageAction("landing")`, which this site permits).
- The stale-save guard: the shared door reads the page's version, refuses a stale one before writing, and passes the version to the site's save, whose store compares it in SQL.
- `check-fields.mts` (55 new checks): shared-bind checks with stubs (block load and save as one `set_prop`, stale refused, the gate before every door, org-bound read, `thread-edit` called with the person and the org, empty title refused, read-only kinds refused on the server, no session no write, no catalogue door = posts read only, block door still whole), then source-level checks over the three sites (thin, gated, `use server`, visitors get nothing, lens out of the canvas and manage pages, marks passed once and only to the marked config, marks only for editors at every draw site, the marked config reached only from draw sites, no new package dependency). Marks off = byte-identical page is proven by the existing shared checks.
- Not run: a signed-in browser pass on a throwaway dev copy of the three sites. The headless floor is the shared code (marks, finding parts, the doors) plus the source-level bind checks.
- Where an app has no page that would show a mark: elktours' landing (above). Every other page of the three sites can show marks once it holds a block whose part names a plain text setting.

## Item 4. Gatherings and series through the lens

No catalogue action edits a gathering's or a series' title. The thread-scoped entries are `thread-edit` (a post: its runner calls `updatePost`, which filters on `kind 'post'`), `thread-publish` and `thread-pin`; `org-publish` creates a draft post only; `atlas:q` (docs/sessions/2026-11-16_dock-rails-atlas.md) is a documentation query, not an entry. So those cards stay read only with the reason ("This card shows a gathering, a tour or a series. Those are renamed on their own page for now."), and nothing writes `threads`. `check-fields.mts` fails if the catalogue ever grows a thread-scoped entry beyond edit, publish and pin, so the day one exists someone is told to route those kinds through it (change `READ_ONLY_THREAD` in `fields/site.ts`).

## Decisions
- Ambiguity: the three sites do not depend on `@elkdonis/actions` (no link in their `node_modules`, and `pnpm install` is not allowed). I did not add the dependency. `createSiteFields` takes an optional `performAction`; without it a post a card shows is read only ("Posts are renamed on their own page on this site for now."), and everything else works. Only elktours has a card block that could show a post today, and its cards fill from tours and experiences anyway. To switch post renaming on later: add `"@elkdonis/actions": "workspace:*"`, `pnpm install`, and pass `session` and `performAction` as sunjay's `app/fields/actions.ts` does (3 lines).
- I did not touch sunjay (it is rebuilt tonight and already wired).
- Forcing sizes in the editor with selectors, not by resizing the canvas: the editor shows Phones and Tablets at any canvas width, and an editor already previewing at a phone width shows the same thing.
- A state look starts empty (the base look is not copied into it) so what is stored is only what the person changed.
- `hide` stays a base-look switch (a state cannot hide its part, by the cleaner's rule), so the eye in the layer tree and free move still write the base look.

## Cuts
- Elktours landing page marks (above). Signed-in browser proof on a dev copy (optional). Nothing else cut; item 2 and item 4 were not needed to be cut.

## Not mine
- `drive13.cjs` 6 failures and `drive14.cjs` 3 failures are old expectations that other teams' changes broke (a 35th block in the shared contract; a picture-address check; the hero banner's new Picture and Wash parts). They are identical with every direct-edit hunk of mine reversed (`~/scratch/live/canvasruns-base.txt` against `canvasruns.txt`).
- The free-move worker's hunks in `canvas/*` and `panel/icons.ts` were not touched or reverted. My `tree-editor.ts` hunks sit beside theirs (re-read immediately before each edit; the patch refused to apply on any mismatch).

## For go-live (PM)
1. Rebuild order: elktours, hidden-enneagram, innergathering (and any host that bundles `@elkdonis/house-editor` / `direct-edit`: arts-collective, sunjay, danamccool, katie get the new switches and the clash line from the shared code; none of their stored pages change).
2. No migration, no package install, no env change.
3. Optional: a signed-in check of the lens on one page of each site (recipe in HOUSE_EDITOR_ONE PROGRESS.md), and the post-renaming step above.
4. Concern: the lens's bar now appears for editors on every public page of the three sites, as on sunjay; on a page with no marked block it offers nothing to edit. Check that the bar's position does not sit on an existing floating "Edit this page" button (hidden-enneagram puts one at the page corner).

## Files
New: `packages/direct-edit/src/panel/where.ts`; `packages/house-editor/src/fields/site.ts`, `site-registry.ts`; `packages/direct-edit/scripts/look-golden-states.mts`, `look-golden-states.json`; `packages/direct-edit/harness/frankenstein/entry-where.tsx`, `drive-where.cjs`; per site `src/lib/fields-site.ts`, `src/app/fields/actions.ts`, `src/components/fields/FieldsLensGate.tsx`, `FieldsLensMount.tsx` (elktours, hidden-enneagram, innergathering).
Edited (small additive hunks): `direct-edit/src/block/morph.ts`, `panel/panel.ts`, `canvas/tree-editor.ts`, `puck/look-panel.ts`, `puck/mount.ts`, `puck/studio-popup.ts`, `puck/morph-mark.tsx`, `direct-edit.css`; `house-editor/src/fields/server.ts`, `fields/index.ts`, `open.ts`, `HouseWholePage.tsx`; `direct-edit/scripts/check-look.mts`, `house-editor/scripts/check-fields.mts`; per site `src/lib/puck/config.server.ts`, `src/app/layout.tsx`, and the draw sites (`elktours/src/lib/puck/render.tsx`, `hidden-enneagram/src/lib/puck/render.tsx`, `innergathering/src/app/p/[slug]/page.tsx`, `innergathering/src/app/page.tsx`).
Work files (not in the tree): `~/scratch/live/` (patch scripts `p_*.py`, tsc lists, run logs, a baseline copy of direct-edit's source with my hunks reversed).

## Full check output

### check-look.mts
```

Task 1: a part named like a slot must not 500 the public route
  (custom hidden field on 0.24: THROWS arr.some is not a function)
  ok    0.24 still has the trap: a custom hidden morph field makes resolveAllData throw
  ok    a hidden object morph field: resolveAllData passes
  ok    buildPuckConfig: morph field is a hidden object field
  ok    buildPuckConfig config: stored morph.parts.items resolves
  ok    createCatalogue throws for a part named like a slot
  ok    createCatalogue accepts a part with another name

Task 2: every look key survives the settings sheet
  ok    LOOK_KEYS is exactly morph and look
  ok    both look keys come back when the host dropped them
  ok    a key the host handed back is not overwritten
  ok    a block with no look keeps nothing
  ok    tree-editor.ts hands the sheet result through keepLookKeys

Task 3: states and screen sizes in the stored look
  ok    v1 unchanged: root colour only
  ok    v1 unchanged: title size and weight
  ok    v1 unchanged: big title is guarded for phones
  ok    v1 unchanged: padding as a quad and margin
  ok    v1 unchanged: tokens only
  ok    v1 unchanged: colour tokens with derived values
  ok    v1 unchanged: font token and part font
  ok    v1 unchanged: tokens and several parts
  ok    v1 unchanged: grid layout on the root
  ok    v1 unchanged: stack layout, row, wrap
  ok    v1 unchanged: hidden part and fixed width
  ok    v1 unchanged: raw css, one refused property
  ok    v1 unchanged: raw css with a url is dropped
  ok    v1 unchanged: absolute position is dropped
  ok    v1 unchanged: part the block does not declare
  ok    v1 unchanged: part with a broken selector
  ok    v1 unchanged: effects
  ok    v1 unchanged: no declared parts at all (generic root)
  ok    v1 unchanged: hostile tokens and names
  ok    v1 unchanged: wrong version
  ok    all 20 v1 fixtures byte-identical (cleaned morph, public CSS, editor CSS)
  ok    cleaner keeps states and at
  ok    cleaner keeps the three states only
  ok    cleaner keeps sm and md only
  ok    a state cannot hide its part
  ok    a screen size may hide its part
  ok    a web address in a state never survives
  ok    an empty state and an empty size are dropped
  ok    states do not nest
  ok    a look with only a state is kept
  ok    a stored v1 look carries neither key after cleaning
  ok    every declaration is !important
  ok    hover rule is scoped and uses :hover
  ok    focus uses :focus-visible, active uses :active
  ok    hover, focus-visible, active come after all base rules, in that order
  ok    size rules come last, md before sm
  ok    a size rule is scoped like a base rule
  ok    the stored scope replaced the marker in every rule
  ok    base rules are byte-identical with and without states and sizes (a prefix)
  ok    a part with a pseudo-element selector gets no state rule
  ok    a state of an undeclared part draws nothing
  ok    a font in a state or a size is loaded
  ok    a hash is stable and changes when a state changes
  ok    puck/morph re-exports cleanMorph, morphCss, partLookAt, setPartLookAt
  ok    the old names still exist
  ok    setPartLook then partLookOf: the base look
  ok    setPartLookAt hover
  ok    setPartLookAt sm
  ok    partLookAt with no where is the base look, without states or sizes
  ok    setPartLook keeps the states and sizes
  ok    the stored shape is PartStyle plus states and at
  ok    the stored look passes the cleaner unchanged
  ok    a state look cannot carry states or sizes of its own
  ok    a state and a size together are refused and nothing changes
  ok    an empty look removes just that state
  ok    clearing the base look keeps the sizes
  ok    clearing the last look removes morph
  ok    a bad part name writes nothing
  ok    tokens survive a part look
  ok    the demo's own sequence still works (read, edit a copy, write back)

Task 4: one look reader
  ok    a block with no looks reads empty
  ok    a missing node or definition does not throw
  ok    per part: base, states and sizes
  ok    a part the block does not declare is listed as undeclared; root never is
  ok    tokens are read
  ok    root.morph holds the root look and the tokens
  ok    one look alone is no conflict
  ok    blkStyle declarations are read at the root
  ok    a background in both is a conflict (shorthand against longhand)
  ok    a margin in both is a conflict (margin against margin-left)
  ok    a colour token in both is a conflict
  ok    padding set by only one source is not a conflict
  ok    the same value from two sources is not a conflict
  ok    a look on another part is not a root conflict
  ok    a box look is read at the root and fights the morph root
  ok    no blkStyle function: blkStyle reads as nothing, never a throw
  ok    a throwing blkStyle function is survived
  ok    hostile part names are dropped, not read
  ok    reading a frozen node works and changes nothing
  ok    reading looks changes no compiled CSS
  ok    read-look.ts imports nothing from page-builder
  ok    block/index.ts exports the reader and LOOK_KEYS

Lane LIVE 1: the panel's When and Screen switches (look data, editor-only forcing)
  ok    public CSS unchanged (editor: false): hover on the title
  ok    public CSS unchanged (editor: false): focus and active on the button
  ok    public CSS unchanged (editor: false): all three states on the root
  ok    public CSS unchanged (editor: false): phones and tablets on the title
  ok    public CSS unchanged (editor: false): hide on phones
  ok    public CSS unchanged (editor: false): state and size on different parts
  ok    public CSS unchanged (editor: false): a state of a part with a pseudo-element selector
  ok    public CSS unchanged (editor: false): tokens with states and sizes
  ok    public CSS unchanged (editor: false): a state of a part the block does not declare
  ok    public CSS unchanged (editor: false): a font in a state
  ok    all 10 state and size fixtures byte-identical for a public page
  ok    a public page's CSS never names the editor's forcing attributes
  ok    editor: a hover look is also written for an element marked to show it
  ok    editor: focus has its own forced selector, so hover and focus do not leak into each other
  ok    editor: a size look is written for an element marked to show it, tablets first, phones after
  ok    editor: the forced size rules sit before the state rules, so a real hover still wins as it does on the page
  ok    editor: the real media rules are kept
  ok    editor: every declaration is !important
  ok    editor output starts with the public output's base rules (a prefix)
  ok    a pseudo-element selector gets no forced state selector either
  ok    a look with no states or sizes has no forcing selectors in the editor either (v1 stays as it was)
  ok    panel/where.ts exists and exports the helpers
  ok    default where ({}): an edit through the panel's writer stores and compiles exactly as setPartLook did, on 20-ish stored v1 looks
  ok    default where reads what partLookOf reads
  ok    an unknown or doubled where is the base look (nothing stored under a made-up place)
  ok    edit at hover stores under states.hover and leaves the base look alone
  ok    edit at phones stores under at.sm
  ok    a hover look starts empty: the base look is not copied into it
  ok    the panel's read of hover is the hover look, not the base
  ok    a state and a size together write nothing (the writer turns it into the base look only if asked to, never both)
  ok    the stored look still passes the cleaner unchanged
  ok    emptying the hover look removes just it
  ok    a dot marks the places that hold a look (base, phones), not the empty ones
  ok    a part with no look has no dots
  ok    clicking On hover leads to hover and drops any size
  ok    clicking Phones leads to phones and drops any state
  ok    clicking Always while on Phones stays on Phones; Every size while on hover stays on hover
  ok    Always from the base is the base
  ok    a made-up option leads to the base look
  ok    the switch says When and Screen in plain words
  ok    no jargon in the switch
  ok    the chosen option is pressed, the others are not
  ok    a dot sits on Phones and Always, nowhere else
  ok    a clash between Style and the look is one plain line that names the winner
  ok    no clash, no line
  ok    several clashes are listed once each, in words
  ok    reading a clash writes nothing

140 passed, 0 failed
```

### check-fields.mts
```
-- marks
ok   with marks off the page is byte for byte what it was, and carries no mark  -> 839 bytes
ok   with marks on there is one marker per block, with its id and type
ok   the marker is the only difference: taking it out gives the unmarked page
ok   the marker sits right before the block's own root when there is no look  -> <style data-precedence="eac-morph" data-href="m-qhcyh516893jh">template[data-morph="qhcyh516893jh"] + .blk-hero .blk-hero-title{color:#e0b23c !important}</style
-- finding each part's element
ok   the block field map names the parts that can be typed  -> marker,kicker,title,body,meta
ok   a setting declared with `binds` is never offered
ok   every typed part of a card is found, with the C4 id  -> block:home:c-1:kicker block:home:c-1:title block:home:c-1:body block:home:c-1:meta block:home:h-1:title block:home:h-1:subtitle block:home:c-2:kicker block:home:c-2:title block:home:c-2:body block:home:c-2:meta
ok   a card's title is found by the card's own part selector (h3 in the card)
ok   a block with a look is found too (the look's marker sits between)  -> block:home:h-1:title block:home:h-1:subtitle
ok   two cards are two sets of fields, never mixed
ok   blockSpecs make one field per setting, typed inline only where the block draws it verbatim  -> marker,kicker,title,body,meta
ok   the lens finds the page's name from a marker a host puts there
ok   a marker for a block type the map does not know is left alone
ok   a marker with no element after it finds nothing
-- where a shown value comes from
ok   a typed setting wins: nothing is marked as coming from the record
ok   an empty setting filled by the record is marked, as a record field
ok   no record reference, no resolved record, or another kind: nothing is marked
ok   the mark carries where the values come from
ok   the record's title is offered as the record's field, not as a setting of the card  -> block:home:c-3:kicker record:thread:abc123:title block:home:c-3:body record:thread:abc123:meta
ok   the typed words of the same card stay a setting of the card
-- the server door for a block's words
ok   load gives the stored words of the block's typed settings, and the page version  -> {"marker":"","kicker":"k","title":"Old","body":"Typed words.","meta":"m"}
ok   load of a block that is not on the page says so  -> That block is not on the page any more. Reload to see the newest version.
ok   load of a page that is not there says so
ok   a block the lens has no map for is not editable
ok   a change is saved as one step through the app's save, with the page version  -> {"ok":true,"v":"v2","say":"Changed \"Title\"."}
ok   nothing else on the page moved, the unknown block is byte for byte the same
ok   a change made on a page that moved since is stale, and writes nothing  -> This page was changed somewhere else. Reload to see the newest version.
ok   a refused step shows its own words and writes nothing  -> "Title" is too long (400 characters at most).
ok   a setting no part draws cannot be written through here  -> "tone" is not a setting that can be typed here.
ok   the look key cannot be written through here
ok   saying what is already there writes nothing  -> "Title" already says that.
ok   two words in one save are two steps and one page write
ok   the app's own gate has the last word
ok   storeGuard false still compares the version itself but hands the store none
ok   sunjay's block door no longer turns the store guard off (store.ts guard fixed 2026-11-20)
ok   by default the version goes to the store, so a block save is one guarded UPDATE
-- the doors through createFieldsActions
ok   kind block goes to the block door
ok   the lens's own gate comes before the block door, for load and save
ok   a record's field is saved through its capability, naming the record  -> {"cap":"thread-edit","input":{"title":"Renamed"},"subject":"abc123"}
ok   a record changed since is stale
ok   a field declared read only is refused on the server too
ok   a record nobody may change from here is read only, in the load and in the save  -> Gatherings are renamed on their own page.
ok   a kind nobody declared is refused
ok   a kind's shared line is part of its declaration
-- the shared site bind
ok   fields/server exports createSiteFields and the registry; the client entry exports the registry only
ok   the map is the blocks' own declaration, nothing added
ok   a block's words load through the shared door  -> {"ok":true,"values":{"marker":"","kicker":"k","title":"Old title","body":"Typed words.","meta":"m"},"version":"2026-11-20 10:00:00.000001+00"}
ok   a block save is one set_prop through the site's gated page save, with the stale guard  -> {"ok":true,"say":"Changed \"Title\".","values":{"marker":"","kicker":"k","title":"New title","body":"Typed words.","meta":"m"},"version":"2026-11-20 10:05:00.000001+00"}
ok   a page changed since the lens loaded it answers stale and writes nothing
ok   someone who may not edit is refused on every door, before anything runs
ok   a post's title and summary load, and its read is bound to this organisation  -> {"text":"\n        SELECT title, excerpt, kind, updated_at::text AS version FROM threads\n        WHERE id = ? AND org_id = ? AND status <> 'archived' LIMIT 1\n      ","values":["abc123","org-1"]}
ok   a post's title is saved through the catalogue's thread-edit, naming the post, the person and this organisation  -> {"id":"thread-edit","actor":{"userId":"u1","email":"ed@example.org","via":"app","siteOrgId":"org-1","subjectId":"abc123"},"input":{"title":"Renamed post"}}
ok   a post changed since is stale
ok   a post's title cannot be emptied  -> {"ok":false,"error":"Title cannot be empty."}
ok   the summary and details stay read only on the server too
ok   no session, no write  -> {"ok":false,"error":"Sign in as an editor to change this."}
ok   a card showing a meeting: read only with the reason, and no write  -> {"l":"This card shows a gathering, a tour or a series. Those are renamed on their own page for now.","s":"This card shows a gathering, a tour or a series. Those are renamed on their own page for now."}
ok   a card showing a event: read only with the reason, and no write  -> {"l":"This card shows a gathering, a tour or a series. Those are renamed on their own page for now.","s":"This card shows a gathering, a tour or a series. Those are renamed on their own page for now."}
ok   a card showing a series: read only with the reason, and no write  -> {"l":"This card shows a gathering, a tour or a series. Those are renamed on their own page for now.","s":"This card shows a gathering, a tour or a series. Those are renamed on their own page for now."}
ok   a card showing a tour: read only with the reason, and no write  -> {"l":"This card shows a gathering, a tour or a series. Those are renamed on their own page for now.","s":"This card shows a gathering, a tour or a series. Those are renamed on their own page for now."}
ok   a post that is not this organisation's (no row) loads empty, never someone else's
ok   a kind the shared registry does not declare is refused
ok   without a catalogue door a post is read only with the reason, and nothing is performed  -> {"l":"Posts are renamed on their own page on this site for now.","s":"Posts are renamed on their own page on this site for now."}
ok   without a catalogue door a block's words still load
ok   the shared bind imports no store, database or session
ok   the catalogue's thread-scoped entries are still edit, publish and pin: nothing renames a gathering or a series  -> ["thread-edit","thread-pin","thread-publish"]
ok   thread-edit is for a post (its runner calls updatePost, which filters on kind 'post')
ok   no entry in the whole catalogue names a gathering, series or tour edit
-- the three canvas sites' binds (source level)
ok   elktours: the bind is thin (a few lines per file, the logic is the shared door's)
ok   elktours: block words save through this site's own gated page save, and the shared door's contracts are its blocks'
ok   elktours: every call is gated on the viewer being an editor, and the bind writes no table itself
ok   elktours: the server actions file is "use server" and exports the two doors only
ok   elktours: visitors get nothing (the gate returns null before any lens or map is sent)
ok   elktours: the lens stays out of the canvas, manage and account pages
ok   elktours: the lens is mounted once, in the root layout
ok   elktours: config.server exports the plain config, the marked config and the block list; marks are passed once, to the marked one
ok   elktours src/lib/puck/render.tsx: marks only for someone who may edit, and the page names itself for the lens
ok   elktours: the marked config is reached only from the draw sites and the config itself  -> ["lib/puck/config.server.ts","lib/puck/render.tsx"]
ok   hidden-enneagram: the bind is thin (a few lines per file, the logic is the shared door's)
ok   hidden-enneagram: block words save through this site's own gated page save, and the shared door's contracts are its blocks'
ok   hidden-enneagram: every call is gated on the viewer being an editor, and the bind writes no table itself
ok   hidden-enneagram: the server actions file is "use server" and exports the two doors only
ok   hidden-enneagram: visitors get nothing (the gate returns null before any lens or map is sent)
ok   hidden-enneagram: the lens stays out of the canvas, manage and account pages
ok   hidden-enneagram: the lens is mounted once, in the root layout
ok   hidden-enneagram: config.server exports the plain config, the marked config and the block list; marks are passed once, to the marked one
ok   hidden-enneagram src/lib/puck/render.tsx: marks only for someone who may edit, and the page names itself for the lens
ok   hidden-enneagram: the marked config is reached only from the draw sites and the config itself  -> ["lib/puck/config.server.ts","lib/puck/render.tsx"]
ok   innergathering: the bind is thin (a few lines per file, the logic is the shared door's)
ok   innergathering: block words save through this site's own gated page save, and the shared door's contracts are its blocks'
ok   innergathering: every call is gated on the viewer being an editor, and the bind writes no table itself
ok   innergathering: the server actions file is "use server" and exports the two doors only
ok   innergathering: visitors get nothing (the gate returns null before any lens or map is sent)
ok   innergathering: the lens stays out of the canvas, manage and account pages
ok   innergathering: the lens is mounted once, in the root layout
ok   innergathering: config.server exports the plain config, the marked config and the block list; marks are passed once, to the marked one
ok   innergathering src/app/p/[slug]/page.tsx: marks only for someone who may edit, and the page names itself for the lens
ok   innergathering src/app/page.tsx: marks only for someone who may edit, and the page names itself for the lens
ok   innergathering: the marked config is reached only from the draw sites and the config itself  -> ["app/p/[slug]/page.tsx","app/page.tsx","lib/puck/config.server.ts"]
ok   elktours: cards that fill from a tour or an experience are offered read only (feature-card record marks), the others carry plain marks
ok   elktours: the landing page is not marked (its slug is reserved for the canvas, so the page save would refuse it)
ok   no site gained a package dependency (the actions package is not needed to bind the doors)

102 passed, 0 failed
```

### drive-where.cjs (headless Chromium)
```
pass Alt+click into the banner's Title  {"sel":"try-banner","part":{"id":"try-banner","part":"title"},"idx":1}
pass the switches are in the panel, in plain words  Properties Title Part of Banner (photograph and words), this page only When Always On hover On focus On press Screen Every size Phones Tablets Banner (photograph and words) Photograph Wash
pass no jargon on them
pass the default is Always and Every size  ["Always","Every size"]
pass a part with no look has no dots
pass Always + Every size: a Size draws and is stored as morph.parts.title.size, as before  {"v":1,"parts":{"title":{"size":60}}}
pass …with no states and no sizes in the stored look
pass …one history step
pass a dot marks Always and Every size now (the base holds a look)
pass On hover is pressed, Every size still is  ["On hover","Every size"]
pass choosing a switch writes nothing and takes no history step
pass the editor shows the state: the title is marked while it is edited  hover
pass a Size typed on hover is stored under states.hover and the base look is kept  {"v":1,"parts":{"title":{"size":60,"states":{"hover":{"size":80}}}}}
pass the preview shows the hover look without a mouse over it  80px
pass one history step
pass a dot on On hover now
pass back to Always: the mark is gone and the title draws its base look  null 60px
pass the Size field is the base look's again  60
pass Phones: pressed, and On hover is not (a state and a size are never chosen together)  ["Always","Phones"]
pass phones are drawn as phones in the editor (both sizes in force)
pass a Size typed on Phones is stored under at.sm  {"v":1,"parts":{"title":{"size":60,"states":{"hover":{"size":80}},"at":{"sm":{"size":24}}}}}
pass the editor canvas (wider than a phone) shows the phone look while it is edited  24px
pass Tablets: only the tablet size is in force  md 60px
pass tablets stored under at.md
pass the two sizes and the state keep a dot each, nothing else does
pass choosing On focus while on Tablets leaves Tablets
pass the reset arrow on hover removes the hover size only  {"v":1,"parts":{"title":{"size":60,"at":{"sm":{"size":24},"md":{"size":40}}}}}
pass picking another part goes back to Always and Every size  ["Always","Every size"] 0
pass the stored look passes the cleaner unchanged
pass a public page's CSS has the real media rules and no forcing selector  template[data-morph="1bywngg1y84yp6"] + section h1{font-size:min(60px, 11vw) !important}
@media (max-width:820px){template[data-morph="1bywngg1y84yp6"] + section h1{font-size:min(40px, 11vw) !important}}
@media (max-width:480px){template[data-morph="1bywngg1y84yp6"] + section h1{font-size:24px !impo
pass undo takes a hover edit back
pass no page errors (Puck's own offline image loads aside)  console: Failed to load resource: net::ERR_INTERNET_DISCONNECTED
pass a block with Style and a look both setting the background: one line says so and who wins  Style and this look both set the background. The look wins.
pass showing a clash changes nothing in the stored block
pass with no Style set there is no such line
pass double-click on a block opens the popup
pass the popup's panel shows the same two switches for the block  Properties
Numbered steps
When
Always
On hover
On focus
On press
Screen
Every size
Phones
Tablets
Numbered steps
Heading
“How to join”
Rule
Steps
“1 Open the ro
pass popup default is Always and Every size  Always,Every size
pass popup: On hover pressed  On hover,Every size
pass popup: the part is marked so the hover look is visible while it is edited  1
pass popup: a Size typed on hover shows on the marked part
pass popup: back to Always strips the mark
pass Use on this page hands the hover look back into Puck's data  {"v":1,"parts":{"heading":{"states":{"hover":{"size":33}}}}}
pass no page errors in the popup run  console: Failed to load resource: net::ERR_INTERNET_DISCONNECTED

44 passed, 0 failed
```

### existing drivers, rerun
```
look 30/30
parity 58/58
56/56
drive13.cjs:
pass 417 fail 6
drive14.cjs:
pass 198 fail 3
baseline (my direct-edit hunks reversed): drive13 / drive14
pass 417 fail 6
pass 198 fail 3
```

### tsc error counts (before / after)
```
packages-direct-edit 0	packages-direct-edit 0
packages-house-editor 0	packages-house-editor 0
apps-elktours 0	apps-elktours 0
apps-hidden-enneagram 0	apps-hidden-enneagram 0
apps-innergathering 0	apps-innergathering 0
done	done
```

## Wave 2 review fixes (2026-11-21)

1. `panel/where.ts` clash line. The reviewer was right. `blkStyle` is inline style on `div.blk-st` around the block (`page-builder/src/style/wrap.tsx`); the look is an `!important` rule on the block's own root inside it (`morphCss`). Two elements, so only what is inherited (text colour) is the look's alone; space adds, borders and shadows nest, opacity multiplies, sizes compound, the wrapper's background shows only where the root's is clear. The note now names the property and says what happens by kind, in plain words ("Both add space, so the block gets both.", "The look's text colour is the one you see.", "Both borders draw, one inside the other.", "Both fade the block, so they multiply."); no blanket "The look wins". `check-look.mts` asserts the wording per group (background, space inside, space outside, text colour, border, opacity, several at once) and that no line says "wins". Failed first (7), now green.
2. `puck/look-panel.ts` When/Screen choice: kept in a module map in `where.ts` (`selectionWhere` / `rememberWhere`), keyed `${id}~p:${part}` like `openTab`, and dropped when the selection moves to another part. Unit checks in `check-look.mts` (choice survives a remount, two writes in a row both land in the hover look, base untouched, another part clears it). Driver check in `drive-where.cjs` (two edits with a props change between them). Honest note: in the harness Puck did NOT remount the panel on that props change (a marker on the panel element survived), so the driver check passes both before and after; the unit checks are what prove the fix.
3. Minors for my files: none found. Left, not mine or not one line: `house-editor/src/fields/blocks.ts:94` (accept a save with no `version`; DOOR's file, the lens always sends one), DraftReview and the draft-tool findings (other lanes). Not touched this round: `tree-editor.ts`, `direct-edit.css`, `landing.ts`.

Counts: check-look 152 passed / 0 failed; check-fields 102 / 0; drive-where 48 / 0; direct-edit tsc errors 0. Files: `panel/where.ts`, `puck/look-panel.ts`, `scripts/check-look.mts`, `harness/frankenstein/drive-where.cjs`.
