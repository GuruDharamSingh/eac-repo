# REORIENT: what was built, measured against "any editor may change anything; each value has one home"

Written 2026-11-21 by the read-only reviewer for Manjushri. Nothing was run signed in; nothing was changed. Claims about code carry `path:line` (paths under `~/eac`). "Unverified" marks what I did not confirm. Part A is for Justin. Part B is the measurement.

---

# PART A. For Justin

## A1. The model, in half a page

**A page** is one stored list of blocks, top to bottom. Nothing else is the page. Whatever you see is that list drawn.

**A block** is an ordinary piece of the page (a banner, a card, a row of buttons) with a short written declaration of what can be changed on it: its *settings* (the words, a picture, a link, a height, a status) and its *parts* (the heading, the picture, the button, each of which can be restyled).

**A value** is one thing you can change: a banner's height, a card's title, a heading's colour. The rule is that each value lives in exactly one place. "Where it lives" is a fact about the page, like which drawer holds the spoons. It says nothing about who may open the drawer.

**The three editors** are three ways of reaching the same values:
- the **direct editor** (the canvas with the side panel): you click the page itself; strongest at arranging and at looks;
- **Puck** (the block list, the fields panel, drag): strongest at settings and at seeing the whole stack of blocks;
- the **live editor** (type one value on the page where it shows): strongest at words.

**The rule from today.** Any editor may change anything. Words, pictures and looks can be done in all three. Arranging blocks can be done in Puck's list and on the canvas. A change made in one shows in the others at once, because there is only one stored page behind them. "Edited" can be recorded against whoever made the change.

