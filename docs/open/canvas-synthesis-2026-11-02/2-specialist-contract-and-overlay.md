# Specialist 1: component contract and page overlay (2026-11-02)

Specification for what a block declares about its inner parts and options, how one page changes a block's look, how that change reaches the published page, and how a change is dog-eared. Worked examples are in sections 11 and 12. Nothing in the tree was changed; no container, row or build was touched. Probes are in `/tmp/claude-3003/-mnt-pool1-home-guru-eac/7236b31a-7646-4e28-8b29-be60fa6c575f/scratchpad/team/s1-probes/` (`proto/` is source, `out/*.log` are the outputs).

Labels: [V:run] executed in the probe folder against the real source and installed packages (repo mounted read-only, Chromium with `--network none`), [V:read] code read, [V:sql] read-only SQL on `elkdonis_dev`, [V:web] fetched upstream, [A] assumed, [U] unknown, with the run that settles it. Names are provisional until the synthesis.

## 0. Decisions

1. Anatomy. `BlockDef.parts` maps a part name to one CSS selector, declared once in the block file. Existing classes are used where they exist, `data-part` attributes where they do not. Selector and marker are one mechanism: `data-part="title"` is written as the selector `[data-part="title"]`. No block's styling changes.
2. Stored prop `morph`, not `overlay`. `store-frame` already declares a prop named `overlay` (`packages/blocks/src/blocks/store-frame.tsx:59`), so reserving that name would throw at module load (`registry.ts:79-91`). No block declares `morph`, and no stored row holds it [V:read grep; V:sql 0 of `site_config`, 0 of `user_pages`]. This report writes `morph` throughout; Specialist 2 reported the same collision.
3. `morph` holds part looks, one-row looks and style tokens only. Options stay ordinary props: a node's props are already per page, so a second "option override" store would have two places for one value. This corrects the thesis's "option overrides" on the overlay.
4. **Delivery: a `<template data-morph="<hash>">` marker right before the block's root, plus one scoped stylesheet with `!important` on every declaration.** Hoisted with `href` and `precedence` when published, drawn in place in editors. With nothing set, output is byte-identical [V:run]. No wrapper element, because a `display: contents` wrapper loses parent spacing on real hosts [V:run, section 5.2].
5. One style vocabulary for looks: `PartStyle` (`direct-edit/block/style.ts`). `blkStyle` is frozen: it keeps rendering, nothing new is built on it, and it has 0 stored uses [V:sql, survey].
6. Cleaned at render, always, and at save on direct-edit hosts. Selectors are never stored; a stored part name that the block no longer declares draws nothing.
7. Dog-ear: a snapshot of one node in a sidecar row `site_config` `puck-ears:<slug>`. It is not in the document, so it is not public, costs the page nothing, and survives the node's deletion. Using it copies it into the editor's document. This is also the hold-back from visitors, per component; a page-wide draft still needs `page_revisions`.
8. Options: `group`, `part`, `when`, `more` on `PropDef`, with a default group derived from the kind, so every block gets a sectioned panel before anyone edits it.
9. The ladder is derived, not stored. Atoms and Detach each take a dog-ear first, which is how they are undone after a save.
10. Tweaks means page variables (`{{paper}}`), plus this block's style tokens when a sealed block is selected. The 768 literal declarations in `blocks.css` stay as they are.
11. Puck 0.24 changes nothing here. `item-focus.tsx:131-142`'s internal key has the same form in 0.24.0 [V:read].

Findings the brief did not have:

| # | Finding | Evidence |
|---|---|---|
| a | `<link rel="stylesheet" precedence>` for a font that cannot load leaves the whole canvas empty; the cause is assumed to be React holding the commit until the sheet settles. A plain `<link>` does not | [V:run] canvas children 0 at 800 ms with no network; with a plain link, drawn |
| b | Hoisted sheets are not removed when their `href` changes. Typing would add a tag per step | [V:run] counts 5, 6, 6; in-place 5, 5, 4 |
| c | Puck's own canvas draws props through `flat` flatten and unflatten, so a numeric object key becomes a sparse array and other keys on it are lost. Row keys must be non-numeric (`r3`) | [V:run] `"rows":{"caption":[null,null,null,{…}]}`; `chunk-H65MT2JK.mjs:263-272`, `chunk-55V3NZVF.mjs:5806` |
| d | Live defect: real `patchCss` with `color: red /*` or `color: rgb(1,2` in one box deletes the next box's rule. `safeDecls` passes both, and slices long values mid-function (`style.ts:97-99`). `patchCss` is what elkdonis-arts.org draws (`apps/innergathering/src/app/page.tsx:49`) | [V:run] `cssRules.length` 1 of 2 |
| e | Defect: "Reset style" and "Copy style" on a sealed block read `node.props.look`, and `faq` and `pt-link` declare a prop named `look`. Reset deletes the block's own setting (`tree-editor.ts:648,684,692`; `faq.tsx:41`, `layout-blocks.tsx:398`) | [V:read], not run |
| f | Own blocks' `look.font` has no font link on a published tree page; only `patchFontsHref` exists, for page edits | [V:read grep], not run |

## 1. What was run

| Probe | Result |
|---|---|
| `proto/server.tsx`, real `safeDecls`, `patchCss`, `cleanBoxDoc`, `validatePage`, `sanitizeRichValues`, `duplicatePuckNode`, `buildPuckConfig`, `<Render>`, `resolveAllData`, `HeroBanner`, `PictureWall`, sunjay `Banner`, elktours `TourMainBlock`, series `SeriesTop` | 35 hostile inputs refused; markup byte-identical when unset; `validatePage` clean with `morph`; `resolveAllData` keeps it; streamed sheets all in `<head>`, coalesced by React into one tag; every parts map below matched real markup. `next/navigation`, `next/link`, tour child components and DOMPurify are stubbed there, and `sanitizeRichValues` was checked only on strings that are not rich |
| `proto/config.patched.tsx`, the real `config.tsx` with the diff in 5.5 applied in scratch | Byte-identical when unset; a host with no `morph` component draws a stored morph as nothing; with `blkStyle` the marker stays right before the root; an `interactive` block receives neither `morph` nor `puck` |
| `proto/drive.cjs`, Chromium, real `blocks.css` and sunjay's served CSS fetched through the edge (8 chunks) | Cascade matrix in 5.3; layout table in 5.2; real `TreeCanvas`; real `<Puck>` with a real keystroke in its real field |
| `proto/tree-editor.patched.ts` + `proto/drive-editor.cjs`, a scratch copy of the real `tree-editor.ts` with parts added, real `Panel`, real `clickthrough`, real `TreeCanvas` | Click 1 selects the block, click 2 "Words", click 3 "Title". The real colour and size fields write `morph.parts.title`; the block restyles live; selection survives the redraw; the Code tab shows `font-size: 64px; color: #ff0000;`. A repeated caption is selectable and styling reaches all of them. Screenshots `out/part-selected.png`, `out/part-code.png`, `out/part-repeat.png` |

Not run: anything in a real Next app, signed in, against stored documents, in Firefox or Safari, or on a Suspense boundary resolved after the shell. Section 15 says what settles each.

## 2. Shapes

### 2.1 On the block (`packages/blocks/src/types.ts`)

```ts
/** One inner element of a block that a page may restyle. */
export interface PartDef {
  /** In the layer tree and the panel heading. For artists. */
  label: string;
  /**
   * One complex selector, no comma. Starting with ">": the element right after the
   * marker, then a path from it. Otherwise: inside the block's root. Declared here,
   * never stored. A block with a slot uses the ">" form only, so it cannot reach into
   * nodes placed in the slot.
   */
  sel: string;
  /**
   * Drawn more than once. true: styled as a whole. { rows }: the drawing of a rows prop,
   * carrying editItem, so one row can also be styled alone.
   */
  repeat?: true | { rows: string };
  /** The part appears only under some settings. Used by smoke, the popup's Show with, and the panel's hint. */
  draws?: { props?: Record<string, unknown>; state?: string };   // state: Specialist 2's SubjectStateId
  /** The prop this part shows. Double click types it in place, or opens the picture chooser for kind image. */
  prop?: string;
}
/** Part names are stored, like block ids: /^[a-z][a-zA-Z0-9]{0,31}$/, never renamed casually. `root` is the block's outermost element. */
export type PartMap = Record<string, PartDef>;

/** A custom property a page may set on this block. Every "tokens" block also gets BLOCK_TOKENS. */
export interface TokenDef {
  name: `--${string}`;
  label: string;
  type: "color" | "font" | "length";
}
export const BLOCK_TOKENS: readonly TokenDef[]; // --blk-accent, --blk-fg, --blk-bg, --blk-band, --blk-band-fg, --blk-font-title, --blk-font-body, --blk-radius

/** A node of a block's live-atoms form. Data, so BlockDef stays serialisable. */
export interface AtomNode {
  type: string;                        // a block id, or "box"
  props?: Record<string, unknown>;     // fixed starting props
  pass?: Record<string, string>;       // atom prop ← this block's prop
  when?: string;                       // omit this atom when this boolean prop is false
  fromPart?: string;                   // carry this part's look to the atom's root
  items?: AtomNode[];                  // for "box"
}

// Added to BlockDef:
parts?: PartMap;
tokens?: readonly TokenDef[];
atoms?: AtomNode[];

// Added to PropDef (section 9):
group?: OptionGroup;
part?: string;
when?: PropWhen;
more?: boolean;
```

