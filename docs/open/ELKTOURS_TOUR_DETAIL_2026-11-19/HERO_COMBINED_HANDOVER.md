# Handoff spec: tour-detail hero, "Hero — Combined"

- **Status:** design direction agreed with Justin on 2026-11-19 and 2026-11-20. **Not built.** Justin still has to say "build it".
- **Design (canvas):** https://claude.ai/artifact/RpqJyjU5yqjV1pT8xQLeS9, board **Hero — combined (1 + 4 + 3)**, `project/HeroCombined.dc.html`. It is a clickable mock-up.
- **App:** `apps/elktours`, tour-detail page `/tours/[slug]`, desktop tree first.
- **Tokens:** the phone tokens in `src/components/mobile/mobile.css` (`body:has(.elk-m)` block). Desktop takes these on now as well.

---

## 1. How we got here (decision trail)

Justin's calls, in order. Each one supersedes what came before it.

1. **Route media.** A stop shows its own photos first. Street View is the last slide, or a button. With no photos, it shows Street View only. This is already built in `components/tours/stop-media.tsx`.
2. **Page order.** Hero, then description, then Highlights / Meeting point / Included / Not included. These four sit **2×2, with no cards**, straight on the page background.
3. **The route shows one stop at a time,** with the media at about ¼ size. The rest of the card is the description and any links. **No "Open in Maps" on stops.** **No prev/next buttons**; Justin removed them himself on the canvas.
4. **The Book box sits right under the hero** and slides (sticky) down the page.
5. **The hero opens on whichever media comes first in the guide's order.**
6. **The fly-over and the 3D map are two different things** and must look it:
   - the fly-over is a rendered film, about 38 MB. Watch it.
   - the 3D route is the live, steerable map. Explore it.
   - Neither loads until it is pressed.
   - Since 2026-11-19, films are only visible on four tours: Latin Quarter, Marais, Montmartre and Île de la Cité.
7. **Stop cards** (boards *Hero — stop cards*, *Full*, *Standard*, *Mini*). Justin picked a mix of three of them:
   - the hero is the window;
   - the **mini cards** run along the bottom, and their lower half grows on hover;
   - clicking a mini card opens the **standard card inside the hero frame**.
   - The stop's sub-gallery is in its own photo frame.
   - The **first** card in the row goes back to the overview. The **last** card is **booking**.