**"Making Puck's studio ours."** Already ours:
- the stored format (a plain list, not Puck's private state);
- the operations that add, move, copy and remove blocks (`packages/direct-edit/src/block/puck-tree.ts`), and Puck's engine run with no screen at all to do the same work (the "door", `packages/house-editor/src/steps`, 87 checks pass headless per the ledger);
- the canvas and the look panel.

Still borrowed from Puck, to be replaced in steps:
- the **fields panel** (the form for a block's settings, with its little pickers);
- the **block list** (the outline, drag to reorder);
- **drag in its preview** (dropping a block from the side onto the page);
- the **outline** (the tree view).

"Ours" means: the same panel, written by us, drawing the same block declarations, with Puck's code gone from what you see. You still get a block list, a drawer of blocks, and a settings column. They are ours to bend: a Content tab, stored media as a picker, hide parts, drag a template.

## A2. Sessions, in order

Nothing below ships to a site without a signed-in check on a throwaway copy with every save aborted, and you looking at it afterwards. The other PM's test guide account on `inner_group` exists (board, PM reply item 4); it is theirs, so we ask first (question 9).

**Session 1. Mend what you can see broken.**
- Aim: innergathering's landing works again signed in: the Site theme button is back, "Settings" opens something, and Current offerings is drawn with its real gathering and picture.
- At the end you can: open the landing editor on elkdonis-arts.org and see the real card, real cover, the theme button, and a settings window that shows fields. Also fixed: the test guide account shown publicly on elktours, and the empty first tour card (both in the ledger as seen, not fixed).
- Touches: `apps/innergathering` (landing page, edit button, mount), the Site theme button's check, one guard in `packages/page-builder/src/block-settings.tsx` so a crash can never leave a blank white sheet. Details in `reports/IG-faults.md`.
- Checked: on a dev copy signed in as the test guide, a screenshot of each fault before and after; the browser console read for errors; then you open it on your own login before it counts as shipped. Until then, recommend rolling the live site back (question 6).

**Session 2. The Content tab.**
- Aim: block settings appear as a tab at the top of the side panel you already click, not as a separate popup.
- At the end you can: click a banner, see "Content" beside "Look", and change its words, link, picture, status and height there. "Settings..." stays only for what the tab cannot draw yet (lists of rows, rich text).
- Touches: `packages/direct-edit` (the panel already has a "props" tab and already draws a block's declared settings: `canvas/tree-editor.ts:1078`, `blockValues` at `:936`; which kinds it covers I did not verify), `packages/blocks/src/types.ts` for the kind list. The Puck sheet is only the fallback.
- Checked: each block kind on a dev copy of each canvas site (sunjay, elktours, hidden-enneagram, innergathering): type a value, save aborted, reload, nothing lost; the door's checks stay green.

**Session 3. Dragging a handle changes the setting.**
- Aim: dragging a banner's bottom edge in the direct editor writes the banner's Height setting, the same value Puck's handle writes and the Content tab shows. Paratheater's banner is the test.
- At the end you can: resize the paratheater banner by hand and see the number in the Content tab move. One undo undoes it.
- Touches: `packages/blocks/src/contract.ts` and `packages/direct-edit/src/block/contract.ts` (carry each block's `resize` declaration; today neither does), the resize path in `packages/direct-edit/src/canvas/tree-editor.ts`, the door's number setting. It also settles the two homes of a block's look (question 5).
- Checked: the banner on a dev copy of sunjay (`apps/sunjay/src/blocks/layout-blocks.tsx:316`), then `hero-banner` and `section-banner`: handle and Content tab agree to the pixel.

**Session 4. Type words on the canvas.**
- Aim: double-click any words on the page and type them, for any block, with no popup first. Header text included.
- At the end you can: click a header on the landing page, type, and it is saved as that block's setting; other kinds (a link, a yes/no, a choice) get a one-click control on the spot.
- Touches: the double-click order at `packages/direct-edit/src/canvas/tree-editor.ts:1850` (a sealed block opens the popup first, so typing is only reachable inside it), the Fields lens kinds at `packages/house-editor/src/fields/blockmap.ts:21,55` (plain string and text only), and the Fields lens bar, so it becomes part of the one editor rather than a second "Edit wording" mode.
- Checked: a signed-in typing pass on each canvas site, including a block filled from a record (question 3), with the "edited" mark visible.

**Session 5. Pickers inside the studio.**
- Aim: the stored-media library and the directory search appear inside the side panel as pickers for any picture, person or gathering setting.
- At the end you can: pick a photo from the library while editing a card, or search the directory for a guide and drop their card in.
- Touches: `packages/page-builder/src/fields` (picker fields), `packages/cms-ui/src/files`, elktours' register-in-place menu (`ELKTOURS_BLOCK_FORWARD_2026-11-21/MEDIA.md`), and your answer to question 8.
- Checked: pick, save aborted, reload, the chosen item still shows; a guide who may not see an item does not see it in the list.

**Session 6. Patterns.**
- Aim: a saved arrangement ("heading and two columns", "offer card and row") that you drag in as one piece.
- Not scheduled by us: the other PM has taken "Sections / templates insert" (board, PM reply: `packages/page-builder/src/templates/**`, sunjay `page-editor.tsx`). We wait for it, then build patterns on its insert step with `apps/development` as the staging ground, as you said. About as its own page follows.

## A3. The questions only you can answer (ten)

1. **The same title in three places.** A tour title shows on the tour page, on its card on the landing page, and in the menu. Which edit changes all three, and which changes one?
   - A: typing a title anywhere changes the record, so all three change. Cost: you cannot give one card a different title without a second setting.
   - B: typing on a block changes that block only (an override). Cost: titles drift apart and you find out by looking.
   - C (my pick): the record is the one home; a block offers a labelled "own wording on this block" switch that stores a separate value on that block only. Cost: one extra control. Today's `feature-card` already does a silent version (typed wording beats the record: `packages/blocks/src/blocks/feature-card.tsx:130`).
2. **"Edited, awaiting review": your own edits too?**
   - Only other people's: you work freely, guides' edits wait for you. Cost: your own typos go live at once.
   - Everyone's: every edit shows "edited" until confirmed. Cost: you confirm your own (one click, "confirm all").
   - My pick: only others', plus a "show me what changed since I last looked" for yours.
3. **What does the Content tab show for a block whose content comes from a record** (a card filled from a tour)?
   - The record's values greyed out with "change on the tour page" and a link. Cost: no fixing a typo in place.
   - The record's values editable, writing back to the record. Cost: a guide could change a tour from a landing page; needs the central permission check you described.
   - My pick: greyed unless you may edit that record, in which case editable and written to the record; plus the "own wording" switch (question 1).
4. **Does the Puck studio stay a separate screen for anything?**
   - No: one editor; the Puck screen goes when the block list and drag are ours. Cost: the longest build.
   - Yes, for new pages and the whole-stack outline only. Cost: two entrances to maintain.
   - My pick: yes for now, as an optional outline view inside the same screen; no separate screens for settings.
5. **What happens to Puck's Style panel now that the look panel exists?** A block's colour can be set in two places that disagree: Puck's "Style" (stored as `blkStyle`) and the look (stored as `morph`); the look panel prints a clash note (`packages/direct-edit/src/puck/look-panel.ts:116`).
   - Hide Style, keep the look: one home. Cost: blocks styled in Style today are converted once (a script, tried on a copy).
   - Keep Style, hide the look on those blocks. Cost: hover and phone options are lost there.
   - My pick: the look wins; Style hidden once a block has a look, with a one-time conversion.
6. **Roll back now, or fix forward?** My call per item, from Part B:
   - innergathering block-pass build (live now): **roll live back to the 10:40 build** until Session 1 passes signed in. Cost: Current offerings goes back to a sealed part. First check that no landing save since 17:50 wrote the new block types into the stored page (unverified; if one did, the 10:40 build would meet unknown block types).
   - Fields lens bar: **fix forward** (likely cause of the missing theme button).
   - Puck "Settings..." sheet: **fix forward**: crash guard now, replaced by the Content tab.
   - Scaled-beside-the-panel editing: **keep**.
   - Look panel "On hover / On phones": **keep**.
   - Sites / Pages "hands" in apps/development: **leave**, as you said.
   - elktours blocks, library picker, register-in-place: **keep**.
   - Tour "previous version": **keep** for now (question 7).
   - Drafts and assistant draft tools: **keep, dormant**.
7. **Two kinds of "previous version".** A tour's fields keep one previous value (`threads.metadata.previousVersions`, `apps/elktours/src/lib/tour-fields.ts:5-9`); pages have versions (migration 281 `dev_versions`, the other PM's). One history per thing you are looking at, or stay separate?
   - One list: cost, a bigger change to the tour save path.
   - Separate: cost, two different "put back" answers on screen.
   - My pick: separate until Session 4, then one "history" button.
8. **Which library inside the studio?** The org media library, the tour pictures registered in place, or both on tabs? Cost of both: a decision on credits and on guides who see only their own tours (decided for elktours; not for the other sites).
9. **Test account.** May my agents use the `inner_group` test guide (the other PM's), on throwaway copies, every save aborted? Cost of no: nothing on innergathering can be checked signed in, which is how the three faults shipped.
10. **Undo.** The canvas and Puck's sheet keep separate undo lists. After Session 2 there is one list inside the one panel. Is it acceptable until then that a change made in the old Puck sheet is undone only there?

---

# PART B. The measurement

## B1. How to read it

- **Fit**: Fits (keep), Change (what exactly), or Works against (undo or replace).
- **Signed in?** Whether anyone looked at it signed in. Per the ledger (`LEDGER.md`, 11:39 entry and report lines): not for anything except what Justin used himself.
- **Risk if left live**: what a visitor, owner or the stored data would meet.

## B2. Shared packages

| Piece | What it is | Fit | Signed in? | Risk if left as is |
|---|---|---|---|---|
| **Step door** `packages/house-editor/src/steps` | One checked way to change a page: set a setting, set a look, add/move/copy/remove a block. | **Fits.** The words / look split is about where a value LIVES: `side: "words"` / `"look"` at `steps/index.ts:85,91,96` labels the result, and `LOOK_PROPS` (`steps/types.ts:74`) lists three look homes (`morph`, `look`, `blkStyle`). Nothing in `StepContext` (`steps/types.ts`) says who is writing, so no editor is barred. Change: `setWord` (`steps/words.ts`) already takes number, select, boolean, so a handle can call it for a banner height with no change to the door. It refuses record-filled settings (`bound_prop`) and any kind beyond text, url, image, number, boolean, select (`unsupported_kind`). `set_look` writes only `morph`. | No (87 headless checks) | Low. The three look keys are the real issue (B5). |
| **Drafts** `packages/page-builder/src/drafts.ts` | A saved draft of an org page, with compare-and-set. | **Fits** as the one home for "not live yet"; only apps/development uses it. | No | Low. |
| **Stale-save guard** `packages/page-builder/src/store.ts:150-157` | Refuses a save if the page changed since you opened it. | **Fits.** `::text::timestamptz` verified at `:157`. | Not by the agents; ledger says saves work again after the hotfix. | Low. |
| **Hidden `morph` / `look` object fields** `packages/page-builder/src/config.tsx:472-500` | Stop Puck rewriting a part's look as a setting. | **Fits** (plumbing). | No | Low. Note: only if the site passes `morph` (`config.tsx:338-342`); innergathering does not. |
| **Look states and screen sizes** `packages/direct-edit/src/block/morph.ts`, `panel/where.ts`, `puck/look-panel.ts` | A part's look can differ on hover, focus, press and on phones; "When" and "Screen" switches and a clash note. | **Fits.** The clash note (`look-panel.ts:116`) is the symptom of two homes (B5). | No (harness 152) | Low. |
| **Scaled editing beside the panel** `canvas/tree-editor.ts` (`fitToPanel` `:98,369-461,1941`), `edit-shell.ts`, `box-drag.ts` | The live page keeps its visitor width and is drawn about 76% beside the panel. | **Fits** (one editor, no layout jump). | Dev-copy measurement only (ELK-landing.md); live on elktours. | Medium: applies to every `openPageAsTree` / `openVisitorPage` page (`puck/open-page.ts:51,91`); it leaked onto `/studio` once already. |
| **`liveNote`** `tree-editor.ts:99,1093` | A panel note for a "live part", telling you where it can really be changed. | **Works against** the rule in effect: it says a thing "has no settings to open" (elktours mount `:19-25`). Change: make each live part a block with settings; the note then disappears. | No | Low. |
| **Fields lens** `packages/house-editor/src/fields/*` | Click text on a page to type it in place; a bar offers "Edit wording" / "Edit page". | **Change.** (1) Plain `string` and `text` settings only, and nothing record-filled (`blockmap.ts:21,55`). (2) A second bar and mode beside "Edit page" (`FieldsLens.tsx:283-300`), so you change mode to type. (3) "Edit the look..." goes to another screen: `apps/innergathering/src/components/fields/FieldsLensMount.tsx:19` points at `/studio`. (4) It renders a `[data-de-ui]` div whenever a field is found (`FieldsLens.tsx:283,287`): the likely cause of fault 1. | Not by the agents (LIVE-wave2.md:55) | **Medium-high**: hides innergathering's Site theme button; adds a second bar on four sites. |
| **Direct editor writes looks only** `canvas/tree-editor.ts:1211-1224` (`writeLook`) | Every handle and panel control writes to the look. | **Change.** For a sealed block it writes `editLookAt(node.props, part, ...)` (`:1215-1218`); for a box, `node.props.look` (`:1221-1223`). No path reaches a declared setting; resize and drag handles inherit this. | Justin hit it on paratheater | Medium: the handle appears to work and writes a value the banner may ignore. |
| **What a handle writing a setting would take** | Puck's handle does it already: a block declares `resize: { height: "<setting>", target? }` (`packages/blocks/src/types.ts:407-412`) and `page-builder/src/drag/height-handle.tsx:69-75` writes that setting. Declared by `hero-banner.tsx:115`, `section-banner.tsx:96`, `split-row.tsx:148` (`minHeight`), `figure.tsx:199`, sunjay `layout-blocks.tsx:316`, katie `quick-landing.tsx:237`. | **Change, small.** (a) Neither `packages/blocks/src/contract.ts` nor `packages/direct-edit/src/block/contract.ts:42-53` carries `resize`: add it. (b) In the canvas resize handler, for a sealed block with `resize.height`, route the drag to the door's `setWord` instead of `writeLook`, as one undo step. (c) Width has no declared setting, so it stays a look. | n/a | n/a |
| **Block settings sheet** `packages/page-builder/src/block-settings.tsx`, wired by `house-editor/src/landing.ts:88-105` | A second full-screen Puck on one block, with Apply / Cancel. | **Works against** the rule in form (a separate screen); it is the "separate settings popup" Justin does not want. Replace by the Content tab; keep as fallback. No error boundary around `<Puck>` (`:130-146`); a throw leaves the white sheet (`:159-165`). | Seen broken by Justin on innergathering | **High** where newly wired (innergathering). |
| **House landing bind** `house-editor/src/landing.ts` | Opens a code-drawn page as a tree, with optional "Settings...". | **Change.** `resolved` and `orgId` are optional and silently absent (`:42,44`); a mount that omits them draws samples (fault 3). | elktours by Justin; innergathering broken | Medium. |
| **Blocks `reads:`** `packages/blocks/src/types.ts`, feature-card etc. | A block states what it reads (viewer, site, record). | **Fits.** | n/a | Low. |
| **Duplicate-name guard** `packages/blocks/src/registry.ts` | Refuses a part named like its own slot. | **Fits.** | n/a | Low. |
| **MCP read tools and draft tools** `packages/mcp`, `apps/arts-collective/src/app/api/mcp/route.ts` | Assistants read page structure and propose changes as drafts. | **Fits**: an assistant is one more editor writing through the same door; a draft is a home for "edited, awaiting review". Three blocks' access switches are read-only to assistants (CLOSEOUT.md). | No `mcp:draft` key exists | Low. "Any editor may change anything" now means a key needs the central check Justin described. |
| **Atlas regeneration** | A map of capabilities. | **Neutral.** | n/a | Low. |

## B3. Apps

| Piece | What it is | Fit | Signed in? | Risk |
|---|---|---|---|---|
| **innergathering block pass** (`offerings-band`, `grand-forum`, mount, config) | "Current offerings" and "Grand Forum" as blocks with settings. | **Change, and hold.** The idea fits (a live part becomes a block with settings). The build fails: three signed-in faults (`reports/IG-faults.md`). | No, then Justin saw three faults | **High**: live on the owner's own site since 17:50. |
| **innergathering About pattern** `ABOUT_PATTERN` | Data for "heading and two columns". | **Fits**, unused. | n/a | None. |
| **elktours new blocks** (`m-page-buttons`, `m-phone-menu`, `tour-cards`, `hero-city-title`, `booking-options`, `locations`) | Phone page buttons, phone menu, tour cards, landing title, booking options, locations. | **Fits.** Two unplaced. Change: `tour-cards` is still a live part with a note sending you to `/manage/tours`, against the rule. | Not by agents; Justin looked at elktours | Medium. |
| **elktours library picker + register-in-place** (`MEDIA.md`) | Choose a picture from the org library; register tour pictures in place. | **Fits**; the seed of Session 5. The HTTP route was never run signed in (MEDIA.md:203). | No | Medium: 46 `tour_assets` rows registered hidden; atlas notes any guide can scan or register any tour's pictures (CLOSEOUT.md). |
| **elktours on-page tour editing** `apps/elktours/src/lib/tour-fields.ts` | Click title, "what to expect", stop lines, "good to know", contact on the phone tour page; one previous version kept. | **Fits** for words; a second home for history (B5). | "Signed-in look: not done" (ELK-tour-detail.md:103) | Medium. |
| **elktours landing editor** `apps/elktours/src/components/landing/page-editor-mount.ts` | The landing as a tree with "Settings...". | **Fits.** It passes `resolved`, `orgId`, `version`, `records` (`:30-45`), which innergathering omits. | Justin used it | Medium. |
| **Fields-lens binds on sunjay, elktours, hidden-enneagram, innergathering** (`components/fields/*`) | The same lens on each site. | **Change** with the lens. | Not by agents | Medium. |
| **apps/development hands** `src/components/sites/SiteHands.tsx`, `PagesView.tsx`, `src/app/sites`, `src/app/pages` | A three-panel test UI: Words, Look, Blocks, Assistant (`SiteHands.tsx:9-12`), and a Pages list with typing in place. | **Works against the rule by being a third editor.** `PagesView.tsx:8-13` imports `packages/house-editor/src/fields/*` by relative path instead of the package. Justin said leave it. Pointing it at the real editors would mean: Sites opens `openHouseLanding` or `HouseWholePage` on the chosen page; the Words / Look / Blocks hands go; "Assistant" (paste JSON steps) stays as a developer drawer. | No | Low (internal, org `development`). |
| **arts-collective MCP route** | Assistant doors. | **Fits.** | `/api/mcp` answers 401 without a key (ledger) | Low. |
| **Migrations 282, 283** | `mcp_grants`; an org named `development`. | **Fits.** | n/a | Low. |
| **danamccool, first Puck 0.24 build** | Her site on the new engine. | **Fits.** Her `/art-archive` collapse predates this work (ledger). | Pixels only | Medium: a real fault on a live page. |

## B4. Where a report and the code disagree

- **IG-landing.md: "Settings... ... both now passed ... works through the read-time swap."** The mount does pass both (`page-editor-mount.ts:26`), but the swap yields blocks that carry only an id (`apps/innergathering/src/lib/puck/landing-blocks.ts:34,38`), and the sheet was never opened (the report: "Not tested signed in").
- **IG-landing.md: "no test account on this org".** The other PM reports a test guide on `inner_group` (`LIAISON/HOUSE_EDITOR_PM.md`, PM reply item 4). It was available.
- **IG-landing.md raises the missing `openPageAsTree` hook for the first-visit path.** The saved-tree path, which is what the live site uses, is what broke.
- **LEDGER 09:07 and 11:24 "identical" lines** hold for signed-out pixels only; the editor was never opened signed in (the ledger's own lesson, 11:39).
- **The contract as "the one description of a block"** omits `resize` (`packages/blocks/src/contract.ts`, `packages/direct-edit/src/block/contract.ts:42-53`), which is why the canvas cannot do what Puck's handle does. I did not re-read the doctrine's exact wording.

## B5. Values with more than one home

| Value | Home 1 | Home 2 (and 3) | Which should win |
|---|---|---|---|
| A block's root colour, spacing, font | Puck "Style", stored as `blkStyle` (`page-builder/src/config.tsx:467`) | The look, stored as `morph` (`config.tsx:486`); a box's own `look` is a third (`tree-editor.ts:1221`) | The look. Style hidden once a look exists; one conversion. |
| A card's title or words | The record (`feature-card` reads `bound`) | The typed setting; typed wins (`packages/blocks/src/blocks/feature-card.tsx:130`) | The record, with an explicit, labelled "own wording" override. |
| A banner's height | The block setting (`height`) | The look (`h` on `morph.root`), written by the direct editor's handle | The setting; the handle writes the setting (Session 3). |
| Undo | The canvas's history | Puck's sheet history (and the block popup's) | One list in the one panel (Session 2). |
| Live versus not-yet-live | The stored page row | Drafts (`puck-draft:<slug>`, `drafts.ts`) | Draft is the one home for "not live", the row for live. Only apps/development uses drafts today. |
| A tour's words and history | `threads.title`, `excerpt`, `metadata.*` plus `previousVersions` (`tour-fields.ts:5-9`) | Page versions `dev_versions` (migration 281, the other PM's) | Separate things (tour versus page) until question 7. |
| innergathering hero wording | The saved tree's copy of the words | The "Home page header" card in Manage (IG-landing.md, table row 1) | The page block; the Manage card should point at it. |
