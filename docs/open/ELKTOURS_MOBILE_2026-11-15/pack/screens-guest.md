# Guest screens

Line numbers refer to `Elkdonis App.dc.html`. Canvas ids (`1a`, `4b`…) refer to phones in `Elkdonis Experiences.dc.html`. Exact values for anything not listed here are in the inline styles at those lines. Tokens and shared components (nav, sheets, buttons, chips, section headers) are in `README.md`.

All guest screens assume a signed-in guest (Ana Ribeiro in the prototype).

---

## 1. Discover — line 23 · canvas 6a, 4a, 4b
Root tab. Scroll padding 62px top, 124px bottom. Side margin 20px (cards 16px). Top to bottom:

1. **Header row.** Left: wordmark, two lines of Brothers 22px / 1: "Elkdonis" in `#dcc08a`, "Experiences" in ivory. Right: city pill, 44px high, radius 22, `#343941`, with a 32px round thumb, "Paris" and a small chevron. Opens the **City sheet**.
2. **Issue rule.** "Autumn · No. VII" (Venture 10.5px), a brass hairline, a 6px brass diamond.
3. **H1** "Paris, with Local Artists" — Brothers 46px / 1.
4. **Intro** — 15px / 1.5 muted: "Tours and experiences led by people who live and work here." then an underlined **Read more** → About.
5. **Search row.** A 50px pill "Search walks, ateliers, museums" and a 50px round filter button. Both go to Tours with the search focused. (The row of type chips was removed from Discover on request.)
6. **This week's walk.** One featured tour card: padding 10/10/16, radius 30 top / 24 bottom, `#343941`, double brass frame. Inside: arched photo 250px high (`150px 150px 16px 16px`) with a places-left badge; kicker "Walking tour · 2h 30"; title Basteleur 700 23px; "with Dana McCool · Next · Sat 21 Nov, 10:00"; a 48px brass circle with `→`. Tap → Tour detail.
7. **Favourite places** with "All ›". Horizontal shelf. Each card 168px wide: arch 196px high (`84px 84px 18px 18px`), kind kicker, name 17px 700, area. Last item is a dashed arch "See all N places". Card → **Place sheet**; "All" → Places catalogue. Shows places a guide has starred.
8. **Experiences coming.** Panel, margin 34/16, padding 20/18/18, radius 26, verdigris wash and border. Heading label "Experiences coming" (Venture 11px verdigris, no icon). H2 "Something strange on the way" Brothers 31px. One line of copy. Rows: 72px porthole, title 16px 700, "Artist · craft", and where it happens in verdigris. Row → Experience page.
9. **Your guides** with "Local Artists ›". One card per guide: 52px initial avatar, "Name · craft", bio, a 28px `+` / `–` ring. Tap expands in place: "Leading now" list (tour title, next date; each → Tour detail) and a "Full profile →" pill → Guide profile.
10. **Three rows**, 16px apart, all in the places-catalogue style (card `#31353c`, double brass frame, `›`):
    - **Feed** — largest. Radius 24. Kicker "From the guides · Feed", post count, then the newest post: 52×60 arch with the author's initial, title 17px 700, a 90-character excerpt, "Author · when". → Feed page.
    - **The places catalogue** — radius 22, 44×52 arch thumb, "Every stop, gallery and table", "N places the guides know well". → Places.
    - **Elkdonis Forum** — thinnest. A 54px pill: 30px `☰` ring, the name, and a brass "N new" badge when something is unread. → Forum.

## 2. City sheet — line 1333 · canvas 1a
Kicker "The guide", H2 "Choose a city", one row for Paris (selected). Then **More cities coming** with one line ("Florence and Lisbon open in spring 2027. Kyoto and Mexico City are being planned.") and an outlined pill **Suggest an artist or place** → Suggest.

## 3. Tours — line 143 · canvas 1b
Root tab. Kicker "Paris · N tours", H1 "Tours" 40px, intro line + **Read more** → About. Search input (live filter on title). Type chips: All, Walks, Ateliers, Museums, Food & markets, Private. List cards: 112×144 arch thumb, "type · duration", title 17px 700, "with guide", next date, price in brass 17px. Empty: "Nothing matches that yet."

## 4. Tour detail — line 181 · canvas 3a–3e, 4g
Top bar: back, type label, heart (toggles saved).

