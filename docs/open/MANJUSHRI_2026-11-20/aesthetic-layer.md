# The aesthetic layer: where looks live today and where they must go (lane H, 2026-11-20)

Read-only research. Paths are under `~/eac/packages/` unless stated. Line numbers were read on 2026-11-20 from a tree with about 760 uncommitted files; they may drift. "Reasoned" means derived from code, not rendered or run. "Unverified" means not checked. I read the code myself and did not use sub-agents.

## Headline

The canvas is already the house's own plain-DOM editor, drawn from the same React components that publish (`direct-edit/src/puck/TreeCanvas.tsx:95-119`). Puck is not in that canvas. Puck survives in three places: the settings sheet (the only editor for block props), the whole-page route `/studio/<slug>/blocks`, and the stored document format.

The real obstacle to "restyle anything" is not Puck. It is that **a look is stored in four unrelated shapes**, each with its own vocabulary, sanitiser and CSS output. Only one of them, `morph`, can reach inside a block, and it has no states, no breakpoints and no per-instance override.

---

## 1. The stored look model today

**In plain words.** When Justin restyles something, the change is saved in one of four places depending on what he clicked. A box he drew gets a "look". A part inside a ready-made block gets a "morph". The block's "Style" field in Puck's sheet is a third shape. The site's colours and header/footer are a fourth. They don't know about each other, so one block can be styled twice in two vocabularies, and the canvas shows only one of them.

| Format | Stored at | Shape | Sanitiser | Becomes CSS as |
|---|---|---|---|---|
| `morph` (sealed block) | `props.morph` on the Puck node inside `site_config puck:<slug>` | `{v:1, parts:{<partName>:PartStyle}, tokens:{--blk-*:value}}` (`direct-edit/src/block/morph.ts:19-25`) | `cleanMorph` (`morph.ts:85-116`); caps 64 parts, 24 tokens, 4 fonts, 16 KB (`:38-41`); `cleanLook` (`:73`) drops absolute/sticky and refuses position, z-index, pointer-events, cursor, transform, rotate in raw css (`:48`); `sheetSafe` (`:61`) bans `url()`, `@`, `!`, foreign `var()` (only `--blk\|eac\|dv`) | one scoped `<style>`: `template[data-morph="<hash>"] + <sel>{... !important}` (`:142`, `:170-178`); published, hoisted by React 19 `href`+`precedence` (`direct-edit/src/puck/morph-mark.tsx:42`) |
| `look` (own boxes: box, words, picture; page root) | `props.look` | `PartStyle`, about 45 keys (`direct-edit/src/block/style.ts:18-45`), numeric `BOUNDS` (`:52-58`) | `cleanStyle` (`style.ts:240`), called from `cleanBoxDoc` (`block/puck-tree.ts:239`, root `:267`) and again at render (`puck/blocks.tsx:24`) | inline `style` on the element (`blocks.tsx:23-29`, `lookDecls` `block/patch.ts:71`) |
| `PagePatches` (code-built pages) | `{v:1, boxes:{<selector>:BoxPatch}}` | selector grammar `[data-edit-section="x"] > tag:nth-child(n)` (`patch.ts:33`) | `cleanPatches` (`patch.ts:51`) | one stylesheet, every declaration `!important` (`patch.ts:94-106`) |
| `blkStyle` (every block) | `props.blkStyle` | `StyleSettings`: padX/padY, margins, maxWidth, bg token or hex, borders, radius, shadow, opacity, `hideOn` mobile/desktop, `hover` lift/glow/brighten, anchor, className, `custom` (`page-builder/src/style/schema.ts:64-90`) | `cleanStyle` (`schema.ts:117`), `cleanCustomCss` allowlist (`:161-191`, `:193`), forbidden `url() @ !` (`:44`). `cleanBoxDoc` stores `blkStyle` on own boxes **unvalidated** (`puck-tree.ts:246`); cleaned only at render | wrapper `<div class="blk-st">` with inline style and `data-hide`/`data-hover` (`style/wrap.tsx:13-41`, `styleToCss` `schema.ts:260`) plus one shared sheet with a media query and `:hover` (`schema.ts:337-347`) |
| Dana `textStyle` | block props, danamccool only | font, weight, case, tracking, italic, colour, site "roles" (`apps/danamccool/src/lib/puck/text-style.tsx:33-50`) | cleaned in that file | wrapper + `app/theme-hooks.css` (per its header; css not read) |
| Site style: theme | `site_themes`, `page_key ''` = site default, other keys per page (`services/src/themes.ts:19,59,148`; hub reads both `hub/src/server/site-builder.ts:79-90`) | `{--var:value}` against a code-declared `SiteVar` list (`direct-edit/src/site/style.ts:60-85`) | `cleanSiteStyle` (`:159`) | `html:root{...}` plus optional `applies` rules `!important` (`:206-211`) |
| Site style: chrome | `site_config site-style:chrome` | `{region:{part:PartStyle}}`, reduced key set (`site/style.ts:113-116`) | `cleanSiteStyle` (`:159-186`) | `[data-chrome="x"] [data-part]...{... !important}` (`siteStyleCss` `:201`; emission past line 220 unverified) |
| Token defaults | `blocks/src/blocks.css` | `--blk-*` fall back to `--eac-block-*`, then host tokens (`blocks.css:42-58`) | code | custom properties on `:root` |