`defineBlock` needs no change: it spreads `def` (`registry.ts:45`). `createCatalogue` gains `morph`, plus Specialist 2's `subject` and `live`, in `RESERVED_PROP_NAMES` (`registry.ts:79`). Specialist 2's `contractOf(blocks)` adds `parts` and `tokens` to what it returns.

A block with no `parts` still has a root: its first element, selected as `> :not(template)`. So every block has margin, fill, radius and tokens from day one, for no adoption work.

### 2.2 On the node

```ts
// packages/direct-edit/src/block/morph.ts. Pure, no DOM, server-safe.
export interface NodeMorph {
  v: 1;
  /** Part name → look. PartStyle is the same vocabulary as `look` on a box. */
  parts?: Record<string, PartStyle>;
  /** One row of a rows-backed part: part name → "r<stored row index>" → look. */
  rows?: Record<string, Record<string, PartStyle>>;
  /** Style tokens on this block's root. */
  tokens?: Record<string, string>;
}
export function cleanMorph(raw: unknown): NodeMorph | null;
export function morphCss(m: NodeMorph, parts: PartMap | undefined, o?: { editor?: boolean }): { scope: string; css: string; fonts: string[] } | null;
export function sheetSafe(value: string): boolean;
```

`direct-edit` stays ignorant of `blocks` (Specialist 2's 2.1), so `morph.ts` declares its own structural `{ sel: string; repeat?: … }`; `BlockDef.parts` satisfies it.

The node:

```json
{ "type": "hero-banner", "props": { "id": "hero-a1", "title": "Ambrosial Hours", "morph": { "v": 1, "parts": { "title": { "color": "#f4f1ea" } } } } }
```

### 2.3 In the sidecar

```ts
// site_config (org_id, key = `puck-ears:<slug>`, value). `listPages` uses LIKE 'puck:%', which does not match it (store.ts:117).
export interface PageEars { v: 1; nodes: Record<string, Ear[]> }  // node id → newest first

export interface Ear {
  id: string;            // "e-<8 random>"
  name: string;          // up to 60 chars. Default "Version 3"
  kind: "named" | "auto"; // auto: "Before detach", "Before atoms", "Before using Version 2"
  at: string;            // ISO
  by: string | null;     // from the session, never the request
  node: PuckNode;        // the whole node: props, look or morph, and its slots' nodes. No subject, no live, no resolved keys, at any depth
}
```

## 3. Anatomy

### 3.1 The choice

| | Selector over classes | `data-part` in markup | Declared selector, either form (chosen) |
|---|---|---|---|
| Shared blocks (148 `.blk-*` classes) | No markup change | Touches every block | No markup change |
| Tailwind blocks | Depends on utilities or tags; `h1 + p.italic` breaks when a utility is edited | Stable | `data-part` |
| Hot or held files (elktours) | Works without touching the file | Needs an edit | Selector now, marker later |
| Repeated items | `querySelectorAll` | Same | Same |
| Conditionally drawn | `draws` tells smoke and panel how to see it | Same | Same |
| Rename risk | Class rename breaks it silently, unless smoke runs | None | Smoke covers both |

Tested on all five: the selector-only forms below matched real markup, including `pt-banner` and `TourMain` without touching either file [V:run].

### 3.2 The five maps

```ts
// hero-banner (shared, tokens). 0 markup changes.
parts: {
  root:     { label: "Banner",   sel: "> .blk-hero" },
  image:    { label: "Picture",  sel: ".blk-hero-img",  prop: "imageUrl", draws: { props: { imageUrl: "/x.jpg" } } },
  wash:     { label: "Wash",     sel: ".blk-hero-wash" },
  copy:     { label: "Words",    sel: ".blk-hero-copy" },
  title:    { label: "Title",    sel: ".blk-hero-title", prop: "title" },
  subtitle: { label: "Subtitle", sel: ".blk-hero-sub",   prop: "subtitle", draws: { props: { subtitle: "A line" } } },
}

// picture-wall (rows, repeated). 0 markup changes. editItem is already on the cell (picture-wall.tsx:264,301,314).
parts: {
  root:         { label: "Wall",                sel: "> .blk-wall" },
  cell:         { label: "Picture and caption", sel: ".blk-wall-cell",    repeat: { rows: "pictures" } },
  image:        { label: "Picture",             sel: ".blk-wall-img",     repeat: { rows: "pictures" } },
  caption:      { label: "Caption",             sel: ".blk-wall-caption", repeat: { rows: "pictures" } },
  captionWords: { label: "Caption words",       sel: ".blk-wall-caption-text", repeat: { rows: "pictures" }, draws: { props: { captionPlace: "on" } } },
}

// pt-banner (Tailwind, lookup tables, inline colours). 8 data-part attributes in layout-blocks.tsx:243-300.
parts: {
  root:     { label: "Banner",     sel: '> [data-part="root"]' },
  image:    { label: "Photograph", sel: '[data-part="image"]',    prop: "imageUrl", draws: { props: { imageUrl: "/x.jpg" } } },
  wash:     { label: "Wash",       sel: '[data-part="wash"]',     draws: { props: { imageUrl: "/x.jpg" } } },
  copy:     { label: "Words",      sel: '[data-part="copy"]' },
  title:    { label: "Title",      sel: '[data-part="title"]',    prop: "title" },
  subtitle: { label: "Subtitle",   sel: '[data-part="subtitle"]', prop: "subtitle", draws: { props: { subtitle: "s" } } },
  body:     { label: "Paragraph",  sel: '[data-part="body"]',     prop: "body",     draws: { props: { body: "b" } } },
  button:   { label: "Button",     sel: '[data-part="button"]',   prop: "ctaLabel", draws: { props: { ctaLabel: "Go", ctaHref: "/" } } },
}
// Today, with no edit to the file [V:run]: "> section", "section > img", 'section > [aria-hidden="true"]:not(img)',
// "section > div:last-child", "h1", "h1 + p.italic", "p.leading-relaxed", "section a".

// TourMain (elktours, hand-written config, read only). No edit to the file: lives in the sidecar of 10.3.
TOUR_CONTRACT.TourMain.parts = {
  root:         { label: "Description, route and booking", sel: "> *" },
  description:  { label: "Description", sel: ".eac-article" },
  lists:        { label: "Highlights and included", sel: ".mt-8.grid" },
  listHeading:  { label: "List heading", sel: ".mt-8.grid h2", repeat: true },
  route:        { label: "Route", sel: "section.mt-14", draws: { props: { showRoute: true } } },
  routeHeading: { label: "Route heading", sel: "section.mt-14 > h2", prop: "routeHeading" },
  booking:      { label: "Booking box", sel: "#book > div", draws: { props: { showBooking: true } } },
  price:        { label: "Price", sel: "#book .font-serif" },
}

// series-next, the IFAC Next band as a block (series-top.tsx:337-373 moved to its own component, classes kept).
// The classes matched SeriesTop's real output [V:run]. Needs `.ifs` tokens and site.css, so ifac and sunjay only.
parts: {
  root:     { label: "Next session",   sel: "> .ist-next" },
  date:     { label: "Date",           sel: ".ist-next__date" },
  kicker:   { label: "Coming up",      sel: ".ist-next__k" },
  title:    { label: "Title",          sel: ".ist-next__t" },
  subtitle: { label: "Subtitle",       sel: ".ist-next__sub" },
  meta:     { label: "When and who",   sel: ".ist-next__meta" },
  actions:  { label: "Actions",        sel: ".ist-next__act" },
  button:   { label: "I'm coming",     sel: ".ist-next__act .ifs-btn--primary" },
  links:    { label: "Calendar link",  sel: ".ist-links" },
}
```

Specialist 2's `live-*` controls put `data-part` on their elements; the maps are in `proto/parts.ts` and their table at their 9.1 lists the names.

### 3.3 Smoke

Add to `packages/blocks/scripts/smoke.mts`. `node-html-parser` 9.0.3 is in the lockfile through `cms-bindings`; it becomes a dev dependency of `blocks`, so this waits for one coordinated install. The same query was run in the probe [V:run].

```ts
import { parse } from "node-html-parser";
console.log("\nparts");
for (const block of sharedCatalogue.all) {
  const { id, parts, props } = block.def;
  if (!parts) continue;
  const hasSlot = props.some((p) => p.kind === "slot");
  check(`${id} declares a root part`, !!parts.root);
  for (const [name, p] of Object.entries(parts)) {
    check(`${id}.${name}: a storable name`, /^[a-z][a-zA-Z0-9]{0,31}$/.test(name));
    check(`${id}.${name}: one selector`, !/[,{};<]/.test(p.sel), p.sel);
    if (hasSlot) check(`${id}.${name}: anchored, cannot reach a slot's nodes`, p.sel.startsWith(">"), p.sel);
    const html = renderToStaticMarkup(createElement(block.Component as never, { ...block.sample?.(), ...p.draws?.props } as never));
    const n = parse(`<div data-morph="t">${html}</div>`).querySelectorAll(`[data-morph="t"] ${p.sel}`).length;
    check(`${id}.${name}: matches the block's markup`, p.repeat ? n >= 1 : n === 1, `${n} for ${p.sel}`);
    if (typeof p.repeat === "object") check(`${id}.${name}: a real rows prop`, props.some((q) => q.name === (p.repeat as { rows: string }).rows && q.kind === "rows"));
  }
  for (const q of props) if (q.part) check(`${id}.${q.name}: part ${q.part} exists`, !!parts[q.part]);
}
```

One block in the shared catalogue does not draw exactly one top-level element from its sample: `profile-gallery` draws `h2` and `ul` [V:run]. The marker reaches only the first, so that block gets a root element when it is adopted. It has 0 stored uses.

## 4. Click-through into parts

`LayerSource` (`clickthrough.ts:22-28`) keeps its shape. `tree-editor.ts`'s implementation changes. All of this ran in `proto/tree-editor.patched.ts`, 70 added lines [V:run].

A selection is a string. `<nodeId>~p:<part>` or `<nodeId>~p:<part>:<i>`, extending the `~` grammar already used for inline runs (`tree-editor.ts:271,277`). `baseOf` must not split a part ref. `elOf(ref)` re-finds the element by querying the node's element, so a redraw that replaces it changes nothing: `redraw` already calls `ct.adopt(elOf(selId))` (`:211`). When the part is gone, because a prop was emptied, selection falls back to its node instead of to nothing (`:212`).

```ts
chain(target)  // as today, then the parts of the last node holding `target`, outermost first
kids(el)       // a sealed node: its top parts. A part: the parts directly inside it
parent(el)     // a part: the nearest part holding it, else its node
name(el)       // a part: PartDef.label
```

`partEls(nodeEl, sel)` filters to `closest("[data-tree-node]") === nodeEl`, so a slot-bearing block's parts exclude nested nodes in the editor as the `>` rule does in the stylesheet. The node's own element is the `root` part, so it is not listed twice.

`TreeCanvas.NodeMark` stamps nothing new: parts are found at event time from the declaration, so a client block's own state change cannot leave a stale mark. Its one change is the marker, in 5.4.

Panel on a part (`context()`, `tree-editor.ts:298`). The same `boxSlots`, `readBox`, `styleValues`, `styleOverridden`, `applyKey`, `codeText` as an own box, because `readBox` works on any element [V:run: size 48, colour `#5b45a8`, weight 400, leading 1.12 from `.blk-hero-title`]. `writeLook` takes a target that reads and writes `morph.parts[part]` instead of `props.look`. Heading is `PartDef.label`, sub is the block's label. Omit Kind and Link: the probe showed them, and a part has no tag or link of its own (`out/part-selected.png`). A part with `prop` lists that prop's field first. Move and group tools are disabled on a part; a part cannot leave its block.

