# IG-faults: three innergathering landing faults, diagnosed from the code

Read-only review, 2026-11-21. No fix, no signed-in run. Paths under `~/eac`. The live build is the block pass (`YbZhh2GgtmToB4hv-W6lU`, `LEDGER.md` 17:50). What I could not confirm by reading is marked unverified, with the one check that would confirm it.

| # | Fault | Most likely cause | Confidence | Smallest fix |
|---|---|---|---|---|
| 1 | Site theme button gone | The Fields lens now finds fields on the landing page and renders a non-button `[data-de-ui]` div; the button's own check hides it. | 70% | Exclude the lens from the button's selector (one line). |
| 2 | Blank white "Block settings" popup | Puck threw while drawing the one-block sheet and nothing catches it; the trigger is not pinned (three candidates below). | 90% that an uncaught Puck error is the mechanism, 40% on the trigger | Error boundary in `block-settings.tsx`; read the console once; then fix the trigger. |
| 3 | Current offerings small, broken image | The editor draws the block's built-in sample (the page never hands it the real rows) and the sample's picture file does not exist. | 90% | Pass the page's `resolved` rows to the editor (as elktours does); fix the sample cover. |

---

## Fault 1. The Site theme button is gone

**The rule that hides it.** `apps/innergathering/src/components/site-style/SiteStyleButton.tsx:28`: `setCanvasOpen(Boolean(document.querySelector("[data-de-ui]:not(button)")))`, re-run by a `MutationObserver` on the whole body (`:29-31`); `if (canvasOpen) return null;` at `:61`. Any `data-de-ui` element that is not a `<button>` hides the button.

**What puts such an element on the landing page with the editor closed.** One candidate in the page's own code, and it is not the direct editor: `packages/house-editor/src/fields/FieldsLens.tsx:287` returns `<div data-fields-ui="" data-de-ui="">`, whenever `found > 0` or the lens is on (`:283`: `if (found === 0 && !on) return null;`). It is mounted for anyone who may edit, on every page but a few paths, by `apps/innergathering/src/app/layout.tsx:88` (`<FieldsLensGate />`) and `components/fields/FieldsLensMount.tsx:9,15`.

**Why the block pass triggers it.** `found` counts elements marked as typed fields. `scanBlocks` (`packages/house-editor/src/fields/scan.ts`) finds them from the `<template data-blk-mark>` markers that the editor-shaped page draws (`apps/innergathering/src/app/page.tsx:220`: `markedPuckConfig` for editors). It keeps a part only if its block type is in `siteFields.map` and the part names a setting (`blockmap.ts:55`: string or text settings only). Before the block pass the landing's saved tree held plain boxes and live parts, which have no such parts, so `found` was 0 and the lens drew nothing (inferred: I did not read the map for box blocks). The block pass swaps the saved parts for `offerings-band` and `grand-forum` at read time (`page.tsx:222`, `lib/puck/landing-blocks.ts:34,38`), and both declare parts that name settings (`offerings-block.tsx:117,118,127`: `eyebrow`, `heading`, `allLabel`; the forum the same). The scan now finds fields, `found > 0`, the lens renders its `data-de-ui` div, and the button's observer sees a "canvas". The timing fits: Justin saw the button on the 10:40 build and not on the block-pass build.

**Not the cause.** `EditPageButton` is a `<button data-de-ui>` (`components/landing/EditPageButton.tsx:25-27`), so `:not(button)` skips it. `liveNote` and `fitToPanel` are options of the editor (`packages/direct-edit/src/canvas/tree-editor.ts:98-99`), used only after "Edit page" is clicked, and closing the editor reloads the page (`packages/house-editor/src/landing.ts:121`), so nothing is left mounted. `block-settings.tsx:156` marks its frame `data-de-ui` and removes it on close (`:186`).

