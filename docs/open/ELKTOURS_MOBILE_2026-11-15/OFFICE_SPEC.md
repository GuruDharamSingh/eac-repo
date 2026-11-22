# The Office (was "the Board"): phone admin reorganisation, 2026-11-15

Justin: "the board can get a little confusing ... call it the office ... a 3 tile row for add tour, instead of the plus going straight to slots ... new tour, new experience".
Design base: pack/screens-board.md §1 (Guide and Office lists) and screens 30 + 40. This spec keeps the pack's parts and puts them in an order that answers one question per band.

## Naming
- "Board" becomes **Office** everywhere a person reads it: tab label, page title "The Office", aria labels, back-button targets, toasts. Routes stay at /manage (no URL change).
- The artist side stays "My page" (/artist). Artists never see the Office.

## Bottom bar (screen 40)
`Office (badge = calls to make) | brass diamond + | Schedule`
- **+ opens a Create sheet** (the shell's Sheet, 30px top radius, brass top border), not New slots directly.
- Sheet content: a **3-tile row**, equal widths, each tile an arched mini frame (design shape language) with label and one line:
  | Tile | Line | Goes to |
  |---|---|---|
  | New tour | Route, stops and price | /manage/tours/new |
  | New experience | An artist's visit or workshop | /manage/experiences/new |
  | New dates | Slots for a tour | /manage/schedule/new |
- Under the tiles, two quiet rows: **Share a post** → /manage/share, **Add a place** → /manage/places (new place).
- Data: `OFFICE_CREATE` in lib/office.ts (labels and hrefs in one place).

## Office home (/manage on a phone), top to bottom
1. **Header**: who (avatar, name, role line) + today's date, title "The Office".
2. **Needs you**: a row of count tiles, in urgency order, from `getOfficeSummary().needs`:
   Calls to make (vermilion when > 0) · Experiences to review* · Posts to confirm* · Suggestions · Waiting on artists.
   (*owner only; already filtered by the read.) Zero tiles are dimmed; if all are zero, one line: "All clear."
   This replaces the separate vermilion banner + FactsStrip "Need your call".
3. **Today** and **This week**: the slot cards as now, "Schedule ›" on the header. The empty state points at **+ → New dates**.
4. **Tours**: one card per tour: title, next date + places booked, then Dates · Collaborate · Page media · Edit.
5. **Experiences on tours**: from `experiencesOnTours`, "{tour} · N stops · N confirmed · N asked" → Collaborate, plus a dashed "+ Add an experience to a tour stop" (pack wording).
6. **On Discover**: "Places & favourites: N featured · N in the catalogue" → Places; "Elkdonis Forum" → /forum; my feed posts with status (On Discover / With the office / Declined) via listFeedPosts({authorUserId, includePending}); a dashed "+ Share a post or a link".
7. **New from artists**: `newFromArtists`, public experiences not on a stop → experience page / Collaborate.
8. **More**: the full manage pages (Bookings, Tours, Places, Experiences, Fly-overs, Journal), folded by default, so the long list stops dominating the screen.

## Data (Jay, done, typechecked)
`lib/office.ts`:
- `getOfficeSummary({guideUserId?, isOwner}) -> {needs[], places{featured,total}, experiencesOnTours[], newFromArtists[]}`
- `OFFICE_CREATE`