Sealed node panel (`:303-311`). The node is its `root` part: the same panel, plus Options (section 9) above the style sections, with Detach at the foot. The sealed-only text becomes one line naming the current rung (section 10.1).

Layers tree (`rows()`, `:252`). Parts are rows under their node with `canHide`, using the `T` and frame icons of `reference/rowlayer4.png`. A repeated part is one row, "Caption ×12".

Code tab (`sheet`, `panel.ts:512-527`). `<h1>` and the part's declarations as editable text, then "From" groups. `fromGroups` looks only at own ancestors today (`:287`); for a part it also lists what the block's own CSS gives, from `inheritedFrom(el)` (`box-panel.ts:237`, not wired today), each with `+` to adopt.

### 4.1 One item of a repeated part

| Part declared | Can be styled | Key | Why |
|---|---|---|---|
| `repeat: { rows }` | Whole, or one row with a chip "All 12 · Just this one" | `morph.rows[part]["r"+row]`, row from `parseEditItem` on `closest("[data-edit-item]")` | The index is in stored rows, a block's filter does not shift it (`edit-item.ts:13`); the attribute is on published pages too, so the rule still matches |
| `repeat: true`, or data rows | Whole only | `morph.parts[part]` | A resolver's row changes with the data; position is not identity |

`editItem` does three jobs under one attribute: focusing the row's fields, as in `item-focus.tsx`; selecting the row in the panel (Content shows its columns under a "← Picture wall ‹ ›" bar); and addressing the one-row rule. The panel's rows control remaps `r` keys when it reorders rows; a reorder in Puck's own editor does not, so a row look can land on the wrong picture there, which costs a look and nothing else. Row keys start with `r` because of finding (c).

## 5. Delivery on the published page

### 5.1 Options

| Channel | Reaches inside a sealed block | Beats inline styles | Unset markup unchanged | Needs block edits | Result |
|---|---|---|---|---|---|
| Custom properties read by each rule | Only what was converted | No | Yes | All 768 literal declarations | Rejected; `display`, `order` and hide are out of reach |
| Inline style through props | Needs a prop per thing | Yes | Yes | Every block | Rejected: this is the monolith |
| `patchCss` | Yes | Yes | Yes | None | Its grammar accepts only `[data-edit-section=…] > …:nth-child` selectors (`patch.ts:33`), and storing structure is what the direction forbids. Its formatting line is reused |
| Scoped sheet + `display: contents` wrapper | Yes | With `!important` | Yes | None | Rejected by 5.2 |
| Scoped sheet + sibling marker | Yes | With `!important` | Yes | None | Chosen |

### 5.2 Wrapper against marker

Real sunjay CSS, offsets of two children against their parent [V:run]:

| Parent | Plain | Wrapper | Marker |
|---|---|---|---|
| `flex flex-col gap-4` | 0, 40 | 0, 40 | 0, 40 |
| `grid grid-cols-2 gap-4` | 0, 641 | 0, 641 | 0, 641 |
| `space-y-6` | 0, 48 | 0, 24 | 0, 48 |
| `.blk-flow-body` (`> *:not(…)`, `blocks.css:1035`) | 0, 44 | 0, 24 | 0, 44 |
| `.blk-grid-cells` (`> *`, `blocks.css:474`) | 0, 430 | 0, 430 | 0, 430 |

With a wrapper, restyling a heading's colour would move the block under it. `<template>` is inert, is `display: none` to the browser, is valid inside `ul`, `ol`, `dl` and `table` where a `div` is not, and is already in `adopt.ts`'s `SKIP` (`adopt.ts:16`).

Limits of the marker:
- The block's root is no longer `:first-child` of its parent. No rule in `blocks.css` depends on that for a node root [V:read grep], and site CSS is [U].
- A block that draws nothing has no root, so `template + .x` meets the next sibling. With a named root it matches only another block of the same type. A no-contract block's generic root could style its neighbour, and only while it draws nothing. The panel shows "Draws nothing".
- A block returning a fragment reaches its first element only (`profile-gallery`, section 3.3).

### 5.3 Cascade

Stylesheets as hosts load them; computed style read in Chromium [V:run, `out/drive.log`]. Each cell is the morph's value winning.

| Target | Today's rule | Layered `blocks.css` + `!important` | Unlayered + `!important` | Real sunjay + `!important` | Unlayered, no `!important` | Real sunjay, no `!important` |
|---|---|---|---|---|---|---|
| `.blk-hero-copy` text-align | inline `style={{textAlign}}`, `hero-banner.tsx:97` | wins | wins | wins | loses | loses |
| `pt-banner` title colour | inline `style={{color: ink}}`, `layout-blocks.tsx:273` | wins | wins | wins | loses | loses |
| Caption, all | `.blk-wall[data-caption="on"] .blk-wall-figure--on .blk-wall-caption` | wins | wins | wins | loses | wins |
| Caption row 2 | inline `tint`, `picture-wall.tsx:291` | wins | wins | wins | loses | loses |
| `.blk-hero` padding and fill, title colour and size, wash `display` | plain class | wins | wins | wins | wins | wins |

**`!important` is required, and it is required on every host.** Which rules lose without it differs between layered and unlayered hosts, so anything less would behave differently per site. `patchCss` reached the same answer (`patch.ts:89-92`).

What that costs: the block's own `:hover` and `@media` rules for that property lose too, and that is what the artist asked for. An artist setting `opacity` on a hover-reveal caption defeats the reveal (`blocks.css:1762-1767`). `blocks.css` has 1 `!important` (`:1648`), on a border colour. An important rule in a layer beats an unlayered one, so a site's Tailwind `!` utility on the same element would win [A; not measured].

Font size has one guard: a size over 32px is written `min(72px, 11vw)`, so a fixed title does not overflow a phone (42.9px at 390px wide [V:run]). `textDecls` itself is unchanged, because classifieds relies on it.

### 5.4 Streaming and the editor

| Mode | Stylesheet | Font | Evidence |
|---|---|---|---|
| Published, server | `<style href="m-<hash>" precedence="eac-morph">`, as `style/wrap.tsx:36` does | Plain `<link rel="stylesheet" href>` per font after the block, as `innergathering/page.tsx:378` does | [V:run] stream: one coalesced tag in `<head>`, `data-href="m-a m-b m-c m-d"`, none in body. Two nodes with one morph share one |
| Editor (`puck.boxEditing` or `puck.isEditing`) | Plain `<style>` after the block, not hoisted | None: the panel calls `loadFont` (`panel.ts:456,584`) | [V:run] count stays flat across edits; `flushSync` draws synchronously, so the editor measures the new size |

