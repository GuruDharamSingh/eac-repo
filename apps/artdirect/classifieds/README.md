# Classifieds style catalog

Reference data for ArtDirect's classifieds section: real newspaper classified pages, annotated for layout, typography and colour, and grouped into style families that can become CSS. Data only. Nothing here is wired into the app yet.

## Where things are

| What | Where |
|---|---|
| Page images (39, de-duplicated) | Nextcloud `EAC_Network/artdirect/Private/classifieds/specimens/cl-NNN.jpg` (originals also in Justin's `Classifieds/` folder) |
| What each stored file is (size, original name, hash, exact duplicates) | `data/manifest.json` |
| Notes on each page | `data/annotations/cl-NNN.json` |
| Shape of the notes | `schema.ts` |
| Style families and their CSS tokens | `families.ts` |

## The layers recorded per page

- **frame**: columns, column width, gutters, column rules, vertical vs modular flow, masthead and footer.
- **headers**: how a classification is labelled (banner, reverse bar, tint bar, rule label, icon label, boxed title, plain caps), with colours, numbering and an approximate `box` on the page.
- **units**: the ad building blocks (liner, bold-lead liner, tinted liner, boxed liner, display, reverse display, photo liner, listing table, notice, house ad), how often each appears, and how its lead words are set.
- **type**: one entry per font role (masthead, header, lead, body, display, code), with classification, a description of the look, and the nearest Google Font.
- **color**: mono, spot or process; paper, ink, and accent hexes with what each is used for.
- **ornaments** and free **notes**.

`box` values are `[x, y, w, h]` as fractions of the page, estimated by eye.

`role` marks pages that aren't real classifieds: `reference` (templates, a textbook mock-up, decor, a flyer pastiche) and `adjacent` (movie-listings pages). They keep their notes for the type and devices they show, but shouldn't weigh on the families.

## Status

All 39 specimens are `draft` (first pass by Claude, 2026-10-24). They become `reviewed` once Justin corrects them. His corrections are the standard.

Known gaps:
- cl-019 is the same page as cl-017; cl-025 is a photo of the cl-020 template.
- cl-022, cl-031 and cl-034 are too small to read the liners; cl-029 and cl-036 have a booking-service banner across them.
- Families marked `provisional` in `families.ts` rest on one or two pages.

## Adding pages

1. Add the image to the Nextcloud specimens folder as the next `cl-NNN` and append a row to `manifest.json`.
2. Write `data/annotations/cl-NNN.json` following `schema.ts`. Start from the closest existing annotation.
3. Assign a family, or propose a new provisional one in `families.ts`.
