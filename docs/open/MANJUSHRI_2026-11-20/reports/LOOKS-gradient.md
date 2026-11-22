# LOOKS-gradient (Manjushri looks, 2026-11-21)

Source only. No rebuild, restart, commit, install or database write. Test copy: a throwaway production build of the tree (`~/scratch/manjushri/ig/next-looks`, own container `ig-dev` on 127.0.0.1:4531), test editor, every save aborted (0 saves sent). Container removed; `apps/innergathering/next-env.d.ts` equals the saved copy.

## Job 1: saved looks were not drawn (innergathering) - DONE

**Cause confirmed.** `apps/innergathering/src/lib/puck/config.server.ts` and `config.client.ts` never passed `morph: MorphMark` to `buildPuckConfig` / `buildEditorConfig`, so no stored `morph` was drawn on the landing or on `/p/<slug>` pages, public or in the editor. Elktours passes it in all of its configs.

**Changes (3 hunks, 2 files, additive):**
- `apps/innergathering/src/lib/puck/config.server.ts`: import `MorphMark` from `@elkdonis/direct-edit/puck/morph`; `serverOptions` gains `morph: MorphMark` (so `serverPuckConfig` and `markedPuckConfig`, which spreads it, both draw looks).
- `apps/innergathering/src/lib/puck/config.client.ts`: same import; `canvasConfig = buildPuckConfig({ ..., morph: MorphMark })` (what the on-page editor draws); `puckConfig = buildEditorConfig({ ..., morph: MorphMark })` (the Settings sheet; same as elktours).

**Band selectors checked** (no change needed): `offerings-block.tsx` root `> .ig-offer-section`, `forum-block.tsx` root `> .ig-forum-section`. Both blocks return their `<section>` directly, so `template[data-morph] + .ig-...-section` matches.

**Seen (signed in, `~/scratch/manjushri/ig/looks-check.cjs`):**
- PASS signed in, no editor: band computed background `rgb(254,254,254)`, `background-image: none` (the stored `#fefefe` replaces the fade).
- PASS `template[data-morph] + .ig-offer-section` count 1.
- PASS editor canvas draws the same `rgb(254,254,254)`; the panel's Fill field shows `#FEFEFE`.
- PASS set Fill `#d8e6f0` in the panel on the offerings band: page shows `rgb(216,230,240)`.
- PASS set Fill `#f0d8d8` on the Grand Forum band (was `rgb(1,18,78)`): page shows `rgb(240,216,216)`; `template[data-morph] + .ig-forum-section` matches.
- PASS no page errors. Screenshots: `~/scratch/manjushri/ig/shots/looks-offerings-panel.png`, `looks-forum-panel.png`.

**Seen (signed out, 1440 and 390, full page; `shots-looks.cjs`, `pixdiff.py`):**
- live1 vs live2 (two sets of the live site): identical.
- live vs the new build with the morph style sheet removed in the browser (= "no stored look"): identical, both sizes.
- live vs the new build as served (stored look drawn): the band differs, rows 1042-1883 only, nothing outside it; largest difference in any channel is 1 level of 255.

## What a visitor will see at the next innergathering rebuild

Almost nothing. Only the Current offerings band changes: its background goes from the site's fade to a flat `#fefefe`. On this site the fade's two ends compute to white already, so the change is at most 1/255 per colour channel, which no one can see. The Grand Forum has no stored look and is unchanged; every other page is identical. Justin should know the change is real in the code but invisible in the picture, and that from then on a colour set in the look panel on either landing band shows on the public page. (If he wants pure white he should type `#ffffff`.)

## Job 2: gradient fill in the look panel - STOPPED AT DESIGN (install needed)

**Why stopped.** `packages/direct-edit` cannot import `@elkdonis/gradients` today: `packages/direct-edit/node_modules/@elkdonis/` holds only the `fonts` link; `pnpm-lock.yaml` links gradients into two other packages (lines ~669 and ~3938) but not into `packages/direct-edit` (importer at line 3303: fonts, react, react-dom). Not in `apps/innergathering` either. A relative `../../gradients/src` import would bypass the package boundary and add a second path for every app to transpile; I did not do it.

