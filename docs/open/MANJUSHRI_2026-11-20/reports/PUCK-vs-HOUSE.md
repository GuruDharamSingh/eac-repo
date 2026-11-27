# Puck studio vs the house canvas, menu, two buttons, building vs editing

Research lead report, 2026-11-23. Read-only; nothing run. Puck 0.24.0 = `node_modules/.pnpm/@puckeditor+core@0.24.0_*/.../dist/index.js` (cited `P:line`). Canvas = `packages/direct-edit/src/canvas` (cited `de:file:line`). Earlier notes: `docs/open/MANJUSHRI_2026-11-20/puck-internals.md` (cited `PI`).

## 1. Placing blocks: Puck's studio vs our canvas

| Feature | Puck does | Our canvas | Still reachable via Studio (Puck) screen? |
|---|---|---|---|
| Drag a NEW block from a list into the page | Left rail Blocks list (`ComponentList` P:13644); drag a card into any drop zone; `insertComponent` P:11479 | **Nothing.** No list to drag from. New blocks come only from a right-click "Add" submenu: Box, Words, Picture, presets, catalogue (de:tree-editor.ts:1920-1925) and tools T/F (:474-476, :2076-2079) | Yes, `/studio/<slug>/blocks` (elktours, sunjay, hidden-enneagram). innergathering: Puck at `/studio/<slug>` |
| Drop zones, insertion line | dnd-kit slots, drop-zone outlines, preview index | Equal-ish for moving existing nodes: `nodedrag.ts:1-25` draws an insertion line, outlines the target, pulls a part out of a row. Moves existing boxes only | Yes |
| Between slots / nested slots | Slot `allow/disallow` rules, depth priority (PI sec 6) | Lesser: nodes drag among box containers by the host's rules (freedom level); no per-slot allow lists | Yes |
| Reorder | Drag on canvas or in outline | Equal: drag, `[` `]` to first/last (:2086-2087), layer rows `data-drag` (panel.ts:366), arrows nudge in free-move | Yes |
| Outline / layers tree | Outline plugin tab, own dnd (P:17337) | Lesser-to-equal: Layers list in the panel Code tab, twist-open, hide eye, drag (panel.ts:292, 366-373). Not a left rail; rows are DOM boxes, not only blocks | Yes |
| Component list, categories, search | Categories from `config.categories` (P:13727). **No search in 0.24** (grep of `index.js` finds none) | Flat "Add" submenu (de:tree-editor.ts:1923). Categories exist in our Puck config (`page-builder/src/config.tsx:625-637`) but the canvas ignores them. No search | Yes (categories only) |
| Keyboard moves | Hotkeys: only undo/redo (P:2885-2894). **No** key-moves, delete or duplicate keys | Better: Del, `[` `]`, Ctrl+D duplicate, Ctrl+G group/ungroup, V/H/T/F tools, Esc selects parent, Enter goes in (tree-editor.ts:2073-2090; clickthrough.ts:281) | n/a |
| Duplicate / delete | Action bar buttons; re-ids children (P:2246) | Equal: menu + keys + multi-select delete (:1059, 1936, 1945) | Yes |
| Copy and paste a block | **None** (no clipboard in Puck 0.24; PI) | **None for blocks.** Copy/Paste **style** only (:1939-1940); Copy as HTML/PNG (export.ts) | No |
| Undo history | Reducer history, 250 ms debounce, Ctrl+Z / Y (P:2916-2929) | Equal: own `History` (model/history), coalesces typing, Ctrl+Z / Shift+Z (edit-shell.ts:198-201); dirty guard on leave | Yes (separate history per screen, same stored doc) |
| Viewport switcher | 360/768/1280/100% + zoom (P:2696, 3460) | Lesser: zoom, fit, one phone-width preview (view.ts:24-68). No tablet | Yes |
| Iframe preview | Canvas is an iframe with copied host styles (P:3534, PI sec 5) | **Different, not lesser:** edits the real live page in place (`de-editing` class), no iframe. Real header, real data | Yes |
| Permissions per block | `drag/duplicate/delete/edit/insert` (+`resolvePermissions`) | Partial: freedom levels, sealed blocks, parts-cannot-leave-block (:2082); `memberSafe` only reaches Puck (`config.tsx:519`) | Yes (Puck) |
| Inline text | 0.24 `richtext` field + `InlineTextField` (P:11264) | Equal or better: type on the page, mini-bar (bold/link), Enter/Esc (interact.ts:203-214); Fields lens for short words | Richtext only if a block turns it on (`config.tsx:276-427`; most blocks use textarea, `blocks/src/editor.ts:134`) |
| `resolveData` | Per block, once per resolve in 0.24 (rsc.js:1142) | Equal by other means: server `resolveAllData` + `resolved` map handed to canvas (`RESOLVED_KEYS`) | Yes |
| `resolveFields` (dynamic fields) | Yes (P:3249-3320) | **Nothing**; **we use none** (no `resolveFields` anywhere in page-builder/blocks/house-editor) | n/a |
| Action bar on selected block | Floating bar (label, parent, duplicate, delete, optional drag handle P:10453) | Equal-plus: floating mini-bar (minibar.ts) and right-click menu with 20+ items | Yes |
| Plugins, left rail | `plugins` tabs; built-ins Blocks, Outline, Fields (P:4024-4027) | Nothing like a rail: right side panel with tabs (Props, Content, Look, Code). Rail tabs live only in Puck: Sections, Templates, Menu, Pages (`page-builder/src/templates/*`, `menu/menu-plugin.tsx`), Parts, Galleries, Media | **Only via Studio** |

