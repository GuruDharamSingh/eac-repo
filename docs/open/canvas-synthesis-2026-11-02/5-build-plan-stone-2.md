# Build plan, stone 2: click into a block (2026-11-04)

Plan by the Coding Team Lead for two coding subagents and one integration pass. It covers stone 2 of `3-synthesis.md` section 11, on top of stone 1 (closed 2026-11-04, `CANVAS_FRAMEWORK_2026-11-02.md` Progress). The Lead's seam edits (section 5) are in the tree. No app was rebuilt, nothing was committed, no database was written.

Labels: [V:run] executed in this pass (repo mounted read-only, Chromium with `--network none`), [V:read] code read, [A] assumed, [U] unknown. `T=/tmp/claude-3003/-mnt-pool1-home-guru-eac/7236b31a-7646-4e28-8b29-be60fa6c575f/scratchpad/team/s2`. `/tmp` does not survive a reboot; rollback is `~/eac-backups/direct-edit/direct-edit-stone2-base.tgz`.

## 1. Result in brief

An artist clicks into a sealed block on the test page, reaches a part inside it (a title, a caption), and restyles that part with the controls a box has, on this page only. The look is stored as `props.morph` on the node and drawn by one scoped stylesheet; the block's code lists its existing elements as parts and is not forked.

This stone edits files every host renders (`packages/blocks/src`, `packages/page-builder/src/config.tsx`, `apps/sunjay/src/blocks/layout-blocks.tsx`), and they reach live sites at any host's next rebuild. **A block with no morph must publish byte-identical markup; that is the main check of this stone** (section 7). Measured at the seam: 93 of 93 cases identical in all three modes [V:run].

Changed from the brief, and why:

| Change | Reason |
|---|---|
| The Lead landed `morph.ts`, `MorphMark`, the adapter diff, the `TreeCanvas` mark, all six parts maps and the fixture as the seam. WP-A hardens and proves them | WP-B needs a look that draws from its first build, and the parts are data taken from S1 §3.2. Splitting them across two coders would have made WP-B wait |
| `pt-banner` uses selectors over today's markup, not `data-part` | A `data-part` attribute changes what visitors are sent, which fails the main check. Cost: a utility edit can break a selector silently; WP-A's part check catches it |
| Editing draws `<style>`, `<template>`, block, in that order. S1 §5.5 put the style after the block | A style after the block would make a morphed root stop being `:last-child` in the editor only. The same argument as note 2 for the font link |
| In an editor `Morphed` always goes through `MorphMark`, which keeps one element shape. S1 §5.5 returned the bare block when unset | From bare element to fragment is a different element type at one position, so React would remount the block at the first look: client state lost, pictures flashing. The published path is unchanged |
| `repeat?: true` only; no `{ rows }` form | `morph.rows` is deferred (SC11). Stone 3 can widen the type |
| A `hasOwn` helper, not `Object.hasOwn` | `packages/direct-edit/tsconfig.json` sets `lib: ES2020` |
| No `package.json` exports change, no `block/index.ts` re-export | No host is wired. Stone 8a adds `./puck/morph`. Same rule as stone 1 |

## 2. Baselines

Measured 2026-11-04 before the first edit, then again after the seam.

| Check | Before | After the seam | How |
|---|---|---|---|
| `tsc --noEmit` `packages/direct-edit`, `packages/page-builder` | 0, 0 | 0, 0 | `$T/lead/tsc-all.sh` |
| `tsc --noEmit` `packages/blocks` | 2, both `services/src/gather.ts:704,706` | the same 2 | same |
| `tsc --noEmit` `apps/arts-collective`, `innergathering`, `elktours`, `sunjay`, `amrit-canada`, `art-auction`, `artdirect`, `danamccool`, `fourthwayBookreaders`, `ifac` | 0 each | 0 each | same. These ten are every app whose `package.json` names `blocks`, `page-builder` or `direct-edit`; `amrit-canada` and `fourthwayBookreaders` name `blocks` only |
| `drive`, `drive4` to `drive12` | 43, 39, 14, 35, 18, 29, 54, 46, 56, 20; 0 failures | the same | `$T/lead/drivers.sh` |
| `drive13` | 403/0 | 408/0 | Seed gained `feature-card` and `pt-banner`; two hard-coded counts updated (`drive13.cjs:36`, `drive13-canvas.cjs:52`); three passes more from iterating one more block |
| `smoke.cjs`, `walk.cjs`, `walk2.cjs` | 24/0, 61/0, 12/0 | the same | `walk*.cjs` copied into the harness |
| Assembled page | 3,116,257 bytes, sha256 `f4788533…`, identical to `team/pack/h3/click-through-test.html` | 3,135,851 bytes | `pack-test.cjs page` |
| Published markup, `$T/baseline-render.json` | 93 cases, sha256 `ba65ee8b…`; two runs of one tree identical; `profile-gallery/defaults` throws today and is recorded | 93/0 in each mode of section 7 | `render-published.sh`, `compare-render.cjs` |
| No contract, baseline source against the tree | n/a | 416 states: 1 differs, a timeout's millisecond text; 36-step flow: 0 differ; the one page error is the same in both (`Add, Profile gallery`, known) | `harness/parity/`, section 7.3 |

