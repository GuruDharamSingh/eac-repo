# Canvas framework: one box tree, several ways in (proposal, 2026-11-02)

Direction confirmed by the developer 2026-11-02, with the guardrails below; first slices built (see "Progress"). It compares the claude.ai
canvas, Silex/GrapesJS, Puck and `packages/direct-edit`, proposes a document model and four editing surfaces, and
orders the work. It follows `DIRECT_EDITING_PANEL_PLAN_2026-11-01.md` and changes one of that plan's assumptions (see
"What changes in the existing plan").

Sources: 19 screenshots and two videos (7 s and 8 s) recorded by the developer on 2026-11-02, the direct-edit source,
`SILEX_PUCK_SURVEY_2026-10-04.md`. Canvas internals are not visible, so mechanics are labelled **observed** or **inferred**.
Statements about GrapesJS beyond this repo are from general knowledge, **not checked** against its source.

## Developer guardrails (2026-11-02, supersede anything below that conflicts)

- The goal is direct editing UX for non-technical people, on declared sections of a page. Not how sites are built.
- The layer is visual: it need not match the real DOM or data exactly, and it gives selection and modification for ease of use.
- GrapesJS is the reference for what Puck lacks; Silex itself is not a concern. A custom layer on Puck emulates GrapesJS and adds the
  live-editing touch. Puck components are valuable when their editability is built in (the IFAC picture grid: resize tiles, crop in place).
- Out of scope here: a platform block and template catalogue (saving a block is fine; it may be graduated later), and the freedom
  levels, which were meant for classifieds only.
- Click-through (confirmed): hover outlines the outermost box; clicking it makes hover outline the next boxes inside; and so on down to
  primitives or component essentials. Below that the focus shifts to actions and data flow, which is a separate scope (a manage page or tab).
- Order: click-through, then the node model.
- Board: for org admins and owners, on their own org's sites. Two modes: an edit button on the live page, and a dedicated edit suite.
- Free objects remember where they were created, can later be inserted into a published page, and have a submit-for-developer-review option.
- Work that goes beyond this gets its own agent. Developer space: `DEV_SPACE_PROPOSAL_2026-11-02.md`.

## Progress (2026-11-02, source only: not rebuilt, not committed)

Changed from the proposal: following the guardrail that the layer is visual, the first node model is a box tree read off the rendered page,
with edits stored as styles per box, instead of a stored `Node` document. The `Node` model below is kept as the later form for
pages built in the editor (not started).

- `packages/direct-edit/src/canvas/layers.ts`: boxes read from any DOM (wrappers collapse, phrasing stays in its text, atoms are one box, plain names),
  `nextLayer` (the click-through rule), `readLayers`, `selectorFor`. Markers: `data-edit-section`, `data-edit-name`, `data-edit-atom`, `data-edit-skip`.
- `canvas/clickthrough.ts`: hover and click over declared sections, Esc, Enter, Alt+click, right-click "Select layer", inner boxes shown faintly, inert links and
  buttons, a rectangle hit option for pages that set `pointer-events: none` (Puck).
- `block/patch.ts`: `{ boxes: { selector: { style, image, imageFit } } }`, `cleanPatches`, `patchCss`. Edits are one stylesheet, the same in the editor and on the public
  page, with `!important` so they beat a page's inline styles. CSS cannot change words or data; those stay with declared fields.
- `canvas/visual-editor.ts`: edit mode: top bar (Undo, Redo, Save, Done), box bar (background, picture, space inside, corners, hide, reset).
- Classifieds and cards editors: `deeperIn` follows the same rule, nothing selected at load, inner boxes shown, "Select layer" items in the right-click menu, Alt+click.

Verified 2026-11-02 in Chromium driven by Playwright over esbuild bundles of the real code (isolated container, no network, no DB): `drive.cjs` 41/41 (sequence
page > band > column > paragraph, neighbour rule, wrapper collapse, atoms, Esc / Enter / Alt / right-click, inert link and button, scroll, rectangle hit, editor and cards
sequences), `drive2.cjs` 17/17 (edits, undo, save, hidden boxes, overrides an inline style, hostile documents, public rule without the editor). check-types 0 in direct-edit and
arts-collective. Scripts are in the session scratchpad, not the repo. The pass-1 to pass-3 suites (Windows scratchpad) were not rerun; deliberate behaviour change: nothing is
selected at load, and a click on a cousin goes to the box inside the common parent rather than the same depth.