### Ranked: five things Puck has that would most improve our canvas
1. **A block library you can drag from (with the existing categories).** Today a new block is a right-click submenu; the catalogue is flat. Puck's Blocks list plus our `categories` solves this (config.tsx:625).
2. **The left rail: Sections, Templates, Pages, Menu tabs on the page itself.** These only exist inside Puck. PLAN step D wants it; not built.
3. **Per-block permissions (`drag/insert/delete/edit`)** on the canvas, so a sealed hero cannot be dragged away by a guide. Canvas has only freedom levels.
4. **Drop zones with allow/disallow rules per slot**, so a block can only go where it belongs.
5. **A viewport switcher with tablet width** (canvas has one phone width only).

Not a Puck advantage: copy/paste of whole blocks (neither has it; an opportunity). `resolveFields` is also unused by us.

### What we have that Puck does not
Edit the real live page with real chrome and data (no iframe); type directly on text; look per part (parts / morph, Copy style / Paste style); free-move and resize boxes; group/ungroup/detach; Del, [ ], Ctrl+D keys; hide-on-page eye; multi-select; Fields lens; stale-save guard; record-aware values.

## 2. Menu, pages, the two buttons

### Menu today, per site
- **Store:** `site_config` row, key `nav:main` per org (`packages/services/src/nav.ts:20-56`, `loadSiteNav`/`saveSiteNav`). Item = `{label, href, external?, sub?}` (`nav-core.ts:17-34`); `sub:true` makes a one-level dropdown (`groupNav`). Flat list; reorder with up/down buttons; remove; add from page candidates or free text (`page-builder/src/menu/nav-editor.tsx:109-243`). **No "hide" flag** (remove the item instead). A menu item can point at any page or an external URL.
- **Editing UI:** the Menu tab of Puck's rail (`menu/menu-plugin.tsx`), wired in sunjay (`components/studio/page-editor.tsx:16`), katie (`menu-plugin.ts:9`), danamccool (`editor-tabs.tsx:143`, plus `/studio/navigation`). **Only danamccool has a stored `nav:main` row** (SELECT on site_config: `danamccool|nav:main`, 829 bytes). Sunjay and katie read the row but fall back to `DEFAULT_NAV`.
- **hidden-enneagram:** no store. `links` and `more` are hard-coded arrays in `app/layout.tsx:63-74`, fed by feeds. Edit = code. innergathering: no nav store found.
- **elktours (desktop header):** `components/site-header.tsx:44-51`: hard-coded array: Tours, then each `offerings` row (data from org feeds), About. No dropdown, no reorder, no hide, no Menu tab. The only owner levers are the feeds. Header looks (colours, fonts) are styled by Site style via `data-part` marks.
- **elktours (phone):** block `m-phone-menu` (`blocks/mobile/phone-menu.tsx:29-37`): array "Items" with Words, Where it goes (a page of the site), Icon, **Who sees it** (audience = hide per viewer), plus Shape and "Pages it shows on". Reorder through Puck's array field. Lives inside the phone page documents `puck:m-<name>` (default in `lib/puck/mobile-defaults.ts:8`), edited at `/studio/m-<name>` (`MobilePageEditor`). No dropdown. `m-masthead` (`blocks/mobile/discover.tsx:17-40`) is wordmark + city pill that opens the City sheet, static copy, not a menu list. Guest bottom tabs `GuestTabBar` (`mobile/guest-tab-bar.tsx:8-12`) is a hard-coded 3-tab list.
- **Puck's left column in our Studio** (sunjay/katie/danamccool): Blocks, Outline, Pages, Galleries, Media, **Menu**, Theme, Sections, Templates (PROGRESS lines 52-54). elktours' Studio has no Menu tab (no `menuPlugin` use); its page list is `/manage/builder` and the canvas page-switcher (`CanvasEditor.tsx:25`).