Found while measuring:
- `scratchpad/artifact-files/index.html` (2,966,880 bytes, 11:05) is the page from before stone 1, not the published page. The current assembled page is the 3,116,257-byte one above. Use `land-data.json` from `team/pack/h3` or read the artifact URL; do not diff against that copy.
- Tree check [V:run, 14:12]: nothing in `apps/` or `packages/` newer than 13:21 EST other than this pass's files. `packages/page-builder/package.json` and `src/editor.tsx` hold another session's edits and were not touched.
- `runall.sh` filtered out the walk's indented `FAIL` lines. Fixed.

Not run: the stored-data check for R-a. A read-only `SELECT` on `site_config` for `css` values with unbalanced brackets or over 160 characters was refused by the permission system and not retried. What stands: 0 rows held `!important` on 2026-11-02 (review). Stored values are at most 160 characters because `safeDecls` sliced them on save; a sliced one that is unbalanced already breaks the next rule, so refusing it can only help [A].

## 3. Scope, from the synthesis

Scope:
- `BlockDef.parts`, `morph`, `MorphMark`, the adapter diff (S1 §5.5), `TreeCanvas.tsx:63`, part rows in the tree, `writeLook` on a part, "This block" in Tweaks, `smoke-morph`.
- First blocks: `hero-banner`, `section-heading`, `prose`, `picture-wall`, `feature-card`, and `pt-banner` with sunjay's CSS inlined.
- The adapter diff is in shared `page-builder/src/config.tsx`, so it reaches any host at its next rebuild. Byte-identical when unset; check through the edge on that rebuild.
- `MorphMark` writes a font `<link>` before the marker (note 2). `morph` holds `parts` and `tokens` only; `rows` is deferred (SC11). The positional limit of synthesis §3.5 is recorded, not closed (note 4). `smoke-morph` runs in the harness, since the parts smoke needs the stone 15a install (note 1).

Done when: click Hero, click, click: Words, then Title, with the same colour, size and font controls as a box. It restyles live and the selection holds. Hide Subtitle, reset, undo. All captions on a wall restyle at once. A Tailwind block and a tokens block behave alike. Save, switch view, return: it draws from the document. The "Show as published" button draws the same through `<Render>` with no editor markers. A block with a font look keeps its spacing against `blocks.css:423,1038`.

Decisions in force: no rebuild, no commit (D4, D5 defaults). The popup is a later stone. The `o.contract` gates from stone 1 stay. No surface code changes. Typing in place on a part waits for the popup stone; here a part's panel lists its prop's field first.

Reading of §4.2 and S1 §4 used here: a sealed node's panel is its `root` part: options first, then the box's sections. So `P1` of `drive13` and two checks in `walk.cjs` change from exact lists to "options first" (B7). No reference image shows a sealed block's panel.

## 4. Repairs and review notes

| Item | Owner | Where | Note |
|---|---|---|---|
| R-a `safeDecls`: comment markers, `!`, unbalanced brackets and quotes, over-long values | WP-A | `block/style.ts`; `balancedCss` is already there | Reaches elkdonis-arts.org at its next rebuild. Verify with `tree.html#classifieds` (parity kit) and `patchCss` in Chromium: `color: red /*` in one box must leave the next box's rule, `cssRules.length` 2 of 2 |
| Colon in a colour prop's name stops its popover | Done in the seam | `panel/panel.ts:590` splits at the first colon | WP-B adds the check |
| Stale comment at `block/contract.ts:38` | Done in the seam | Now cites `panel/panel.ts:590` | |
| Contract prop named `id` writes node identity | WP-B | `canvas/block-fields.ts:51`: skip `id`, `puck`, `editMode`, `children`, `morph` | Reached by no shared block; test with a hand-made contract |
| Stored node type `constructor`, `__proto__`, `toString` throws outside the boundary | WP-A in `puck/TreeCanvas.tsx`, `block/puck-tree.ts`. WP-B in `canvas/tree-editor.ts` | `hasOwn` and `contractFor` from `block/contract.ts`; `sampleKeysOf` and `sampleHasRows` already use them | Each lookup by `node.type`. The result is "Unknown block: constructor", selectable |
| Detach on a parent copies "Unknown block: <type>" as words | WP-B | `canvas/tree-editor.ts`, `existing`: an element with `dataset.treeNode` and no wrap is a node too | |
| Undo with focus and no typing session leaves stale field text | WP-B | `canvas/tree-editor.ts`, history callback: a full redraw when focus is in the panel. Only with a contract | |

