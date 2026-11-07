# Look layer inside Puck's editor: parity checklist (2026-11-06)

Division of labour (developer, 2026-11-06, as GrapesJS's style tools sit on a structure editor): **Puck owns placement and structure; the look layer owns the look of a component.** Puck keeps state, history, save, viewports, zoom, drawer, header, block settings (props) and the page outline. The look layer adds parts, the style panel, the thin bar for text looks, a look-only right-click menu and a focused look editor. Every look is written to the node's `props.morph` through Puck's `dispatch`, so there is one undo history.

Sources walked: `packages/direct-edit/src/canvas/*.ts`, `src/panel/panel.ts`, `src/puck/*`, and the Progress, Box panel, Box tree, Thin bar, Stone 1 and Stone 2 sections of `docs/open/CANVAS_FRAMEWORK_2026-11-02.md`.

Seats:
- `iframe`: the parts plugin's `overrides.iframe` (`packages/page-builder/src/parts/`): listeners and layers in the canvas iframe.
- `fields`: the plugin's `overrides.fields`: the right column while a part is selected.
- `dispatch`: Puck's `replace` on the block, `recordHistory: false` while typing, one `history.setHistories` entry when the spell ends.
- `host`: an option the host passes, because page-builder does not depend on direct-edit.

Status: **done** (in source and harness-verified, see README), **next** (seat decided, not started), **open** (a decision or a test first), **Puck** (Puck's own feature; kept).

## Look layer (ours)

| Capability (canvas source) | Seat | Status |
|---|---|---|
| Click into the selected block: the outermost declared part under the pointer, one part deeper per click, a cousin goes to the part inside the shared part, Alt+click the deepest, Enter one in, Esc one out and from the outermost back to the block (`clickthrough.ts` rules, `parts.ts`) | `iframe`, capture click, rectangle hit (`find.ts` `nextPart`) | done |
| Parts of a nested block not picked from its parent | `iframe`, owner check on `[data-puck-component]` | done |
| Outlines of the selected block's parts; solid outline and name on the selected part | `iframe`, fixed layer in the canvas body | done |
| "← Block settings" above either panel | `fields` | done |
| Built-in part panel (fill, text colour, size, weight, capitals, letter spacing, space inside, corners, line, opacity, hide, part chips, Reset; CSS box with kept / not kept for developers) | `fields` (page-builder controls), used when the host passes no `panel` | done |
| One spell of typing = one undo step | `dispatch` | done |
| The block's layer tree at the top of the panel (block > parts nested as drawn, `×n` on repeated parts, words quoted, hover outlines the part on the canvas, eye hides, click selects) | `fields`: `mountLookPanel` (`direct-edit/src/puck/look-panel.ts`) | done |
| Full Properties panel for a part (`panel/panel.ts` + `canvas/box-panel.ts`): Align in parent, Size Hug / Fixed / Fill (as a look), Column span, Grow, Layout block / stack / grid, direction, wrap, distribute, columns, align items, gap, padding and margin per side, Text with the font library, weight, size, line height, letter spacing, colour with live contrast, align, case, italic, Appearance fill / opacity / radius per corner / border, Effects; values read from the page; reset arrows | `fields`: direct-edit's plain-DOM `Panel` through `mountLookPanel`, which takes Puck's API as functions (no `@puckeditor/core` import); the host passes it as `panel` | done. Text fields open on parts that read as words (Puck wraps inline-editable words in a span, so `boxSlots` alone put them behind "+"). Puck's column is 274 px against the canvas panel's 330 px; page-builder's editor.css narrows the label column |
| Tweaks tab: the block's style tokens (`morph.tokens`, `setToken`) | same adapter | done |
| Arrange inside a block: picture left / right, columns of cards, order (`canvas/arrange.ts`) | same adapter | next |
| Thin bar over a part with words: style chip (Theme / Custom), swatch, B I U, align (`canvas/minibar.ts`) | `iframe`, `MiniBar` in the canvas body | next. B I U and align write the part's look (`weight`, `italic`, `align`), not inline runs |
| Right-click on a part, look actions only: select parent, copy / paste style, hide / show, reset, Layers row (`canvas/menu.ts`) | `iframe`; page-builder's `CanvasMenu` keeps the block menu | next |
| Focused look editor: "Edit look" opens the block on its own with real or sample rows, handed back with one `replace` (`canvas/popup.ts`) | `host`: the plugin's `popup` option, direct-edit's `openStudioPopup` over Studio's window (the canvas's popup and nested tree editor, unchanged); "Edit look" in Puck's action bar (`overrides.actionBar`) and a double-click in `iframe`; `dispatch` once on "Use on this page" plus one `setHistories` entry | done 2026-11-06 (brief `docs/open/EDIT_LOOK_POPUP_BRIEF_2026-11-06.md`; `drive-popup.cjs` 56/56). The popup keeps the canvas's own panel, not `mountLookPanel` (brief section 3: one popup, two doors) |
| Typing a block's own words in the popup, rows included (`prop`, `"<rows prop>.<field>"` with `editItem` marks) | `canvas/tree-editor.ts` `startOwnWords`, rich text through the host's `cleanRich` | done 2026-11-06 on `pt-steps` (title, text, heading) and `pt-forum` (heading; topic titles locked with a note) |
| Own blocks `box`, `words`, `picture`: their `look` prop in the same panel | `fields`, writes `props.look` | next |
| A part's background picture (`edit-shell.ts` drawer, `MediaPicker`) | `fields`; the host passes its chooser | next |

## Developer only (`developer: true`, set by the host)

| Capability | Seat | Status |
|---|---|---|
| Code tab: editable sheet, "From <ancestor>" groups with "+", refused lines named "Not kept" while typing | same adapter, `code` context, only with `developer: true` | done. sunjay passes `developer: false` (to be switched to platform admins only). Values inherited from the page's `body` are not listed, as on the canvas |
| Detach (`canvas/adopt.ts`): what a block drew becomes boxes | right-click on a block, `replace` | next |
| Code tab in the block popup | tree-editor `developer` (only `false` removes it), passed from the plugin's switch by `openStudioPopup` | done 2026-11-06. Detach is not offered in the popup at all (as on the canvas) |

The built-in panel's CSS box is behind `developer` too.

## Puck's (kept; not ported on purpose)

Reason for every row: Puck owns placement and structure (developer, 2026-11-06). A second gesture on the same elements would compete with Puck's.

| Canvas capability | Puck's feature |
|---|---|
| Page-wide layer tree with drag (`tree-editor.ts`) | Puck's Outline |
| Drag between slots with an insertion line (`nodedrag.ts`) | Puck's drag and drop |
| Group / Ungroup (`puck-tree.ts` `wrapPuckNode`, `unwrapPuckNode`) | Puck: add a box and drag into it |
| Move first / last, `[` `]` | Puck's drag; `CanvasMenu` Move up / down |
| Add box / words / picture / any block | Puck's drawer (sunjay's editor config includes `BOX_BLOCKS`); `CanvasMenu` Add |
| Duplicate, Delete | Puck's action bar; `CanvasMenu` |
| Kind, Link, Anchor, Name on own blocks | Puck fields of `box` / `words` / `picture` |
| A sealed block's settings (`block-fields.ts`) | Puck's fields |
| Pills, hand tool, zoom, preview, undo, save (`edit-shell.ts`, `view.ts`) | Puck's header, viewports, zoom, history, PuckEditor's Publish |

