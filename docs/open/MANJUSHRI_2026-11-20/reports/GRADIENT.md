# GRADIENT: a fade fill in the look panel (lane GRADIENT, 2026-11-22)

Source only. No commit, install, migration, live rebuild or production write. Seen signed in on a throwaway production build of innergathering (every save aborted, none attempted). Screenshots in `~/scratch/manjushri/gradient/`.

## What Justin gets
In the look panel, Fill now reads "Colour / Fade". Fade shows a strip, a row of five presets from the gradient lab, a shape (Straight, Round, Sweep), two to five colours each with a colour and a place, "Add a colour", and an angle (a start for Sweep). The page changes as you adjust; one adjustment spell is one undo step. It works with When (hover, focus, press) and Screen (phones, tablets) because it writes through the same look writer as Fill. A fade replaces the colour on that look, and a colour replaces the fade ("A fade replaces the colour." is said under it).

## The control: plain DOM on the lab's data functions
The lab's React control (`GradientControl`, generators, shaders, grain) is a React island and far larger than "minified", and the look panel is plain DOM, so `panel/fade.ts` is a small plain-DOM control on the lab's data functions: `PRESETS` and `adjustedStops` (the presets, with the lab's softening baked into the colours), `cleanGradient` (cleaning), `gradientCss` (compiling). Nothing from `@elkdonis/gradients/react` is imported.

## Stored shape (the earlier design, one change)
`grad: { v:1, kind:"linear"|"radial"|"conic", stops:[{color:"#RRGGBB", at:0..100}] (2 to 5), angle:0..359 }` on a part look: base, `states.<hover|focus|active>`, `at.<sm|md>`. A subset of the lab's `GradientSpec`; the lab's other keys (shader, grain, base, mute, mesh) are dropped.
Changes from `LOOKS-gradient.md`, with reasons:
- The writer clamps angle to 0..359 (the lab wraps), and the compile asks the lab for at most 1200 characters (it thins its ramp to fit; the raw-CSS cap of 160 would not hold a ramp).
- Exclusive on three layers, not one: the panel writes one or the other; `setPartLookAt` (`block/morph.ts:338`) drops `fill` when a `grad` is written (so the door and the canvas's panel cannot store both); `cleanStyle` drops `fill` when a good `grad` is present (hand-written JSON). At draw time a fade wins anyway.
- Chosen over a separate "Colour / Gradient" word: the panel says "Fade", the stored key stays `grad`.
- The panel offers Fade on every panel that edits a part's look (it has the When / Screen switches), not only `puck/look-panel.ts`. Reason: innergathering's landing editor and the block popup use the canvas's panel (`tree-editor.ts`), not the Puck panel; showing it there needed no edit in `canvas/**`.

## What changed (path:line)
- `packages/direct-edit/src/block/style.ts`: import lab (:14); `Grad`, `GRAD_KINDS`, `GRAD_MAX_STOPS`, `cleanGrad` (:30), `gradCss` (:40); `PartStyle.grad`; `boxDecls` draws the fade as the `background` declaration (:199; no `grad` = the old `fill` line, byte-identical); `cleanStyle` keeps `grad` and drops `fill` (:326).
- `packages/direct-edit/src/block/morph.ts:338`: one line in `setPartLookAt` (fade drops fill).
- `packages/direct-edit/src/panel/fade.ts` (new, 103 lines): presets, edit functions (`fadeShape/Angle/Colour/Place/Add/Remove`, `startFade`), `setFade/setFlat`, markup (`fadeModeHtml`, `fadeHtml`).
- `packages/direct-edit/src/panel/panel.ts`: imports (:26-27); `PanelContext.fade?`; Fill row wrapped when the panel has `where` (`fadeOf`, :399 and the bottom of the file); click, input and change handlers (`fadeClick` :673; colours live, a colour's place on leaving the field, so the list does not re-sort under the cursor).
- `packages/direct-edit/src/puck/look-panel.ts`: `fade` in the context (:127), `grad` key written through `setFade` (:224), a colour typed removes the fade.
- `packages/direct-edit/src/direct-edit.css`: 12 lines at the end (`.de-fade*`).
- `apps/{art-auction,development,elktours,hidden-enneagram,innergathering,katie-the-potter,sunjay}/next.config.ts`: `"@elkdonis/gradients"` after `"@elkdonis/direct-edit"` in `transpilePackages` (one line each). `arts-collective` already listed it.
- `packages/direct-edit/scripts/check-look.mts`: 50 new checks appended. `harness/frankenstein/drive-gradient.cjs` (new).
- Not touched: `canvas/**` (including `box-panel.ts`), `block/contract.ts`, `house-editor`.

## Apps: can each build with the lab?
Resolution is through direct-edit's own link (`packages/direct-edit/node_modules/@elkdonis/gradients`, and the lab's `culori` beside it), the same way direct-edit already reaches `@elkdonis/fonts` in apps that do not list fonts. No app needs its own dependency line and no app needs an install.
| app | transpile line | builds |
|---|---|---|
| innergathering | added | built (production, Turbopack) and served; fade seen |
| arts-collective | already there | type-checks; not built here |
| art-auction, development, elktours, hidden-enneagram, katie-the-potter, sunjay | added | type-check 0 errors; not built here (same resolution path as innergathering, which did build) |
Nothing stopped short.

## Checks
- `scripts/check-look.mts`: 152 passed before, 202 passed 0 failed after (old cases untouched; the golden files `look-golden.json` and `look-golden-states.json` not regenerated). New cases: hostile stops (a `url(` colour, names, colour functions, a colour that ends a rule), 200 stops cut to 5, huge and non-number angles, unknown shapes, non-objects, polluted keys, three gradients' CSS (straight, round, sweep; lab-safe, under 1200 characters), no-fade look byte-identical, fade against fill exclusive (cleaner, writer, door-style write), fades in base, hover and phones compiled in `morphCss`, a hostile uncleaned fade compiling to nothing, the control's edits and bounds, plain words.
- `harness/frankenstein/drive-gradient.cjs`: 40 passed, 0 failed (Puck's right column, Para Theater's editor): Fade chosen (one step, flat colour replaced), a colour and the angle and a stop's place changed and the element's computed `background-image` asserted, Add and Remove to the 2 and 5 limits, Round and Sweep, a lab preset, an angle typed slowly = one history step and one undo, Colour then Fade brings the same fade back, a real hover showing a hover-only fade (and Always showing the flat colour), a phones fade in the 480px rule, public CSS with no `url(` and no editor attributes, a hostile stored fade draws nothing, no page errors.
- Existing drivers rerun on the final source: `drive-where.cjs` 48/48, `drive-look.cjs` 30/30.
- tsc (`pnpm check-types`): direct-edit 0 before; now 1, `canvas/tree-editor.ts(1165,11)` TS2322 (`hmode`), in lane CANVAS's file, not mine (0 errors in my files). Apps art-auction, development, elktours, hidden-enneagram, innergathering, katie-the-potter, sunjay: 0 before, 0 after. arts-collective: 0 before, 0 after.

## Seen signed in (throwaway production build, innergathering)
`~/scratch/manjushri/ig/gradient-check.cjs` (test editor from the credentials file read inside the container, never printed; 0 saves attempted). 10 of 10:
- The panel on the Current offerings band shows Fill: Colour / Fade; no word "gradient" anywhere in it.
- Fade chosen: the band's computed `background-image` is a `linear-gradient`; the lab preset "Ember" is drawn; the first colour changed to #1b3a6b shows as `rgb(27, 58, 107)`; the angle 90 gives `linear-gradient(90deg, ...`.
- No page errors. Screenshot: `~/scratch/manjushri/gradient/gradient-offerings-panel.png` (and `gradient-01-fade.png`, `gradient-02-states.png` from the harness).
- Signed out, 1440 and 390, full page: the new build as served and with the look style sheet removed are both pixel-identical to the live site (`~/scratch/manjushri/ig/shots/gl`, `gn`, `gs`; `pixdiff.py`: ALL SAME, both sizes). No gradient is stored, so nothing changes for a visitor.

## Things the PM should know
1. **innergathering's stored looks changed since the last report.** The page now holds `background:#000000` on both landing bands (and `color:#fffdf8` on the Current offerings heading); earlier it held #fefefe on the offerings band. The live site already draws them (live and the new build are identical, black bands). Not mine; whoever set them did it from the editor.
2. The door (`set_look`) needs nothing: `steps/look.ts:83` runs `cleanStyle`, which now keeps `grad`; `setPartLookAt` drops the old fill. Optional, one line, if the door should drop the fill in its own copy before comparing for "no change": after `const next = { ...current, ...kept }` (`look.ts:107`) add `if (kept.grad) delete next.fill;`. I did not edit it.
3. Optional, in `canvas/box-panel.ts` `applyKey` (the other PM's file): nothing needed now; the exclusivity is at the writer.
4. A first click on a button straight after typing in a panel field can be swallowed when the field's blur ends the spell and Puck redraws the panel (seen in the driver after a colour field; it exists for any field). Not changed.
5. Not built: the six other apps. Each needs a rebuild to draw a fade; none needs an install.
