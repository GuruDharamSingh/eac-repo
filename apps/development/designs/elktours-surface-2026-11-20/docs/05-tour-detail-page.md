# 05 · Tour detail page below the stage (phone)

Files: `designs/Tour Detail Page Phone.dc.html` (v1, superseded) and `designs/Tour Detail Page Phone v2.dc.html` (**current**).

## v2 flow: stage → index → everything
- **4a Stage** (docs/04 phone). Full screen. The foot carries a small but obvious **way back**: a bordered 44px pair, "‹ TOURS" (Venture .6rem) + "⌂" (home), left of the tour name. The "swipe for the practical part" hint was removed at the owner's request.
- **Snap.** One swipe moves full screen from stage to index; swiping back returns to the stage. Use CSS scroll-snap (`y mandatory`) on the first two screens only.
- **4b Index** (full screen):
  - Folded stage bar under the status bar: 30px numeral tile, "BACK TO THE WALK · STOP III", the stop title, ↑ 44px.
  - Then:
    - "BEFORE YOU GO" (Venture) + tour name (Basteleur Bold 1.2rem, one line);
    - 4 key facts (Length, Walk, Group, Price);
    - a **Next departure** face (date tile + "Sat · 10:00" + "6 of 10 left · 3 more dates") that jumps to Dates;
    - a numbered index 01–07 (What to expect, The route, Dates & times, Meeting point, What's included, Your guide, Good to know), each row 44px+ with a one-line teaser and ↓.
  - Book bar docked (with the way back).
- **Free scroll.** Below 4b the page scrolls normally.
- **4c Everything:**
  - A sticky pill bar of the 7 sections, highlighting the one in view. Tapping a row in 4b or a pill jumps there; at the bottom the last pill lights up.
  - Sections, each a SurfaceSection with a Venture head and a numeral:
    - 01 What to expect: summary, facts, highlights.
    - 02 The route: map, then rows I–IX; each row jumps back to that stop on the stage.
    - 03 Dates & times: **only departures a guide has offered**, with places left, Choose / Chosen / Full. The choice fills the Book bar.
    - 04 Meeting point: map, place, Directions.
    - 05 What's included: two columns.
    - 06 Your guide: guide face + "Their take".
    - 07 Good to know: cancel, bring, tickets, contact.
  - Book bar docked throughout.

## Typography (owner decision, applies site-wide going forward)
- **Basteleur Moonlight (400)** for body text.
- **Basteleur Bold (700)** for titles.
- **Venture** for labels, kickers and section numbers (uppercase, letter-spacing .14–.18em).
- **Brothers is no longer used.** Earlier files (the specimen, wizard and heroes) still show Brothers and need updating.

## Behaviour notes
- Section tracking: the active section is the last one whose top is within 80px of the scroll top; at the very bottom it is the last section. A jump locks tracking for 250ms.
- Dates: full departures are not selectable.
- Everything in [brackets] is a placeholder.