## Open

| Item | Note |
|---|---|
| Resize handles on a part (`box-drag.ts` `startBoxResize`, `resize.ts`) | A size is a look (`w`, `h`, `cspan`), so it belongs to the layer; handles in a layer outside Puck's draggable wrapper, `stopPropagation` on pointer-down, as page-builder's height handle does. Test against Puck's drag before building |
| Moving a part among its siblings (`box-drag.ts` `startBoxMove`, stored as `order`) | Changes what is seen, not structure; same test as resize |
| Comments on nodes (thin bar) | Where comments are stored is not decided |
| ~~Popup retirement~~ | ~~The canvas popup is replaced by the focused look editor above once that exists.~~ Superseded 2026-11-06 by the approved brief: the canvas popup is the focused editor, opened from both doors. |

## Next stone (not this run): scope of a look

Today a look is "this block on this page" (`props.morph`). The developer described the popup as editing the component's default look, which is a second scope: "every block of this kind on my site", a site-level default per block type, likely stored beside elktours' site style in `site_config` (`site-style:*`). Questions: precedence (page look over site default), whether the published page draws the default from the site row on every page (one more read per request), and how the panel shows which scope a value comes from.

## Verified (2026-11-06)

`drive-pkg.cjs` 58/58 (built-in panel, `?dev=1`), `drive-look.cjs` 30/30 (`mountLookPanel`, developer off and on), on Para Theater's real editor config in an isolated Chromium; `tsc --noEmit` 0 in page-builder, direct-edit, sunjay, elktours, innergathering, arts-collective. Details: `README.md`.

Block popup from Studio (2026-11-06): `drive-popup.cjs` 56/56 (`entry-popup.tsx`, wired as sunjay's page editor); covers the gesture, a Puck inline field keeping its double-click, the stage drawing with the canvas's font family and token colour, row and rich-text typing, a part look, Ctrl+Z kept from Puck, one undo step, Discard and Esc byte-equal, "Edit look" in the action bar, a block nested in a band, the forum with Puck's resolved rows, Publish, phone width (390 px), developer on and off, no page errors. `drive-pkg.cjs` 58/58 and `drive-look.cjs` 30/30 rerun after it; `tsc --noEmit` 0 in the same six workspaces.

## Next, in order

1. Thin bar over a part with words (`MiniBar`), writing the part's look.
2. Right-click on a part: look actions (select parent, copy / paste style, hide / show, reset, Layers row), beside page-builder's block menu.
3. ~~Focused look editor~~ done 2026-11-06 as the canvas's popup opened from Studio (see the table).
4. Own blocks' `look` in the same panel; a part's background picture through the host's chooser; Arrange.
5. Resize and part-move handles, after a test against Puck's drag.
6. Detach for developers.

Estimate (assumed, from the size of the canvas code each step reuses): about two more sessions of this length for 1-6, each step verified in this harness before the next.

## History

- 2026-11-06 (later): block popup from Puck Studio (`parts/popup.tsx`, `puck/studio-popup.ts`), row typing in the popup, `pt-steps` parts and row marks; `drive-popup.cjs` 56/56.
- 2026-11-06: checklist written and rewritten to the placement / look split; parts plugin moved from the harness into `packages/page-builder/src/parts/`, wired into sunjay's `/studio/<slug>` editor (source only).