Left recorded in the framework doc: stored `javascript:` link or `Private/` picture on a sealed block at save; four `limit` props with no bounds; a box's Fill popover scrolling the panel sideways; the test bars at 390 px; blocks that draw nothing on Add.

## 5. Shared contract, verbatim

All of this is in the tree. A coder may change internals; a signature or a stored shape changes only by asking the Lead.

`packages/blocks/src/types.ts` (exported as types from `index.ts`):

```ts
export interface PartDef {
  label: string;
  /** One complex selector, no comma. Starting with ">": the element right after the marker (the block's root), then a path from it. Otherwise: inside the root. A block with a slot uses the ">" form only. */
  sel: string;
  repeat?: true;
  draws?: { props?: Record<string, unknown> };
  prop?: string;
}
export type PartMap = Record<string, PartDef>;   // names stored: /^[a-z][a-zA-Z0-9]{0,31}$/, `root` is the outermost element
export interface TokenDef { name: `--${string}`; label: string; type: "color" | "font" | "length" }
// BlockDef gains: parts?: PartMap; tokens?: readonly TokenDef[];
```

`packages/blocks/src/registry.ts:79`: `morph` joins `RESERVED_PROP_NAMES`. No declared prop has that name [V:run grep]. `subject` and `live` join in their own stones.

`packages/blocks/src/contract.ts`: `BLOCK_TOKENS` (the eight of S1 §2.1), and `BlockContract` gains `parts?: PartMap; tokens: readonly TokenDef[]`, the second being `BLOCK_TOKENS` for a `tokens` block, then its own. `contractOf`'s result still assigns to `EditorContract` [V:run: `typecheck-seam.ts`, and a deliberate error in a copy is reported].

`packages/direct-edit/src/block/contract.ts`:

```ts
export interface ContractPart { label: string; sel: string; repeat?: true; draws?: { props?: Record<string, unknown> }; prop?: string }
export interface ContractToken { name: string; label: string; type: "color" | "font" | "length" }
// BlockContract gains: parts?: Readonly<Record<string, ContractPart>>; tokens?: readonly ContractToken[];
export const hasOwn: (o: object, k: string) => boolean;
export const contractFor: (c: EditorContract | undefined, type: string) => BlockContract | undefined;
export const ROOT_PART = "root";
export const GENERIC_ROOT_SEL = "> :not(template)";
export const PART_NAME: RegExp;
export const partRef: (id: string, part: string, i?: number) => string;   // `<id>~p:<part>` or `<id>~p:<part>:<i>`
export function parsePartRef(ref: string | null | undefined): { id: string; part: string; i?: number } | null;
export const tokenKey: (name: string) => string;      // `t:--blk-accent`, the panel key
export const tokenNameOf: (key: string) => string | null;
export const tokenSlotId: (name: string) => string;   // `t-blk-accent`, the panel slot id
```

`packages/direct-edit/src/block/morph.ts` (pure, server-safe):

```ts
export interface NodeMorph { v: 1; parts?: Record<string, PartStyle>; tokens?: Record<string, string> }  // a font token holds a library family's name
export type MorphParts = Readonly<Record<string, { sel: string }>>;
export interface CompiledMorph { scope: string; css: string; fonts: string[] }
export function sheetSafe(value: string): boolean;
export function cleanMorph(raw: unknown): NodeMorph | null;
export function morphCss(m: NodeMorph, parts: MorphParts | undefined, o?: { editor?: boolean }): CompiledMorph | null;
// Reading and writing a node's props. An empty morph is removed, so a block with no looks publishes as if morph did not exist.
export function partLookOf(props: Record<string, unknown>, part: string): PartStyle;   // as stored, or {}
export function setPartLook(props: Record<string, unknown>, part: string, look: PartStyle): void;
export function tokenOf(props: Record<string, unknown>, name: string): string | undefined;
export function setToken(props: Record<string, unknown>, name: string, value: string | undefined): void;
export const partSafeDecls: (css: string | undefined) => Decl[];   // the Code tab's `sanitize` on a part
```