Elkdonis landing page wired 2026-11-02 (source only; live rebuild not run, the session's permission system refused the production deploy): `apps/innergathering/src/app/page.tsx` declares
nine sections (hero, offerings, about, gallery, join, fundraising, cities, board, vision; the forum is left out), each with its own `data-edit-section` because the signed-out banner shifts sibling
positions. `lib/page-edits.ts` stores `site_config` key `page-edits:home` under `inner_group` through `withOrg`; `lib/page-edits-actions.ts` allows owners and guides; `EditPageButton.tsx` loads the
editor only when opened. Verified in a dev preview with a temporary guide account, since removed (`drive3.cjs` 24/24: no button or editor CSS for visitors, click-through on the real hero, background over
inline styles, hide, save to the real row, public rule in the first response, signed-out save refused, no console errors). The test row was deleted; `page-edits%` count 0. A signed-in non-member save was not tested.
Also not checked: contrast (the bar does not warn when a background makes text hard to read; the test colour made the navy heading hard to read).

Not done, next: rebuild innergathering; (done above) wire edit mode into a real page (an `EditRegion` wrapper or a `data-edit-section` attribute, an Edit button for owners, a `site_config` row through `withOrg`, the
stylesheet in the page's first response); then board and free objects; then the `ifac` picture grid as the model for components with editing built in.

Box panel slice (2026-11-02, source only, not rebuilt; arts-collective also not rebuilt): the small bar is gone. Edit mode opens the existing `panel/panel.ts` on the right (Properties, Code) with fields from
`canvas/box-panel.ts` chosen by the box and its parent: whole-page layer tree (hover outlines, click selects, eye hides), Align in parent, Size (Hug / Fixed / Fill by parent), Column span in a grid, Grow in a flex parent, Layout (Block / Stack / Grid),
direction, columns, gap, padding and margin per side, Text (font library, weight, size, spacing, colour with live contrast), Appearance (fill, picture by address, opacity, radius, border), Effects. Values shown are read from the page. `BOUNDS` in
`block/style.ts` were widened for whole pages, which also widens what the classifieds validator accepts. `patchFontsHref` loads chosen fonts on the public page.
Verified 2026-11-02 in an isolated browser with no database writes: `drive.cjs` 41/41, `drive4.cjs` 39/39 on the fixture, `drive5.cjs` 9/9 on a saved copy of the public landing page (its real markup and CSS, saving faked); check-types 0 in direct-edit, innergathering, arts-collective.
Not verified: signed in on the real app with a real save (the temporary test account was refused by the permission system), React behaviour around the panel, touch. The classifieds suites from the Windows scratchpad were not rerun after the bounds change.

Move and resize slice (2026-11-02, source only, not rebuilt): `canvas/box-drag.ts`. Resize: east, south and corner handles on the selection, live, Esc cancels. In a grid the width lands on whole columns (`cspan`); elsewhere pixels (`w`, `h`, with `box-sizing: border-box` so the size is what the handle showed). `h` is a minimum height, so a box cannot shrink below its content. No left or top handles: an in-flow box is anchored top-left. Move: drag the selected box; an insertion line shows the place among its neighbours; stored as CSS `order` on every sibling, markup unchanged (`order` added to the style vocabulary and validator). A plain block parent becomes a flex column when a child is first moved. A collapsed wrapper moves with its box.
Limits: a box stays in its parent, and the declared sections cannot be reordered (they sit outside any section). `order` changes what is seen, not the reading order for screen readers and keyboards. A block parent turned into a column can change margin collapsing and auto-margin children. Verified 2026-11-02 in an isolated browser, no database writes: `drive.cjs` 41/41, `drive4.cjs` 39/39, `drive5.cjs` on a saved copy of the public landing page, `drive6.cjs` 35/35 on the fixture. Not exercised signed in on the real app.

Picture sources slice (2026-11-02, source only, not rebuilt): no new picker. `@elkdonis/cms-ui/files` `MediaPicker` already did upload, library, folders and search, and innergathering already had `/api/upload` (owners and guides), `/api/media/library` and `/api/media/library/mine`. `visual-editor.ts` takes a `choosePicture` option and opens it in a drawer over the panel; `apps/innergathering/src/components/landing/page-picture-chooser.tsx` mounts the picker. A picture whose path has a `Private` segment is refused with an explanation, because visitors could not load it (`isPrivatePicture`; editor-side only, so a stored document is not re-checked on the server). Verified 2026-11-02: `drive7.cjs` 18/18 with the real picker component in an isolated browser over stand-in routes (upload, both libraries, private refused, undo, remove, Esc, phone width). Not verified: the real routes and real Nextcloud listing, a real upload. No focal point or framing yet; `CoverFramer` exists in the same package for that.

Right-click slice (2026-11-02, source only, not rebuilt): `canvas/menu.ts` gains rows that open in place (`MenuItem.kids`; click or Right arrow, Left closes). Edit mode's menu: Select parent, Copy style, Paste style, Move to first, Move to last (`[` `]`), Choose a picture, Hide or Show, Reset changes, then a Layers row listing every box under the pointer, outlining each on the page as it is hovered. Cut, Duplicate, Delete, Group and Flip are left out because this layer cannot do them without changing the page's structure. Copy style leaves out place and size (`order`, `cspan`, `w`, `h`, `self`, `grow`, `hide`). The classifieds and cards menus get the same Layers row, after their existing tools. Verified 2026-11-02 in an isolated browser: `drive.cjs` 43/43, `drive6.cjs` 35/35, `drive7.cjs` 18/18, `drive8.cjs` 29/29; check-types 0 in direct-edit, innergathering, arts-collective. Touch has no right-click, so phones have no way to open this menu yet.

Box tree slice (2026-11-02, source only, not rebuilt). This is the custom layer on Puck the developer asked for: Puck stays the storage format, the block catalogue and the published renderer; the editor on top is ours; the old Puck editor is no longer the target but still opens the same document.

- Format: a page stays Puck's `{ root, content }` in `site_config` `puck:<slug>`, so existing pages open unchanged and `/p/<slug>` publishes them. `src/puck/blocks.tsx` adds three ordinary blocks (`box` with a slot, `words`, `picture`) and `BOX_ROOT` for the page root; hosts opt in. Moving between boxes moves nodes between slot arrays (`block/puck-tree.ts`), with no CSS tricks and no order numbers.
- Other blocks are sealed nodes: they move like a box into any slot, including a block's own (grid), and their inside is not edited here. Their settings stay in the Puck editor for now; a fields section in the panel is not built. (2026-11-04: built behind an optional contract, which no host passes yet; see "Stone 1" below.)
- Drawing: `src/puck/TreeCanvas.tsx` draws with the same components as the published page and marks nodes and slots; `canvas/tree-editor.ts` is the editor; `canvas/edit-shell.ts` is the top bar, save and picture drawer shared with the visual layer.
- Tools that now exist: move between boxes with an insertion line, Group (row or column), Ungroup, Duplicate, Delete, Add (box, words, picture, any block), type on the page, Kind, resize, Link, Anchor, Name.
- Tree and Code tab, built to the developer's screenshots: the page root is a row of its own (background, picture, width; click empty space to select it); names read `Section First page of ads`, `Column #for-sale`, `Navigation Sections`; marked words are child rows (`Text "EASEL,"`); hints use the words as written, not as CSS uppercases them; the tree stays above the Code tab. The Code tab is one editable sheet of declarations, then "From `<div>`" groups of what the box inherits, nearest first, each with "+" to set it on this box; refused lines are named ("Not kept").
- `safeDecls` now allows layout properties for that sheet; `position` only as `relative` or `static`, so nothing can be fixed over a site. This also widens what classifieds accepts.
- innergathering: `/studio/<slug>/canvas`, linked from `/studio`; save goes through `savePageAction`, which now runs `cleanBoxDoc`.

Verified 2026-11-02, isolated browser, no database writes: `drive10.cjs` 46/46 on the classifieds page rebuilt from the screenshots (tree names, Code sheet, From groups, +, typed CSS, field over code, inline runs, links, an ad moved between columns); `drive9.cjs` 54/54 (moves, group, delete, undo, hostile documents); published through Puck's own `Render`: same elements, order and sizes as the editor (25/25, 10/10); Puck's editor opens the moved document with its look; earlier suites still pass. Read-only dev preview of the real app: `/studio/try-it/canvas` 307 to login, `/p/try-it` and `/p/showcase` 200 with the new root. check-types 0 in direct-edit, innergathering, arts-collective.

Not verified: the canvas route signed in, a real save, resolver rows in the canvas, touch. Open: `{{tokens}}` and the Tweaks tab; a fields section for sealed blocks; class attributes; per-run styles (`<b>` with its own letter-spacing); editing the landing page's code-built sections as a tree, which needs them turned into boxes first; the board.

Thin bar, Detach and the landing page as a tree (2026-11-02, source only, not rebuilt).

- Thin bar (`canvas/minibar.ts`), built to the developer's screenshots: a white pill centred 5px above the selection. On words: style chip, swatch, B, I, U, link, then list, align, then comment, more. On a box: swatch, comment, more. On anything else: comment, more. The chip opens Theme (the page's type scale, largest first, named Heading 1 to n, each in its own face, with size and a tick, searchable) and Custom (font, weight, size, line height, letter spacing). The swatch opens Theme and Custom. Comments are kept on the node as `comment` and never drawn. The classifieds editor shares the class, so its bar changed too.
- Selection, as on the canvas: blue outline, four white corners, no name tag except during a drag. Pills replace the top bar (`canvas/edit-shell.ts`): page name and tools at the left; preview, panel, zoom, undo, redo, save and done at the right. Note, pen and shape are shown disabled until the board exists.
- Detach (`canvas/adopt.ts`): what a block drew becomes boxes, keeping each element's tag, class and inline style, so the site's stylesheet still draws it at every width. What sits in the block's slots stays as it is. Data-driven content is frozen by this, which is why it is a choice.
- Landing page: `apps/innergathering/src/app/page.tsx` marks nine live parts with `data-landing-part`; they render the same in both versions. Edit page converts what the page drew into boxes in the browser (`puck/open-page.ts`); nothing changes for visitors until Save writes `puck:landing`, after which `/` renders the tree with its parts. Saved style edits (`page-edits:home`, the developer's red hero) carry over. Restore the original page deletes the row. `/p/landing` and `/studio/landing` redirect home.

Frozen on conversion, on purpose (2026-11-02): hero words and picture, which until now came from /manage/pages and the landing config, the about text, the fundraising heading, cities, vision. After saving a tree those stop following their sources. Live and still following the site: sign-in buttons, offerings, sign-in banner, gallery, join, forum, money raised, fundraising status, board members. Hero picture keeps one size: `srcset` is not carried over.

Verified 2026-11-02: `drive11.cjs` 56/56 (bar options, order, look, Theme, Custom, colour, B I U on the whole and on a range, link, align, comment, more, menu scrolling, pills, panel, zoom, hand, preview, Detach); `drive12.cjs` 20/20 on the real landing markup and CSS from a read-only preview (nothing skipped, nine parts kept, red hero carried, converted page equals the coded page in order and size 20/20, click-through, a heading moved into another box, undo, save, valid page, published through Puck's renderer equals the editor 20/20). Real Next app, preview only, stored tree read from a file through a test page bound over `/data`: 200, all nine parts in place, moved heading, red hero, no editor markers in visitor HTML, no errors; production `puck:landing` rows 0. Earlier suites pass: `drive` 43, `drive4` 39, `drive5` 14, `drive6` 35, `drive7` 18, `drive8` 29, `drive9` 54, `drive10` 46. check-types 0 in direct-edit, innergathering, arts-collective. The developer's own save of a red hero through the live small bar (row present 2026-11-02) is the one signed-in save seen so far.

Not verified: opening the editor signed in on the real app with a stored tree, Restore, a real tree save, touch (no right-click there, so the menu cannot be opened except through the bar's More). The visual layer (`mountVisualEditor`) has the pills but not the thin bar; the landing page no longer uses it.

Next, from the developer's trial of the test page (2026-11-02), not started. Live parts are hard to fit to a page because they are sealed. Two forms of one idea:
- A deeper editor per live component: open one part on its own, shape it for this page, saved with this page.
- A preview of the live data, with the right panel saying exactly what goes where and how grouped pieces work together (a badge, an RSVP button, a date).
The pieces exist in the feed-card work: a box tree whose words name fields as `{{tokens}}`, one design drawn over real rows, and a "Comes from" control in the panel. What is missing is a list of each part's fields and live controls, RSVP being a live control rather than words, and a place in the page document to store a part's design. Falling back to the coded part when no design is saved keeps today's behaviour. Related: the developer space proposal, and the developer's idea of this as an in-window editor for any block.

2026-11-03: `openPageAsTree` on apps/elktours landing: a real tree save and Restore verified signed in in a browser, on a Tailwind page (the earlier "Not verified" items for those two). `CLASS_RE` dropped a whole class list when one class had brackets (`tracking-[0.18em]`); fixed in `block/puck-tree.ts`. Touch is still untested.

Stone 1, a sealed block's own settings with sample data (2026-11-04). Source only: no app rebuilt, nothing committed, no host passes a contract, and the private test page has not been republished with it. No surface code changed. Plan: `canvas-synthesis-2026-11-02/4-build-plan-stone-1.md`. Model and later stones: `canvas-synthesis-2026-11-02/3-synthesis.md`.

- `packages/blocks/src/contract.ts` (`contractOf`, `groupOf`, `dataOf`) states what each block declares, as data. It is not exported from the package index; the harness imports it by path. `packages/direct-edit/src/block/contract.ts` is the structural type direct-edit reads, so direct-edit does not depend on blocks.
- `contract` is an optional field of `TreeEditorOptions` and `TreePageOptions`. With it, selecting a sealed block lists its props in Content, Layout, Appearance and Behaviour, in the rows a box uses (`canvas/block-fields.ts`; new controls `text`, `textarea`, `readout` in `panel/panel.ts`). Rows and lists show by count, read-only; slots have no row. One spell of typing is one undo step, however long the pauses. A select with nothing stored and no default reads "Choose…" (one shared prop: `cycle-badge.status`).
- `url` and `image` values are stored only if `safeLink` or `safeSrc` accepts them and, for pictures, `isPrivatePicture` does not refuse. This runs in the panel only: a stored value is not re-checked, and nothing on a save route checks it.
- Canvas (`puck/TreeCanvas.tsx`, `puck/mount.ts`): data blocks draw `sample` rows beside the document, never in it. A block that throws draws a named stand-in that carries the node's mark, can be selected and deleted, and is tried again on the next draw.
- Detach is refused, in the panel and the menu, on sample rows, a stand-in, an empty label, and a block whose sample holds no rows (`gallery-grid`). Copy style, Reset style and Hide do not touch a sealed block's `look` prop. The Code tab shows the node's props as read-only JSON.
- Test page: view Blocks, with a seed document, "Show saved document" and "Show as published". Assembly and harness repairs: section 7 of `docs/sessions/2026-11-02_canvas-direct-edit-layer.md`.
- Outside the plan's file list: `canvas/menu.ts` (`keepOnScroll`) and `canvas/clickthrough.ts` (`menuKeepsOnScroll`), because a right-click's panel redraw fired a scroll that closed the menu. Passed only with a contract.

Hosts with no contract (innergathering, elktours, and the classifieds and cards editors on arts-collective). The stand-in, the Detach refusals, the `look` guards and the menu option apply only with a contract, so these hosts behave as before, and a rebuild of any of them ships this source. The defects those gates leave in place are in the baseline too: Add, Profile gallery blanks the whole canvas (**verified** on both bundles, page error `reading 'length'`); a right-click can close its own menu just after the panel was scrolled; Reset style stays enabled on a FAQ with a stored look, and Detach on an empty label. Keeping or lifting the gates is the developer's decision.

Verified 2026-11-04 on the final source, in read-only `eac-dev` and isolated Chromium with `--network none`, no database:
- `tsc --noEmit`: direct-edit 0, arts-collective 0, innergathering 0, elktours 0; blocks 2, both `services/src/gather.ts:704,706`, the same as the baseline. `contractOf`'s result assigned to `EditorContract` compiles.
- `drive13` 403/0 (canvas C1 to C13, panel P1 to P19). `drive` 43, `drive4` 39, `drive5` 14, `drive6` 35, `drive7` 18, `drive8` 29, `drive9` 54, `drive10` 46, `drive11` 56, `drive12` 20, all with 0 failures and at the 2026-11-02 counts.
- The checks added from the review (C13, P17, P18, P19) were also run on a copy of the source with those fixes removed: they fail there, 11 failures with all four removed and 2 with only the empty-sample fix removed.
- Assembled page 3,116,257 bytes: `smoke.cjs` 24/0; the hand test of plan section 12, production React, mouse and keyboard, 61/0; Detach clear of the test tabs at four window sizes, 12/0. These two walkers are in the session scratchpad, not the repo. (2026-11-04: copied to `harness/walk.cjs` and `walk2.cjs` at the start of stone 2.)
- No contract, baseline source against final: 416 recorded states (panel HTML, menu rows, stored documents, saves, computed styles) on the tree, classifieds tree, landing, classifieds and cards editors differ in 2, a reveal transition caught mid-fade and a timeout's millisecond text. A 36-step flow differs in 0. Both comparisons strip the one DOM addition, a hidden `data-sync="notice"` placeholder in every panel.
- Screenshots read against `harness/reference/`. Rows match `text chosen, box around it shownabletoexpand.png` in label, grey field, unit and reset column; the Code tab matches `rowlayer4.png` in structure; unusable menu rows stay listed and grey, as in `rightclickmenuplusresizeablecornersonheader.png`. Differences: long labels wrap to two lines (planned), selects show the native arrow as a box's do, the sealed colour popover opens leftward. No reference covers the textarea, the notice line or the new sections.

Not verified: a real host signed in against stored documents; Firefox, Safari, touch; whether the claude.ai sandbox allows `data:` images on the test page (assumed); publishing; phone width after the integration edits (390 and 320 px were read before them).

Open items from the 2026-11-04 review. No shared block reaches the first three today (0 of 175 props, and the third needs a stored document with that type):
- ~~A contract prop named `id` writes the node's identity (`canvas/block-fields.ts:51`).~~ 2026-11-04: fixed in stone 2 (`NOT_A_FIELD`).
- ~~A colour prop with a colon in its name does not open its popover (`block/contract.ts:39`, split at `panel/panel.ts:590`).~~ 2026-11-04: fixed in stone 2's seam, the split is at the first colon; its check is `drive14`'s.
- ~~A stored node of type `constructor`, `__proto__`, `toString` or `hasOwnProperty` throws in `NodeView`, outside the boundary, so the editor does not mount (lookups by inherited name; those lines are unchanged from the baseline).~~ 2026-11-04: fixed in stone 2 (`hasOwn`, `contractFor`, `slotRulesOf`).
- A stored `javascript:` link or `Private/` picture on a sealed block shows in its field with no flag and survives Save (`block/puck-tree.ts:197-201`). Run `cleanPropValue` over contract props on the server save when a host is wired.
- ~~Detach on a parent copies "Unknown block: <type>" as words from a nested unknown block, and drops that node's props (`canvas/tree-editor.ts`, `existing`; same path in the baseline, read, not run).~~ 2026-11-04: fixed in stone 2, with a contract only.
- Four `limit` number props have no bounds (`thread-feed`, `profile-feed`, `profile-galleries`, `profile-record`), so a negative value reaches SQL `LIMIT` and the loader's catch draws an empty feed (read, not run on a host). Text has no length cap.
- ~~Undo with focus in a field and no typing session leaves the old text in the field while the document reverts. It needs a tap that does not blur the field (assumed iOS Safari, not run).~~ 2026-11-04: fixed in stone 2, with a contract only.
- A box's Fill popover scrolls the panel sideways, clipping labels (in the baseline; the fix would change no-contract hosts). The test bars cover part of the bottom sheet at 390 px (test page only; phone width in the popup is a later stone).
- 12 of 30 blocks draw nothing on Add until filled, three of them (questions, picture wall, dated list) until stone 3. Detach on the seed wall loses its pictures, because seed pictures are `data:` addresses and `safeSrc` refuses those.

Rollback: `~/eac-backups/direct-edit/direct-edit-stone1-base.tgz` holds `packages/direct-edit` from before stone 1. `packages/blocks/src/contract.ts` is a new file outside it.

Stone 2, click into a block (2026-11-04). Source only: no app rebuilt, nothing committed, no database write. No surface code changed. Plan: `canvas-synthesis-2026-11-02/5-build-plan-stone-2.md`.

- A sealed block lists existing elements as `parts` (and `tokens`) in its declaration: `hero-banner`, `section-heading`, `prose`, `picture-wall`, `feature-card`, and sunjay's `pt-banner`. A page's look is `props.morph` (`{ v: 1, parts, tokens }`), cleaned at render and in `cleanBoxDoc` (`block/morph.ts`), drawn by `puck/morph-mark.tsx` through the `morph` option of `buildPuckConfig` (`page-builder/src/config.tsx`). With no option the prop is stripped; with nothing set the block's markup is unchanged.
- With a contract: a selection can be a part ref (`block/contract.ts`), parts are rows in the tree, a part's panel has a box's sections with no Kind or Link, a sealed node's panel is its root part, and Tweaks shows "This block". Move, Group, Detach, Duplicate and Delete are grey on a part.
- R-a: `safeDecls` refuses comment markers, `!`, unbalanced brackets or quotes, and values over 160 characters, where it used to cut them. This also applies to classifieds and to `page-edits` at their next rebuild.

Verified 2026-11-04 in read-only `eac-dev` and isolated Chromium with `--network none`:
- Published markup, 93 cases against `~/eac-backups/direct-edit/baseline-render-stone2.json`: 93/0 with no option, `WITH_MARK=1` and `STRAY_MORPH=1`. Run on the source at 15:45; the published path's files are older than that (mtime, latest 14:54), and later edits are editor-only. Through the edge on a real rebuild: not run.
- `tsc --noEmit`: 13 workspaces 0 except blocks' same 2 (`services/src/gather.ts:704,706`), at 15:45. After the last edits: direct-edit, arts-collective, innergathering, elktours, sunjay 0.
- Final build, 3,146,646 bytes: `smoke` 24, `walk` 61, `walk3` 60, `drive13` 408, `drive14` 239, 0 failures. On the source at 15:45: `drive` 43, `drive4` 39, `drive5` 14, `drive6` 35, `drive7` 18, `drive8` 29, `drive9` 54, `drive10` 46, `drive11` 56, `drive12` 20, `smoke-morph` 954, `walk2` 12, 0 failures. No contract against baseline, 416 states: 2 differ (opacity mid-fade, a timeout's milliseconds), the same two as the baseline against itself; 36-step flow: 0.
- Hand test walked by mouse and keyboard on the final build; corrections to its wording are under plan section 8.
- Screenshots read against `rowlayer4.png`, `text chosen, box around it shownabletoexpand.png` and `rightclickmenuplusresizeablecornersonheader.png`. No reference covers "×6", the notice line, Tweaks' rows or the "Block style" chip.

Limits and open items:
- `selectorFor` (`canvas/layers.ts:206`) counts every sibling, and a morph adds a `<template>` and font `<link>`s before its block, so a morph inside a patched section would shift the stored `nth-child` patches after it. Not reachable today (read and grep, 2026-11-04): `patchCss` is drawn only on innergathering's code-built landing, which has no `<Render>` in that branch and no `morph` option; its tree branch draws no patches; sunjay passes `morph` and draws no patches. Not changed, because the selector is the stored key of existing `page-edits` rows. Check it for any host that puts `<Render>` inside a `data-edit-section`.
- A right-click outside the selection selects what a click there would, so right-clicking a title from another block gives the block's menu, not the part's. Same rule as a box.
- `blocks.css:423,1038` `:last-child` rules lose on specificity today, so the marker changes nothing visible there; the spacing control in `smoke-morph` uses a wrapper.
- A panel's tree keeps its scroll when the selection comes from the canvas, so the selected row can be out of view (read in a screenshot, selecting from the wall). The heading stays in view.
- The Code tab has no From rows for values inherited from `body`.
- Stored-css check for R-a: a read-only `SELECT` on `site_config` was refused by the permission system and not retried. What stands: 0 rows held `!important` on 2026-11-02.
- Not verified: a real host signed in; Next's router and a real stream; Firefox, Safari, touch; phone width in the part panel.

2026-11-04, outside this stone: another session's edits are in the tree. `apps/sunjay/src/lib/puck/config.client.ts` and `config.server.ts` pass `morph: MorphMark` and a contract, and `packages/direct-edit/package.json` exports `./puck/morph`, which plan section 1 left for stone 8a. So "no host passes a contract" no longer holds for sunjay's source. `WITH_MARK=1` covers a wired host with nothing set.

Rollback: `~/eac-backups/direct-edit/direct-edit-stone2-base.tgz`.

Developer notes after trying the live page (2026-11-02), for later slices. Click-through accepted as working; the small bar was accepted only as a test of it:
- The box bar does not look like the canvas menus in the screenshots: replace it (next slice, the right-side panel).
- ~~Pictures must come from Nextcloud connections or a file upload, not only a pasted address.~~ Done in source 2026-11-02 (above).
- ~~Right-click should show the tools, with layers as one expandable row, not a layer list alone.~~ Done in source 2026-11-02 (above).
- Thin bar to match the screenshots exactly: done in source 2026-11-02 (above).
- Right-click Add: the list's scroll bar closed the menu. Fixed 2026-11-02: the menu closed on any scroll, its own included (`canvas/menu.ts`).

Known limits: a stored edit is keyed by DOM position, so a code change that restructures a section can move or orphan it (the bar counts orphans; moved edits are not detected); a code
change alters no stored data. Text and data are not editable in this mode. The box bar can cover content above the selection. Touch input was not tested.

Free objects (recommendation, not built): a board object lives in board coordinates, so it moves with the page when panning (the camera moves, not the object). Keep a
`{ anchor: <selector>, dx, dy }` with it, set at creation, as its remembered context; if the anchor is gone it stays at its last board position. Publishing is a later step:
"Submit for review" stores it with a status for a developer to place.

## Finding

The canvas has no blocks. It has one tree of boxes, from the page down to a bold word, and every box is edited the
same way. What a box is called and which controls it gets are read from its tag, its layout and its parent's layout.

Direct-edit has grown the canvas's controls on top of a two-level structure: a flat list of blocks (`ads`), each with
a small tree of parts. The sheet above the ads (masthead, nav, sections, columns) is not in the model, so it cannot be
selected. That is why the panel reaches text in detail but boxes feel secondary.

## What the canvas does

### The tree (observed)

```
Classifieds page            artboard: width, height, print mode, paper, background, radius, layout guide
  group       <div>         background {{paper}}; color; font-family; padding
    Column    <div>         max-width 1200; margin 0 auto; flex column; gap 18
      Header  <header>      flex column; gap 8; position relative
        Row   <div>         flex wrap; space-between; font-size 11; letter-spacing .22em; uppercase; border-bottom
          Text <span>       "Nothing set on this element yet"; everything inherited
      Nav     <nav>         flex wrap; centre; gap 4px 22px; font-size 12; @aria-label
        Text  <a>           text-decoration none; @href #for-sale
      Section <section>     grid, repeat(6, minmax(0,1fr)); gap 18; @class band; @aria-label
        Column <div>        grid-column span 1; flex column; border-right; @id for-sale; @class linecol
          Heading <h2>      type, borders, padding
          Text <div>        12.5px, justify, border-bottom
            Text <b>        letter-spacing .05em     (inline runs are layers too)
```

That path is seven levels deep. Direct-edit allows four below the ad, and 40 nodes per ad (`catalog.ts:78`).

### Rules read from the screenshots

1. **Names are derived** (inferred from the tag and declarations on each row). `<div>` with flex column is Column, flex
   is Row, grid is Grid; `<header>`, `<nav>`, `<section>`, `h*` and `p` name themselves; `span`, `a` and `b` are Text.
   The second label is the first words, `aria-label`, `#id` or `.class`.
2. **Layout is a property of any box** (observed): the Layout menu offers Block / Stack / Grid on the box.
3. **Style cascades** (observed). Size and tracking sit on the Row; the Text inside has nothing of its own. The Code tab
   lists "From ≡ `<div>`" per ancestor, with "+" to adopt a value locally. Tokens appear as values (`{{paper}}`).
4. **The panel depends on context** (observed). A Column in a stack shows Offset and Grow; a Column in a grid shows Column
   span and Row span (video 2). The artboard shows its own section. An oval shows Size and Appearance only.
5. **Hover outlines the deepest box** (observed once, video 2: a paragraph outlined while its ad's neighbour is selected). The
   2026-11-01 live test recorded that one click on text selects the text itself.
6. **Toolbars depend on the object** (observed): a design heading gets style, colour, B I U, link, list, align, comment, more. A free
   title gets size, colour, B, I, comment. An oval gets a nine-colour swatch and comment.

### Free objects are not part of the page (observed; the developer's own reading, 2026-11-02)

The oval and title drawn in video 1 appear in the layer tree as `Oval`, `Title`, then `Classifieds page`: siblings of the
artboard, not children. Position is Absolute, offsets X 720, Y -213 (they sit above the artboard's top edge). The title placed
on the oval did not nest in it. The developer noted these objects move with the canvas and do not become page structure.

So the canvas has two layers: the **page** (flow, nesting, exports) and the **board** around it (free, annotation). This
also answers the sticky-note request: notes belong on the board.

Open: whether "moved with the screen" means they pan with the board or stay fixed to the viewport. The videos do not pan, so
they do not settle it. Board coordinates are assumed.

### Border drag "sometimes only expands to the right" (video 2)

A grid Column's width moved 403 → 389 and its height 542 → 546 while dragged, overflowing its cell without pushing the
neighbour. Inferred cause: an in-flow box is anchored at its cell's top-left, so added width always lands on the right
and bottom, whichever handle is pulled. The mode label is truncated to "Fi…" (Fill or Fixed cannot be told apart).
Implication: this is a canvas weakness not to copy. On a grid, the left handle should move the column start. Not checked:
what `canvas/resize.ts` does with the left and top handles.

## The four systems compared

| | Canvas | Silex / GrapesJS | Puck 0.23 | direct-edit today |
|---|---|---|---|---|
| Unit of editing | Any element | Any component | A block | Block, then its parts |
| Tree | One, page to inline run | One | Blocks and slots; inside a block is opaque | Flat ads, a tree per ad |
| Stored as | HTML, inline styles (inferred) | Component tree and generated CSS, published as HTML | `{type, props}` | Template plus overrides by node id |
| Layout | Property of any box | CSS on any component | Whatever the block's code does | On `box` nodes only; sheet grid separate |
| Semantic tags | Yes | Yes | Block's code | `div`, `h3`, `img` (`catalog.ts:411`) |
| Cascade | CSS, shown per ancestor | CSS | None across blocks; `--blk-*` tokens | Family base per part; boxes setting type for their children: assumed absent, not traced |
| Live data | None observed | Binding engine, `<eac-embed>` islands | Resolvers, 15 `dataDriven` blocks | `{{tokens}}`, one design per item |
| Reuse | Instances ("Detach instance") | Copy; templates | Improve the block, every page follows | Improve the template or family, every ad follows |
| Phones | Author's problem | Author's problem | Block handles it | Grid and stacks; absolute only at Free |
| Sanitised on save | Unknown | HTML sanitiser at render | Fields typed | `cleanDoc`, allow-lists |
| Where it runs here | Outside the platform | 1 of 18 orgs | Six hosts, 40 blocks | Arts-collective (pass 3 live since 2026-11-02 17:05 UTC) |

Limits that matter:

- **Puck.** It selects blocks and sets `pointer-events: none` inside them (`page-builder/src/drag/item-focus.tsx:24`). A nested layer on
  top must keep a second tree inside props, with two selections and two undo stacks. Slots nest blocks, not arbitrary
  boxes. Its value is the block catalogue, resolvers, field definitions and existing pages, not its canvas.
- **Silex.** It has the right tree and interaction, but stored pages are free HTML with no template inheritance, and React
  components only enter as islands. One org uses it; its bridge to blocks was never built.
- **Direct-edit.** The controls, the dial, cleaners, bindings and pattern mode are worth keeping. The limits are structural: `NodeRef` is
  `{node, part}` (`model/nodes.ts:10`), and 1744 lines of behaviour live in a classifieds host
  (`apps/arts-collective/src/lib/classifieds/editor-engine.ts`), which feed cards borrow. It cannot yet be mounted on another page type.

## Proposed model

### One document, one tree

```ts
type Node = {
  id: string;
  type: "box" | "text" | "media" | "live" | "instance";
  tag?: string;        // allow-list: div section header footer nav article aside main h1-h6 p span a figure ...
  layout?: { mode: "block" | "stack" | "grid"; dir?; wrap?; gap?; align?; justify?; cols?; rows? };
  place?:  { w?: Dim; h?: Dim; grow?; cspan?; rspan?; pos?; x?; y? };  // read in terms of the parent's layout
  style?:  Style;      // existing vocabulary; type properties inherit down the tree
  text?:   string;     // existing rich-text allow-list
  bind?:   Record<string, string>;     // {{field}} for repeated designs
  live?:   { block: string; props: unknown };   // a React block, drawn opaque
  ref?:    { pattern: string; over?: Record<string, Partial<Node>> };   // an instance and its overrides
  kids?:   Node[];
};
type Doc = { root: Node; board?: BoardItem[]; theme?: Tokens };
```

Four things separate this from free HTML, and from Silex:

1. **Allow-listed JSON, rendered by React on the server.** No stored HTML; `cleanDoc` stays the gate.
2. **`live` nodes.** A feed list, booking form or auction block is a leaf in the tree: boxes around it are editable, inside it its
   declared fields are. This is what Silex's islands and Puck's blocks both are, in one model. The catalogue is reused through `toPuckFields`.
3. **`instance` nodes.** An ad, a feed card or a tour stop is an instance of a pattern. Override-by-id, "a template improves everything"
   and "one design per data row" all carry over. Today's templates become patterns.
4. **Tokens and the freedom dial** stay on top of the values. The dial now also governs which structural moves are offered.

### The panel as a function

`sections = f(node.type, node.layout, parent.layout, level)`

| Section | Shown when |
|---|---|
| Layers (whole document) | Always |
| Align in parent | Has a parent |
| Size: Hug / Fill / Fixed | Always; Offset and Grow in a stack, Column and Row span in a grid |
| Layout: Block / Stack / Grid, gap, padding | `box` |
| Link | Any node; `a` when set |
| Text | `text`, or any box (sets what its children inherit) |
| Fields | `live` |
| Appearance, Effects, Advanced | Always, gated by level |
| Page: size, background, guides | Root |

A box showing Text controls that write to the box is how "set the type on the Row" works.

### Selection and click-through

The missing behaviour, as understood here (to confirm). Today the first click selects the ad and each further click goes one level in
(`deeperIn`, `model/nodes.ts:77`), and hover follows that rule, so a nested box takes several clicks.

| Input | Result |
|---|---|
| Hover | Outline the deepest box under the pointer, with its name |
| Click | Select the deepest box |
| Click again on the selection, or Enter on a box | Inline text, or first child |
| Esc, or the breadcrumb | Parent, one level at a time |
| Alt+click | Next box down the stack under the pointer, for boxes that cover each other |
| Right-click, "Select layer" | Every box under the pointer, by name (`elementsFromPoint`) |
| Tree row click and hover | Select and outline on the canvas; canvas selection scrolls the tree to the row |
| Drag | Move what is selected if the press is inside it |

Outer-first selection (Figma's default) stays available as a setting if the developer prefers it.

## Four surfaces over one engine

| Surface | Where | Default level | Scope | Stored |
|---|---|---|---|---|
| **Board** | Beside any page in the page editor; a Studio tab | N/A | Stickies, shapes, free text, arrows, comments pinned to a node id. Not published | `Doc.board`, or a per-org board |
| **Live edit** | The real page, in place, "Edit page" | Family | Declared regions only: page and section background, words, pictures, section order | Override doc per page |
| **Page editor** | Studio "Pages" kind and `/hub/sites/<slug>/design` | Borrow | The whole tree, Layers, Code, Tweaks, patterns | `Doc`, versioned |
| **Pattern designer** | Existing classifieds and cards editors | Family/Borrow | One design, many rows or instances | Pattern plus bindings |

**Code-built pages.** Most landing pages are React with hard-coded values, such as `apps/innergathering/src/app/page.tsx:255,293`
(inline section backgrounds). Rewriting them into documents is not needed to change a background. The page wraps a section in
`<EditRegion id="landing.hero" accepts={["background"]}>`; the region reads its overrides from the store and Live edit outlines it.
Later, a region can accept a full tree. This is how a landing page gets a background control first, and more over time.

**Board build or integrate.** Excalidraw is already a dependency (`cms-ui`, `ui`, several apps; used for drawings). It suits a
stand-alone whiteboard. Recommendation: use the engine for notes beside a page, because they need node pins and the same pan and zoom. Keep
Excalidraw for drawings, and do not add a third whiteboard.

## Where each tool goes

| Tool | Decision proposed |
|---|---|
| direct-edit | Becomes the engine: model, tree, canvas, panel, surfaces. Host logic leaves `editor-engine.ts` |
| Puck | Keep running; no new canvas work. Existing pages stay. Its catalogue feeds `live` nodes. A `tree` Puck block can host a box tree in an old page; conversion of `{type, props}` to a `live` node per block looks mechanical (not tried) |
| Silex | Frozen for hidden-enneagram; phases 2-3 not started. Take concepts, not the engine |
| GrapesJS as engine, or another library | Considered and not recommended: rendering React with live data on the server, overrides by id and the cleaners would all be built around it anyway. Craft.js (a React node-tree editor) has not been evaluated; a half-day look is worthwhile before S2 |
| `live-editor` | Live edit replaces it per host over time; its CSS-var panel is the forerunner of Tweaks |
| Studio essay canvas | Stays for writing: flow-only by design (`BLOCK_CANVAS_BRIEF_2026-09-27.md`). A piece can be a `live` node |

## Order of work

Each slice is usable alone. Nothing here needs a production rebuild until S4.

- **S1. Click-through.** The selection table above, on the current classifieds and cards editors. No model change. Small.
- **S2. Node document.** `packages/direct-edit/src/doc`: `Node`, tree operations extended from `block/tree.ts`, `cleanDoc`, one React renderer (from
  `BlockView`), derived names. Selection becomes a node id. Old classifieds and `cards:feed` documents load through a read adapter, as ads become
  instances; no data migration. Depth and node caps rise.
- **S3. Box-first panel.** Panel as a function, tags, cascade with "From …" and adopt. Host logic moved into the package.
- **S4. Live edit and `EditRegion`.** First target: one landing page's background. First production rebuild, on the developer's word.
- **S5. Page editor.** Studio "Pages" kind, `live` nodes, versions (Phase 4 `page_revisions`), org patterns.
- **S6. Board.** Stickies, shapes, node-pinned comments.

S4 and S6 are independent of each other, and S4 needs only S1 and part of S3, so they can be reordered.

Verification per slice as in the existing plan: check-types, esbuild harness with Playwright, server render through the real
renderer, a real render before calling any UI done. Extra check for S2: every saved classifieds document renders the same markup
before and after the adapter.

## What changes in the existing plan

- Plan decision "Edits stored as block data" holds. The meaning of "block" changes: a box tree with instances, not a React component per block.
- Phase 5 "Mount the same panel inside Puck" is replaced by the `tree` block and `live` nodes.
- Phase 1 and 2 panel work is kept; sections become conditional as above.
- Phase 4 (versions, org patterns, review) and the font library are unchanged, and patterns get a clearer shape.

## Open questions for the developer

1. Confirm the direction: box tree as the model, with Puck frozen and feeding `live` nodes.
2. Click-through: deepest-first as proposed, or outer-first?
3. First visible result: S1 then S2 (structure), or S4 early (a landing background on a named page)? Which landing page?
4. Board: internal notes for developers only, or also for members?
5. "Moved with the screen": do the free objects pan with the board or stay put on screen?
6. Member reach: can members at Family see the whole tree, or only the regions Live edit declares?

Popup on sealed blocks and on Para Theater's live blocks (2026-11-04). `canvas/popup.ts`, `canvas/arrange.ts`; double-click a block or right-click, "Open this block large". A second `mountTreePage` on a working copy of one node, writing `morph`; markup is unchanged and parts cannot leave their container.

State, 2026-11-04 evening:
- Para Theater go-live ran at 18:02 EST (`harness/sunjay-go-live.sh`): popup deployed, the Zoom row cleaned, `/try` added. Signed-out compare of 80 pages: 0 status changes, 6 markup differences, all the Zoom removals, 0 editor marks in HTML.
- `/try` first held only static blocks, so the popup had not met a live one. The developer pointed this out; the seed now has feed cards, next gathering, profile, calendar, post list, forum, writing and gallery (`harness/sunjay-try-page.json`, row updated the same evening).
- ~~Source only, not deployed:~~ Deployed 2026-11-04 18:53 EST (second go-live; 80 pages compared, 6 markup differences, all the Zoom removals): parts on those seven block types (`apps/sunjay/src/blocks/data-blocks.tsx`), a plain `<div>` root on `ForumView` and `GalleryView`, clicks reaching parts under a card's cover button (`coveredBy`, `canvas/clickthrough.ts`), and a gap on a holder of repeated cards (`applyShape`).
- Verified with `harness/sunjay-live/` (real config and contract, hand-written rows, isolated browser): all eight blocks open; on the feed cards three clicks reach Title, 2 columns on Cards gives a 16px gap, order and shape on Card apply to all four, "Use on this page" and Save keep `morph` and store no rows.
- Not verified: database rows in the popup, a signed-in session on the live site (a temporary editor account was refused by the permission system), a published render of a morphed live block, parts other than the feed card's being changed, phone width.
- 2026-11-05, deployed 09:11 EST (build `k4zclBf2IC5yRdibIQz_Y`; 80 signed-out pages against the 2026-11-04 snapshot: 0 status and header changes, 0 editor markers, 19 markup differences from content edits and the date; the snapshot's screenshot stage was stopped by a time limit): Picture left and Picture right in Arrange, offered on any part holding one picture and at least one other part (`canvas/arrange.ts`). The picture gets its own column at 38% of the card (`38cqw`, so `container-type` joined `CSS_ALLOWED` in `block/style.ts`); a card with no picture has no column and its words take the full width. The panel reads the fullest repeat of a part, so a first card with no picture still offers the buttons. Verified with `harness/sunjay-live/picture.cjs` (real config, hand-written rows, first card without a picture): left and right, 2 and 3 columns of cards, order, As built restoring the flex card, "Use on this page", Save, 390px width, 0 browser errors, screenshots read. The picture's width has no control in the panel. Not verified: database rows, signed-in live, published render, Firefox, Safari.

Developer, 2026-11-05: highly experimental; keep it to Para Theater for now. No other site gets this until they say so.

Para Theater's home page editable (2026-11-05, stone 15a for `/` only; deployed 09:51 EST, build `Ao2V220qXMD3OviBJDlSP`, no `puck:landing` row saved):
- `apps/sunjay/src/app/page.tsx` draws from code until `puck:landing` exists, then draws that tree. "Edit page" for editors (`components/landing/`); save and Restore behind `getApiEditor` (`saveLandingAction`, `restoreLandingAction`). `landing` joined `TEMPLATE_SLUGS`, so it has no address, and `/studio/landing` redirects to `/`.
- Opened from what a signed-out visitor gets (`openVisitorPage`, `puck/open-page.ts`), per synthesis rule 1: a fetch with no cookies. A failed or redirected fetch leaves the editor shut. `sso-proxy.ts` redirects only `sec-fetch-dest: document`, so the fetch should pass (from reading; not run on the site).
- Differs from the stone's text: the stage, next gathering, forum and sign-up frame are sealed blocks (`blocks/home-blocks.tsx`), not `part` nodes, so they open in the popup and a look is stored as `morph`. The page still draws their contents, so they stay live and per viewer. The banner picture stays a `part`. `/` uses `config.landing.ts` (boxes and these four), not the whole catalogue, so feed cards and other catalogue blocks cannot be added to this page yet.
- `adopt.ts`: a wrapper holding only one classed link stays a box, so a button keeps its class; line breaks in source text become spaces unless the element draws them.
- `popup.ts`: the stage box carries the classes of the page's outer elements and a relative line height. Before this, `.ifs` tokens and `.pts` rules did not reach a block in the popup and large titles overlapped.
- `saveNotice`: said once before the first save. Used on the first save of the home page and on the `event-detail` and `journal-piece` templates. The `.de-vpanel` height fix moved from `CanvasEditor` into `direct-edit.css`, so elktours and innergathering get it on their next rebuild.
- Verified with `harness/sunjay-live/` (`home.cjs`, `home-ssr.tsx`, `home-compare.cjs`) on the real signed-out HTML, CSS and pictures of `/`, with the markers written as `page.tsx` writes them: all four pieces open in the popup, a saved tree holds no signed-in text and no rows, 0 browser errors. The saved tree drawn by the real config and `<Render>` under `renderToStaticMarkup` has the same words and the same position and size for all 126 elements at 1440px and 390px; the one extra element is an image preload tag that this renderer writes inline. Looks set in the popup (picture before words on the stage, 2 columns on the forum card) appear in that render. Type checks and a trial build pass.
- Script weight on `/` (measured 2026-11-05 from `page_client-reference-manifest.js`, page and layout entries, uncompressed): live 1,301,199 bytes, trial build 1,411,004, so +110 KB. Importing `buildPuckConfig` from the package's main entry had made it 2,140,088, because that entry also exports Puck's editor; `config.landing.ts` now imports `@elkdonis/page-builder/config` (new export). 92 KB of what remains is the shared gallery and contact-form client code, reached through `SHARED_BLOCKS` in `page-builder/src/config.tsx`, and `/` does not use it. `/` also makes one more read per request (`loadPage`).
- After deploy, signed out through the edge: `/` 200 with the five markers and no editor marks in HTML; `/landing` 404; `/studio/landing` and its canvas redirect to `/`; 80 pages against the 09:11 snapshot: 0 status and header changes, markup differs on `/` only (those markers and two wrappers); script weight on `/` 1,411,004 bytes as in the trial; 0 server errors since the restart.
- 2026-11-05, about 09:55 EST, first signed-in open on the site failed: `fetch` with `accept: text/html` from a page on plain http carries no Sec-Fetch headers, so `sso-proxy.ts` treated it as a page visit and redirected it to arts-collective.com, which CORS refused. Reproduced with a browser user agent through the edge (307 with that header, 200 without it). Earlier signed-out checks used curl, whose user agent `BOT_UA` skips, so they could not see it. Fixed: no `accept` header, `redirect: "manual"`; deployed 09:59 EST, build `AQydtQKoe208scyjMKK49`. The same request in headless Chromium with a browser user agent, no cookies, from the live site's http and https origins: 200, `.pts-snap` found, all four blocks and the banner marker present. Old and new `/` have identical boxes and words at 1440px and 390px (124 elements).
- Not verified: anything on the site itself (signed-in open, save, Restore, the no-cookie fetch, per-viewer pieces after a save), the stage's script after hydration in a stored page, `/about`, `/community`, `/publications` (not started).
- Limits: a saved page's words stop following `/manage/pages`; later code changes do not reach it until Restore; a save is public at once; a live piece removed from the tree draws nothing if added back in the same session, until saved and reopened.

Open: no review of the popup code. Each block's parts are per-site; the same `.eac-face` cards appear on other sites and would share a declaration when they get a canvas.


## Puck plugin and two-room house (experiment, 2026-11-06)

Harness only, nothing outside `packages/direct-edit/harness/frankenstein/` changed. Details, results and how to run: that folder's `README.md`.

- Part editing as a Puck plugin (`overrides.iframe` + `overrides.fields`, 178 lines) works in page-builder's real `PuckEditor` on Para Theater's config: second click picks a part, outlines, part panel, `morph` written through Puck's `replace` (same shape as `setPartLook`), Puck's undo/redo and Publish, nested blocks in two clicks, 360 px viewport with `@media` firing. `drive.cjs` 34/35 (the miss is key order only).
- Two rooms over one document (Puck editor and the direct-edit canvas, one open at a time, handoff cleaned as a save, refused if a surviving block loses a prop, logged): `house.cjs` 16/16.
- Finding: Puck's editor walks into props that have no field. A `morph` part named like an inline or rich-text field (`title`, `subtitle`, `body`) loses its look in Puck's editor (harness-verified on `pt-banner`; assumed to affect the live `/studio/<slug>` editor on Para Theater; not checked on the site). Published pages are unaffected. Fixed in source 2026-11-06: `buildPuckConfig` adds a hidden `morph` field (`type: "custom"`, `visible: false`) when a host passes `morph` (`packages/page-builder/src/config.tsx`); check-types 0 in page-builder, sunjay, direct-edit, innergathering, elktours; both drivers rerun on the real config without the harness patch (34/35, 16/16). Not rebuilt: reaches Para Theater's `/studio/<slug>` on its next rebuild.

## Site style on elktours (2026-11-06)

Live on elktours since the 2026-11-06 rebuild; first signed-in save by the developer 17:58 UTC (theme and footer rows written, public page carries the sheet); signed-out save refused through the edge. Details: `packages/direct-edit/harness/site-style/README.md`.

- Shared: `@elkdonis/direct-edit/site` (schema, cleaner, one stylesheet function for page and preview) and `@elkdonis/direct-edit/site/editor` (React drawer: Theme, Header, Footer). Written in React as the first piece of the "Puck as the house" direction; it does not use Puck, because the header and footer are not in a Puck document.
- elktours: 11 theme variables (theme in `site_themes`, page_key ''), header and footer parts named by `data-chrome`/`data-part` (looks in `site_config` `site-style:chrome`), owners and guides only, "Site style" button bottom right.
- Verified: `style.cjs` 38/38 in an isolated browser over the site's served CSS; type checks 0 in direct-edit, elktours, sunjay. Found while testing: elktours' page background is a gradient on `body`, so a theme colour alone would not change it (`applies` writes it onto `body` when set).
- Open: contrast of a header part against its own fill; presets (light/dark sets); the landing "Edit page" editor and this drawer can both be open at once.

## Look layer inside Puck's editor (2026-11-06)

Source only: no app rebuilt, nothing committed, no database write. Division of labour (developer, 2026-11-06): Puck owns placement and structure (adding, moving, ordering, deleting, block settings, outline); the look layer owns the look of a block's parts, written to `props.morph` through Puck's `dispatch`, one undo history. Checklist of every canvas capability with its Puck seat and status: `packages/direct-edit/harness/frankenstein/PARITY.md`.

What exists:
- `packages/page-builder/src/parts/` (exported from `@elkdonis/page-builder`): `partsPlugin({ contract, look, panel?, developer?, rootLabel? })`. `overrides.iframe` finds a block's declared parts at event time (`find.ts`, the grammar `morphCss` compiles; elements of a nested block are not the parent's), outlines them, and runs the canvas's click-through inside the selected block (outermost part first, one deeper per click, cousin rule, Alt+click deepest, Enter in, Esc out, from the outermost back to the block). `overrides.fields` replaces the block's fields while a part is selected: "← Block settings" and either the built-in panel or the host's `panel`. Writes: `replace` with `recordHistory: false` while typing, one `history.setHistories` entry when the spell ends (`store.ts`), because Puck's own recording is debounced 250 ms and a blur-time record would race a click on Puck's undo button. `closeItemFocus` added to `drag/item-focus.tsx`; styles in `editor.css`.
- `packages/direct-edit/src/puck/look-panel.ts` (exported from `@elkdonis/direct-edit/puck`): `mountLookPanel`, the canvas's `Panel` with `boxSlots`/`readBox`/`applyKey` (box-panel.ts) and the tree editor's Code helpers, now exported from `canvas/tree-editor.ts` (`codeText`, `setCodeText`, `settleCss`, `dropCss`, `FONT_GROUPS`, `kindOfRole`, `quoted`, `srgbHex`, `firstFamily`, `INHERITED`). No `@puckeditor/core` import; it receives Puck's API as functions. Tabs: Properties, Tweaks when the block declares tokens, Code only with `developer`. `puck/morph-mark.tsx` re-exports `partLookOf`, `setPartLook`, `partSafeDecls`, `setToken`, `tokenOf` for hosts.
- `apps/sunjay/src/components/studio/page-editor.tsx`: `/studio/<slug>` passes `partsPlugin({ contract: canvasContract, look, panel: mountLookPanel, developer: false })` and imports `direct-edit.css`. No other app changed.

Verified 2026-11-06, read-only `eac-dev` bundle, isolated Chromium with `--network none`, Para Theater's real editor config, contract and `/try` seed, stand-in rows: `drive-pkg.cjs` 58/58 (built-in panel), `drive-look.cjs` 30/30 (look panel, developer off and on); screenshots read. `tsc --noEmit` 0 in page-builder, direct-edit, sunjay, elktours, innergathering, arts-collective. Found: Para Theater's sheet sets `border-radius: 0 !important` on every element, Puck's own controls included; Puck wraps inline-editable words in a span, so `boxSlots` read a title as a box (the adapter opens Text fields for parts that read as words); Puck's right column is 274 px, so the look panel's label column is narrowed in `editor.css`.

Not verified: the live site, signed in; a real save and `<Render>` of a document with these looks (Publish hands out the `morph`, and `cleanBoxDoc` keeps it, in the harness); Firefox, Safari, touch; the `set is expensive` warning Puck logs once per recorded look step (the `setHistories` state has no `indexes`, so Puck rebuilds them), measured only as a count.

Open: thin bar, look-only right-click menu, focused look editor ("Edit look"), own blocks' `look` in the panel, a part's background picture, Arrange, resize and part-move handles (to test against Puck's drag), Detach for developers, and a second scope for a look ("every block of this kind on my site"); order and estimate in `PARITY.md`. `developer` stays false on sunjay until it can be given to platform admins only. Making it live on Para Theater: rebuild sunjay per `docs/reference/ops.md`.

## Block popup from Puck Studio (2026-11-06)

Source only: no app rebuilt, nothing committed, no database write. Brief: `docs/open/EDIT_LOOK_POPUP_BRIEF_2026-11-06.md` (steps 1-3 built; step 4 harness run). The canvas's block popup (`canvas/popup.ts`, a second `mountTreePage` on `{ root, content: [node] }`) now has a second door: Puck Studio.

What exists:
- `packages/page-builder/src/parts/popup.tsx`: `openBlockPopupFor` and `LookActionBar`. The parts plugin takes `popup?: BlockPopupOpen` (`parts/types.ts` `BlockPopupContext`); with it, a block the contract lists gets "Edit look" in Puck's action bar (`overrides.actionBar`, Puck's duplicate and delete kept) and opens on a double-click in the canvas (`parts/picker.tsx`); a double-click inside `[data-puck-overlay-portal]` (Puck's inline fields) stays Puck's. Out: the node with the props its resolvers fill (`resolverKeysFor`) taken out into `resolved`, by node id, for it and the nodes in its slots. In, on "Use on this page": the rows put back, one `replace` with `recordHistory: false`, one `history.setHistories` entry (`store.ts` `recordStep`), then `resolveDataById(id, "replace")`, because a plain dispatch runs no resolver (Puck 0.23 `resolveAndReplaceData` is called only from field changes, insert and move). Discard and Esc dispatch nothing. Opening clears the selected part and the open row.
- `packages/direct-edit/src/puck/studio-popup.ts` (`openStudioPopup`, exported from `@elkdonis/direct-edit/puck`): `openBlockPopup` + nested `mountTreePage` with the host's published-shape config and contract, mounted over Studio's window. Ctrl/Cmd+Z, Y and I are stopped at `document.body` while it is open, so Puck's undo does not run beside the popup's (Puck listens on the document after the popup's capture listeners; Puck already refuses Delete and Backspace under a visible `role="dialog"`).
- `canvas/tree-editor.ts`: typing into a sealed block's own words in the popup (`wordsTarget`, `startOwnWords`): a part whose `prop` names a typable prop (string, text, rich text), or `"<rows prop>.<field>"` for one field of the row its nearest `data-edit-item` mark names. Rich text is typed as the inline markup and stored as paragraphs (`richToParagraphs`), then through the host's `cleanRich` (page-builder passes `sanitizeRichValues`, the save path's); a stored text with headings, quotes or numbered lists is refused with a note rather than flattened. React's own nodes are put back before the redraw. A part with no `prop` on a data block says where its words are changed. Options `developer` (only `false` removes the Code tab; the canvas hosts pass nothing and keep it) and `cleanRich`, passed through `puck/mount.ts`. `canvas/interact.ts`: `inList` now counts only a list typed inside the part, so Enter commits a step's text inside the step's `<li>`.
- Contract: `ContractProp.fields` (a rows prop's fields) and the dotted `prop` (`block/contract.ts`, documented on `PartDef.prop` in `packages/blocks/src/types.ts`); `harness/smoke-morph.ts`'s prop check accepts the dotted form (not rerun).
- `apps/sunjay/src/blocks/small-blocks.tsx`: `pt-steps` declares nine parts (root, heading, rule, list, step, number, step words, step title `steps.title`, step text `steps.text`) and marks each step `editItem("steps", <stored index>)`.
- `apps/sunjay/src/components/studio/page-editor.tsx`: `popup: (ctx) => openStudioPopup({ config: canvasConfig, contract: canvasContract }, ctx)`; `developer` stays false.

Verified 2026-11-06 (read-only `eac-dev` bundle, isolated Chromium, Para Theater's real editor config, contract and `/try` seed with two `pt-steps` added, stand-in rows; forum rows with two topics routed in the driver): `drive-popup.cjs` 56/56, screenshots read; `drive-pkg.cjs` 58/58 and `drive-look.cjs` 30/30 rerun; `tsc --noEmit` 0 in page-builder, direct-edit, sunjay, elktours, innergathering, arts-collective. `pt-steps` published markup rendered before and after through `buildPuckConfig` with MorphMark (sample rows, a filtered empty row, no rows): identical except one `data-edit-item="steps:<i>"` attribute per drawn step.

Not verified: the live site, signed in; real `next/font` fonts in the popup (the harness has shims; font family and the number's colour matched the canvas); Firefox, Safari, touch; a Puck history step added by `resolveDataById` when a popup change alters what a resolver reads (none of the tested changes did). At phone width the popup draws the block at the canvas's width (Puck's viewport), zoomed out to fit (28% at 390 px).

Open: words typed into a rich-text row lose single line breaks inside a paragraph (each line becomes a paragraph); the IFAC/current-series card is not wired (the forum was the data block); the `/studio` popup and the in-place part panel are separate paths over the same props, by design (brief section 3). Making it live on Para Theater: rebuild sunjay per `docs/reference/ops.md`.