### The two buttons
| Site | "Edit page" (file:line) | "Site style" (file:line) |
|---|---|---|
| elktours | `app/page.tsx:141,194` -> `landing/EditPageButton.tsx` (bottom-left, navy). Landing only. Other pages show a link "Edit this page" -> `/studio/<slug>` (`lib/puck/render.tsx:46`) | `app/layout.tsx:105` -> `site-style/SiteStyleButton.tsx` (bottom-right), all pages |
| innergathering | `app/page.tsx:250,408` -> `landing/EditPageButton.tsx` | `app/layout.tsx:91` (bottom-left above Edit page); hides under `/studio /manage /hub /account` and while the canvas is open (SiteStyleButton.tsx:12-37) |
| sunjay | `app/page.tsx:102,154` -> `landing/EditPageButton.tsx` (bottom-left); other pages "Edit this page" link (`lib/puck/render.tsx:91`, bottom-right) | `app/layout.tsx:103` (bottom-right, 68px up so they do not overlap); also `/?site-style=1` deep link from the hub card |
| hidden-enneagram | **No button.** `lib/puck/render.tsx:47` link "Edit this page" -> `/studio/<slug>`; header link "Edit the site" -> `/studio` (`site-header.tsx:64`) | `app/layout.tsx:107` -> `SiteStyleButton.tsx` (hidden under `/studio` and `/manage`) |

What each opens: "Edit page" on the landing = `openHouseLanding` (`page-editor-mount.ts`) mounting the canvas **in place**, saved via `saveLandingAction` to `site_config puck:landing` with a version guard. Elsewhere it is a **navigation** to `/studio/<slug>` (full-screen canvas page). "Site style" = a drawer, `SiteStyleEditor` (`direct-edit/src/site/SiteStyleEditor.tsx:278`), saved via `saveSiteStyleAction` to `site_themes` (page_key '') + `site_config site-style:chrome` (`elktours/src/lib/site-style.ts:7-11`).

Shared: both are editor-gated server actions (checked again on save), both lazy-load, both live in direct-edit, both are `data-de-ui`. Differs: different component, save action and tables, different place on screen, and **neither knows the other**: Edit page offers no style, Site style offers no menu or blocks. A third floating button, "Edit wording" (Fields lens, `FieldsLensMount.tsx:25`), also exists on elktours.

### What merging them takes
- The plan already points here: PLAN section 9.2 "one page, one editor", a Theme tab in the side panel, step F (Theme ladder in panel), step G (menus as blocks), rule 5 (chrome lives in Site style looks plus the nav store). None of it is built.
- Concretely: (a) one Edit button per app that always opens the in-place `HouseEditor`/`openHouseLanding` (today only the landing does; other pages jump to `/studio`). (b) Host `SiteStyleEditor` as a panel tab inside the canvas panel instead of a separate drawer (it is self-contained: `schema, initial, onSave, onClose`); it keeps its own save. (c) A "Site" tab / selectable chrome: header and footer already carry `data-chrome`/`data-part`, but the canvas root is only `.elk-landing` (`page-editor-mount.ts:25`), so the root would have to widen to include layout chrome. (d) For the menu: elktours first needs a menu store (the desktop header is hard-coded), then reuse `NavEditor` as a panel tab; it is a pure, lifted component. (e) Retire the floating Site style button; decide where the Fields lens lives.
- Risks: signed-in checks on a localhost copy (PLAN 9.5); two saves in one editor need one Save/Done story; innergathering's `/studio` is Puck, not canvas.