**Exactly what is needed (for the PM to approve):**
1. `packages/direct-edit/package.json`: add `"@elkdonis/gradients": "workspace:*"` to dependencies.
2. Run the repo's install (`docker compose --profile tools run --rm install`) so the workspace link and the lock entry for `packages/direct-edit` appear.
3. Each app that draws looks lists the gradients package in `transpilePackages` (innergathering's `next.config.ts:43` list does not), then a rebuild of every site that should draw a gradient look.
Only the pure entry `@elkdonis/gradients` (no React, no DOM; uses `culori`, already in `packages/gradients/node_modules`) is needed; the shader and `grapick` parts are not.

**Design (decided, not built):**
- **What the lab gives:** `GradientSpec` v1 (`kind`, `stops` 2-8 of `{color:"#RRGGBB", at:0..100}`, `angle`, `cx/cy`, `space`, `ease`, ...), `cleanGradient(raw)` (known keys only, clamps numbers, hex colours only, null otherwise), `gradientCss(spec, {maxLength})` (OKLCH ramp sampled to plain hex stops; no url, no colour functions), `isSafeGradientCss`, and `PRESETS` (12 named, e.g. "Spectrum wash", "Ember", "Tide pool"). Its React control (`GradientControl`, `mountGradientControl`) is a React island with generators, shaders and grain: far larger than "minified", so the panel gets a small plain-DOM control on top of the data functions (presets, From, To, Angle), not the lab's whole control.
- **Stored shape (one line):** optional key `grad` on a part look (also inside the When / Screen entries, like `fill`): `{ v:1, kind:"linear"|"radial"|"conic", stops:[{color:"#RRGGBB", at:0..100}] (2-5), angle:0..360 }`, a strict subset of the lab's `GradientSpec`, cleaned on save and at render by `cleanGradient` then narrowed (three CSS kinds only, at most 5 stops, no shader, grain, base, mesh, halo or bands). Why the lab's data and not CSS: a smooth ramp is 300-900 characters, over `MAX_VALUE = 160` for the raw-CSS key (`morph.ts:57`); the spec stays small, re-compilable, and the cleaner already bounds everything (no `url(`, nothing that ends a rule).
- **Compile:** `block/patch.ts` `lookDecls` (line 71) and `morphCss` turn `grad` into `["background", gradientCss(grad, {maxLength: 1200})]`. No `grad` key adds no declaration, so every old look compiles byte-identically (golden file in `scripts/check-look.mts` extended, old cases untouched).
- **Flat fill against gradient:** the gradient wins, and the panel says so in plain words ("A fade replaces the colour"). Only one is stored: choosing Gradient removes `fill`, choosing Colour removes `grad` (the control keeps the other in memory for the session, so flipping back loses nothing).
- **Panel:** under Fill, "Fill: Colour / Gradient". Gradient shows "Fade" (4-6 lab presets), "From", "To", "Angle" (linear and conic), and Remove. Works for the base look and for When / Screen because it writes through the same `partLookAt` / `setPartLookAt` path as `fill`.
- **Checks to add when unblocked:** `check-look.mts` cases (hostile stops, 200 stops, `url(` inside a colour, a huge angle, byte-identical old cases, CSS for three gradients); a headless driver in the `harness/frankenstein` pattern that picks Gradient, changes a stop and the angle, and asserts computed `background-image`; then the signed-in proof on this innergathering copy (after a build with the link in place).

## Checks
- tsc, `apps/innergathering`: 0 errors before, 0 after.
- Files changed: `apps/innergathering/src/lib/puck/config.server.ts`, `apps/innergathering/src/lib/puck/config.client.ts`. Scratch (not in the repo): `~/scratch/manjushri/ig/{shots-looks.cjs,looks-check.cjs,probe-looks.cjs}`.
- Needs a rebuild: `innergathering` only. Job 2 changed nothing.
