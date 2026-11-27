# CANVAS lane report (Manjushri CANVAS, 2026-11-22)

Source only. No commit, install, migration, rebuild or production write. Nothing is live until the sites below are rebuilt.

## What a person will notice
- Select a banner (Para Theater's "Banner (photograph and words)", and hero-banner, section-banner, split-row, figure, katie quick-landing: every block that declares `resize`) in the direct editor. It now wears a bottom handle. Dragging it changes the block's own **Height** setting, the same number Puck's handle and the Content tab show. The banner grows while you drag; one undo takes the whole drag back; Escape during a drag puts it back.
- The side handle on such a block writes nothing. The hint line says "Banner always fills the width of its place, so its width cannot be changed here. Drag its bottom edge for its height."
- Double-click a part that shows a plain one-line or paragraph setting (banner title, subtitle, paragraph, button text) and you type in place, not in the block's pop-up. Enter or clicking away writes the setting; Escape puts the words back; the whole spell of typing is one undo step.

## What changed (all `path:line` are in the tree now)
1. `packages/blocks/src/contract.ts:54-55, 74` `BlockContract.resize?` and `contractOf` carries `def.resize` (additive, optional).
2. `packages/direct-edit/src/block/contract.ts:53-54` the editor's `BlockContract.resize?` (same shape).
3. `packages/direct-edit/src/canvas/tree-editor.ts`
   - `:342-356` `resizeOf` (the declared `resize` when it names a number setting the block has; label without its bracket), `resizeRow` (the Height row of such a block shows the setting, not a stored look), `resizeSel` (whole blocks only, never in the large pop-up, never a part or the page).
   - `:505` hint line for a selected resize block (how to drag; why no width).
   - `:1164-1165` the Look panel's `values` / `overridden` take the Height row from the setting.
   - `:1341-1346` panel `change`: for a resize block the size row's `hpx` / `hmode` write the setting (through `changeProp`, so clamped, through the door, one undo step as any setting) and `wpx` / `wmode` say why not. Tab-off hosts get the same.
   - `:1650-1698` `resizeSetting`: the drag. Starts from the measured height (of the `data-resize-target` element if declared, else the block), clamps to the setting's `min` / `max`, rounds to the setting's `step` (10 when none is declared, as Puck's handle), validates through `o.setProp` (the door) when the host passes it, redraws live with `o.draw`, one `history.remember` on the first move, Escape restores.
   - `:1700-1712` `WordsTarget.plain` (set only for a whole `string` / `text` setting, not rich text, not a row field); `:1759-1766` the commit goes through the door (`o.setProp`) when there is one, refusal says why and leaves the words; `:2002` handles for a resize block are `s`, `e`, `se`; `:2007` the box-resize path is skipped for one; `onDouble` tries a plain part first, then the old order (pop-up, rich text and rows keep the pop-up route; a part locked to site data keeps its note).
4. `packages/direct-edit/src/canvas/content-tab.ts:108-112` `dedupeLook`: for a block that declares `resize`, the Look's Height row is dropped even when a look `h` is stored, with a note that the stored height is kept and not drawn.
5. `packages/direct-edit/src/block/morph.ts` `morphCss` option `setsHeight` (+ `declsFor`): the root part's stored look `h` is left out of the stylesheet; `packages/direct-edit/src/puck/morph-mark.tsx` passes `setsHeight: !!def.resize`. Public pages draw through the same function, so a stored root height stops fighting the setting everywhere once a site is rebuilt.
6. Harness (new files only): `packages/direct-edit/harness/resize.ts`, `resize.html`, `drive17-resize.cjs`, `canvas.sh` (build the page and run drivers on eris).

## Decisions
- **One home: the setting.** A look height (`h`, written as `min-height`) stored on the root of a block that declares `resize` is **kept in the data and not drawn** (nothing deleted). The panel no longer offers it and says so. Old pages that had one now draw the setting's height instead.
- Width: a resize block's side handle and the panel's Width row do nothing and say why. (The Look's Width row on such a block was not removed; it still writes a look, as before. Say if it should be refused too.)
- Drag step is 10 when the setting declares none (matches Puck), typing in the size row uses 1. Both clamp to min/max.
- Words on the canvas: only `string` / `text` settings. Rich text and `rows.field` stay on the pop-up route. Site header and footer are site chrome, not part of the page: not attempted (they are not in a page's document).
- The large pop-up editor is unchanged (no handle there).

## Checks
Driver counts (before = tree at HEAD for my six files; after = now), same machine, same bundle:
| driver | before | after |
|---|---|---|
| drive13 | pass 416 fail 7 | pass 416 fail 7 (identical lines; the 404 is the harness's missing file) |
| drive14 | pass 198 fail 3 | pass 198 fail 3 (identical) |
| drive15-rows | not run before | pass 23 fail 1 (only the harness 404) |
| drive16-content | not run before | pass 34 fail 1 (only the harness 404) |
| drive17-resize (new) | n/a | **pass 34 fail 0** |

drive17 covers: banner wears the handle; drag writes Height (not `morph`, not `look`), by the dragged distance, live redraw, page shows it, Content tab shows the same; one undo; redo; clamp to 1200 and to 0; Escape cancels; width handle writes nothing and says why; typed height in the size row writes the setting; a block without `resize` has no handle; a stored root height is dropped from the sheet only with `setsHeight`; typing a title in place writes the setting on Enter, one undo, Escape restores, blur writes the subtitle, a faq row still opens the pop-up.

tsc (`pnpm check-types`, `error TS` count): before 0 / 0 / 0 / 0, after 0 in `packages/direct-edit`, `packages/blocks`, `packages/house-editor`, `apps/sunjay`. (I had one error of my own mid-job, in tree-editor.ts, fixed before finishing.)

## Signed-in proof (throwaway sunjay dev copy, localhost:4026, turbopack, `.next` in scratch)
Test editor `house-editor-test` (guide on sunjay), page `/studio/cv-canvas-test` (no row: opens its starting document, never saved). Every POST after sign-in aborted (1 was `/api/pulse`; no save was ever sent). 0 console or page errors. Script `~/scratch/manjushri/canvas/proof.cjs`, runner `run-proof.sh`, screenshots `~/scratch/manjushri/canvas/shots/c1..c8` (and `s17-*` from the headless driver).
- Banner selected: tabs Content, Look; handles s, e, se. Height setting 0, banner 217 px.
- Dragged the bottom edge 150 px: mid-drag banner 370 px; after release the Height setting reads **370** in the Content tab, banner min-height 370 px, box 370 px (c4-after-drag.png).
- Width handle dragged 80 px: nothing changed; the bar says "Banner always fills the width of its place, so its width cannot be changed here. Drag its bottom edge for its height."
- One undo: Height back to 0; redo: 370.
- Double-click the title: editable in place, no pop-up; typed "Rock balancing and breath", Enter: page and the Content tab's Title field both show it (c8); one undo: "Page title"; second try with Escape: restored.
- Dev container stopped and removed; `apps/sunjay/next-env.d.ts` restored.

## Unproven / not done
- A real save and a reload of a saved page were not done (saves are aborted by rule). The stored-look note and `setsHeight` were checked in the headless page and as a function, not on a page that carries an old root height signed in.
- Only sunjay's pt-banner was exercised signed in. hero-banner, section-banner, split-row (`minHeight`), figure and katie's `quick-landing` use the same declaration and the headless fixture covers hero-banner's handle; `target`-marked blocks (`data-resize-target`) are untested.
- Phone widths and a zoomed canvas (zoom != 1) were not tried; the drag divides by the canvas zoom.
- Header/footer text: site chrome, out of scope as told.
- The panel's Look Width row on a resize block still writes a look.
- The two 404s in drive13/15/16 come from the harness copy (a stylesheet it does not have), same before and after.

## Rebuilds needed
Sites that draw `MorphMark` or carry the canvas: **sunjay** (Para Theater), elktours, hidden-enneagram, innergathering, katie-the-potter, art-auction, arts-collective (anything with `@elkdonis/direct-edit`). Required for the editor change: sunjay at least. The stored-height rule also changes how public pages draw a root look height on blocks that declare `resize`, so rebuild any site that has such a look stored before you rely on it.