## 3. Building a site vs casually editing it

How the code already divides them:
- **Casual editing (on the live page):** the in-place canvas (`openHouseLanding`, landing only); the Fields lens "Edit wording" (text on blocks, `FieldsLensMount.tsx`); Site style drawer (colours, fonts, header/footer looks).
- **Building:** canvas page `/studio/<slug>` (`HouseEditor`), Puck whole-page `/studio/<slug>/blocks` (`HouseWholePage`, left rail: blocks, sections, templates, menu, pages), page lists (`/manage/builder` on elktours; `/studio` elsewhere), phone layouts `/studio/m-*`, tour and experience layouts `/studio/tour-detail`, `/studio/experience-detail`.
- **Overlap:** the canvas both rearranges blocks and edits words/looks; Puck edits fields too; Site style edits chrome looks that a Theme tab also exposes (danamccool duplicate, PLAN step I); Fields lens and canvas both type on words.
- **Where people get thrown:** "Edit this page" on a non-landing page is a full-page navigation to `/studio/<slug>` (sunjay `render.tsx:91`, elktours `render.tsx:46`, hidden-enneagram `render.tsx:47`); the canvas panel's "Edit its settings" link goes to `/studio/<slug>/blocks` (tree-editor.ts:1133; open.ts:184); the landing editor's "Settings..." opens Puck in a sheet; the Fields lens `lookHref` sends you to `/studio/<slug>` or `/manage/builder` (`FieldsLensMount.tsx:24`); Site style hides inside /studio on some sites; the menu is reachable only in Puck (sunjay/katie); elktours phone menu only at `/studio/m-*`, via links on `/tours`, `/feed`, `/people`, `/places`.

### Every way to add a NEW block to a page, today
- **Any canvas:** right-click > Add > Box / Words / Picture / presets / catalogue blocks (tree-editor.ts:1920-1925); tools Add words (T), Add a box (F), Add a picture; "Add here" from empty space (page-builder `drag/canvas-menu.tsx`, Puck side); duplicate (Ctrl+D) and group.
- **Puck whole-page:** drag from the Blocks list; Sections tab "Add to page" (`sections-plugin.tsx`); Templates tab replaces the page (`templates-plugin.tsx`); Galleries and Media tabs.
- **elktours:** landing canvas (Puck only through "Settings..."); `/studio/<slug>` canvas + `/studio/<slug>/blocks`; `/studio/m-*` (phone blocks); tour/experience layouts; new page from template `/studio/<slug>?template=` (`new-page-form.tsx:22`).
- **sunjay:** canvas `/studio/<slug>` + `/blocks` (Sections, Templates, Menu tabs); legacy `/studio/<slug>/canvas`; layout door for records (`layout-door.tsx`).
- **hidden-enneagram:** canvas `/studio/<slug>` + `/blocks` with parts plugin (`page-editor.tsx:73`); no Edit page button on `/`.
- **innergathering:** landing canvas via Edit page (PagePatches); `/studio/<slug>` is Puck; `/studio/<slug>/canvas` is a bare canvas (no inception, parts, records).
- **Not possible:** dragging a block from a list while on a canvas on any site.

## Could not determine
- Whether each site's Studio Puck instance exposes categories in its UI (only `config.categories` verified; Puck 0.24 has no search).
- `enableDragHandle` behaviour (not run).
- Any owner-side way to edit the elktours desktop header other than code and feeds (found none); innergathering and hidden-enneagram nav stores (found none).
- elktours Studio plugin list (did not read its `page-editor.tsx`; only confirmed no `menuPlugin` use).
- Runtime behaviour: nothing was executed.