**Hero** — an arch 330px high, margin 14/16, double brass frame. It shows one of the media kinds the guide has switched on for this tour; pills under it switch between them when more than one is on. If nothing is on, there is no hero.

| Kind | What shows |
|---|---|
| Film | Label "Fly-over film", a row of progress segments (one per stop), and a **16:9 frame** (183px high) at the bottom of the arch. The film is never cropped: the map credit and "promotional use only" burned into its edges must stay visible. Time readout and a pause button. Autoplays muted and loops. |
| 3D route, before play | Cover photo, a cut-corner button **▶ Preview the route**, and "N stops · a flight along the walk, stop by stop". The map only mounts on tap. |
| 3D route, live | Tilted map with numbered pins; the pin for a stop with an experience is ringed verdigris. Badge "Live 3D map". Bottom overlay: kicker ("The route · 5 stops" or "Stop IV · +1h 30"), stop name, experience line if any. A row of 32px Roman-numeral chips flies to a stop; **Play the route** / **Pause** steps through every 2.6s. |
| Photos | Horizontal scroll-snap gallery, one photo per page, with a Roman counter "II / V". One photo: no counter. |

Pills: "Film · 0:52", "3D route", "Photos · 5" (or "Photo"). Which kind opens first is the guide's choice (see `data-and-state.md`).

Below the hero: title (Brothers 40px); guide row (40px avatar, name, "craft · leads in EN · FR"); a 4-column facts strip between brass rules (Length, Distance, Group, Language); drop-cap blurb.

**The route.** Hint "Tap a stop for what you'll see there." A vertical timeline: 36px circle with a Roman numeral, a 1px brass connector, the stop name, a 76×56 Street View thumb (when stills are on), and a 28px `+` / `–` ring. **Tapping a stop expands it in place** (it does not scroll to the map): a kicker ("Where it starts" / "About 1h 00 in"), a short note, a 150px Street View picture, and an **About this place** pill when the stop is linked to a place (→ Place sheet). There is deliberately no map button here. Stops that carry a public experience show a verdigris pill "Experience at this stop · Artist · Title" → Experience page.

Then "Meet at …", **Next dates** (up to three chips: day, time, places left → Dates with that slot picked), and a sticky bottom bar: price 24px brass, "per person", **Choose a date →**.

## 5. Date & time — line 308 · canvas 1d
Month grid; days with a future slot have a brass ring, the picked day is filled. Slots for the day as cards: time range, "N of M places left" / "Full · waitlist open (N waiting)" / "Booking closed", when booking closes, guide. Party stepper (max 6, or what is left). Total, the minimum-guests rule in plain words, and a CTA: **Continue** or **Join the waitlist**.

## 6. Booking & payment — line 358 · canvas 1e
Summary card, Card / Apple Pay chips, price line and total, cancellation policy, the rule again, CTA "Book and pay €N" or "Join the waitlist". Success screen: "You're booked" with a reference, or "You're on the list" with a queue position.

## 7. Experiences — line 1036 · canvas 5h
Root tab. Kicker "Paris · hosted by local artists", H1 "Experiences", one line + **Read more** → About. Cards (radius 24, verdigris border): 76px porthole, "kind · minutes", title, "Artist · craft", the one-line pitch, and where ("At a stop on …" / "By request"). Then **The artists** with "All ›": a horizontal row of 84px portholes with name, craft and a status ("Presenting on tours", "By request", "Coming soon"). Then a dashed pill "Know an artist we should meet?" → Suggest.

## 8. Experience page — line 733 · canvas 2a
Round hero, title, pitch, host row → Artist profile, a 2×2 facts grid (Length, Format, Where, Group), drop-cap body, "On these tours" cards → Tour detail, upcoming dates (the tour departures the artist has accepted) → Dates, and for standalone offers a note with the price and **Ask about a private visit** (enquiry only).

## 9. Artist profile — line 780 · canvas 2b
Arched portrait in verdigris, name (Brothers 42px, centred), "craft · area", drop-cap bio, a 3-column Work grid, their experiences, "Find {name} on" tour cards, link out to the ArtDirect portfolio.

## 10. Guide profile — line 1091 · canvas 4d
Same layout in brass: portrait, name, craft, bio, "Tours with {name}", "{name}'s favourite places" as chips → Place sheet, "Shared by {name}" (their feed posts).

## 11. Local Artists — line 1188 · canvas 5j
Kicker "Paris · N people", H1 "Local Artists", one line. Chips: Everyone, Guides, Artists. Two-column grid of cards: a 96×110 frame (arch + brass for guides, round + verdigris for artists), name, "craft · area/role", status. Card → Guide or Artist profile.