8. **Integration.** The mini cards expand *over* the hero, not in a band below it. The overview is the **general tour card**, not just the cover photo.
9. **Narrative (the defining idea):**
   - Overview is a text intro to the tour.
   - Every card puts the **text on the left and the picture on the right**.
   - The text is a **continuation of the tour's story**: "on this tour we will see…", "stop I, we begin by admiring…", "II, arriving here we can see the difference…", "III, then we move on to something new yet reminiscent…".
   - Every stop card keeps the **tour name, date, its stop narrative and a booking option**.
   - The **place details** (the place's own facts and text) sit **under** the narrative. They expand by **growing the card up over the narrative**.

---

## 2. Overview of the component

One hero frame. In it:
- a **card** that is either the tour's overview or one stop;
- or the **booking card**;
- a **row of frosted mini cards** floating on its bottom edge: The walk · I … IX · Book.

The visitor reads the tour as a story, stop by stop, without leaving the top of the page. They can book from any card.

---

## 3. Layout (desktop, reference 1440 wide)

| Part | Spec |
|---|---|
| Hero frame | 1320 × 720 max, radius 14, `overflow: hidden`, centred in the page container (`max-w` 1320 + 60 side padding). Background is a darkened wash of the current item's tone. |
| Card | Absolute; inset 24 left/right/top; height 576 (Justin's value). Padding 26, radius 14, bg `--m-sheet` at about 88 %, 1 px brass @ 35 % border. Flex row with gap 30. |
| Left column (text) | Fixed 560 wide, `position: relative`, flex column. |
| Right column (picture) | `flex: 1`. Radius 10. Framed by a 6 px `--m-card` ring plus a 1 px brass @ 40 % ring (box-shadow). |
| Mini-card row | Absolute, bottom 14, side padding 36, gap 8. Items align to the bottom, so growth goes upward. 11 items × 106 wide. |
| Booking card | 440 wide, centred in the frame above the row. |

### Left column, top to bottom
1. **Tour bar, always present:** tour title (one line, ellipsis), "Next walk [date] · [price] per person", and a **Book** button on the right. A brass hairline sits under it.
2. **Narrative block:**
   - kicker: a Roman-numeral badge for stops, then "Stop III of IX", or "The walk · 9 stops" for the overview;
   - title (display font, 36);
   - **narrative** (display/serif, 21, line-height 1.5);
   - the flow line "Then on to IV, Conciergerie · [3 min walk]" (12–13, faint).
3. **Details panel:** absolute, bottom 0, full width.
   - Collapsed it is 58 high: "About Sainte-Chapelle · Royal chapel · Ticket · [20 min]" with **More ▴**.
   - Expanded its height is `calc(100% − 70px)`, so it covers the narrative but never the tour bar. It shows **Less ▾**.

### Right column
- The current slide fills the column.
- **Tabs, top right:** one per media kind. A stop has *Photos* and *Street View*. The overview has *Photo*, *Fly-over* and *3D route*.
- Arrows appear when there is more than one photo.
- The caption sits top left.

---

## 4. Design tokens

| Use | Token (mobile.css) | Value |
|---|---|---|
| Page ground | `--background` | #2b2f36 |
| Card / sheet | `--m-sheet`, `--m-card` | #2f3339 / #31353c |
| Panel well | `--background` / `--m-well` | #2b2f36 / #3d424a |
| Text | `--foreground` | ivory #f1ece2 |
| Soft text | `--foreground-soft` | #e6e0d4 |
| Muted text | `--muted-foreground` | #b9b2a5 |
| Faint | `--faint` | #8f8a82 |
| Brass (CTA, rings, badges) | `--primary` | #c9a25c |
| Ink on brass | `--primary-foreground` | #1b1e23 |
| Kicker brass | `--brass-light` | #dcc08a |
| Display font | `--site-font-heading` | Brothers (the mock-up uses Marcellus as a stand-in) |
| Body | `--site-font-body` | Basteleur (the mock-up uses Inter) |
| Kicker | `--site-font-kicker` | Venture small caps (the mock-up uses Marcellus SC) |

Radii are 14 for the frame and card, 12 for the panel, 10 for the picture and mini cards, and 999 for pills.

---

## 5. Components

| Component | Variant | Data | Notes |
|---|---|---|---|
| `TourHero` | — | tour, stops, assets, next departure, price | Owns `sel` (0 = overview, 1…n = stop, n+1 = book), `hover` and `panelOpen`. |
| `HeroCard` | `overview` / `stop` | narrative, title, kicker, gallery slides, details | Same layout for both variants. |
| `HeroGallery` | — | slides `{kind: photo/sv/film/map, caption, url}` | Built on `StopMedia` (already built), extended with the film and map kinds. **Film and map mount only when pressed.** |
| `DetailsPanel` | collapsed / open | facts, about, guide note, links, place card line | Uses BusinessCard `line` mode (already built) for the place. |
| `MiniCard` | overview / stop / book | thumb, numeral, title, first clause of the narrative, kind | Frosted glass. |
| `BookCard` | — | price, dates, party | Reuses the existing booking form logic. Also keep the mailto fallback for when no dates are open. |

---

## 6. States and interactions

| Element | State | Behaviour |
|---|---|---|
| Mini card | Default | 106 wide. Thumb 46 high, title on one line, frosted (`--m-sheet` @ 82 % + 8 px blur). |
| Mini card | Hover / focus | Thumb grows to 96, the card lifts 8 px, and it shows the first clause of the narrative plus the kind. It grows **up over the card**. |
| Mini card | Selected | 2 px brass border; the numeral badge fills brass. |
| Mini card | Click / Enter | Sets `sel`, closes the details panel, resets the gallery to its first slide. |
| Tour bar · Book | Click | `sel = book`, which shows the booking card. |
| Details panel | More / Less | Toggles open; height animates. `aria-expanded`. |
| Gallery tab | Click | Jumps to the first slide of that kind. The pressed tab fills brass. |
| Fly-over slide | Default | Poster plus "Watch the fly-over" button. Nothing downloads. |
| Fly-over slide | Pressed | Mounts the 720p `<video controls autoplay>`. |
| 3D route slide | Pressed | Mounts the route preview (`RoutePreviewLauncher`) inside the frame. |
| Street View slide | Shown | Mounts `StreetViewPano` only when it is the visible slide. |

**Default selection:** the overview (sel 0). The overview gallery opens on the first item in the guide's asset order.

---

## 7. Content

- **New field: stop narrative.**
  - It is the tour's story at this stop, written by the guide, roughly 1–3 sentences (aim for ≤ 280 characters).
  - It is **separate** from the place description, which lives in the details panel.
  - Proposed as `tour_stops.narrative` (sanitised text). A migration is needed, and needs Justin's go.
  - Until it is written, fall back to `stopExtras.excerpt`, then to the first sentence of `body`.
- **New field: tour narrative intro.** Use the tour excerpt or the first paragraph of the body until a dedicated field exists.
- **Mini-card line:** the first clause of the narrative, cut at the first `, : .`, plus an ellipsis.
- **Facts:**
  - Time here: needs a per-stop duration. `durationMinutes` exists on stops.
  - Entry (free / ticket, and whether included).
  - Built.
  - Opening hours, from the place.
  - Walk to the next stop: computed, or entered.
- **Placeholders seen on the canvas:** [price], [date], [length], [language], [meeting place], [guide name], [opening hours] and [min]. They map to existing tour fields where those exist. Leave a fact out rather than showing an empty one.

---

## 8. Edge cases

- **Stop with no photos:** the gallery is Street View only and has no tabs.
- **Street View switched off and no photos:** a quiet placeholder.
- **Tour with no film:** no Fly-over tab. No placed stops: no 3D route tab.
- **No open dates / not priced:** the tour bar shows "Ask about a date" (mailto); the Book card shows the existing fallback.
- **Long titles:** the tour bar title is one line with an ellipsis. The card title wraps to two lines at most. The mini-card title is one line with an ellipsis.
- **Many stops (more than 9):** the row scrolls horizontally inside the frame. Keep Overview pinned first and Book pinned last.
- **Slow connection:** only the current photo loads. Neighbours are preloaded lazily. No film or map loads until pressed (the 38 MB lesson).

---

## 9. Responsive

| Width | Behaviour |
|---|---|
| ≥ 1200 | As specified. |
| 900–1199 | The card stacks with the picture on top (16:9) and the text below. The row becomes a horizontal scroller. |
| < 768 | The phone tree (`<Split>`) shows. Port the *idea* there: narrative cards in a swipe deck. This is a separate ticket and needs Justin's call, because desktop and phone may merge soon. |

---

## 10. Motion

| Element | Trigger | Animation | Duration | Easing |
|---|---|---|---|---|
| Mini card | hover / focus | lift 8 px, thumb height 46→96 | 200 ms | ease-out |
| Details panel | More / Less | height 58 ↔ full | 250 ms | ease-in-out |
| Gallery slide | change | crossfade | 350 ms | ease |
| Card | `sel` change | crossfade of the text and picture | 250 ms | ease |

Respect `prefers-reduced-motion`: no lift, no crossfade.

---

## 11. Accessibility

- **The row** is a `role="tablist"` or toolbar of buttons. Each mini card is a `<button aria-pressed>` with the label "Stop III: Sainte-Chapelle". Left and right arrow keys move along the row.
- **The card** region is `aria-live="polite"`, so a change of stop is announced by its title.
- **The details toggle** has `aria-expanded`. Focus stays on the toggle.
- **Gallery:**
  - arrows carry `aria-label` "Previous/Next picture";
  - tabs are `aria-pressed`;
  - the film and map buttons are real buttons.
- **Contrast:** ivory on the sheet passes, and ink on brass passes. Check muted text at 12 px on `--m-sheet`.

---

## 12. Out of scope or open

- **Whether the route section below the hero stays** (the one-stop-at-a-time card with the rail) now that the hero carries the narrative. Justin to decide.
- **The booking-box contact email** (Dana's Gmail, a role address, or none). This blocks the next prod rebuild.
- **The pending prod rebuild** of round 2: film on demand, place card `line` mode, booking fallback, reviews hidden when empty.
- **Migrations** (`tour_stops.narrative`, a tour intro field) need Justin's go. Do not trial DDL on live.