### Responsive and stateful?

- **Breakpoints:** only `blkStyle.hideOn` (two values, one media query at 40rem, `schema.ts:339-340`). No `@media` or container rule appears in `direct-edit/src/block/*.ts` (grepped). `morph.ts:130` guards big fixed font sizes with `min(Npx, 11vw)`, a hand patch for the missing responsive layer.
- **States:** only `blkStyle.hover` (three presets on the wrapper). A part cannot have `:hover` or `:focus`; raw `css` refuses `@` and braces, so it cannot be hand-written either.
- **Per-page layers:** one JSON per slug. The only page-level looks are the root node's `look`/`image` (`puck-tree.ts:265-270`, drawn by `PageRoot`, `blocks.tsx:127-132`) and the per-page `site_themes` row.

### Divergences that matter

1. **Colour vocabularies differ.** `PartStyle` colours are hex only (`style.ts:120`, `:155`); `blkStyle` colours are tokens mapped to `--blk-*` (`schema.ts:32-44`). A canvas-drawn box cannot follow the site palette; raw `css` can say `var(--blk-accent)` (`morph.ts:67`), but only in the developer Code tab.
2. **Two stores, one block (reasoned).** A sealed block can hold `blkStyle` (inline on an outer wrapper) and `morph.parts.root` (a `!important` rule on the block's own root, `morph.ts:142`). Different elements, so most properties stack, but for inherited ones (`color`, `--blk-fg`) the inner `!important` wins invisibly.
3. **The canvas never touches `blkStyle`.** Grep finds it nowhere in `direct-edit/src/canvas` or `house-editor/src`; only `puck-tree.ts:246`. Justin sees a block restyled by something the canvas cannot show or edit.
4. **`cleanOwn` keeps a closed prop list** (`puck-tree.ts:236-262`), so own boxes cannot carry `morph`, tokens or any new look key without a code change.

---

## 2. How direct-edit reaches inside a React block it does not own

**In plain words.** The block's author writes a list of "parts" (title, byline, card) as CSS selectors. The editor never reads the block's code. It finds those selectors on screen when you click, and when you restyle one it writes a small style sheet next to the block. That is why it works on blocks the editor did not build, and why it can restyle only what the author named.

### Mechanism

- **Declaration.** `BlockDef.parts: {name:{label, sel, repeat?, draws?, prop?}}` and `tokens` (`blocks/src/types.ts:234-262`, `:290-293`). Grammar: one complex selector, no comma; `>` means the element right after the marker, otherwise inside the root; a slot-holding block uses `>` only (`types.ts:240-246`; rule `.claude/rules/areas/puck-blocks.md:54`). Examples are class-based: `.blk-quote-text` (`blocks/src/blocks/quote.tsx:57-60`). Declared in 14 shared block files and about 38 more across 7 apps (grep `parts: {`).
- **The marker.** `buildPuckConfig` wraps each block in `Morphed`, innermost: strips `morph` from props, renders `MorphMark` (`page-builder/src/config.tsx:534-541`). `MorphMark` emits `<style>` and `<template data-morph=hash>` right before the block (`morph-mark.tsx:26-45`). Published with no morph: nothing is emitted, markup is byte-identical (`morph-mark.tsx:36`, `config.tsx:540`). In an editor the same element shape is always emitted so the first look does not remount the block (`morph-mark.tsx:29-35`).
- **Addressing.** A look is keyed by part name, not DOM path: `setPartLook` writes `props.morph.parts[name]` (`morph.ts:205-211`). The canvas finds parts with `partEls` (`direct-edit/src/canvas/parts.ts:14-22`, `:43-49`) and writes in `writeLook` (`canvas/tree-editor.ts:1051-1064`).
- **Own boxes** draw their own element and take `look` inline (`BOX_BLOCKS` `blocks.tsx:141-168`). Everything else is "sealed" (`TreeCanvas.tsx:116`).

### Puck JSON to canvas tree and back

The document is Puck's own JSON; slots are arrays of nodes in a parent's props, found through a slot map read from Puck fields (`puck/mount.ts:73-80`, `block/puck-tree.ts:45-75`). `TreeCanvas` draws with the published-shape config, gives each slot a component that renders its children (`TreeCanvas.tsx:50-61`), and passes a fake `puck` context `{isEditing:false, boxEditing:true}` (`:110`). Selection marks (`data-tree-node`) go on each node's first drawn element, skipping `style/template/script/link` (`:63-80`), so the marker and the `blk-st` wrapper do not break selection.

### Resolver-filled props kept out of saves

- Out of the document: saves run `cleanBoxDoc(stripResolvedKeys(data, resolvedKeys))` (`house-editor/src/save.ts:56`). `stripResolvedKeys` removes, per block type, the keys that block's resolver fills, walking slots and zones (`blocks/src/record/resolved.ts:21-37`). A resolver key equal to a prop name would erase the author's value (`resolved.ts:10-11`).
- Drawn beside the document: resolved rows merge over node props at draw time, never written back (`TreeCanvas.tsx:104-108`, `mount.ts:24`). `openHouse` fills them with `resolveAllData` (`house-editor/src/open.ts:118`, `:147`).
- Looks and resolvers are separate: `morph` is stripped before the block sees props (`config.tsx:535`) and excluded from the settings-rows cache key (`mount.ts:142`).
- Known trap: object props with no Puck field get walked by `resolveAllData` with the block's own fields, so `look.items` was read as the `items` slot and 500ed a live site (`puck-blocks.md:70-71`). `look` now has a hidden object field (`config.tsx:476`). `morph` still has a hidden **custom** field (`config.tsx:462`); `puck-blocks.md:71` itself says a part named like a slot would hit the same walk. `cleanMorph` rejects only the name `type` (`morph.ts:96`). Not tested; treat as an open risk.

### What happens to a look when things change

| Event | Result | Source |
|---|---|---|
| Block re-renders | Look survives: a sibling rule keyed by an adjacent-sibling selector, not a DOM mark. Parts are found at event time, so state changes leave no stale mark | `parts.ts:1-5`, `morph.ts:142` |
| Rows filtered or reordered | Unaffected (keyed by part name). But a `repeat` part styles every instance as one; `partRef` can select instance `i` (`contract.ts:85`) yet no per-instance look is stored. `editItem` marks exist for fields, not looks | `contract.ts:85-90`, `blocks/src/edit-item.ts:20` |
| Selector stops matching | Silent: the rule matches nothing; the canvas lists only parts it finds. No warning that stored looks are orphaned | `morph.ts:171-177`, `parts.ts:33` |
| Part removed from declaration | Stored look "draws nothing" but stays in the document | `morph.ts:145`, `:172` |
| Part renamed | Look lost; names are "never renamed casually" | `types.ts:259-261` |
| Duplicate / move | `duplicatePuckNode` deep-copies the node, `morph` included; a move keeps props | `puck-tree.ts:165-172` |
| Detach to boxes | Looks do not come along; the canvas says so | `tree-editor.ts:1341-1349` |
| Settings through Puck | Canvas keeps old `morph` if the sheet hands back none | `tree-editor.ts:553-556` |
| Undo | Canvas history = whole-document JSON snapshots, 800 ms same-key coalescing | `model/history.ts:5-47` |

---

## 3. Who is in charge today

**In plain words.** On the canvas the house editor is already in charge: you click, and house code writes the look into the document. Puck takes over only when you open a block's settings sheet, because the sheet is the one place to edit a block's real settings. When you come back, house code merges the result and keeps your looks.

### (a) A look change on a part, from the canvas

1. Click finds the part via `partOwners` (`canvas/parts.ts:43`); selection becomes `<nodeId>~p:<part>` (`block/contract.ts:85`).
2. A panel field calls `writeLook` (`tree-editor.ts:1051`): clone `partLookOf`, mutate, `setPartLook` (`:1058-1060`), so `node.props.morph.parts[part]` changes.
3. `change(...)` snapshots history first (`history.ts:21`); `draw` re-renders through `flushSync` (`mount.ts:176-182`). `MorphMark` re-cleans (`morph-mark.tsx:27`) and `morphCss` writes the sheet.
4. Save: `onSave(doc)` goes to `holdVersion` (`house-editor/src/save.ts:67-76`), then the app action: `stripResolvedKeys`, `cleanBoxDoc` (cleans morph again, `puck-tree.ts:227-230`), `savePage`, with a stale-version guard (`save.ts:56-58`, `open.ts:160`).
5. Published: the route renders the Puck JSON with the server config, whose `Morphed` emits the hoisted sheet (`config.tsx:534-541`). Each app's server config passing `morph` is unverified beyond the harness `direct-edit/harness/render-published.ts`.

Who dominates: **the house.** Puck is not involved.

### (b) The same change from Puck's "Edit look"

1. `partsPlugin` overrides Puck's `actionBar` to add "Edit look" (`page-builder/src/parts/popup.tsx:122-150`) and `iframe` to pick parts in Puck's canvas iframe (`parts/plugin.tsx:36-40`); `fields` mounts the part panel in Puck's right column (`plugin.tsx:41`).
2. Popup route: `openBlockPopupFor` splits the node into stored props and resolver rows (`popup.tsx:39-49`) and calls the host's `openStudioPopup` (`direct-edit/src/puck/studio-popup.ts:64`), which mounts a **second canvas** on a working copy `{root, content:[node]}` (`:66`, `:81-100`).
3. "Use on this page": rows are joined back, Puck `replace` with `recordHistory:false`, `recordStep` adds one history entry, then `resolveDataById(id,"replace")` because a plain replace runs no resolver in 0.23 (`popup.tsx:98-107`; rule `puck-blocks.md:59`).
4. The sheet-column route writes through `writeLive`/`writeStep` to `dispatch({type:"replace"})` (`parts/store.ts:73-112`), history built by hand with `history.setHistories` (`store.ts:134-143`; rule `puck-blocks.md:58`).

Who dominates: **Puck holds the data and the history; the house draws the UI and decides the values.** Two undo stacks are in play depending on route.

### (c) A settings change through the Puck sheet opened from the canvas (inception)

1. `editSettingsFor` pauses the canvas and calls the host's `editSettings(clone(node))` (`tree-editor.ts:538-548`).
2. `openHouse` sends it to page-builder `openBlockSettings` with the editor-shape config, the keys to strip, and the same parts plugin so "Edit look" works inside the sheet (`house-editor/src/open.ts:124-138`, `:165-175`).
3. On return `resolveAllData` redraws the node's rows (`open.ts:178-182`). `structural(...)` replaces `node.props` with `{...props, ...keep, id}`; `keep` preserves `morph` only if the sheet returned none (`tree-editor.ts:553-557`). One undo step.
4. Whatever props the sheet returns, `blkStyle` included, overwrite. A key the sheet lost is gone.

Who dominates: **Puck owns the settings form** for every block prop and `blkStyle`; the house owns everything around it.

### Where Puck still dominates

- Settings fields are Puck `custom` fields only (`config.tsx:430-440`); no house-built settings surface exists.
- The whole-page route `/studio/<slug>/blocks` (`open.ts:157`) is Puck's iframe, drag layer and history.
- The document format is Puck JSON; `resolveData` and `resolveAllData` are Puck calls (`config.tsx:489-509`, `open.ts:118`).
- `blkStyle` has a control only in Puck (`config.tsx:448-451`).

### Where the house already took over

- The canvas, drawn from the published config, not Puck's `<Render>` (`TreeCanvas.tsx:7-16`).
- Selection, drag, resize, layers, minibar, multi-select, snapping and the part panel.
- Save path, stale guard, sanitising (`save.ts`, `puck-tree.ts`).
- Layer stack for Esc and dirty checks (`house-editor/README.md`).
- Adopting code-built pages into trees (`puck/open-page.ts:29-53`).

---

## 4. The gap to Figma / GrapesJS grade

**In plain words.** The house has the bones of a style panel, layers, a canvas and a safe CSS generator. What it lacks is what makes Figma and GrapesJS feel like "restyle anything": hover states, phone/tablet looks, reusable named looks, colours that follow the site palette, and styling one card instead of all cards. Most of it can be stored as plain data. A few things cannot be done on blocks that do not expose the right handles.

The full list is in `aesthetic.json` (`capabilities`). Summary:

| Capability | House has | Missing | As block data | Needs from block author |
|---|---|---|---|---|
| Style Manager | `Panel` sections (`direct-edit/src/model/schema.ts:46-68`, `panel/panel.ts`, `canvas/box-panel.ts`) | properties limited to `PartStyle` keys | extend `PartStyle`, same sanitiser | nothing |
| Selector Manager: classes | `cls` on own nodes (`puck-tree.ts:32`); `blkStyle.className` (`schema.ts:101`) | named reusable looks | library of looks referenced by id | nothing |
| Selector Manager: states | `blkStyle.hover` three presets | states on parts and boxes | `states:{hover,focus,active}` | nothing |
| Layer Manager | layers (`tree-editor.ts:662-671`) | internals of sealed blocks | already data | declare parts |
| Trait Manager | Puck sheet; canvas `changeProp` (`tree-editor.ts:1096`) | a house settings surface | contract props (`block/contract.ts:8-24`) | already declarative |
| Device Manager | `hideOn` only | breakpoints for looks | `at:{sm,md}` | flexible block CSS |
| CSS Composer | generated rules (`morph.ts:142`, `patch.ts:102`) | author-written rules | structured rules, never free CSS | declare parts |
| Asset Manager | `choosePicture`, `safeSrc` (`puck-tree.ts:252`) | backgrounds on parts | safe `bg` key | nothing |
| Components with types | `BlockDef` (`blocks/src/types.ts`) | visual authoring of blocks | detach and templates | n/a |
| Stores HTML+CSS | stores Puck JSON | n/a | by design | n/a |
| Auto-layout | `layout/dir/gap/wrap/items/justify` (`style.ts:126-136`) | reflow inside sealed blocks can fight block CSS | already allowed on parts | flexible block CSS |
| Constraints | `pos/x/y/self/push` | parts cannot be absolute (`morph.ts:76`) | own boxes only | n/a |
| Variables/tokens, modes | `SiteVar` (`site/style.ts:60`), `morph.tokens`, `--blk-*` | own-box colours are hex; no modes | token refs in colour keys, mode map | declare `tokens` |
| Variants, instance overrides | `variant` key exists (`style.ts:20`), unused; `morph` is the instance override | variant sets, patterns | `use:<patternId>` plus overrides | declare parts |
| Styles (named) | `STYLE_PRESETS` (`schema.ts:358`) blkStyle only | for parts | named looks | nothing |

### Hard limits on a block the editor does not own

1. **Only named parts are reachable.** No "click any element" inside a sealed block: a part is a declared selector (`morph.ts:149-178`, `parts.ts:14`), and a block with parts needs one root (`puck-blocks.md:55`).
2. **Per-instance of a repeated part needs a stable mark.** `.blk-card` hits every card. Styling one needs the author to emit `editItem("rows", i)` (`edit-item.ts:20`); then `[data-edit-item="rows:2"]` is possible. Today only fields use it.
3. **Structure does not change.** Order, hide and gap work; new wrappers, tag swaps and reparenting do not. Content is another lens.
4. **Layout inside a sealed block fights the block's CSS.** The `!important` rule wins (`morph.ts:9-10`), but a block positioned by margins or absolute inside can look broken after a flex change. Only the author fixes that.
5. **State styles need real pseudo-classes**, and interactive state the block drives itself (open accordions) is the block's.
6. **Type scale**: blocks size in rem, each differently; a wrapper cannot scale them (Dana's `text-style.tsx` header).

---

## 5. A proposed aesthetic layer

**In plain words.** One stored "look" shape that every block, box, page and site section accepts. It names things the way a person would (the block, its title, hover, on a phone). The canvas writes it; the published page reads it with the same code. Old looks keep reading exactly as now, with no rewriting of anything saved.

### The format ("Look v2")

```
look: {
  v: 2,
  use?: "<patternId>",
  tokens?: { "--blk-accent": "#..." },
  parts: {
    <partName | "root">: {
      base:  PartStyle,                              // today's vocabulary
      states?: { hover?: PartStyle, focus?: PartStyle, active?: PartStyle },
      at?:   { sm?: PartStyle, md?: PartStyle },     // fixed named breakpoints
      item?: { [index]: PartStyle }                  // needs the author's editItem mark
    }
  }
}
```

It lives at `props.look` on own nodes and `props.morph` on sealed ones, as now. A v1 value `{v:1, parts:{x:PartStyle}}` reads as `{x:{base:PartStyle}}`. An own-box `look` (a bare `PartStyle`) reads as `parts.root.base`. `blkStyle` reads through an adapter over `styleToCss`: `root.base`, `root.states.hover`, `root.at.sm` (hide). Nothing in the database is rewritten.

### Selectors that stay stable

Part names, declared by the block author (`PartDef`), stay the only stored address. Selectors are code and may change, so add `partsHealth(contract, dom)` that reports stored parts matching nothing (silent today, section 2). Per-instance addressing uses `data-edit-item` marks the author emits (`edit-item.ts:20`), compiled to `[data-edit-item="<prop>:<i>"]`. Part names are the stored contract; selectors are code; `data-` marks are the escape hatch.

### Cascade (low to high)

1. `:root` tokens (`blocks.css:42-79`, `--eac-block-*`)
2. Site style theme (`html:root`, `site/style.ts:206`)
3. Page level (root node `look`; per-page `site_themes` row)
4. Block defaults (the block's own CSS)
5. Pattern (`use`)
6. Block look `root.base`, then `states`, then `at`
7. Part look: `base`, `states`, `at`
8. Per-instance `item`
9. Safety rules last

Today steps 6-8 collapse into one `!important` rule per part (`morph.ts:142`). Keep `!important` (it is what beats a block's inline styles, `morph.ts:9-10`) and order rules in one sheet by this list. Avoid `@layer`: with `!important` the layer order reverses, which is a trap.

### Breakpoints and states

Two named widths, sm 40rem (matches `schema.ts:339`) and md 64rem, emitted as `@media`. Add `container-type:inline-size` to `PageRoot` (`blocks.tsx:127`) only if a canvas "device width" preview is wanted; the canvas draws in the real document, so the viewport is the browser's. Container-query behaviour in the canvas is **unverified**. States compile to `:hover`, `:focus-visible`, `:active`. Keep the reduced-motion guard (`schema.ts:344`).

### Variants and patterns across orgs

A pattern is `{id, name, look}` in a per-org library (new `site_config` key such as `looks:<org>`; where the hub owns it is unverified), referenced by `use`. Resolve inside `morphCss` (pure, server-safe). Resolve on read, not on save, so editing a pattern restyles its users; offer "detach pattern". Cross-org promotion copies into a shared library an owner approves; looks are public-page data, so every read goes through the cleaner again.

### Sanitising

One cleaner for every format, built from `cleanStyle` (`style.ts:240`), `sheetSafe` (`morph.ts:61`) and the fence lists. Remove today's differences: `cleanBoxDoc` keeps `blkStyle` unvalidated (`puck-tree.ts:246`), and three raw-css allowlists disagree (`CSS_ALLOWED` `style.ts:74`, `ALLOWED_PROPS` `schema.ts:161`, `REFUSED_PROPS` `morph.ts:48`). Keep byte caps, add caps on states and breakpoints. Colours become `hex | {t:"token"}` compiled to `var(--blk-*)`.

### How CSS is emitted

Keep what works: one scoped `<style>` per node, hashed by content, hoisted by React 19 `href`+`precedence`, beside a `<template data-morph>` marker (`morph.ts:142`, `morph-mark.tsx:42`). For own boxes keep inline for `base` and emit a sheet only when `states` or `at` exist, so pages without them stay byte-identical. No atomic classes: the hashed sheet dedups and survives duplicate.

### Staying attached

- Duplicate/move: looks are node props, copied by `duplicatePuckNode` (`puck-tree.ts:165-172`). A pattern reference is by id.
- Undo: canvas history snapshots whole documents (`history.ts:5-47`). Do not add a second look store with its own history. Puck's sheet has its own stack (`store.ts:134-143`); move look editing off the sheet to narrow that.
- Block upgrade: add `aliases` to `PartDef` (`{title:{was:["heading"]}}`) so a rename keeps stored looks; run `partsHealth` in the harness. Renames are forbidden today (`types.ts:259`).

### What it absorbs and how old data reads

| Today | Becomes | Reader |
|---|---|---|
| `morph` v1 | `parts.<n>.base`, tokens | `readLook(node)` normaliser; no migration |
| own `look` | `parts.root.base` | same |
| `blkStyle` | `root.base` + `states.hover` + `at.sm` | adapter over `styleToCss`; field keeps working; canvas shows it as a read-only "from Style" layer first |
| Dana `textStyle` | stays app-specific | adapter later |
| chrome | stays on `site-style:chrome`, same `PartStyle` | none |
| site theme | stays | none |
| `PagePatches` | stays for code-built pages | none |

Writers emit v2 only when a v2 feature (state, breakpoint, item, pattern) is used; otherwise they keep writing v1. Stored rows stay unchanged until someone edits them.

---

## 6. The first three moves

**Move 1 (S): a read-only normaliser `readLook(node, def)`.** A pure function in `direct-edit/src/block/` returning a merged view of `morph`, own `look` and `blkStyle` (adapter duplicated as a pure copy, because direct-edit must not import page-builder, `house-editor/README.md`). The canvas panel uses it to show "this block also has Style set: border, shadow" and to flag conflicts between `morph.root` and `blkStyle`. Files: new `direct-edit/src/block/read-look.ts`, a small read at `canvas/tree-editor.ts:1070-1077`, `canvas/box-panel.ts`. Nothing is written. Proof: a script loads every `puck:*` row, runs the old emitters and the new reader, and asserts identical CSS text; before/after pixel screenshots are identical because no output changes.

**Move 2 (M): states and breakpoints as additive part keys.** Add optional `states` and `at` to the part value, accepted by `cleanLook`, emitted by `morphCss` after the base rule. Canvas gets "State: base/hover" and "Device: desktop/phone" switches over the panel. Files: `block/morph.ts` (`cleanMorph`, `morphCss`), `block/style.ts`, `panel/panel.ts`, `canvas/tree-editor.ts`, `puck/look-panel.ts`. Proof: no stored row has the new keys, so every published page's CSS and pixels are unchanged; a new test page with a hover and a phone rule is screenshotted at 390 and 1280 against an expected sheet; extend `page-builder/scripts/smoke-style.cjs` and `direct-edit/harness/smoke-morph.ts` with hostile `states`.

**Move 3 (M): named looks and part health.** `use` plus a per-org looks library, "Save this look as..." in the part panel, and `partsHealth` in the harness plus an orphan warning in the layer panel. Files: `block/morph.ts`, new `block/looks-library.ts`, `canvas/tree-editor.ts`, `canvas/box-panel.ts`, `blocks/src/types.ts` (`aliases`). Proof: a page with `use` compiles to the same CSS as its pattern inlined (unit test); `partsHealth` over every stored page and contract produces an orphan list with no writes; existing pages' pixels unchanged.

Later: token colours in `PartStyle`, then a house-owned settings surface so the Puck sheet handles only data props.

---

## Sharpest risks to content binding

1. **The sheet overwrites props.** Anything the Puck sheet drops (`blkStyle`, hidden `look`) is lost on inception; only `morph` is explicitly kept (`tree-editor.ts:553-557`). A new look key must be added to that keep list or live inside `morph`.
2. **Hidden `custom` field for `morph`** does not stop `resolveAllData`'s key-by-name walk (`puck-blocks.md:70-71`): a part named like a slot is a latent 500. Use the hidden object field for any look container (`config.tsx:476`) and have `cleanMorph` refuse part names equal to the block's slot names.
3. **A resolver key equal to a look key** is stripped on save (`resolved.ts:10-11`). Reserve `look`, `morph`, `blkStyle`, `use`.
4. **Silent orphaning** when a selector stops matching or a part is renamed: no content loss, visual loss with no warning.
5. **Two history stacks** (canvas snapshots vs Puck `replace`) can interleave undo across the sheet (`store.ts:134-143`).
6. **Unvalidated `blkStyle` on own boxes at save** (`puck-tree.ts:246`).
7. **Per-instance looks keyed by row index** drift when rows reorder in the content lens; use ids where the block has them (`edit-item.ts:20` allows string keys).

## GrapesJS / Silex comparison

Silex stores a published static HTML and CSS site in Nextcloud and sanitises it on read (`silex-render/src/silex-site.tsx:7-25`); looks there are free CSS rules on classes. Its components carry traits and are non-droppable by design (`Example.Ref.GrapeJSBlocks/Blocks.GrapeJS/eac-hero.component.js:1-20`). That is the feel Justin wants, minus free HTML. Look v2 stores data only: no selectors, classes or HTML.

## What I could not verify

- Rendered output (nothing was built or screenshotted); the `morph.root` versus `blkStyle` conflict is reasoned only.
- Each app's server config passing `morph`, beyond the harness.
- `siteStyleCss` chrome emission beyond about line 220.
- Container-query behaviour in the canvas.
- Whether any live page row stores `morph` parts named like slots.
- Dana's `theme-hooks.css`.
- Puck 0.24 changes (another session is installing it).