Rules compile to `template[data-morph="<hash>"] + <root>{…}` and `template[data-morph="<hash>"] + <root> <sel>{…}`, each declaration `!important`; a `>` selector replaces `<root> ` with its own path.

`packages/direct-edit/src/puck/morph-mark.tsx`: `MorphMark({ def, morph, editing, children })`. Published: font `<link>`s, `<style href="m-<hash>" precedence="eac-morph">`, `<template data-morph>`, the block. Editing: `<style>`, `<template>`, the block, null slots holding position when there is no look.

`packages/direct-edit/src/canvas/parts.ts`: the editor's reading of the same selectors.

```ts
export function partEls(nodeEl: HTMLElement, sel: string): HTMLElement[];   // what the rule in morph.ts reaches; `:scope`-anchored; a nested node's elements excluded
export interface DrawnPart { name: string; part: ContractPart; els: HTMLElement[] }
export function drawnParts(nodeEl: HTMLElement, def: BlockContract | undefined): DrawnPart[];   // declaration order; root omitted, since the node is its root part
```

`packages/page-builder/src/config.tsx`, the adapter diff as applied:

```ts
// PuckConfigOptions:
morph?: ComponentType<{ def: BlockDef; morph: unknown; editing: boolean; children?: ReactNode }>;

// after `inner`:
const morphed = function Morphed(props: Record<string, unknown>) {
  const { morph, ...rest } = props;
  const drawn = createElement(inner as ComponentType<never>, rest as never);
  if (!MorphMark) return drawn;
  const puck = props.puck as { boxEditing?: boolean; isEditing?: boolean } | undefined;
  const editing = !!(puck?.boxEditing || puck?.isEditing);
  return morph || editing ? createElement(MorphMark, { def, morph, editing }, drawn) : drawn;
};
// `Styled` draws `morphed`, and `base` falls back to `morphed`.
```

`packages/direct-edit/src/puck/TreeCanvas.tsx:63`: `firstBox` skips `STYLE`, `SCRIPT`, `LINK`, `TEMPLATE`, at the top and in the `display: contents` descent.

Parts data, in the block files: S1 §3.2 for `hero-banner` and `picture-wall` (with `repeat: true`); new maps for `section-heading`, `prose`, `feature-card`; `pt-banner` as selectors: `> section`, `> section > img`, `> section > [aria-hidden="true"]:not(img)`, `> section > div:last-child`, `h1`, `h1 + p.italic`, `p.leading-relaxed`, `a`.

Fixture: `harness/blocks-fixture.ts` passes `morph: MorphMark` and adds `ptBanner` to the catalogue; the seed gains `card` and `ptb` at its end. `harness/sunjay-banner.css` is the extract of sunjay's served chunk (`sunjay-extract.cjs`, 3.7 KB): pt-banner's rules in their real layers, the variables and the preflight scoped to its section. `view-blocks.html` links it; `test.html` has `/*__SUNJAY_CSS__*/`, filled by `pack-test.cjs`.

Checked at the seam in Chromium with a morph on hero, wall and ptb, saved and remounted [V:run]: the marked element is the `SECTION`; wrapper children `STYLE, TEMPLATE, SECTION`; title colour, 64px and font applied; `--blk-band` on the root moves the ground; a hidden subtitle is `opacity .3` in the editor and `display: none` published; six captions change together; `pt-banner` drawn as `flex`, with its inline title colour beaten; published shape `LINK, TEMPLATE, SECTION`, no `data-tree-*`, three sheets in `<head>`; no page errors. Screenshot read.

## 6. Work packages

Disjoint files. Each coder builds in its own scratch (`$T/a`, `$T/b`):

```bash
S=$T/a; mkdir -p $S/h3/shots; H=/mnt/pool1/home/guru/eac/packages/direct-edit/harness
cp -r $H/. $S/h3/ && cp -r $T/lead/h3/node_modules $S/h3/ && cp $T/lead/h3/land-data.json $T/lead/h3/land.css $T/lead/h3/land-body.html $T/lead/h3/landing.html $T/lead/h3/snapshot.html $S/h3/
S=$S sg docker -c "bash $S/h3/runall.sh drive13.cjs"      # bundles, then runs
sg docker -c "docker run --rm -u 3003 -v $S/h3:/h -w /h node:24-alpine node pack-test.cjs page"; S=$S sg docker -c "bash $S/h3/runall.sh smoke.cjs walk.cjs walk2.cjs"
sg docker -c "bash $T/lead/tsc-all.sh $S/tsc packages/direct-edit packages/blocks"   # no list: all 13 workspaces
```