The scope is a hash of the compiled rules, so a morph whose scope changed cannot leave an old rule matching, and no node id reaches CSS. Clean and compile take 30 µs per node [V:run].

`NodeMark`: the file as it stands marks the `<template>` [V:run]. One line settles it, also verified [V:run]:

```ts
// TreeCanvas.tsx:63
.find((k) => k.tagName !== "STYLE" && k.tagName !== "SCRIPT" && k.tagName !== "LINK" && k.tagName !== "TEMPLATE")
```

A morphed block that draws nothing has no qualifying child, so `first` is undefined and the existing "Empty" label appears (`:66`). `EmptyBlock` in Puck's own editor counts the marker as a child (`empty-block.tsx:32`), so its placeholder does not appear for a morphed empty block; left as it is, because Puck's editor gets no new work.

### 5.5 Adapter diff

Applied and run in `proto/config.patched.tsx` [V:run]. Innermost, inside `Styled` and `GenericStyle`, so the marker stays adjacent to the root whatever a site wraps around it. `config.tsx` keeps no dependency on `direct-edit`; the host passes the component.

```ts
// packages/page-builder/src/config.tsx, PuckConfigOptions:
/** What draws a node's `morph`. Without one the prop is removed and ignored. */
morph?: ComponentType<{ def: BlockDef; morph: unknown; editing: boolean; children?: ReactNode }>;

// after `inner` is set, :440
const morphed = function Morphed(props: Record<string, unknown>) {
  const { morph, ...rest } = props;
  const drawn = createElement(inner as ComponentType<never>, rest as never);
  if (!morph || !MorphMark) return drawn;
  const puck = props.puck as { boxEditing?: boolean; isEditing?: boolean } | undefined;
  return createElement(MorphMark, { def, morph, editing: !!(puck?.boxEditing || puck?.isEditing) }, drawn);
};
// :446 createElement(inner, …) becomes createElement(morphed, …); :450 `: inner` becomes `: morphed`.
```

```tsx
// packages/direct-edit/src/puck/morph-mark.tsx, new subpath ./puck/morph. Server-safe: no hooks, no DOM.
export function MorphMark({ def, morph, editing, children }: {...}): ReactNode {
  const clean = cleanMorph(morph);
  const c = clean ? morphCss(clean, def.parts, { editor: editing }) : null;
  if (!c) return children;
  return createElement(Fragment, null,
    createElement("template", { "data-morph": c.scope }),
    children,
    editing
      ? createElement("style", null, c.css)
      : createElement("style", { href: `m-${c.scope}`, precedence: "eac-morph" }, c.css),
    editing ? null : c.fonts.map((f) => {
      const href = googleFontsHref([f]);
      return href ? createElement("link", { key: f, rel: "stylesheet", href }) : null;
    }));
}
```

The strip happens before `inner`, so `Interactive` (`config.tsx:436-439`) and every client component never see `morph` [V:run: keys `["id"]`]. Each host passes `morph: MorphMark` in both `config.server.ts` and `config.client.ts`, which is the existing "add to another host" step plus two lines. A host with no such option draws nothing and strips the prop [V:run].

## 6. Vocabulary and safety

### 6.1 What survives

| Thing | Disposition | Reason |
|---|---|---|
| `PartStyle`, `cleanStyle`, `lookDecls`, `safeDecls` (`direct-edit/block`) | The vocabulary for part looks | The panel, Code tab, `box`/`words`/`picture` and `patchCss` already speak it. Nothing in the panel changes |
| `StyleSettings`, `cleanStyle`, `styleToCss`, `BlockStyleWrap` (`page-builder/style`) | Frozen: still draws a stored `blkStyle`, gets no new features | 0 stored uses [V:sql], unverified on most hosts. Removing it needs a change on every host for nothing |
| `styleField` | Not offered where a host uses the direct-edit panel; stays in Puck's panel | Puck's editor gets no new work |
| `cleanCustomCss` | Stays with `blkStyle`; its value rules are ported to `sheetSafe` | `direct-edit` does not depend on `page-builder`, by design. `contrastRatio` is duplicated the same way (handover section 4) |
| `STYLE_PRESETS` | Not ported now | A later "looks" list could reuse the idea with `PartStyle` |

Gap to note: `StyleSettings` has token colours (`accent`, `ink`); `PartStyle.color` and `fill` are hex only (`style.ts:169,139`). A part following the site's palette writes `css: color: var(--blk-accent)` today. A palette group that writes the `var()` form is an open item (section 17), and matters on sites with light and dark.

### 6.2 What a morph may hold

`cleanMorph` runs `cleanStyle` on each look, then:

