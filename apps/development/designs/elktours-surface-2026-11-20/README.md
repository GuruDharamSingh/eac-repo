# Handoff: elktours on Surface UI

Repo: `GuruDharamSingh/eac-repo` (eris `~/eac`), app `apps/elktours`, shared package `packages/cms-ui` (Surface UI lives in `packages/cms-ui/src/surface`).

## Overview
A set of design references for moving elktours onto the shared Surface UI everywhere, for both staff (the hub) and visitors (the tour page):

1. **Surface UI specimen.** What cms-ui/surface already is, in elktours' tokens, with findings.
2. **Field and step variations.** Ways a surface can hold forms, and where a wizard's steps can live.
3. **Create a tour wizard.** A working prototype: hub cards → a full-size wizard surface (Description → Route → Details), with a stacked "Create place" surface, a real map, and draft save.
4. **Tour page hero.** The "mini cards as stop thumbnails" artifact, redesigned as the surface docked into the page (desktop and phone).
5. **Tour detail page below the hero (phone).** Stage → index → full page, in dark (v1, v2) and a first **light theme** (bleu de Paris, white, yellow).

`docs/` has one file per piece with exact values. `docs/CONVERSATION.md` is the decision log: what was asked, what was decided and what is still open.

## About the design files
Everything in `designs/` is a **design reference made in HTML**: prototypes that show the intended look and behaviour. It is **not production code to copy**. Recreate it inside the existing codebase:

- Shared, cross-app UI goes in `packages/cms-ui` as **plain CSS with `--sf-*` / `--eac-*` custom properties** (surface.css, fields.css). Do not use Tailwind utilities there: ifac and artdirect don't run Tailwind over cms-ui.
- App-only pieces go in `apps/elktours` (Next.js app router, Tailwind 4, `@elkdonis/primitives`).
- Theming happens only through tokens in `apps/elktours/src/app/globals.css`.

The `.dc.html` files are Design Components. Open them from this folder in a browser; they load `support.js` and the fonts in `designs/apps/elktours/public/fonts/` by relative path, and some browsers need the folder served (`python3 -m http.server`). `Create Tour Wizard.html` is plain HTML with Leaflet 1.9.4 and OpenStreetMap tiles.

## Fidelity
- **High fidelity:** the specimen (mirrors the source CSS), the tour hero (desktop and phone) and the detail page v2 and Light. Colours, type, spacing and states are intended.
- **Mid fidelity:** the Create Tour wizard. The layout, flow and behaviour are intended. The field styling follows `fields.css` and should be taken from it.
- **Exploration:** `Surface Forms.dc.html` holds options to choose from, not specs. The wizard uses 1a, 1f, 1c and 2a.
- All content in [square brackets] is a placeholder: prices, dates, guide names, meeting place, policies. Sample places and stops are filler. Real data and copy must come from the database and from guides.

## Files
| File | What it is | Doc |
|---|---|---|
| designs/Surface UI Specimen.dc.html | cms-ui/surface as it is today, in elktours tokens | docs/01-surface-specimen.md |
| designs/Surface Forms.dc.html | 7 field treatments (1a–1g), 4 wizard step placements (2a–2d) | docs/02-forms-and-steps.md |
| designs/Create Tour Wizard.html | Interactive hub + Create Tour wizard + Add place | docs/03-create-tour-wizard.md |
| designs/Tour Hero Stage.dc.html | Desktop tour hero as a docked surface (1440) | docs/04-tour-hero.md |
| designs/Tour Hero Stage Phone.dc.html | Phone tour hero (390) | docs/04-tour-hero.md |
| designs/Tour Detail Page Phone.dc.html | v1: below the stage, long page + mid-scroll state | docs/05-tour-detail-page.md |
| designs/Tour Detail Page Phone v2.dc.html | v2: stage → index → full page, Basteleur + Venture, way back in the foot | docs/05-tour-detail-page.md |
| designs/Tour Detail Page Phone Light.dc.html | v2 in the first light theme | docs/06-light-theme.md |
| reference/HeroCombined (original artifact).dc.html | The hero artifact the user brought in | docs/04-tour-hero.md |
| github.md | Repo association and screen → source-file map | |

## Start here (suggested order of work)
1. Token fixes in `apps/elktours/src/app/globals.css`. Set `--eac-surface-danger` (the default #ae3a31 is about 1.9:1 on the dark card). Map `--eac-font-record` to Venture. Add a `place` kind. See docs/01.
2. The tour page hero as `SurfaceStage` (docs/04). Tours with published start times only on `/tours`.
3. Hub tiles → `SurfaceCard`s that open surfaces (docs/03), starting with Create a tour and Add a place.
4. The light theme as a second token map (docs/06), once the owner settles it.

Screenshots of each design are in `screenshots/` (01 specimen · 02 forms · 03 wizard: hub, Route, Description, Details · 04 hero desktop · 05 hero phone · 06 detail page v2 · 07 light theme). They show the first screen of each canvas; open the files for the rest.
