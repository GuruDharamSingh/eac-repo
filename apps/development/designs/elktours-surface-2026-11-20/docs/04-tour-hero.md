# 04 · Tour page hero as a docked surface

Files: `designs/Tour Hero Stage.dc.html` (desktop, 1440×780 artboard) and `designs/Tour Hero Stage Phone.dc.html` (390×844). The original artifact is in `reference/HeroCombined (original artifact).dc.html`.

## The idea
The hero is the surface docked into the page. The mini cards are small faces; the big card is the surface the selected face opens. Build it as **`SurfaceStage`**: a second host for the same descriptors. `open()` renders into an in-page stage instead of the `<dialog>`: no scrim, no ✕, and ‹ › walk the sibling faces. The stack, crumbs and URL behave as in the popup. Surface size is `stage` (fills its host). No new components beyond the host and a strip variant of the grid.

## Desktop (1320×720 frame on a 1440 artboard)
- **Stage:** a surface at left/right/top 24, height 552, `rgba(52,57,65,.95)` + blur(10px), 1px rule border.
- **Head:** glyph tile 38 holding the stop numeral (Venture); kicker `‹ The walk · Stop III of IX`; title 1.22rem; ‹ counter › controls (32px).
- **Body:** grid `540px | 1fr`.
  - Left: narrative (1.5rem, line-height 1.5), then the flow link ("Then on to IV, Conciergerie · [3 min walk]", dashed route line).
  - Bottom of the left column: the place face (one line, 62px, place kind #8fb3c4). Clicking opens the place surface over the narrative (height calc(100% − 28px), .28s): head with `‹ Stop III · Place`, facts in 4 columns, about, "From your guide" (dashed #e8805c), links; foot with "Open the place page →".
  - Right: media, flush. SurfaceTabs pills (Photos / Street View; or on the overview Photo / Fly-over / 3D route), ‹ › for photos, caption + count gradient. Street View, film and 3D load **only on press** ("Nothing loads until this is pressed").
- **Foot:** status line = tour name + "Next walk [Sat date] · [€ price] per person"; "Start at stop I" on the overview; **Book** is the primary.
- **Strip:** 11 faces (The walk, I–IX, Book) at left/right 36, bottom 16, gap 8. Each face:
  - a 44px cover (84px on hover) with a medallion in the cover's top-left (22px, Venture numeral; filled brass when open);
  - title 2-line clamp .8rem;
  - on hover: kicker (kind) + first clause of the narrative + "+" cue; lift translateY(-10px);
  - open card: brass border.
- **Book:** a compact event surface (440) pushed over the stage. The stage dims to an under-layer (translateY(-14px) scale(.985), opacity .4). Content: price, date pills, people stepper, Meet at / Cancel facts; foot "Book now".

## Phone (390×844)
- **Media first:** a 300px band (tabs at top 52, dots for photos, load buttons).
- **Stage scrolls under it:** head with numeral glyph, wrapping title, ‹ › 44px; narrative 1.22rem; flow link; the one-line place face; the guide's note.
- **Dock fixed at the bottom (166px):**
  - strip of faces 86px wide, 70px tall; the open one is 132px and shows its kind, and the strip auto-scrolls to it;
  - foot: tour name + next date + counter + Book (44px).
- **Place and Book:** bottom sheets over a scrim, with a handle, a ‹ crumb, ← 44px, and the foot.

## Content rules from the earlier hand-off (still valid)
Stop **narrative** is a new field, separate from the place description, with a fallback until guides write it. Text-length limits apply. Film and 3D map load on press.

## Open questions carried over
Whether the route section below the hero stays (answered by docs/05); which email goes in the booking boxes; the waiting rebuild; the new database fields (need owner approval).
