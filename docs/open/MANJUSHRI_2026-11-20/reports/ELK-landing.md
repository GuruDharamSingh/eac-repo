# ELK-landing: house editor on the elktours landing page (2026-11-21)

Source only. Nothing rebuilt in a live container, no commits, installs, migrations or writes. Dev copy ran in its own container (`elk-final-dev`, port 4021, `.next` in `~/scratch/manjushri/elk/next-final`), mail, Stripe and the reminder and slot-sweep timers switched off in it, now removed; `apps/elktours/next-env.d.ts` unchanged. Every request that would save was aborted (0 got through the guard; 0 page errors).

## (B) What the two sealed pieces are

| Piece | What it is | What clicking it now gives |
|---|---|---|
| "See Paris with Local Artists." heading | In the saved page it was a words node that `landing-hero.ts` swapped at read time to the live part `hero-title` (pure site code, `HeroCityTitle`). | It is now a real block, `hero-city-title` (two settings: words before and after the city; the city chooser itself stays the site's). Click it, "Settings..." opens Puck's sheet "Landing heading with city chooser: settings" with the two fields; Apply redraws it in place ("See" typed as "Visit" drew "Visit Paris..."; not saved). |
| Tour list | Live part `tour-cards`: the `TourCard` grid, drawn by site code from each tour's record (title, picture, price, next date). No block of this kind exists; `m-tour-list` is the phone list with its own cards and cannot stand in. | Honest: the panel says what it is, says there are no settings to open, and offers an "Edit the tours" link to `/manage/tours`, plus "Put it in a box". |

What would have to exist for Puck to open on the tour cards: a `tour-cards` block in the elktours catalogue (`apps/elktours/src/lib/puck/catalogue.ts`, both `config.client` and `config.server`) with real settings (number shown, columns, show next date, empty-state words), a resolver in `config.server`/`config.client` that reads `listTours()`/`nextDepartures()` into a resolved key listed in `resolved.ts`, `TourCard` drawn from that data in the block, and `swapHeroTitle`-style read-time conversion (or a saved-row conversion) of the stored `part` node `tour-cards` into the block. That changes what visitors get if the settings differ, so it needs Justin's design call.

Other live parts get a plain note too: guides (link to `/manage/people`), hero buttons, lead tour's film.

## Changes (this task)

- `apps/elktours/src/components/landing/hero-city-block.tsx` (new): the `hero-city-title` block (`before`, `after`), root `.hct-root > h1 > HeroCityTitle`.
- `apps/elktours/src/lib/puck/catalogue.ts:2, ~49`: import and add `heroCityTitle` to `PAGE_BLOCKS` (so it is in the contract, canvas, Puck config, server config; it also appears in the Studio palette).
- `apps/elktours/src/lib/puck/landing-hero.ts` (untracked file): `swapHeroTitle` now returns the `hero-city-title` block (was the `part`), and also converts a saved `part` node named `hero-title`. Stored rows are not changed.
- `apps/elktours/src/components/landing/page-editor-mount.ts`: `LIVE_NOTES` and `liveNote` passed to `openHouseLanding`.
- `packages/house-editor/src/landing.ts:50, 119`: `liveNote` option passed through. (`editSettings` was already passed through by the previous agent; it works, see text box and heading.)
- `packages/direct-edit/src/canvas/tree-editor.ts:98-99` options `fitToPanel`, `liveNote`; `:~1093` live-part panel uses the note and an optional link (`data-f="live-note"`, `live-link`); `:369`, `:394`, `:461`, `:1941` gate the page scaling on `fitToPanel` and restore the older zoom path for pages that do not set it; `:386` keeps a window-wide fixed element's width in step when the window is resized.
- `packages/direct-edit/src/puck/mount.ts:56-59, 196`: pass `fitToPanel`, `liveNote` through.
- `packages/direct-edit/src/puck/open-page.ts:51, 91`: `openPageAsTree` and `openVisitorPage` (live site pages) pass `fitToPanel: true`.

## (A) Review of the page-scale fix

Findings and what was done:

1. **It affected every page, not only live site pages.** The `/studio/<slug>` canvas also drew scaled (before: html `de-design de-editing de-vpanel-open`, body style none, zoom 100%; after the previous agent: `de-fit`, body width 1094px, 76%). It also broke the package harness: `drive13` failed 17 and `drive14` 23 (known baseline 6 and 3). Fixed: scaling is now only on when the host sets `fitToPanel`, and only `openPageAsTree`/`openVisitorPage` set it. Re-run: **drive13 pass 417 fail 6, drive14 pass 198 fail 3** (the known ones), drive10 46/0, drive11 56/0, drive15-rows 24/0. drive12 errors (`window.openIt is not a function`) with or without my change (stale driver, not related). Dev copy `/studio/canvas-test` after the fix: identical to before (`de-design de-editing de-vpanel-open`, no body style, 100%, no zoomed children).
2. **A fixed bar spanning the window kept its first width after a window resize** (1100 px window, panel open: expected 754, measured 987). Fixed: the width follows the window on each resize. Measured after: 754.
3. Checked and fine: overlays and handles at 76% (outline boxes sit on the elements); resize drag maths (+60 screen px gave +60 screen px; stored width in page px); free move already takes the zoom; fixed full-width bar and its centred inner content scale together (inner left 109.4, width 875.2, as expected); sticky header scales with the page; phone layout (390 px) identical before and after (body margin 0, no style; scrollW 749 in both, an existing quirk); panel toggle, 100%/50%/fit, preview and window resize all return to the same layout; popup (nested) editor returns before any scaling and shows no "fit" entry; the landing editor's Done reloads the page, so nothing survives; for other uses `dispose` restores every style it set.
4. Not changed, noted: elements added to `<body>` after the editor opens (a toast, a site popup) are not scaled until the next resize or toggle. Elements deep in the page that are `position: fixed` with `left:0; right:0` were not found on the landing page (only the sticky header and body-level bars), so that case is unproven.

## Measurements (dev copy, 1440 x 900, fractions of the page's width: left, width, top)

| Piece | No editor | Panel open | Panel hidden |
|---|---|---|---|
| Text box | L 0.1639 W 0.3929 T 0.1802 | L 0.1639 W 0.3929 T 0.1803 | L 0.1639 W 0.3929 T 0.1802 |
| Tour list | L 0.1139 W 0.7722 T 0.4662 | L 0.1139 W 0.7722 T 0.4666 | L 0.1139 W 0.7722 T 0.4662 |
| Heading (block, wider than the window by design) | L -0.0718 W 1 T 0.0892 | L -0.0718 W 1 T 0.0894 | L -0.0718 W 1 T 0.0892 |

Scale 1 / 0.7597 / 1 (pill 76% then 100%). The page keeps its layout; the 0.0001 to 0.0004 difference in top is the sticky header's rounding.

Fixed-bar probe: no editor inner L144 W1152; panel open inner L109.4 W875.2 (expected 109.4, 875.2); resized to 1100 outer 754; back to 1440 109.4 / 875.2; panel hidden 144 / 1152.

## Screenshots (eris `~/scratch/manjushri/elk/shots/`)

`final-1-signed-out-1440.png`, `final-2-panel-open-1440.png`, `final-3-panel-hidden-1440.png`, `final-4-tour-list-clicked.png` (note + "Edit the tours"), `final-5-title-clicked.png`, `final-6-title-settings.png` (Puck sheet on the heading), `final-7-title-after-apply.png` ("Visit Paris..."), `final-8-resized-1100.png`. Scripts: `final.cjs`, `fixedprobe.cjs`, `runfinal.sh` in `~/scratch/manjushri/elk/`; harness output `~/scratch/manjushri/hs/after-p7.txt`.

## Unproven

- Saving the heading block (Save was blocked on purpose): the row it writes, the reload after, and `resolveAllData` on `hero-city-title` on the live server. The block has no resolver, so nothing to strip.
- The first-visit route (no saved tree): the heading there stays a live part with its note; saving writes a `part` node that the reader turns into the block on the next load (code is in `landing-hero.ts`, not exercised).
- Harness has no driver for `fitToPanel` (the landing editor); coverage is the dev copy above.
- The heading block shows in Studio's palette on elktours pages (and on a Studio page its "Paris" chooser is not wired to anything).
- Sunjay, hidden-enneagram and innergathering landing editors get `fitToPanel` via `openPageAsTree`; not re-measured on those sites.

## What must be rebuilt

elktours (new block, catalogue, `landing-hero.ts`, note text, direct-edit and house-editor changes). Also sunjay, hidden-enneagram and innergathering, which pull in the corrected `tree-editor.ts` (scaling only for live site pages; they were running the earlier unreviewed version, which also scaled their `/studio` canvases).