Copy harness files again after editing them (`cp $H/*.cjs $H/*.ts $H/*.html $H/*.sh $H/*.css $S/h3/`).

### WP-A: delivery and its safety

Files: `packages/direct-edit/src/block/{morph,style,puck-tree,patch}.ts`, `src/puck/{morph-mark.tsx,TreeCanvas.tsx}`, `packages/page-builder/src/config.tsx`, `packages/blocks/src/{types,registry,contract,index}.ts`, `packages/blocks/src/blocks/{hero-banner,section-heading,prose,picture-wall,feature-card}.tsx`, `apps/sunjay/src/blocks/layout-blocks.tsx`. Harness: `blocks-fixture.ts`, `hb.sh`, `pack-test.cjs`, `test.html`, `view-blocks.html`, `render-published.*`, `compare-render.cjs`, `sunjay-*`, new `smoke-morph.*`.

- A1. R-a in `safeDecls`: refuse `/*`, `*/`, `!`, `!balancedCss(value)`, and values over 160, without slicing (`style.ts`, the line `out.push([prop, value.slice(0, 160)])`).
- A2. `cleanBoxDoc`: `morph` on a sealed node through `cleanMorph`, deleted when null. S1's "cleaned at render, and at save". Own nodes already drop it by whitelist. A stored `morph` of unknown shape on a sealed node must not survive a save.
- A3. `hasOwn` at each lookup by a stored type in `TreeCanvas.tsx` (`config.components`, `slots`) and `puck-tree.ts`.
- A4. `harness/smoke-morph.{ts,html,cjs}`, bundled in `hb.sh`, in Chromium:
  - The 35 hostile inputs of S1 §6.3, all refused. A list of ordinary values all kept (`calc((1px + 2px) * 2)`, `var(--blk-accent)`, `rgb(1, 2, 3)`, a font stack, `repeat(2, minmax(0, 1fr))`).
  - `cleanMorph` is idempotent. `constructor` as a part name finds nothing in `morphCss`. Past 16 KB the morph is dropped whole.
  - Per first block and part: drawn through `<Render>` with `{ ...defaults, ...sample, ...draws.props }`: `partEls` and the stylesheet's own selector select the same elements; exactly one for a part with no `repeat`, at least one with it; the name passes `PART_NAME`; no comma; a slot-bearing block uses `>`; `prop` is a declared prop. This is the parts smoke of S1 §3.3, moved to the harness (note 1).
  - The cascade, on `blocks.css` unlayered and layered, and on `sunjay-banner.css`: inline `text-align` on `.blk-hero-copy`, inline title colour on `pt-banner`, the caption's specificity chain, as in S1 §5.3.
  - Spacing: a block with a font look against the same block without, in `.blk-flow-body` (`blocks.css:1038`), `:is(.blk-prose, .blk-textimg-body)` (`:848`), and the flowing split column at `:423`: identical offsets, published shape.
  - A font that cannot load does not blank the canvas (S1 finding a).
  - Hydration: `renderToString` of a page holding `contact-form` with a morph, then `hydrateRoot`: 0 recoverable errors (S1 §15; narrowed in the synthesis §13).
  - `patchCss` with `color: red /*` and `color: rgb(1,2` in one box: `cssRules.length` 2 of 2 (R-a).
- A5. Byte identity (section 7) after every change to `config.tsx`, the block files or `TreeCanvas.tsx`.

Print `pass N fail M`, as the other drivers do.

### WP-B: click-through, tree, panel

Files: `packages/direct-edit/src/canvas/{tree-editor,block-fields,parts,clickthrough,minibar,box-panel,adopt}.ts`, `src/panel/{panel,icons}.ts`, `src/direct-edit.css`, `src/model/schema.ts`, `src/block/contract.ts`. Harness: new `drive14.cjs`, `drive14-*.cjs`, `walk3.cjs`; `view-blocks.ts`, `drive13-panel.cjs`, `drive13-canvas.cjs`, `walk.cjs`.

Every behaviour below applies only with `o.contract`. S1 ran this in the real panel with 70 added lines; that prototype is gone, so its shape is restated here.

