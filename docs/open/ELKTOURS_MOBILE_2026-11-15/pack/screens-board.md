# Board screens: guides, artists, the office

Line numbers refer to `Elkdonis App.dc.html`; canvas ids to `Elkdonis Experiences.dc.html`. Shared components and tokens are in `README.md`.

Three roles use the same shell. In the prototype: **Guide** = Dana McCool, **Artist** = Lucien Arnaud, **Admin** = the Elkdonis office, which sees every guide and artist. A three-way switch at the top of the Board changes role for demo purposes only; the real app takes the role from the session.

---

## 1. Board — line 814 · canvas 2e, 2f, 2h, 4h, 4k
Header: avatar, name, role line, today's date. Content depends on role.

**Artist**
- **Invitations** (count). Card per invitation: "{Guide} invites you", tour title, "Stop IV · Palais-Royal · Sat 28 Nov, about 11:15", "{Experience} · €90 per run", and **Accept** / **Decline**. Either one updates the guide's Collaborate screen and shows a toast.
- **Coming up**: accepted dates with guests booked so far → Tour detail.
- **My experiences**: each with its status (Public, Members only, In review, Sent back with notes) → Experience page.
- **When I'm free**: a 7 × 3 grid (Mon–Sun × morning, afternoon, evening). Tap a cell to toggle. Saved at once.
- **+ New experience** → the wizard at step I, prefilled.

**Guide**
- A vermilion banner when any of their slots closed below its minimum → Decisions.
- **Experiences on tours**: one row per linked stop, "N confirmed · N asked" → Collaborate. A dashed button "+ Add an experience to a tour stop".
- **On Discover**: "Places & favourites" (N featured · N in the catalogue) → Places; "Elkdonis Forum" → Forum; their own feed posts with status ("On Discover", "With the office", "Declined"); a dashed button "+ Share a post or a link".
- **New from artists**: public experiences not on any tour yet.

**Office** (everything a guide sees, for all guides) plus:
- **To review**: new experiences. Card with the artist, title, pitch, details and three actions: **Publish**, **Members only**, **Send back**.
- **Posts to confirm**: feed posts from guides. **Put on Discover** / **Decline**.
- **Artists**: everyone → Artist profile.
- **Waiting on artists**: invitations not yet answered.

## 2. Schedule — line 430 · canvas 1f, 1j
Week strip (7 day cells with dots for slots; tap to filter to a day), previous/next week. Slots grouped by day. Slot card: time range, tour title, a status line coloured by state, a seat bar (filled = booked, a tick at the minimum), "booked/max", and waitlist or shortfall note. The office also gets guide filter chips and a guide initial on each card. Card → Slot.

## 3. New slots — line 524 · canvas 1g
One long form that creates many slots at once:
1. Tour chips. Picking one loads its defaults.
2. Month grid, multi-select dates.
3. Start times (up to 4), each stepped by 15 minutes, with its end time.
4. Duration stepper.
5. Minimum and maximum places, drawn as a row of seat dots, with the rule spelled out.
6. Booking cutoff chips: 6h, 12h, 1 day, 2 days, 3 days.
7. Waitlist switch and size.
8. Price override switch and stepper.
9. Guide chips (office only).
10. **Preview list**: every date × time, each marked ready or blocked with the reason — "Clashes with {tour} at {time}" or "Booking would already be closed. Shorten the cutoff."

CTA "Create N slots" creates only the ready ones, jumps to that week on the Schedule and shows a toast.

## 4. Slot — line 662 · canvas 1h, 1i
Kicker with date and time, tour title, guide. A framed status panel whose colour follows the state (vermilion when below minimum). Below-minimum actions: **Run it with N guests**, **Reopen booking**, **Cancel and refund N guests**. While open: **Close booking now**. A big booked count with seat ticks. Steppers for cutoff, minimum, places and price. Waitlist switch. Guest list (name, party size, note). Waitlist with **Offer** on the first person when a place is free.

## 5. Decisions — line 492 · canvas 1k
Two lists: slots below their minimum, and full slots with a waitlist. Intro text changes with the below-minimum rule (guide decides / auto-cancel).

## 6. Artist sign-up and new experience — line 925 · canvas 2c, 2d
Four steps with a numbered progress bar (I You, II Experience, III Free, IV Offer). Earlier steps are tappable.
- **I** name, email, craft chips, area, about, link.
- **II** title, "what will happen" pitch, kind chips, format (In person / Online / Hybrid), place chips (hidden when online), length and group steppers.
- **III** the 7 × 3 availability grid, and a notice chip (1 day, 2 days, 1 week).
- **IV** "As a stop on a tour" switch with fee stepper and per run / per guest; "On its own, by request" switch with price per guest; visibility wanted (Members only / Public); a preview card.

Continue is enabled when the step is valid. The last step sends the experience for review; the office sees it under To review.

## 7. Collaborate — line 992, sheet 1022 · canvas 2g
Tour chips. The tour's stops as a timeline with their time offset from the start. A stop with an experience shows the experience, the artist, and one chip per upcoming date: **Confirmed**, **Asked**, **Declined**, **+ Invite** (artist is free then) or **Not free**. A stop without one has "+ Add an experience", which opens a sheet of public experiences with "Free for N of M dates". Choosing one links it to the stop and **invites the artist automatically for every date they are free**, timed to when the group reaches that stop.

## 8. Tour page media — line 1287 · canvas 3f
"What guests see first." Tour chips. **Opens with**: chips for whichever of Film / 3D route / Photos are available. **On the page**: one row per item with a switch.

| Row | Notes |
|---|---|
| Fly-over film | Shows its length. If there is none: a **Request** button (needs stops placed on the map); the delivered film arrives switched off. |
| 3D route preview | Needs stops on the map. Indoor tours cannot have one. |
| Cover picture | |
| Gallery | "N more pictures". |
| Street View at each stop | Needs stops on the map. |

Note: "New pictures and films arrive switched off. Nothing reaches the page until it is on." A button previews the guest page. This is the mobile form of `components/manage/asset-panel.tsx`.

## 9. Places (guide) — line 1063 · canvas 4i, 5l
The same catalogue as guests see, with: a dashed "+ Add a place"; a 44px star on each row that features the place on Discover under Favourite places (toast confirms); and **tapping a row opens the edit page** instead of the sheet.

## 10. Add / edit a place — line 1152
Name, kind chips (Gallery, Studio, Shop, Food & drink, Landmark), address or area, website, "why you like it" (guests read this on the place card). **Tags**: every tag in use as a toggle chip, plus a "New tag" field with Add. Tags become the filter chips at the top of the catalogue. A "Feature on Discover" switch. Save is enabled with a name and an area.

## 11. Share a post or a link — line 1137 · canvas 4j
Chips: A post / A link. Title, link (for links), body. A note says what happens next. A guide's post goes to the office first ("Send to the office"); the office's own goes straight up ("Publish on Discover"). Once public it appears in the Feed and as a topic in the forum's Feed section.

## 12. Forum for staff — canvas 5g
The same forum screens. Guides, artists and the office also see the closed section **Guides & artists**, which guests never see.