1. `pos` `absolute` or `sticky` is dropped, with `x` and `y`. A part stays inside its block's flow; `tx` and `ty`, which are bounded, move it.
2. `css` is filtered again: `position`, `z-index`, `pointer-events`, `cursor`, `transform` and `rotate` are refused. These are what `cleanCustomCss` calls overlays and click traps (`page-builder/src/style/schema.ts:156-160`), and a bare `transform: scale(50)` on an invisible link is one. `safeDecls` keeps allowing them for own boxes, which is a decision of 2026-11-02 this report does not reopen.
3. Every value passes `sheetSafe`: at most 160 characters, refused rather than sliced; no `url(`, `image-set`, `expression`, `javascript:`, `@`, `\`, `{`, `}`, `;`, `<`, `>`, `/*`, `*/`, `!` or control characters; balanced brackets and quotes; functions from an allow-list based on `cleanCustomCss`, plus `repeat`, `minmax`, `fit-content`, `span` for grids; `var()` only of `--blk-*`, `--eac-*`, `--dv-*`, with no fallback.
4. Caps: 64 part names, 200 row looks, 24 tokens, 16 KB per node. Past the byte cap the morph is dropped whole.
5. Names: parts `/^[a-z][a-zA-Z0-9]{0,31}$/`, rows `/^r\d{1,4}$/`, tokens `/^--[a-z][\w-]{0,40}$/`. Declared parts are looked up with `hasOwnProperty`, so a stored `constructor` finds nothing.

**Fix `safeDecls` for finding (d), separately and first.** Add the stylesheet checks (comment markers, `!`, balanced brackets and quotes; refuse over 160 instead of slicing at `style.ts:99`). Inline use never needed those values. It is a change to shared code that classifieds also runs, so its Windows suites should be rerun, per handover section 5.

### 6.3 Hostile inputs

35 ran in `proto/server.tsx` section 1, all refused [V:run]; move them to `packages/direct-edit/scripts/smoke-morph.mts`, beside the 20 in `smoke-style.cjs`:

Shape: string, array, null, `x{}body` as part name, `a.b` as part name, `__proto__` as part name, colour written as `red;background:url(x)`, numeric row key, `r3,body` as row key, a part with 30 declarations in each of 64 parts. Escape: `/*`, `*/`, `rgb(1,2`, `"x`, `!important` inside a value, `} body { display:none`, `</style><script>`. Loading: `url(`, `URL(`, `u\72l(`, `image-set(`, `src(`, `paint(`, `attr(`. Variables: `var(--secret)`, `var(--blk-accent, url(x))`. Traps: `position: fixed`, `z-index`, `pointer-events`, `transform: scale(50)`, `pos: absolute`. Tokens: `url(x)` as a value, `x:y;--z` as a name, `red;}body{display:none`. Fonts: a name not in the library.

### 6.4 Fonts

`isKnownFont` gates `look.font` in `cleanStyle` (`style.ts:231`), so a morph can name only library fonts. `morphCss` returns them, capped at 4 per node; `MorphMark` writes one `googleFontsHref([font])` link for each, so a font used twice costs one request per URL at the browser. There is no page-level helper like `patchFontsHref` (`patch.ts:109`), so no host change is needed. A plain `<link>` in the body is what innergathering does today. Finding (f) can use the same path in `Words` and `Box`.

## 7. Storage

| Touches | What it does with `morph` | Evidence |
|---|---|---|
| `validatePage` (`validate.ts:53-56`) | Nothing: walks only arrays of objects with `type`. Accepted with no warnings | [V:run] |
| `sanitizeRichValues` (`store.ts:87`) | Recurses, changes nothing unless a string starts with a rich tag, which `safeDecls` refuses | [V:run] |
| `savePage` 512 KB cap (`store.ts:76,95`) | Counts it. Largest stored page 41,609 bytes, all 31 pages 153,100 [V:sql]. A morph here is 115-312 bytes, so roughly 1,500 morphs fit on the largest page | [V:run] |
| `cleanBoxDoc` (`puck-tree.ts:195-201`) | Passes it uncleaned on a sealed node today. `cleanOwn` drops it on an own block, which is correct | [V:run] |
| `duplicatePuckNode` (`puck-tree.ts:160-167`) | Copies it, new ids. The scope is a content hash, so the copy needs nothing else | [V:run] |
| `movePuckNode`, `wrapPuckNode` | Move the node as it is | [V:read] |
| `resolveAllData` | Keeps it beside resolved keys | [V:run], Specialist 2's t1 |
| `stripResolved` (sunjay, arts-collective, artdirect) | Removes named keys. Forbid part name `type`, in case a walker takes a part for a node; the check is one word | [V:read] |
| `remember()` (`config.tsx:158`) | A resolver that enumerates props re-runs when `morph` changes; keyed reads do not. Puck's editor only | [V:read] |
| `toDefaultProps` | Never present: a dropped block has no morph | [V:read] |
| Puck's `<Render>` | Hands it to `render` as an ordinary prop; `Morphed` takes it there | [V:run] |
| Puck's own editor, on save | **Keeps it, on the edited node and on others.** A real `<Puck>`, a keystroke in its real title field: `onChange` data held `morph` on both | [V:run]; this settles Specialist 2's open point for `subject` too |
| Puck's own canvas | Draws through `flat`; arrays and string keys survive; a numeric key does not. See finding (c) | [V:run] |

Who cleans. `MorphMark` cleans at every render, as `Words` and `BlockStyleWrap` do, and that is the safety boundary: a row written by hand, by Puck's editor, or by a host with no direct-edit still passes it. `cleanBoxDoc` cleans at save for storage hygiene:

```ts
// puck-tree.ts, the sealed branch, :196
const m = cleanMorph(raw.props.morph);
if (m) raw.props.morph = m; else delete raw.props.morph;
```

`savePage` stays as it is, because `page-builder` does not depend on `direct-edit`. A host on Puck's editor alone has no way to create a morph short of a hand-written request, and the render fence covers that.

Detach bakes it. `adoptElement` has an `edits` hook that merges saved looks (`adopt.ts:30,52-53`). `detach` (`tree-editor.ts:485`) passes it: for an element matching a part, return `{ style: morph.parts[name] }`. Tokens become custom properties in `look.css`, which `safeDecls` allows. Without this, Detach would lose every look, because the marker goes away.

## 8. Dog-ears

### 8.1 Inline or sidecar

| | Inline on the node | Sidecar `puck-ears:<slug>` (chosen) |
|---|---|---|
| Reaches a public render | Sits in the document on every read | Never read on a public path |
| Page's 512 KB | Counts, 12 × 3.3 KB per 20-row wall | Separate cap |
| Node deleted | Gone with it | Kept: can bring the block back |
| Two people saving the page | Last save drops the other's ears | Independent |
| Saving a dog-ear | Requires saving the page, which publishes everything | Writes one row, publishes nothing |
| Migration | None | None: `site_config` has `tenant_isolation` [survey] |
| `listPages`, `hud-actions` `LIKE 'puck:%'` | Unaffected | Unaffected: `puck-` does not match `puck:` |
| Cost | | A second store and action |

### 8.2 Actions

All in the popup's fourth tab, "Saved", which exists in `panel.ts` (`TabId`, `:41,:44,:105`) and is unused by the tree editor. The main right column keeps Properties, Code and Tweaks, as in `reference/rowlayer4.png`. New store `packages/page-builder/src/ears.ts`, through `withOrg`; `getApiEditor` or the host's equivalent in the action; `by` from the session.

| Action | What happens |
|---|---|
| Dog-ear | `node` deep-copied. `subject` and `live` removed at every depth. Keys in `resolverKeysFor(type)` removed. `cleanBoxDoc` on it. Prepended, in a `withOrg` transaction with `SELECT … FOR UPDATE` on the row. Written at once; no page save. Visitors see no change |
| Use | Editor: `history.remember()`, then the node is replaced in the document by a copy of `ear.node` with the current node's id, and current `subject` values put back by id. An auto dog-ear of the current state comes first, unless an ear already matches it. Visible to visitors only after the page's Save. Undo works |
| Compare | A second, read-only `TreeCanvas` beside the first in the popup (the popup's main is the same re-rooted canvas), and a list of differences from a pure `diffEar(a, b)`: props, then parts, then rows, in the prototype's "field by field" form (`PATTERNS_VERSIONS…md:172-175`) |
| Restore | Use, on an older ear. Never overwrites: the auto dog-ear keeps what it replaced |
| Rename, delete | One row write |
| Deeper | Not built. See 8.5 |

Caps: 12 ears per node; 64 KB per ear; 256 KB per sidecar row. At a cap the oldest `auto` goes first; if none remain the action says so and refuses. Measured: a hero node is 430 bytes, a 20-row wall 3,261 [V:run].

### 8.3 Group

A dog-ear of a `box` captures its subtree: arrangement, the children's morphs and looks. Restoring puts them back, and any node id already elsewhere in the document gets a new id. Restoring does not touch `subject`, per Specialist 2's rule (their 12.1): a node present before and after keeps its current one, and a node coming back with no own subject inherits. Default for the developer to confirm in section 17.

### 8.4 Held back from visitors

Saves are public at once, and `page_revisions` does not exist. Without it:

| State | Who sees it | Written |
|---|---|---|
| Working copy in the popup | The artist | Nowhere |
| Applied to the editor's document | The artist | Nowhere until Save |
| Dog-ear | Editors of the org, in the popup | Sidecar |
| Page saved | Everyone | `puck:<slug>` |

**So a morph can be held back per component: dog-ear it instead of using it. A whole-page draft cannot be held back, and there is no preview link for someone else, no schedule and no "publish this one block but not that one" within one editor session beyond not having used it.** That is what the sidecar buys, and it is enough for "before needing to be saved deeper". If the developer wants the page-wide version, Phase 4's `page_revisions` is the next size up, and `Ear` needs no change.

Concurrent saves of one document remain last-write-wins. The smallest fix is `savePage(orgId, slug, data, { ifUpdatedAt })` with `date_trunc('milliseconds', updated_at)` on both sides (`.claude/rules/areas/db.md`) and a prompt in the editor; `loadPage` already returns `updatedAt` (`store.ts:68`). Listed for the Team Lead, separate stone.

### 8.5 Saving deeper later

`Ear.node` is already what an `org_blocks` row's `doc` would hold (`PATTERNS…md:79-91`), so "save deeper" later copies it into a wider store and a node gains `morph.base`. `morphCss` then merges base under the node's own looks. Nothing is reserved now: `cleanMorph` passes only known keys, and adding one later costs a line and no migration of stored data. No catalogue is built.

## 9. Options model

### 9.1 Additions

```ts
export type OptionGroup = "content" | "layout" | "look" | "behaviour";

export interface PropWhen {
  prop: string;
  is?: readonly (string | number | boolean)[];
  not?: readonly (string | number | boolean)[];
  /** The other prop has any non-empty value. */
  set?: boolean;
}

// Added to PropDef:
/** The section this option sits in. Default from the kind: see groupOf. */
group?: OptionGroup;
/** The part it shapes. With that part selected, the panel lists it first. */
part?: string;
/** Show the field only while this holds. Hidden fields keep their value. */
when?: PropWhen;
/** Behind the section's "+". */
more?: boolean;
```

Default, so an unedited block gets sections at no cost:

```ts
export function groupOf(p: PropDef): OptionGroup | null {
  if (p.group) return p.group;
  if (p.kind === "slot") return null;                 // a slot is in the tree, not the panel
  if (["string", "text", "richtext", "url", "image", "rows", "list"].includes(p.kind)) return "content";
  return "layout";                                     // select, number, boolean
}
```

`binds` and Specialist 2's `needs` are Data, above Content, in their section.

```ts
// picture-wall, WALL_PROPS (picture-wall.tsx:57-179), one word each
{ name: "captionPlace",  group: "layout", part: "caption", … },
{ name: "captionAt",     group: "layout", part: "caption", when: { prop: "captionPlace", is: ["on"] }, … },
{ name: "captionShow",   group: "behaviour", part: "caption", when: { prop: "captionPlace", is: ["on"] }, … },
{ name: "captionWeight", group: "look", part: "caption", … },
{ name: "captionFont",   group: "look", part: "caption", … },
{ name: "captionSize",   group: "look", part: "caption", … },
{ name: "captionColor",  group: "look", part: "caption", … },
{ name: "captionScrim",  group: "look", part: "caption", when: { prop: "captionPlace", is: ["on"] }, more: true, … },
{ name: "min",           group: "layout", part: "cell", … },
{ name: "shape",         group: "layout", part: "image", … },
{ name: "gap",           group: "layout", part: "root", … },
```

An option and a morph can set one thing, such as `captionWeight` and the caption's weight. The morph wins, by `!important`. The panel shows the option under its section as "Block settings" and the look's reset arrow beside the look.

### 9.2 Mapping

| `PropDef` | `panel.ts` | Puck 0.24 | Lab controls |
|---|---|---|---|
| `group: "content"` | New section "Content", above Layout | `<FieldGroup label="Content" defaultExpanded>` | Fieldset |
| `group: "layout"` | Option rows at the top of "Layout" | `<FieldGroup label="Layout">` | Fieldset |
| `group: "look"` | Option rows at the top of "Appearance" | `<FieldGroup label="Look">` | Fieldset |
| `group: "behaviour"` | New section "Behaviour" | `<FieldGroup label="Behaviour">` | Fieldset |
| `part` | Selected part's options listed first | Ignored | Outlines that part on hover |
| `when` | `slots` filter on each render, `allowed: null` when false | `resolveFields` (exists in 0.23 and 0.24, `actions-Dgllwd-W.d.ts:478`) | Same filter |
| `more` | `optional: true`, under "+" (`panel.ts:290,297`) | Separate collapsed group | Same |
| `PartDef.draws` | Popup's Show with | None | A state |

`SECTION_ORDER` and `SectionId` gain `content` and `behaviour` (`model/schema.ts:37-42`). Classifieds declares neither, so it is unaffected.

`renderFields` receives `{ fields: Record<name, ReactNode> }` and draws what it returns (`chunk-DQXMVPVM.mjs:9030-9036`; [V:read] 0.24.0's dist, downloaded to the scratchpad and not executed). A `renderFieldsFor(def)` in `page-builder/config.client.tsx` walks the same groups. It lives there, not in `blocks`, because it imports `FieldGroup` from Puck and `blocks` imports nothing from Puck. Written with the 0.24 stone, not before.

`FieldGroup` in 0.24: `{ variant?, icon?, children?, id?, defaultExpanded? } & ({ collapsible: false; label? } | { collapsible?: true; label })` (`index.d.ts:82-96`).

`item-focus.tsx:131-142` in 0.24.0: the list key is still `<id>_<field type>_<name>` (`chunk-DQXMVPVM.mjs:8963`), rows are still `{_originalIndex, _currentIndex, _arrayId}` with `_arrayId` `<id>-<n>`, and the list's `openId` is read the same way (`:1273,1368-1379,1415-1417`) [V:read]. Unchanged in form, so the line survives the upgrade. It remains an undocumented key; a browser run on the upgraded editor settles it.

### 9.3 Plain-DOM controls

`Control` has no plain text box today: `attrRows` writes its own HTML (`tree-editor.ts:360`), and `toggle` is declared with no case in `control()` (`panel.ts:348-406`). `propSlots(def, values)` turns `PropDef`s into `ResolvedSlot`s, with these additions to `panel.ts`:

| Kind | Control | Care |
|---|---|---|
| `string`, `url` | New `text` | `data-sync` placeholder for soft render (handover section 7). `url` runs `safeLink` on commit |
| `text` | New `textarea` | Same. `prop` on a part: double click types in place (`startInlineText`, `tree-editor.ts:515`) |
| `richtext` | `textarea`; double click opens `startInlineText` with `rich` | A rich prop is HTML through `<RichText>`; `sanitizeRichValues` still runs on save |
| `number` | `number`, with `bounds` from `min`, `max` | Existing |
| `boolean` | `chips`, `list(true, false)`, labels On and Off | No new control, and `toggle` stays unused |
| `select` | `select` | Existing. Options become `allowed.list` and `labels` |
| `string` with `format: "color"` | `color` | Existing popover. Writes hex |
| `image` | `pictureRow` generalised from `tree-editor.ts:365` to a prop name | `choosePicture`; pasted address on the test page |
| `list` | New `rows`-like list of one column | Stored as `string[]` (`coerce.ts:82`), or `[{ value }]` when Puck's array field wrote it (`editor.ts:215`). Read both, write what was there. Only `contact-form` uses it (`contact-form.tsx:37`) |
| `rows` | New `rows` | Collapsed rows named by `summary`; open one to get its columns as sections, with "← Block ‹ ›", as `FocusedFields` does; add, remove, duplicate; drag through the existing `dragLayer` handler (`panel.ts:121`). Reorder remaps `morph.rows` keys. The largest piece: about 150 lines [A] |
| `binds` | `mount`, below | Falls back to a text box holding the id, as the type comment says (`types.ts:219-220`) |
| `slot` | None | A row in the tree |

React custom controls. Hosts already build them: `PuckConfigOptions.fields` is `(prop) => component | null`, with Puck's custom-field signature `{ value, onChange, readOnly, field }`. Reuse the same function, passed to `mountTreePage` as `fieldControls`. New slot control `mount`:

```ts
// in Panel: keep the element and root across innerHTML redraws
mounts: Map<slotId, { host: HTMLElement; root: Root }>;
// html(): <div data-mount="<slotId>" data-sync="row-<slotId>"></div>
// after each draw: replace the placeholder with the kept host, root.render(createElement(Control, { value, onChange, readOnly, field }))
```

`ServicePickerField` mounted under `createRoot` outside `<Puck>` with no error: its `FieldLabel` reads a default store [V:run]. Its label carries Puck's class and needs Puck's stylesheet or a plain label. `gallery-pictures-field.tsx` and `tile-arrange-field.tsx` (danamccool) use `useFocusedItem` and `useGetPuck`, so they keep Puck's panel through "Edit its settings" [V:read, not run].

`AutoField` is not used here, so Puck 0.24 and its unknowns do not reach the panel.

## 10. Ladder, atoms, elktours, Tweaks

### 10.1 Ladder

Each rung is per node, per page, and readable from the document. No field stores it.

| Rung | What the artist does | Stored as | How to tell | Undo after a save |
|---|---|---|---|---|
| Moves | Drag, duplicate, delete, put in a box | Position in the tree | Default | Move it back |
| Options | Fields in the panel | Props | Props differ from defaults | Field reset |
| Parts | Click in, restyle, hide a part, set tokens | `props.morph` | `morph` present | Reset arrows; "Reset" on the node deletes `morph` |
| Live atoms | "Open up": the block becomes a box of smaller live blocks | A `box` of atom nodes | `box` whose children have `needs` or are declared atoms | Auto dog-ear "Before opening up" |
| Frozen | Detach: rendered HTML into boxes | Own blocks | No sealed node, data stopped | Auto dog-ear "Before detach" |

Moving down keeps looks: atoms take `fromPart`, and Detach bakes through `edits`. Moving back up from atoms or frozen discards what was changed since, and the panel says so before Use. The panel shows one line, e.g. "Block · parts changed on this page · 3 of 6".

### 10.2 Atoms

```ts
// TourMain, in the contract sidecar
atoms: [{
  type: "box", props: { tag: "div", cls: "tour-main-grid" },
  items: [
    { type: "box", props: { tag: "div" }, items: [
      { type: "TourDescription", fromPart: "description" },
      { type: "TourLists",  when: "showHighlights", fromPart: "lists" },
      { type: "TourRoute",  when: "showRoute", pass: { heading: "routeHeading" }, fromPart: "route" },
    ] },
    { type: "TourBooking", when: "showBooking", fromPart: "booking" },
  ],
}]
```

Pure expansion in `block/atoms.ts`: walk, drop `when` false, copy `pass`, new ids, `fromPart` becomes the atom's `morph.parts.root`, or `look` on a box. `subject` on the node moves to the new box, per Specialist 2's 8.3.

Tested on `TourMain` by reading, not by writing it: the function is 95 lines (`blocks.tsx:226-320`), and each atom is already a clear piece of it (`lists` at `:234-253`, route at `:270-281`, aside at `:284-317`), all reading one context. The refactor is 4 small components, 4 config entries, and one named class for the page grid, because `lg:grid-cols-[minmax(0,1fr)_22rem]` fails `CLASS_RE` (`puck-tree.ts:29`) and `PartStyle` has no breakpoints. About 80 lines moved, `TourMain` stays for existing documents. Practical for context-fed and event-fed blocks, where atoms need no plumbing. `pt-event-*` are already atoms and declare nothing.

It is not generic, and not cheap for a block that holds state across its pieces: `SeriesTop` keeps `going`, `subscribed`, a toast and two dialogs together (`series-top.tsx:122-270`), so its pieces come out through extraction, not through this. Recommendation: build this rung last, and only after the developer has tried parts on real blocks. Parts alone may satisfy what they called hardly any aesthetic editing.

### 10.3 Elktours

Smallest shape, no edit to `tour/config.tsx`, `tour/context.tsx` or `tour/blocks.tsx`:

```ts
// apps/elktours/src/blocks/tour/contract.ts, new, imports nothing heavy
export const TOUR_CONTRACT: Record<string, { parts: PartMap; tokens?: TokenDef[]; atoms?: AtomNode[] }> = { TourMain: {…}, TourFilm: {…}, TourIntro: {…}, … };
```

```ts
// packages/page-builder: pure
export function fieldSlots(fields: Record<string, HandField>): ResolvedSlot[];
// text → text, textarea → textarea, number → number with bounds, radio → chips with its own labels
```

The mount passes `contract: TOUR_CONTRACT` beside `tourConfig`. `fieldSlots` draws options from the hand-written `Field` union (`config.tsx:29-32`), which has exactly those four shapes. `useTourPage` and `TourPageProvider` are Specialist 2's `via: "context"` and `runtime`. `TourLayout` (`config.tsx:90-102`) spreads props into blocks; a block ignores `morph`, so a stored morph draws nothing there until `TourLayout` or Puck's `<Render>` goes through `MorphMark`. That is a two-line change in `config.tsx`, which is hot and comes last: 0 stored rows today [survey]. Selectors here are on Tailwind literals and no elktours smoke exists; `checkParts(def, html)` is exported from `blocks` so an app script can run it. Held paths (`ELKTOURS_CONVERGENCE_2026-11-02.md:6-7`) are not involved.

### 10.4 Tweaks

The reference shows `background: {{paper}}` on the top group (`reference/grouplayer1.png`), and `panel.ts` calls that tab "the sheet's shared variables" (`:102,534`). Node tokens are something else, and a sealed block needs them. The tab offers both:

| Group | Scope | Stored | Applied |
|---|---|---|---|
| "This page" | Every node on the page | `root.props.vars: Record<name, { type, value }>`, cleaned in `cleanBoxDoc`'s root branch (`puck-tree.ts:232-238`) | `PageRoot` (`puck/blocks.tsx:127-132`) writes `--dv-<name>` on `[data-page-root]` |
| "This block", when a sealed node is selected | That node | `morph.tokens` | Root rule, section 5 |

In a look's `css`, a variable is stored as `var(--dv-paper)`, which `safeDecls` and `sheetSafe` accept, and shown in the Code tab as `{{paper}}`: `codeText` and `setCodeText` (`tree-editor.ts:71-82`) convert both ways, because `safeDecls` refuses braces (`style.ts:97`). Tree editor offers `tweaks` by adding it to `tabs` (`:300`), with `tweaks.slots` for each group. Specialist 2's `{{title}}` tokens occur only in words, these only in CSS, so the two cannot meet; in the panel, words call theirs "fields" and the Tweaks tab calls these "colours and fonts".

Style tokens that are derived get rewritten: `--blk-accent-ink` is computed at `:root` from `--blk-accent` (`blocks.css:72-75`), so redefining the input below `:root` does not move it (`css-ui.md`). `morphCss` writes `--blk-accent-ink: color-mix(in srgb, <accent> 60%, black)` beside it, using the same formula, unless the artist set it. Tokens go on the root element, not above it, because a block may set its own at its root: `.blk-banner { --blk-banner-accent: var(--blk-accent) }` (`blocks.css:191`). `--blk-bg-soft`, `--blk-faint` and the rest of `:root` work the same way, so `BLOCK_TOKENS` entries with derivatives list them.

**The 768 literal declarations do not need converting.** A part reaches any of them by selector. Tokens are for a value several parts share, where one control should move all of them. If the panel turns out to need a shared "title size" on many blocks, that block gets a token then, on evidence.

## 11. Worked example: the group

Countdown, event card, RSVP, a heading and a discussion lower down, about one thread, re-styled for this page, dog-eared. Stored in `site_config` `puck:running-the-script`, org `sunjay`, as in Specialist 2's 13.1, with `morph` filled in.

```json
{
  "root": { "props": { "title": "Running the Script" } },
  "content": [
    {
      "type": "box",
      "props": {
        "id": "box-next",
        "tag": "section",
        "label": "Next session",
        "subject": { "k": "thread", "id": "bl0whFnG6dS_7J9NvvLyS", "at": "next" },
        "look": { "layout": "stack", "gap": 24 },
        "items": [
          { "type": "live-countdown", "props": { "id": "c1", "label": "Starts in", "source": "subject", "until": "", "endedText": "We are meeting now",
            "morph": { "v": 1, "parts": {
              "root":   { "fill": "#10223a", "padding": 24, "radius": 4 },
              "digits": { "font": "Playfair Display", "size": 64, "weight": 300, "color": "#f4f1ea" },
              "label":  { "case": "upper", "tracking": 0.14, "size": 12, "color": "#b8c4d6" } } } } },
          { "type": "live-event", "props": { "id": "e1", "showCover": true, "showFacts": true } },
          { "type": "live-rsvp", "props": { "id": "r1", "label": "I'm coming", "showCount": true,
            "morph": { "v": 1,
              "parts": { "button": { "fill": "#b85c3a", "color": "#ffffff", "radius": 0, "css": "letter-spacing: .08em; text-transform: uppercase" } },
              "tokens": { "--blk-accent": "#b85c3a" } } } },
          { "type": "words", "props": { "id": "w1", "tag": "h2", "html": "Talk about <b>{{title}}</b>" } },
          { "type": "live-discussion", "props": { "id": "d1", "heading": "Conversation", "limit": 20, "refresh": 0,
            "morph": { "v": 1, "parts": {
              "root": { "margin": [64, 0, 0, 0] },
              "item": { "bstyle": "solid", "bwidth": 1, "bcolor": "#d8d3c4", "padding": 16 } } } } }
        ]
      }
    }
  ]
}
```

The exact CSS it publishes, from the prototype [V:run, `out/server.log`], with `live-*` assumed to carry the `data-part` markers of `proto/parts.ts`:

```css
template[data-morph="10pk7e9mdbt"] + [data-part="root"]{padding:24px !important;background:#10223a !important;border-radius:4px !important}
template[data-morph="10pk7e9mdbt"] + [data-part="root"] [data-part="label"]{font-size:12px !important;text-transform:uppercase !important;letter-spacing:.04em !important;letter-spacing:0.14em !important;color:#b8c4d6 !important}
template[data-morph="10pk7e9mdbt"] + [data-part="root"] [data-part="digits"]{font-family:"Playfair Display", Georgia, "Times New Roman", serif !important;font-size:min(64px, 10vw) !important;font-weight:300 !important;color:#f4f1ea !important}

template[data-morph="tnxa0528xl"] + [data-part="root"]{--blk-accent:#b85c3a !important;--blk-accent-ink:color-mix(in srgb, #b85c3a 60%, black) !important}
template[data-morph="tnxa0528xl"] + [data-part="root"] [data-part="button"]{color:#ffffff !important;background:#b85c3a !important;border-radius:0px !important;letter-spacing:.08em !important;text-transform:uppercase !important}

template[data-morph="cbvki1f94"] + [data-part="root"]{margin:64px 0px 0px 0px !important}
template[data-morph="cbvki1f94"] + [data-part="root"] [data-part="item"]{padding:16px !important;border-style:solid !important;border-width:1px !important;border-color:#d8d3c4 !important}
```

`letter-spacing` twice on the label is existing `textDecls` output (`style.ts:164,166`), harmless, and a later one wins.

A dog-ear row, `puck-ears:running-the-script`:

```json
{ "v": 1, "nodes": { "c1": [
  { "id": "e-3kd92hsa", "name": "Navy, large digits", "kind": "named", "at": "2026-11-03T02:14:00Z", "by": "<session user id>",
    "node": { "type": "live-countdown", "props": { "id": "c1", "label": "Starts in", "source": "subject", "until": "", "endedText": "We are meeting now",
      "morph": { "v": 1, "parts": { "root": { "fill": "#10223a", "padding": 24, "radius": 4 }, "digits": { "font": "Playfair Display", "size": 64, "weight": 300, "color": "#f4f1ea" }, "label": { "case": "upper", "tracking": 0.14, "size": 12, "color": "#b8c4d6" } } } } } }
] } }
```

In the editor.
1. Click the countdown: the node is selected; the panel shows Data (Specialist 2), Options and the root's look.
2. Click again: the digits. `~p:digits` is selected, and its computed size, weight and colour fill the fields. The artist types 64.
3. `writeLook` → `change()` → `draw()`. `MorphMark` writes the marker and a plain `<style>`. The element is re-found, the selection stays.
4. Opening `c1` in the popup is the same engine re-rooted; `subject` still resolves against the full document (Specialist 2's 12.1), so the look is on the node and "From" still names `box-next`.
5. Saved tab, Dog-ear, "Navy, large digits": the sidecar row is written. The page's document is not. Other pages are not touched: the block definition has not changed, and `morph` is on this node of this document.
6. Using an earlier ear replaces `c1` in the editor's document, keeping `subject`. Save publishes.

Published, on the server. `loadPage` → `resolveAllData` (Specialist 2's pre-pass adds `live`) → `<Render>`. For each node: `Morphed` takes `morph` off the props; `Interactive` strips `puck`; the client component gets its data only; `MorphMark` cleans, compiles and writes `<template>`, block, `<style href>` and a font `<link>`. React coalesces the styles into `<head>`. Client JS receives neither `morph` nor any selector. With no morph on a node, its output is exactly today's.

## 12. Worked example: a monolith made editable, not rewritten

`pt-banner`, sunjay, nothing but 8 `data-part` attributes:

```json
{ "type": "pt-banner", "props": { "id": "b1", "title": "Para Theater", "subtitle": "Rock balancing", "imageUrl": "/media/…/rocks.jpg", "scrim": 80, "align": "center", "size": "regular", "height": 0,
  "morph": { "v": 1, "parts": {
    "title":    { "color": "#d9c08a", "size": 96, "weight": 300, "tracking": -0.02 },
    "subtitle": { "color": "#f4f1ea", "css": "font-style: normal; letter-spacing: .2em; text-transform: uppercase" },
    "wash":     { "opacity": 0.45 },
    "copy":     { "align": "left" },
    "button":   { "radius": 999, "bstyle": "none", "fill": "#d9c08a", "color": "#2b3033" } } } } }
```

```css
template[data-morph="1lh969o1w1z"] + [data-part="root"] [data-part="wash"]{opacity:0.45 !important}
template[data-morph="1lh969o1w1z"] + [data-part="root"] [data-part="copy"]{text-align:left !important}
template[data-morph="1lh969o1w1z"] + [data-part="root"] [data-part="title"]{font-size:min(96px, 15vw) !important;font-weight:300 !important;letter-spacing:-0.02em !important;color:#d9c08a !important}
template[data-morph="1lh969o1w1z"] + [data-part="root"] [data-part="subtitle"]{color:#f4f1ea !important;font-style:normal !important;letter-spacing:.2em !important;text-transform:uppercase !important}
template[data-morph="1lh969o1w1z"] + [data-part="root"] [data-part="button"]{color:#2b3033 !important;background:#d9c08a !important;border-radius:200px !important;border-style:none !important}
```

The inline `style={{ color: ink }}` at `layout-blocks.tsx:273`, the Tailwind `text-4xl` in `@layer utilities`, the lookup tables and `isolate` are all still there and were not touched. On sunjay's real CSS the inline title colour lost to the morph [V:run, using the selector-only form of the parts map, since the markers are not in the file yet]. `radius: 999` was clamped to 200 by `BOUNDS.radius`.

`TourMain`, no edit to any file, same mechanism:

```css
template[data-morph="1t94ghhuqk2"] + * section.mt-14 > h2{font-family:"Playfair Display", Georgia, "Times New Roman", serif !important;font-size:min(40px, 6vw) !important;font-weight:400 !important}
template[data-morph="1t94ghhuqk2"] + * #book > div{background:#f7f2e8 !important;border-radius:8px !important;border-style:none !important}
template[data-morph="1t94ghhuqk2"] + * #book .font-serif{color:#8a3b1e !important}
```

Picture wall with one row styled alone:

```css
template[data-morph="kaiem9a3u"] + .blk-wall .blk-wall-cell{padding:8px !important;background:#ffffff !important}
template[data-morph="kaiem9a3u"] + .blk-wall .blk-wall-caption{font-size:18px !important;color:#112233 !important}
template[data-morph="kaiem9a3u"] + .blk-wall [data-edit-item="pictures:1"] .blk-wall-caption{color:#8a3b1e !important}
```

## 13. Failure modes

| Case | Published | Editor |
|---|---|---|
| Deleted thread; no permission; private thread in a public page | Block draws what its view allows (Specialist 2). A morph restyles only what the server sent: CSS cannot reveal what was withheld, and a hidden part is still sent if the block sent it, so `hide` is a look, never access control | Parts not drawn are listed greyed with "Show with", using `draws` |
| Stale dog-ear: a part the block no longer has | Compile ignores the name | Saved tab and panel: "2 looks for parts this block no longer has", with Remove. Kept until removed |
| Stale dog-ear: a prop changed | `coerceProps` on Use: undeclared dropped, ranges clamped | Named in the differences before Use |
| Stale dog-ear: block removed from the catalogue | Not applicable: the ear is not drawn | Ear listed disabled, "This block no longer exists" |
| Node deleted | Nothing | Its ears stay. The Saved tab of the page root lists "Removed blocks", with Bring back. Dropped after 30 days when the row is next written |
| Node detached | Own blocks, looks baked | Auto dog-ear brings the block back |
| Page deleted or restored to code | Nothing | `deletePage` also deletes `puck-ears:<slug>`; `restoreLandingAction` likewise (`apps/innergathering/src/lib/puck/store.ts:27`) |
| Two editors, one document | Last save wins, as today | `ifUpdatedAt` guard (8.4), separate stone |
| Two editors, one sidecar | | Row lock in `withOrg`; per-node merge, no lost ear |
| Sidecar write fails | | Bar says so; the working copy is kept in the popup; nothing public changes |
| Document over 512 KB | | `savePage` refuses, as today; the browser stash keeps it (`PuckEditor`) |
| Morph over 16 KB, or malformed | Dropped; block draws plain | Panel says "Too much on this block" before save |
| A block draws nothing | `<template>` and no root; see 5.2's limits | Existing empty label; panel "Draws nothing" |
| Host has no `morph` option | Prop stripped; block plain | Not editable there |
| Puck's own editor opens the page | Unchanged | Keeps `morph`, draws it, offers no control |
| Font blocked or offline | Falls to the next in the stack: `fontStack` carries fallbacks | Same. Plain `<link>` does not hold the page [V:run; `precedence` did] |
| JavaScript off | Styles are server HTML | |
| Contrast | Whatever was chosen | The existing contrast note on `color` (`panel.ts:337-340`), read from the part's computed background. On the probe's sunjay page a hero subtitle drew dark on navy because `--blk-band-fg` comes from the host, so token changes need this check too (`out/sunjay-real.png`) |

## 14. Cost of adoption

| Block | Parts | Markup | Options | Lines | Rebuild needed to reach visitors |
|---|---|---|---|---|---|
| `hero-banner` | 6 | 0 | 6 `group` or `part` words | 12 | Every host using it |
| `picture-wall` | 5 | 0 | 12 words | 20 | Same |
| `pt-banner` | 8 | 8 `data-part` (or 0 with the verified selector form) | 14 words | 25 | sunjay |
| `TourMain` | 8 | 0 | `fieldSlots` | 10 in the sidecar | elktours (dev mode) |
| `series-next` | 9 | ~40 lines moved out of `SeriesTop` | Specialist 2's fixtures | 60 | ifac, sunjay |
| Any other shared block | ~3-8 | 0 | Default from the kind | 5-15 | |

Free for every block once the engine lands: root look, tokens, sectioned options, `when` not set. Which shared blocks first: `hero-banner`, `section-heading` (35 stored), `prose` (15), `picture-wall`, `feature-card`. Their classes are in the files [V:read].

## 15. Verification

Run on the test page, by hand, by the developer, in this order:
1. A sealed hero: click, click again, click again. Words, then Title. Same colour and size controls as a box.
2. Picture wall: all captions, then one.
3. A Tailwind-free and a Tailwind-built block side by side.
4. Reset arrow, undo, hide a part.
5. Dog-ear, change, compare, use the old one.
6. Reload the page (test page store) and confirm the morph draws from the document.

Automatic, before that.
- `smoke.mts` parts section, 3.3.
- `smoke-morph.mts`, 6.3.
- Harness driver from `proto/drive-editor.cjs`.

Settling what is unknown, each by a named run:

| Unknown | Run |
|---|---|
| `<template>`, hoisted style and streaming under a real Next RSC stream and a late Suspense boundary | `next dev` of a host with a stored morph in a test document, read through the edge, `grep data-morph`, and a block under `<Suspense>` with an async child |
| Hydration of a client block right after a `<template>` | Same page, browser console |
| Site CSS relying on `:first-child` of a node root | Screenshot comparison per host before and after a morph on the first block of a slot |
| Firefox and Safari | Same page by hand |
| 0.24 `arrayState` line | Browser run of Puck's editor on 0.24 in the lab, opening a row by clicking a picture |
| A site's Tailwind `!` utility beating the morph | Grep the served CSS per host for `!important` on the `.blk-*` class chain |

Not to be verified on production. Writes go to the test page's store. The first stored morph on a real host waits for the developer's innergathering rebuild, handover section 6.

## 16. Decided against

- Converting `blocks.css` to tokens.
- A `display: contents` wrapper, in the published path. It stays in `TreeCanvas`, which never ships, and is why that canvas already hid the same spacing difference.
- `@scope`: `template + root` with child combinators covers slot-bearing blocks, without a browser-support question ([U], not checked).
- Stored selectors, or a Code tab that takes a selector.
- Option overrides inside `morph`.
- `overlay` as the prop name, and renaming `store-frame`'s prop to free it.
- Dog-ears inline on the node.
- Page-wide drafts in this round.
- `subject` in a dog-ear.
- A style for one position in a data-driven list.
- Breakpoints in `PartStyle`. One font-size guard only. Listed as open.
- `AutoField` in the panel.
- A catalogue, freedom levels, or new work in Puck's own editor. `EmptyBlock` left as it is.
- A sandboxed iframe block, and any ingest at runtime (direction note 7).

## 17. Needed, and open

From Specialist 2: `contractOf` carries `parts` and `tokens`; `draws.state` uses `SubjectStateId`; `live-*` put `data-part` on the names in `proto/parts.ts` and render one root. Their `Morphed`-side adapter work and the diff in 5.5 touch the same lines of `config.tsx`, so one stone or an agreed order. Puck's editor keeps an unknown prop [V:run], which closes their open point.

From the Team Lead: `mountTreePage` gains `fieldControls` beside `contract`, `data`, `runtime`, `mode`. `TreeCanvas.tsx:63` one line. `writeLook` takes a target. `panel.ts` gains `text`, `textarea`, `rows`, `mount`. `safeDecls` fix (finding d) and the `look` fix (finding e) go first, as their own stone, independent of everything here. Rerun the classifieds suites after the first, per handover section 5.

Questions for the developer, through the senior advisor:
1. Popup's fourth tab "Saved", in the popup only, with the main column staying Properties, Code, Tweaks as in their screenshots. Default: yes.
2. A dog-ear of a group includes the arrangement of what is in it. Default: yes.
3. Per-component hold-back rather than a page-wide draft, for now. Default: yes; page-wide needs `page_revisions`.
4. Who may dog-ear: the Chief Engineer's default, owners and guides.

Open items, not for now:
- A palette that writes `var(--blk-*)`, so a part follows light and dark (6.1).
- Phone-specific looks: `morph.parts[x].phone` compiled in `@media`. `PartStyle` has no breakpoints, and neither does the reference panel.
- Font link for own blocks' `look.font` on published trees (finding f).
- Part-level `order`, from `PartStyle.order`, to rearrange a block's parts without atoms: works where the part's parent is flex or grid, and `.blk-hero-copy` is block, so it needs a look at each block.
- `morph` on `part` nodes: goes through the same path on published pages; in the canvas a part is an `outerHTML` snapshot, so the marker and the snapshot sit in one `display: contents` div (`puck/blocks.tsx:122`), and the root selector reaches it [A; not run].