- B1. References. `selId` may be a part ref. `found(ref)` resolves it to the node's `FoundNode`. `elOf(ref)`: `partEls(nodeEl, sel)[i ?? 0]`. `idOf(el)`: the node id, or the part ref found through `drawnParts`. `baseOf` must not split a part ref (`tree-editor.ts:299`). In `redraw`, a part that is gone (a prop was emptied) falls back to its node, not to nothing (`:234`).
- B2. `LayerSource` keeps its shape (`clickthrough.ts:22-28`). `chain(target)`: as today, then the parts of the innermost node that hold `target`, outermost first. `kids(el)`: for a sealed node, nested nodes as today plus its top parts; for a part, the parts directly inside it. `parent(el)`: the nearest part holding it, else its node. `name(el)`: `PartDef.label`. Two parts selecting one element: the first declared wins. So Hero, Words, Title on three clicks; Esc walks back out; Enter goes in.
- B3. `writeLook(ref, fn)`: a part ref writes `morph.parts[part]`; a sealed node with a contract writes `morph.parts.root`; an own node, or any node on a host with no contract, as today. Use `partLookOf` and `setPartLook`, on a copy, so an empty look removes the key. Every panel key, the thin bar's `custom`, `color`, `align` and `style`, and the menu's `hide`, `reset`, `copy-style`, `paste-style` go through it. `faq`'s `look` setting is never touched.
- B4. Panel on a part (`context()`, `:329`): heading `PartDef.label`, sub the block's label; the same `boxSlots`, `readBox`, `styleValues`, `styleOverridden`, `applyKey`, contrast, fonts as a box; no Kind and no Link. A part with `prop` lists that prop's field first, in Content, through `changeProp`. A repeated part says how many: `notice` "All 6 change together." Code tab: `sheet`, `css: codeText(look)`, `sanitize: partSafeDecls`, `from` from `inheritedFrom(el)` (`box-panel.ts:237`), each with `+`. `setCodeText` takes the sanitizer. Sealed node: `blockSlots` first, then the box's sections with no Kind or Link, reading `morph.parts.root`; Detach at the foot with a line "N of M parts changed on this page." Its Code tab keeps the read-only JSON.
- B5. Tree (`rows()`, `:274`). Parts are rows under their node, by `parent` ref: `kind` `text` where the part holds words, `image` for media, else `frame`; `name` the label; `text` the first words; `canHide`, `hidden`. A repeated part is one row with `note` "×6", and it reads selected whichever instance is. A part not drawn has no row. A sealed node's row starts closed (`open: false`), so the tree stays short; selection opens it (`panel.ts` `revealSelected`).
- B6. Tweaks: `tabs` gains `tweaks` when a sealed node or one of its parts is selected and the block has tokens. `tweaks.slots`, by type: `color`, `font`, or a `number` with `px`, keyed `tokenKey`, id `tokenSlotId`. `change` routes `t:` keys to `setToken`, as one undo step per field; `reset` removes. Values: what is stored, else `getComputedStyle(root).getPropertyValue(name)`, so none is blank. Font tokens store the family name and call `loadFont`. `panel.ts`: `tweaks.title` ("This block"; default "Shared variables"), and a tab no longer offered falls back to Properties (`html()`, `:259`) when `c.tabs` is given.
- B7. Tools on a part. Menu (`menuTools`, `:733`): Select parent, Add, Copy style, Paste style, Hide, Reset style live; Group, Ungroup, Detach, Duplicate, Move, Delete listed and grey, as in `rightclickmenuplusresizeablecornersonheader.png`. Hide on the root part is not offered. Delete, `[`, `]`, Ctrl+D, Ctrl+G do nothing on a part (`:862`). `onPull` starts no drag on a part; `handles` is empty. Thin bar: `mode` `text` for a part with words, with `bold`, `italic`, `underline`, `link`, `list` null; `box` for a container; `plain` for media. Reset style on a sealed node clears its `morph`, and it stays grey on a block with none (stone 1's FAQ check). Detach on a node with a morph says its looks do not come with it; baking them is a later stone (synthesis §3.2). `drive13` `P1` and `walk.cjs` steps "sections" and "Layout labels": options first and in their order, no longer an exact list; say so in the report.
- B8. Review notes assigned in section 4. `view-blocks.ts` may take a hash that mounts a hand-made contract and a stored `constructor` node, for those checks.
- B9. `harness/drive14.cjs`, as `drive13`'s shell, on `view-blocks.html`, one check per line of section 8 and:
  - The document holds `morph` under `parts` and `tokens` only, never a selector, and no `look` appears on a sealed node. Reset everything: the `morph` key is gone.
  - Selection holds across a redraw that replaces the element; a client block's state survives the first look (`faq`'s open row).
  - Undo and Redo through a part edit, a hide, a token, in order.
  - `tree.html` (no contract): no part rows, no Tweaks, the menu as before.
  - `walk3.cjs`: section 8 by mouse and keyboard on the assembled page, production React, as `walk.cjs` does for stone 1.