**Other sites with the button.** Only art-auction has another `SiteStyleButton`. It has no `[data-de-ui]` check (it hides by path only, `apps/art-auction/src/components/site-style/SiteStyleButton.tsx:12`), so it cannot vanish this way; art-auction does not mount the Fields lens (grep of `apps/*/src` for `FieldsLens` lists elktours, hidden-enneagram, innergathering, development, not art-auction; sunjay's layout was not in that list either, so the lens bar is on those sites, but only innergathering pairs it with a button that watches for `data-de-ui`). The fault is innergathering-only.

**How sure.** About 70%. Every link is read from code except that `found > 0` on the landing. Confirm: signed in on a dev copy, run `document.querySelectorAll("[data-de-ui]:not(button)")` on the landing page with the editor closed; expect one element, `[data-fields-ui]`.

**Smallest fix.** One line at `SiteStyleButton.tsx:28`: `"[data-de-ui]:not(button):not([data-fields-ui])"`. Sturdier (the other PM's own suggestion, board): direct-edit sets one marker on `<html>` when a canvas is open and the button reads that. A second consequence worth knowing: the lens bar ("Edit wording") now also appears on the landing page beside "Edit page", which is new behaviour.

---

## Fault 2. "Block settings" opens a big blank white popup

**The path.** The panel's "Settings..." button (`packages/direct-edit/src/canvas/tree-editor.ts:1099-1100`, shown for any non-own, non-live-part block) calls `editSettingsFor` (`:625-645`), which calls the mount's `editSettings`: `packages/house-editor/src/landing.ts:88-105`, built only when a `puckConfig` is passed (`:65`). innergathering began passing one in this build (`apps/innergathering/src/components/landing/page-editor-mount.ts:26`; before it called `openPageAsTree` with no `puckConfig`, so there was no "Settings..." at all: `git diff` of that file). `editSettings` calls `openBlockSettings` (`packages/page-builder/src/block-settings.tsx:153`), which appends a full-screen frame holding a white sheet (`:159-165`, `SHEET` background `#fff` at `:113`) and renders Puck into it (`:226`, component at `:130-146`).

**Why it can be blank.** There is no error boundary around `<Puck>` (`block-settings.tsx:130-146`). With React's default behaviour an error while rendering unmounts the whole root. The frame and sheet are plain DOM made outside React (`:155-165`), so what stays is exactly what Justin describes: the dimmed frame and an empty white sheet. So any render error inside Puck for this block gives a blank sheet. I am sure of that; what threw I could not pin from the code.

**Candidates for the throw, most likely first** (what differs from elktours, where the same button works: `apps/elktours/src/components/landing/page-editor-mount.ts:26-45`):

1. **The node is a bare id.** The read-time swap turns the saved live part into `{ type: "offerings-band", props: { id } }` (`apps/innergathering/src/lib/puck/landing-blocks.ts:34,38`): no settings, no defaults. That node goes to the editor (`page.tsx:222,228`) and to Puck as the sheet's only item (`block-settings.tsx:116`), with every setting undefined; elktours' landing nodes carry full props. Puck then runs the block's resolver, which returns `items`, `rows`, `signedIn`, `nextcloudUrl` as read-only props (`packages/page-builder/src/config.tsx:522-541`), and draws the band (imports `RsvpPanel`, `LocalTime`, `OfferingCall`, `OfferingSignIn` with `BaroqueSignup`: `OfferingsBand.tsx:1-8`) inside Puck's preview iframe, away from the page's providers. Anything there that needs a provider or the page's context could throw. Unverified.
2. **The "parts" plugin on a new contract.** The sheet gets `sheetPlugins` (`landing.ts:74-83`, `partsPlugin` with `contract`) because the mount now passes `contract: canvasContract` (`page-editor-mount.ts:26`; `config.client.ts:75`). The plugin matches each declared part's selector against the drawn block; the landing blocks declare parts with `draws: { props: { panel: "signin" } }` and `repeat` (`offerings-block.tsx:117-127`), a shape I saw no other block use here. Unverified.
3. **No `morph` option in this site's configs, and no `orgId`.** Elktours passes `morph: MorphMark` to both configs (`apps/elktours/src/lib/puck/config.client.ts:28,47`); innergathering passes none (`apps/innergathering/src/lib/puck/config.client.ts:78,80`). Without it the hidden `morph` field is not declared (`page-builder/src/config.tsx:338-342,486`), while the sheet's look hand-back reads it. The mount also passes no `orgId` (elktours does), so the sheet's metadata has `orgId: undefined` (`landing.ts:70`). Lower likelihood: nothing I read throws on either alone.

**Not the cause.** The Puck stylesheet: `block-settings.tsx:6-7` imports `@puckeditor/core/puck.css` and `./editor.css` itself, and the same module runs on elktours. A missing config entry: both landing blocks are in `puckConfig` (`config.client.ts:71,80-83`).

**How sure.** 90% that the blank sheet is an uncaught render error in Puck; 40% on which candidate. Confirm: on a dev copy signed in, open the landing editor, select Current offerings, press "Settings...", read the browser console; the stack names the component.

**Smallest fix.** In this order:
1. In `packages/page-builder/src/block-settings.tsx`, wrap `<Puck>` in a small error boundary that shows "This block's settings could not open" with the message and a Close button. A blank sheet then cannot happen on any site.
2. Fix the trigger once the console names it. For candidate 1 (most likely): make the swap carry the block's declared defaults (`landing-blocks.ts:34,38`: `props: { id, ...defaults }`), or hand the sheet defaults before it opens. For candidate 3: pass `morph: MorphMark` in both configs and `orgId` in the mount, as elktours does.

---

## Fault 3. Current offerings drawn smaller, with a broken image

**How the canvas draws a sealed block that needs data.** `packages/direct-edit/src/puck/TreeCanvas.tsx:103-110`: `props = { ...node.props, ...(resolved ?? sample ?? {}), id, ... }`. `resolved` is the rows the host handed over, by block id (`puck/mount.ts:117`: `{ ...(o.resolved ?? {}) }`); `sample` is what the block's `sample()` adds beyond its declared settings (`packages/blocks/src/contract.ts:20-25`, `dataOf`). With no rows from the host the canvas draws the sample and labels it "nothing to show yet" (`TreeCanvas.tsx:117`; `mount.ts:191`, `drawsSample`). The canvas never calls the block's resolver: the HTTP resolvers in `apps/innergathering/src/lib/puck/config.client.ts:33-60` run only inside Puck.

**What innergathering hands over.** Nothing. `page.tsx:228` passes only the tree: `<EditPageButton page="home" doc={edits} tree={data as PuckDoc} />`; `EditPageButton.tsx:7,15` takes no `resolved` and calls `openLandingEditor({ tree, edits: doc })`; the mount (`page-editor-mount.ts:13-37`) passes no `resolved` to `openHouseLanding`, which supports it (`landing.ts:42`) and forwards it (`landing.ts:110`). The server did resolve the rows for the page render (`page.tsx:223`, `resolveAllData`) and never sends them on. Elktours does: `apps/elktours/src/app/page.tsx:141` passes `resolved={resolvedByNode(filled.content)}` and its mount forwards it (`page-editor-mount.ts:27,39`).

**So the editor draws the sample.** The offerings sample (`apps/innergathering/src/components/landing/offerings-block.tsx:~136-176`): one made-up gathering ("Morning sit"), a one-line description, one row beneath, signed out. That is a smaller card than the real one, which is "drawn smaller".

**The broken image.** The sample's cover is `coverImageUrl: "/sample-cover.jpg"` (`offerings-block.tsx:153`). No such file exists: `find ~/eac/apps/innergathering -name "sample-cover*"` (excluding `node_modules` and `.next`) returns nothing, and `apps/innergathering/public` has none. The image inside the editor is a broken link.

**How sure.** 90%. Every link read from code; not seen as a screenshot.

**Smallest fix.**
- Hand the editor the rows as elktours does: in `apps/innergathering/src/app/page.tsx` add the `resolvedByNode(filled.content)` helper (`apps/elktours/src/app/page.tsx:23-31`), pass `resolved` through `EditPageButton`, `openLandingEditor` and `openHouseLanding({ resolved })`. `LANDING_RESOLVED_KEYS` stays as it is (`page-editor-mount.ts:24`).
- Also remove `coverImageUrl` from the sample, or add a real `public/sample-cover.jpg`: a sample must never point at a file the site lacks.
- `grand-forum` will draw a stub in the editor by design (`config.client.ts:57`, `preview: true`); say so in the panel rather than let it look broken.

---

## Before the next innergathering build or rollback

The three faults share a root: this build changed the editor mount and added two blocks, and nobody opened it signed in. The stored row was left unconverted (IG-landing.md, "Decisions and cuts"), so the swap is read-time only, but a landing save from the editor would write `offerings-band` / `grand-forum` nodes (with no settings) into `puck:landing`. If anyone saved the landing since 17:50 (unverified; check the row's updated time and whether it contains those types), a rollback to the 10:40 build would meet block types it does not know; the page loads against the known set (`page.tsx:48`: `loadPage(LANDING_SLUG, new Set(Object.keys(serverPuckConfig.components)))`). Check that before rolling back.
