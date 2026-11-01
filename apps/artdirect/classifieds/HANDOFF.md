# Classifieds: handoff notes for future sessions

Start here. See README.md for the catalog's format.

## What this is

Justin's classifieds site, part of ArtDirect. It emulates newspaper classified sections with a microfiche-style UX: an endless plane of real and procedurally generated ads, with fonts and CSS driven by a catalog of real section styles.

## Current state (2026-10-24)

- 39 specimens annotated, all `draft` (`data/annotations/`). Waiting on Justin's review; his corrections become the standard.
- 13 style families in `families.ts`; most are `provisional`.
- Images: Nextcloud `EAC_Network/artdirect/Private/classifieds/specimens/` (on disk: `/mnt/ncdata/__groupfolders/2/files/artdirect/Private/classifieds/specimens/`, rescan with `occ groupfolders:scan 2`). Originals are in Justin's Nextcloud `Classifieds/` and `C:\Users\Justi\classifieds` on his Windows PC.
- There is no `artdirect` org in the DB, so `/api/media` won't serve that Private path to anyone yet.

## How to read the families

The families are a loose repertoire built from a first pass, not fixed identities. Justin does not expect every ad to be restyled strictly by a family. Sections can mix and borrow freely (e.g. a 1920s magazine page with a modern spot-colour tab).

Mock-ups of four new sections mixed this way (2026-10-24): source and annotations in `mockups/` (README.md there); live canvas https://claude.ai/artifact/8UzW1pDVK277rC98s1Vuum

## Ground rule

Build UI only when Justin asks. On 2026-10-24 (morning) he said: "i dont want you to build the ui or app. only classify and look at the examples." Later the same day he asked for the viewer, the CSS standardisation and a plan, and it was built: see below.

## The viewer (2026-10-24, source only, not deployed)

`apps/artdirect/src/classifieds/` (rng, catalog, style, copy, plane, Sheet, Microfiche) and `src/app/classifieds/` (`/classifieds`, `/classifieds/mockups`, `microfiche.css`). The families here are read by `src/classifieds/catalog.ts` as keyframes; `style.ts` blends them over the plane. Plan, integration and open questions: `docs/open/CLASSIFIEDS_PLAN_2026-10-24.md`.

Justin's clarifications (2026-10-24):
- Individual ads do not "filter through families". The families are keyframe norms; areas hold to one, and elsewhere the CSS morphs naturally between them. Keep adding keyframes and descriptions of section aesthetics.
- One continuous classified section: no separate pages, no gaps, no masthead sheets, no zoom modes or film overlays. Zoom only scales. The boxes carry the variety and take on a theme by area. The first build (sheets with gaps) was replaced the same day.

## Where the generator stands (2026-10-25)

Five builds in one day; the current shape is in `docs/open/CLASSIFIEDS_PLAN_2026-10-24.md` ("Zones, topography, catalog to 155"). The box catalog is `src/classifieds/templates.ts` (155 templates + 15 heads + 8 palettes), the topography is `style.ts` `centresNear`, the zones are `zones.ts`. Justin's standing feedback: the hand mock-ups (`mockups/BoxStudies.html` pages 1 and 3) are the target quality; body text must not be minute; stand-out boxes must not recur; themes should centre, disintegrate and reform.

## The reference collection (directive, 2026-10-25)

Justin: "this is what I wanted to do from the start: create collections of references for each; render each example as far as possible as its own mock-up in code that makes sense to the site." Rules for mock-ups, from his reviews: full pages filled to the foot; genuine original efforts (copy and composition), with only the devices taken from the specimens; the nuance of the specimen (its small oddities: codes, ticks, arrows, ovals, run codes) carried over. Collection lives in `mockups/specimens/` (README there lists order and status; cl-014 done). Composed sections (`ThreeKinds.html` etc.) are mixtures of the collection.

## Suggested next step

Entry types now exist in code (`catalog.ts` `EntryType`, `RATIOS`). Tag the annotations' units with them too, so the dials can be checked against the specimens.

## Site decisions (Justin's Q&A, 2026-10-24)

- **Breadth:** every type is in: classic classifieds, notices and announcements, seasonal sections, listings, mail-order and posters. Entries need a type so ratios can be managed (e.g. a movie listing or poster dropped in every so often).
- **Content:** a mix of real platform posts, generated filler, archive text from the scans, and real posts set in period styles. Generated tone is all of: period-true, art/poetic, network-flavoured, archive-led.
- **Posting:** a standard form plus an optional preferred look or a custom submitted look. The poster picks the ad type and upgrades, the page decides the family, and the look still varies across the plane.
- **Recurrence:** each real ad has one home spot in its chosen look, plus restyled echoes elsewhere that link back to it.
- **Plane:** part free collage, part reel-by-reel. Wide blank borders (staggered in and out) replace page jumps. Themes transition gradually, with boxes from other families intruding. Visitors land on a random spot.
- **Look priority:** paper first, then film at a distance, then full film. Microfiche is the navigation idea for now; its aesthetics come later.
- **Visitor functions:** a focus view on an ad that links to the publisher's ArtDirect page, org or thread. Search and jump, respond, tell real from generated. No save/clip.
- **Directory:** every dossier, org, event and unclaimed file automatically becomes an ad. Outside entries come from community-opened files, imported feeds and Justin's curation.
- **Languages:** real ads stay in their own language with a translate option in the focus view; generated text follows its family's language.
- **Images:** user uploads and public-domain cuts. Type-only at first. No AI-generated images.
- **Catalog growth:** Justin drops scans (Claude annotates, he reviews); approved custom looks become families.
- **Ratios:** global admin dials.
- **Pricing:** decided later.