Compare with the reference and read the screenshot, for each: part rows `rowlayer4.png` (T and frame icons, indent, first words in quotes); a part's panel `text chosen, box around it shownabletoexpand.png` (Size, Layout, Text, Appearance, the row shape, "Good contrast"); Code tab `rowlayer4.png`; right-click `rightclickmenuplusresizeablecornersonheader.png`. No reference covers "×6", the notice line, or Tweaks' rows; state that.

## 7. Checks

### 7.1 Each coder

`tsc` 0 in `direct-edit` and `blocks`' same 2, and no new error in the app list; every driver at its count or above with 0 failures; own driver with 0 failures. A coder's report names what was run and what was not.

### 7.2 Byte identity, the main check

`$T/baseline-render.json`: 93 cases: every block in `SHARED_BLOCKS`, `BOX_BLOCKS` and sunjay's `layout-blocks` with defaults and with sample; the first blocks with real-looking props and each conditional part drawn; slots, boxes and the root; the adapter's `Styled`, `GenericStyle`, `style: false` and interactive paths. Clock and `Math.random` frozen. Run all three, each against the same file:

```bash
for v in "" "WITH_MARK=1" "STRAY_MORPH=1"; do E=""; [ -n "$v" ] && E="-e $v"
  sg docker -c "docker run --rm -u 3003 --network none -e TZ=UTC $E -v /mnt/pool1/home/guru/eac:/app:ro -v $S:/w --entrypoint sh eac-dev /w/h3/render-published.sh /w/render-now.json"
  sg docker -c "docker run --rm -u 3003 -v $S:/w -v $T:/t -w /w node:24-alpine node h3/compare-render.cjs /t/baseline-render.json render-now.json"
done
```

No option (an unwired host); `WITH_MARK` (a wired host, nothing set); `STRAY_MORPH` (no option, every node holding a morph, which must be stripped). 93/0 each. New cases must not change old ones; add a case for any block whose markup could be affected. Through the edge on a real rebuild: not in this stone.

### 7.3 No contract

`harness/parity/` holds stone 1's comparison, with its scripts now in the repo: 416 recorded states on the tree, classifieds tree, landing, classifieds and cards editors, and a 36-step flow, on bundles of `$T/baseline-tree` against the tree. Result at the seam is in section 2. `sg docker -c "P=$T/par BASE=$T/baseline-tree SKIP_BASE=1 bash $H/parity/run.sh"`; then `python3 $H/parity/cmp.py $T/par/base/h3/parity.json $T/par/now/h3/parity.json` and `cmpflow.py` on `flow.json`. R-a's reach on classifieds is verified here, and any difference is read, not waved through.

### 7.4 Integration, by the Lead

1. `diff -ru $T/baseline-tree/packages/direct-edit packages/direct-edit` and the same for `blocks/src` and `page-builder/src`, plus `git status --short packages/blocks packages/page-builder apps/sunjay/src/blocks`: only owned files.
2. Read both diffs. `packages/page-builder/package.json` and `src/editor.tsx` unchanged by this work.
3. `tsc` over all 13 workspaces against section 2. `typecheck-seam.ts`.
4. Section 7.2 and 7.3. Every driver, `smoke-morph`, `drive14`.
5. Remove each fix on a scratch copy (R-a, the marker, the empty-morph removal, the fallback to the node): the checks must fail.
6. Read every new screenshot against the references.
7. Assemble and smoke, `walk3`. The publish and its `artifact-design` load are the senior advisor's.
8. Docs, in the register, after `git diff` on shared files: framework doc Progress and open items; section 7 of the handover (`render-published`, `parity/`, `sunjay-extract`, `smoke-morph`, `drive14`, `walk*`); one line in `CLAUDE.md`'s Canvas entry; `.claude/rules/areas/puck-blocks.md` for `morph` as a reserved name and the part selector grammar.

## 8. Hand test for the developer, on the test page, view Blocks

