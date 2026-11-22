# One document, three hands: the doctrine (2026-11-20)

PM: Manjushri (Claude, Justin's session). Built from three read-only lanes in this folder:
`puck-internals.md` + `seams.json` (P), `aesthetic-layer.md` + `aesthetic.json` (H), `fields-and-mcp.md` + `manifest.json` (F).
The try-it page is `apps/development/src/ideas/manjushri*` ("One document, three hands").

**Status: research and a sandbox demo. No shared package, live site, database row or dependency was changed.**

## 1. The idea in plain words

A page is one stored document. Today Puck is the only thing allowed to change it, through its own panels.

The proposal: Puck keeps two jobs, **holding the document** and **dragging blocks around**, and steps back from everything else.

- **The look** belongs to our own editor (direct-edit). You click any part of a block and restyle it.
- **The words** belong to the on-page field editor (the Fields lens). You click a value and type.
- **An assistant** (MCP), and a lesson in the courses layer, can do what either hand does by sending the same steps as text.

All three write the same document through one checked door, so neither side can overwrite the other.

## 2. What the research found

Each line was checked against the code by the PM as well as the lane, unless marked.

**Puck (0.23.0, read from its shipped bundle)**

1. **Only what sits inside a block's settings reaches the public page.** The published renderer hands a block its `props`, `id` and `puck` and nothing else (`puck-0.23.0/dist/rsc.js:758-781`). So the look must live inside the block's settings to survive. Our `morph` key already does this.
2. **Puck's document engine runs with no Puck screen.** `@puckeditor/core/internal` exports `createReducer` (`internal.js:935`). **Verified by a run** on our own block config: insert, duplicate, move, replace and remove all worked in plain Node; a duplicated block got a new id and kept both its look and its words (8 of 8 checks, `~/scratch/manjushri`, script not kept in the repo).
3. **Puck's editing canvas is not the public page.** It wraps most blocks in an extra element and forces a positioning rule, so layouts can differ between editing and published (lane P, read from code, not reproduced). Our canvas does not have this problem: it draws with the published config in the plain page (`packages/direct-edit/src/puck/TreeCanvas.tsx:7-16`).
4. **There is no "wrap every block" hook in Puck.** The usable takeover points are 51 in number; 44 are documented API. The ten that matter are ranked in `puck-internals.md` ("Recommended seams, ranked").
5. **A plain `replace` runs no resolver, and a style edit re-runs every resolver for that block.** Both are known to the house; both become design constraints for the one door (section 3, rule 3).

**The look (direct-edit, page-builder)**

6. **A look is stored in four shapes that do not know about each other**: `morph` (parts inside a block), `look` (canvas boxes), `blkStyle` (Puck's Style panel), and Site style. Only `morph` reaches inside a block.
7. **No look can change by screen size or on hover from the canvas.** `blkStyle` has one media query and three hover presets; `morph` has neither.
8. **The canvas never reads `blkStyle`** (the only mention is `puck-tree.ts:246`), so a block can carry two looks that fight invisibly (reasoned from code, not rendered).
9. **A look is addressed by part name.** If a block's maker renames a part, the stored look for it draws nothing, silently (`morph.ts:171-177`).

**The words, and machines**

10. **Eight field systems, four different "who may save" checks.** Only two of them write an audit row.
11. **A value that comes from a record has no label saying so.** `feature-card` draws the typed title first and the record's title only if the typed one is empty (`packages/blocks/src/blocks/feature-card.tsx:131`). So typing over a gathering's title on a card silently detaches the card from the gathering, and never changes the gathering.
12. **The Fields lens steps aside inside any Puck block** (`packages/house-editor/src/fields/FieldsLens.tsx:50`), so today it cannot edit block content at all.
13. **Org pages have no draft.** `savePage` writes the live page (`packages/page-builder/src/store.ts:120-170`). An assistant must never write live, so a draft comes before any write tool.
14. **The assistant door is read-only (5 tools)** and a lesson can only point at a catalogue entry, not at a block or a field.

## 3. The rules

1. **One document, in Puck's format.** We do not fork the format or keep a second copy. Puck's `props` is the only place that publishes.
2. **Two reserved sides inside every block: words and look.** The look sits under one reserved key (today `morph`; `look` on canvas boxes). Puck's fields never show it. No content key may be written through the look door, and no look key through the words door. The demo's `ops.ts` is this rule as about 200 lines of code.
3. **One door.** Every change is a *step*: set a word, set a look on a part, set a block colour, insert, move, remove, bind a record. A step is checked against the block's own declaration (its contract) and the cleaners the public page already uses. The canvas, the Fields lens, Puck's settings sheet when it hands back, and the assistant all use it. Inside a live Puck, a step lands as `dispatch({type:"replace"})` followed by `resolveDataById(id, "replace")`. With no Puck on screen (the canvas, the server, MCP), structure steps run through Puck's own reducer.
4. **Our canvas is the editing surface; Puck is the engine and the settings sheet.** We do not build on Puck's iframe. Where whole-page Puck stays, our chrome goes on through the documented overrides (`iframe`, `actionBar`, `componentOverlay`, `fields`, `<Puck>` children).
5. **Every value on a page knows its owner.** A value is either a setting of this block or a field of a record. The mark on the element says which. An in-place edit of a record's value goes to the record, through that record's own action and gate, and says so ("This changes the gathering itself").
6. **A machine proposes, a person publishes.** Assistant writes go to a draft and are reviewed. Reads are scoped to the key's organisation. Member-written text is fenced as untrusted. This is the existing `packages/mcp` rule set, extended, not replaced.
7. **Blocks declare, editors do not guess.** Parts, colours, fields, what a block opens, and whether an assistant may touch it are declared once on the block. The look panel, the Fields lens, the forms, the block manifest and the assistant tools are all generated from that declaration.

8. **A block reads its surroundings before it asks for settings** (added 2026-11-20, Justin: "smart components that understand the flow of ux"). A block that can work out what to show from where it is (the site, the record in the address, who is looking, what sits beside it, which step of a journey it is in) does that, and offers a setting only for what it cannot know. Each block declares what it reads (`reads` on its declaration, contract C5 in `BUILD_SPEC.md`), so the editors and an assistant can say where a value comes from. This is the direction of `docs/open/SMART_COMPONENTS_KIT_2026-11-08.md`. A further idea, components with natures (hot, cold, dry, wet) that respond to their neighbours, is being talked through in `NATURES.md`; it is not designed yet.

## 4. Puck conventions we break, and the trap in each

| Puck's way | What we do instead | The trap if done carelessly |
|---|---|---|
| The fields sidebar is the only way to edit | Steps through the one door | A bare `replace` skips resolvers, so record-filled values go stale; call `resolveDataById` after |
| The iframe canvas | Our plain-page canvas (`TreeCanvas`) | Anything that relies on `data-puck-*` marks does not exist on the public page |
| One history, Puck's | One history per editing surface, never two at once | Two undo stacks exist today (canvas snapshots and Puck `replace`); a hand-back must be one undo step |
| Look controlled by per-block Style fields (`blkStyle`) | The look namespace, edited by clicking parts | A block can hold `blkStyle` and a `morph` root look together; read both through one reader before changing either |
| Hidden settings get a hidden custom field | A hidden **object** field | `morph` still has a custom field (`packages/page-builder/src/config.tsx:462`); a part named like a slot of its block would be read as that slot on the public route and return a 500, as `look.items` did on hiddenenneagram.com on 2026-11-11 |
| Blocks only ever see `props` | We keep to it | Style kept anywhere else (a side document, `metadata`) is lost on duplicate and on undo |
| The internal reducer is private | We use it, in one wrapper module | `@puckeditor/core/internal` is exported but undocumented: pin the version, wrap it once, re-check on every upgrade |

## 5. The order of work

Each move ships alone. "Needs your yes" marks anything that touches a live site, the database, or a rebuild.

| # | Move | What you would see | Size | Needs your yes |
|---|---|---|---|---|
| 0 | **Close two holes.** Give `morph` a hidden object field and make the cleaner refuse a part named like a slot; keep every look key (not only `morph`) when the settings sheet hands a block back (`tree-editor.ts:553-557`) | Nothing. A class of public 500s cannot happen | S | Rebuilds, per app |
| 1 | **The one door, for real.** Lift the demo's step checker into `@elkdonis/house-editor` as the shared checker, with insert, move and remove added on Puck's reducer | Nothing yet. The canvas, the lens and the tools all get the same refusals in the same words | S-M | No (source only) |
| 2 | **One look reader.** Read `morph`, `look` and `blkStyle` as one answer; the panel shows when two looks fight | A warning in the look panel where a block has two looks | S | No |
| 3 | **Block manifest and read tools.** Generate the manifest from the 184-block extract; add `list_pages`, `read_page`, `list_blocks`, `describe_block`, `find_fields`, `list_surfaces` | An assistant can describe any page and block on your sites, and change nothing | M | The parked `mcp_grants` migration and an arts-collective rebuild |
| 4 | **Hover and screen sizes on a part.** Optional `states` and `at` keys; State and Device switches in the look panel | "On hover" and "On phones" switches when restyling a part | M | Rebuilds |
| 5 | **Owner marks, and one record field edited in place.** `fieldMark` on drawn values; a gathering-sourced card title edited on the page changes the gathering | On Para Theater, click a card's title, type, and the gathering itself is renamed, with a line saying so | M | A live-save round trip on sunjay |
| 6 | **Drafts for org pages, then `propose_page_patch` and `set_field`.** | An assistant's change waits as a draft with a before-and-after for you to publish or discard | M-L | The drafts decision (below) |
| 7 | **Named looks and part health.** Save a look as a pattern; a check that lists looks whose part no longer exists | "Save this look", "Use a look", and a list of orphaned looks | M | Rebuilds |
| 8 | **Whole-page Puck in our chrome.** Our panels and overlays on Puck's engine via overrides; lessons that point at a block or field | The Blocks view looks and behaves like the canvas | L | After Puck 0.24 lands and the seams are re-checked |

## 6. Decisions (Justin, 2026-11-20: "take all recs")

1. **One stored look: yes.** `morph` (extended) is the one look; Puck's Style panel values are read through it. No stored page is converted.
2. **Editing a record's value on a page changes the record**, with the line that says so.
3. **Drafts for org pages: yes.** An assistant's change, and optionally an editor's, waits as a draft that a person publishes.
4. **Assistant read tools first: go**, including the parked `mcp_grants` migration and one arts-collective rebuild.
5. **The other session's "AI direction" folds into moves 3 and 6 here.**
6. Going live with the try-it page waits for the development board's next rebuild.

His steer for the build: align the code base to this central editor as we go; move fast and accept cuts; keep the live editor idea in mind; no one uploads code, and `apps/development` becomes his console onto every site. The build contract is `BUILD_SPEC.md`; progress is in `LEDGER.md` and `reports/`.

## 7. Corrections and open items

- `puck-blocks.md` says Puck reads slot `allow`/`disallow` "from the field only". The canvas also honours them when passed to the slot call (`puck-0.23.0/dist/index.js:9592-9604`); only the outline is field-only. The rule stands; its reason should be reworded. Not edited: the rules file belongs to the repo's maintainers' flow.
- **Bugs met on the way, not fixed (owners to decide):** the workshop live save is a raw `UPDATE threads` with no sanitiser and no audit row (`apps/arts-collective/src/lib/cms/actions.ts:331`, lane F, not re-checked by the PM); `cleanBoxDoc` stores `blkStyle` on own boxes unvalidated (`packages/direct-edit/src/block/puck-tree.ts:246`, lane H, not re-checked).
- **Puck 0.24.0 is installed** (2026-11-20 16:38 EST, by the 0.24 session; 13 workspaces link to it). Live sites keep 0.23 in their builds until each is rebuilt. Re-checked on 0.24: the step logic 17 of 17, the headless reducer 8 of 8, the demo page 25 of 25. Lane P compared the bundles: `internal.js` is identical, the actions are unchanged, `replace` still runs no resolver, and the slot-name trap is **not** fixed (`puck-0.24.0/dist/index.js:1597`), so move 0 stands. New and useful: `<Render fieldTransforms>` on the public route, slots that forward `data-*` props, a dedicated drag handle, field tabs and groups. Details: `puck-internals.md` ("0.23 -> 0.24") and the `v024` key on each item of `seams.json`. The frozen 0.23.0 copy stays at eris `~/scratch/manjushri/puck-0.23.0/`.
- **Not verified by a run:** the canvas/publish layout differences (finding 3), the two-looks clash (finding 8), `Puck.Preview` without `Canvas`.
- **How the lanes ran:** three Sonnet leads. Each was allowed three Haiku helpers and each chose to read the code alone, so no helper output needed checking.

## 8. The demo, and how it was checked

`apps/development` > Ideas > "One document, three hands".

- A real shared block is drawn by Puck's own `<Render>` with the house config, as a public page draws it.
- **Look** restyles a clicked part, **Words** types into its settings, **Assistant** sends the same steps as JSON.
- The document is shown in two halves with a fingerprint each, so it is plain that a look step never moves the words.
- Checks: the step logic 17 of 17 against the real `hero-banner` contract; the page 25 of 25 in headless Chromium (`~/scratch/manjushri/h/run.sh`), including that a web address slipped into a look never reaches a stylesheet. The test browser has no network, so the sample hero picture did not load there.