## 12. About — line 1169 · canvas 5i
**Every "Read more" (Discover, Tours, Experiences) lands here.** Arched photo, H1 "Elkdonis Experiences", a drop-cap paragraph, three ruled sections (I · Tours, II · Experiences, III · Places & the forum). Then **Local Artists** with "All ›": a sideways-sliding, snap-scrolling row of the same people cards (136px wide). Then **Suggest an artist or place**.

## 13. Places catalogue — line 1063 · canvas 5k, 4c
Kicker "Paris · N places", H1 "Places". Filter chips: All, Favourites, then **every tag in use**, most used first. Rows: 52×64 arch thumb, "kind · area", name, tags joined with `·`, "A guide favourite" when starred, `›`. Row → Place sheet.

## 14. Place sheet — line 1354 · canvas 4b
Bottom sheet. 92×112 arch thumb beside the kicker and name (Brothers 30px). Blurb, tag pills, "A favourite of {guide}", Address and Hours rows, an "On a tour · Stop IV · {tour}" button → Tour detail with that stop open, two outlined buttons: the website (opens the in-app web view) and Directions. Businesses show a dashed note "Business profile coming soon…". Last: **See all places →** (hidden when already in the catalogue).

## 15. Suggest — line 1121 · canvas 4f
Two chips: An artist / A place (labels below change with the choice). Fields: name, **URL**, a free-text reason, optional email. Send is enabled when there is a name and either a URL or a reason. On send: toast "Thank you. The office reads every suggestion." and return to Discover.

## 16. Feed — line 1276 · canvas 6b
H1 "Feed", one line explaining it. Rows in the catalogue style: arch with the author's initial, kicker ("Post" or "Link · host"), title, "Author · when · N comments". Row → Post preview.

## 17. Post preview — line 1378 · canvas 6c, 6d
Tall sheet (starts 70px from the top). Author row, title (Brothers 28px), body. **Link posts** embed the site in a 240px frame with the host and a "Full screen ⤢" control, plus a note that some sites refuse previews. Then the comment count with "In the forum ›" (opens the same post as a forum topic), the comments, and a pinned comment box. Anyone signed in can comment.

## 18. In-app web view — line 1394
Near-full-height sheet: close, host pill, "Browser ↗", and the page in a frame. Used by feed links, forum link cards and place websites.

## 19. Elkdonis Forum — line 1200 · canvas 5b
Modelled on `ForumSurface`. Kicker "Forum · Elkdonis", H1, a status line "N topics · N posts", who you are signed in as. An unread banner "N topics have something new" with **Mark all read**.

**Sections**: each a block with a 3px left rule in the section's colour. Section name Basteleur 700 **19px**, topic count, "· N new" in brass. Sub-sections sit under it, indented with `↳`, **16.5px**. Tap → Section.

**Latest**: rows of `[kind glyph] [unread dot + title] [time]`, with a mono meta line "Section · Author · N replies · ▧ 2 · ↗ link" and a small "Members" / "Private" tag when not public. Unread titles are bold. Tap → Topic (and marks it read).

Pinned CTA: **✎ Start a topic**.

## 20. Forum section — line 1224 · canvas 5c, 6e
Breadcrumb kicker, name with the coloured rule, count, description, sub-section pills, the same rows, and **✎ Start a topic here** (preselects the section).

## 21. Topic — line 1238 · canvas 5d, 5e, 5m
Breadcrumb, kind, title (Brothers 32px). A visibility tag, or — on your own topic — a box **"Your topic · who can read it"** with Public / Members / Private chips and one line saying what the choice means. The opening post in a card (avatar ringed by role: brass guide, verdigris artist, grey guest), then replies. Posts can carry a link card and a 2-column media grid (photos, video). Pinned reply bar: a `+` to attach photos or video (pending files show as 64px thumbs with `×`), a text box, **Reply**.

## 22. Start a topic — line 1258 · canvas 5f
Section chips (sub-sections shown as "Parent › Child"), kind chips (◉ Discussion, ✦ Idea, ◆ Event), title, body, optional link, **+ Add photos or video**, and **Who can read it**: Public / Members / Private with a help line. Private reveals **Add people** chips. Post is enabled with a title, a body and — if private — at least one person. On post: go to the new topic.