1. Click the hero once: Hero banner is selected and its settings are in the right column as before, with Padding, Fill and the rest below them. Boxes inside it show faintly.
2. Click its title, then click it again: Words, then Title. The right column says Title, under it Hero banner, with Size, Layout, Text and Appearance as a box has. The tree shows Hero banner, Words, Title, Subtitle.
3. Change Colour, Size and Font. The title changes as you go and stays selected. Compare with a box's words lower down the page.
4. In the tree, click the eye on Subtitle: it goes faint here. Press "Show as published": it is gone. Close. Click the eye again. Press Undo twice: all of it goes back.
5. Use the reset arrow beside Colour: the title returns to the block's own colour.
6. On the picture wall, click, then click a caption. The right column says Caption and "All 6 change together". Change its colour: all six change.
7. Right-click the title: Move, Group, Detach and Delete are grey; Hide, Reset style and Copy style are live. Press Esc twice: Words, then Hero banner.
8. Click into the Para Theater banner lower down, which is built with Tailwind: Title and Button restyle the same way, and the Title colour beats the one it had.
9. Select the hero, open Tweaks: "This block" lists Accent, Ink, Ground, Band and the rest. Change Band: this hero changes, and nothing else on the page.
10. Press Save, switch to another view, come back: the looks are there. "Show saved document" shows `morph` on those blocks, with part names and no CSS selectors. "Show as published" shows the same looks with no editor marks. Set a font on a paragraph in the Text block inside the grid: the space under it does not change.

Corrections from the Lead's walk of the assembled page, 2026-11-04, by mouse and keyboard. The steps above stand as planned; these are how they behave:
- Step 2: from outside the block it is three clicks: Hero banner, Words, Title.
- Step 4: "all of it" is Subtitle's hide. Title's colour, size and font stay, which step 5 needs. Close returns to the selection (test page, `harness/blocks-fixture.ts`).
- Step 6: three clicks: Picture wall, Picture and caption, Caption.
- Step 7: select the title first, three clicks from outside the block. A right-click outside the selection selects what a click there would, so from the wall the menu is Hero banner's, with Group, Detach and Delete live (`canvas/clickthrough.ts:244`, unchanged). With Title selected, the first Esc closes the menu, then Esc, Esc give Words, Hero banner.

To tell the developer in the report: a part's panel has no Link or Kind, because a part has no tag or link of its own; Detach does not carry looks yet; typing in place on a part comes with the popup; a selector over Tailwind classes on `pt-banner` can break silently when a utility is edited, which the part check catches.

Not verified by this stone: a real host, signed in; Next's router and a real stream (synthesis §13); Firefox, Safari, touch; phone width in the part panel; a site's Tailwind `!` utility against a morph [A].

## 9. Risks

| Item | Effect | Handling |
|---|---|---|
| Another session rebuilds a host mid-work | `blocks`, `config.tsx` and the `parts` data reach production; no host passes `morph`, so a stored morph is stripped and nothing changes | Byte identity at the seam; compile-clean saves; WP-A reruns 7.2 |
| A catalogue declares a prop named `morph` later | `createCatalogue` throws at module load, a 500 on every page importing it | 0 declared today; the throw names the block |
| A morphed block draws nothing, so `template + :not(template)` meets the next sibling, on a block with a generic root | That sibling takes the look. Only blocks with no declared root | S1 §5.2 limit. Recorded. First blocks declare a named root |
| `profile-gallery` returns a fragment: the marker reaches its first element only | A root look on the `h2` only | 0 stored uses. A root element when it is adopted |
| `blkStyle` set: `NodeMark` marks the wrapper, not the morph's root | The panel reads the wrapper's values for the root part | 0 stored uses [V:sql, survey]. Recorded |
| Structured `pos: relative` with `x`, `y`, and `sx`, `sy`, `tx`, `ty` still transform a part (note 4) | An invisible link can move or grow | Only org editors write morphs before stone 18. Recorded, not closed |
| `--blk-on-accent` is not derived with the accent | Text on a filled accent may fail contrast after a token change | Existing contrast note reads the part's real ground; a token has none. Recorded |
| Panel length on a sealed node, and "Height" both as a prop and in Size | Reads as clutter | Named in the report; the developer decides at the hand test whether the root's box sections stay behind a `+` |
| `:first-child` of a block's root in site CSS | A morphed first block loses a site rule | `blocks.css` has none [V:read, S1 §5.2]. Screenshot compare per host at stone 8a |
| Effort | [U] | Reported at integration; no estimate offered |
