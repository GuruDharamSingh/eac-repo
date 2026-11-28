# Handoff: Single-page publication template · offer surfaces

## Overview
A template system for single-page publication sites. There is one site per person or organisation, and each site features **one offer at a time** (an event, a service, a series or an artwork). Everything else (other offers, writing, comments, profiles, share, checkout) opens on top of the page as a **surface**. A surface is a popup on desktop and a bottom sheet on phones. Visitors should be able to take in the content quickly and act on it: RSVP, book, buy, subscribe, comment, follow.

Six publication kinds share one surface system: **writing, live events, services, series, artwork, profiles**.

Source app this was designed against: `GuruDharamSingh/eac-repo` → `apps/sunjay`. Related files are `src/components/profile-card.tsx`, `rsvp-panel.tsx`, `inquiry-form.tsx`, `signup-card.tsx`, `src/lib/fonts.ts`, `src/lib/forum.ts`, `src/blocks/*-sample.ts` and `writing-blocks.tsx`.

## About the design files
The files in this bundle are **design references created in HTML**: prototypes that show the intended look and behaviour. They are not production code to copy directly. The task is to **recreate these designs in the target codebase** (the sunjay app: React/TSX) using its established patterns, components and libraries.

The `.dc.html` files open directly in a browser (keep `support.js` beside them). `Flyer Pages Wireframes.dc.html` is a pan/zoom canvas. Its rounds are stacked newest first (7 at the top, 1 at the bottom), and each option has an id badge (e.g. `5a`) for reference.

## Fidelity
- **Rounds 2–7: high fidelity.** Final colours, type, spacing, borders and interactions. Recreate them as closely as possible. Copy is placeholder ("Host Name", "Event title"), and every image is a hatched placeholder.
- **Round 1: low fidelity.** Hand-drawn sketch wireframes (Kalam font), kept for history. Use them for structure only.

## Core rules (the system)
1. **One offer page per site.** Only the featured offer has its own page. Every other offer, piece, profile and transaction opens as a surface.
2. **Surfaces stack.** Layer 1 explains and offers. Its primary action pushes layer 2 (RSVP, pay, order, subscribe, follow), then a **done** layer. A crumb in the head (`‹ Previous title`) pops one layer, Esc pops one, ✕ closes the whole stack, and clicking the dimmed page closes it.
3. **The URL follows the stack:** `?surface=evt-offer/evt-rsvp`. A shared link reopens the same stack over the page.
4. **The head carries at most one button**, and only for the object, never for the transaction:
   - Offers (event, service, series, artwork): `↗ Share`, which pushes the share layer.
   - The featured offer, opened from the profile: `⤢ Its page` (instead of Share).
   - Reading: `Aa +` / `Aa −`, which toggles body size between 13.5px and 15.5px.
   - Talk: `+ Follow` / `✓ Following`, to follow the thread by email.
   - A co-host's profile: `⤢ Their site`.
   - Transactions (RSVP, pay, order, subscribe, follow, done) and the site owner's profile: **nothing** but the crumb and ✕.
   - On phones the head button shows only its icon (`↗`, `⤢`, `Aa`, `+`).
5. **The foot carries one primary action** (bronze, filled). A quiet secondary appears only where noted (e.g. `Next ›` on reading, `Add to calendar` on done).
6. **Phone (<640px):** surfaces become bottom sheets. They have a grab handle, the same head, a scrolling body and a full-width primary under the thumb. Each sheet takes the height it needs: offers and pay rise high, done sits low.
7. **Reading** happens in a popup on desktop, with the index under the text and `Next ›` swapping the piece in place. On the writing page it is **docked** into the page as a stage with a strip of pieces; a docked stage has no ✕. On phone the stage fills the screen and the strip scrolls sideways above the home bar.
8. **Names open profiles.** Any person's name inside a surface pushes their profile layer: the host on a service, the author of a piece, the hosts of a series or session, and anyone in the talk.

## Screens / views

### A. The surface (component: `Offer Surface.dc.html`)
One component renders every layer. It takes these props:
- `layer`: one of the layer ids listed below.
- `crumb`: the previous layer's title, or empty.
- `docked`: no ✕.
- `sheet`: phone bottom sheet.
- `headActions`: enables the head button rules.
- `maxH`.
- `ctx`: shared flow state.
- `icons`: `glyph | things | marks | stamps`.
- `mark`: `box | inline | thumb`. Phone head treatment; desktop is always `box`.
- `tint`: kind colour on or off.
- Callbacks: `onGo(id, patch)` to push, `onReplace(id, patch)` to swap the top layer, `onBack`, `onClose` and `onSet(patch)`.

**Shell (desktop popup), 400–440px wide**
- Root: background `#24282a`, border `1px solid #5a6064`, top border `1px solid #5a6064`, shadow `0 30px 60px -24px rgba(0,0,0,.85)`. Column flex, `max-height` from the prop. Square corners everywhere.
- Head: grid `auto minmax(0,1fr) auto`, gap 12px, padding `13px 14px 12px 16px`, bottom border `2px solid <kind colour>` (bronze `#c8a45b` when tint is off).
  - Mark (box): 36×36, border `1px solid rgba(kc,.38)`, background `rgba(kc,.12)`, icon 17px in the kind colour.
  - Kicker row: JetBrains Mono 500 9px, letter-spacing .12em, uppercase, `#a3a09a`. The crumb is a bronze button `‹ Title`, then `·`, then the layer kind (e.g. `PAY`).
  - Title: heading font (see font templates) at `calc(20px * var(--fhx))`, line-height 1.08, single line with ellipsis.
  - Head button: height 28, min-width 28, padding `0 9px`, transparent, border `1px solid #5a6064`, utility font 10px. Hover: border and text `#c8a45b`.
  - ✕: 28×28, border `1px solid #5a6064`, 12px.
- Body: padding 16px, grid, gap 12px, `overflow-y:auto`, thin scrollbar `#3d4246`.
- Foot (desktop): flex, space-between, padding `10px 14px 10px 16px`, background `#1f2225`, top border `1px solid #373c3f`.
  - Status text (left): mono 500 8.5px, .1em, uppercase, `#8f8c86`, ellipsis.
  - Quiet button: transparent, border `#5a6064`, padding `8px 11px`, utility 10px.
  - Primary: background `#c8a45b`, text `#1b1e20`, padding `8px 13px`, utility 10px. Hover: `filter:brightness(1.08)`.

**Shell (phone sheet)**
- No side borders. Shadow `0 -18px 40px -10px rgba(0,0,0,.7)`.
- Grab handle: 38×4, radius 2, `#5a6064`, with 8px top padding.
- Foot: padding `10px 16px 26px`, grid gap 8. The status is centred above the buttons. The primary is full width, padding `13px 0`, utility 11px. The quiet button, when present, sits to its left (`flex:none`, padding `13px 12px`).
- Phone head marks (round 7):
  - `inline` (recommended default): no box, grid `minmax(0,1fr) auto`. A 12px icon in the kind colour sits in the kicker row before the kind label.
  - `thumb`: a 40×40 thumbnail of the offer's own picture (border `#4a5054`). In its bottom-right corner, offset −5px, is an 18×18 badge filled with the kind colour, containing an 11px icon in `#1b1e20`, with a ring `0 0 0 2px #24282a`. Talk, share, follow and done have no picture and fall back to `inline`. Profiles use the portrait.
  - `box`: as on desktop.

**Layers.** Each is listed as id: head kind / title / foot status / primary.
- `svc-offer`: SERVICE / One-to-one session / "3 times open this week" / **Book · $80**. Body:
  - Italic standfirst.
  - Mono tags: `60 MIN`, `ONLINE`, and dashed `SLIDING $50–90`.
  - Description.
  - "Pick a time" label and three radio slots. Each slot has background `#1b1e20` and a 1.5px border that turns bronze when selected, with a 12px radio dot.
  - "PAY WHAT YOU CAN" with the amount, and a range input from 50 to 90, step 5, `accent-color:#c8a45b`.
  - Host row, which opens `pf-owner`: 26px avatar, name, and `● REPLIES WITHIN A DAY` in sage `#8da882`.
- `evt-offer`: EVENT / Event title / "23 coming · 40 spaces" / **I'm coming**. Body:
  - Poster at 120px tall.
  - Date block: day "14" in heading font, `calc(32px*var(--fhx))`, bronze, next to `SAT · DEC / 8:00 PM`, with the venue and street on the right behind a left rule.
  - Description.
  - Running order rows (46px time column, 1px dotted dividers `#3d4246`).
  - Avatar stack (24px, −7px overlap, 2px `#24282a` ring) with "23 coming".
  - Head button: Share, or `⤢ Its page` when `ctx.featured`.
- `evt-rsvp`: RSVP / Are you coming? / "Free · no account needed" / **Yes, I'm coming**. Body:
  - Capacity line.
  - Name and email fields: background `#1b1e20`, border `#5a6064` that turns bronze on focus.
  - Reminder checkbox, checked.
  - "or sign in" link.
  - Dashed note: a priced event reads "Get a place · $20" and pushes Pay.
- `wr-read`: WRITING / piece title / "4 min · 12 replies" / **Open the talk**, with quiet **Next ›**. Body:
  - Series kicker in bronze.
  - Italic standfirst.
  - Author row; the author name opens `pf-owner`.
  - Body text with a bronze drop cap at `calc(46px*var(--fhx))`.
  - Picture.
  - Pull quote, italic 19px.
  - "In this series" index rows; the current one is bronze.
- `talk`: TALK / Talk · 8 / "Anyone can read" / **Post**. Body:
  - Comments with a 24px avatar, name, mono time and text. A comment can carry a photo.
  - Host comments get a bronze avatar ring and a `· HOST ·` tag.
  - Composer: text input plus a Photo button.
  - Names open `pf-member`; the host opens `pf-owner`.
- `share`: SHARE / Share this / – / **Copy link** → **✓ Copied**. Body:
  - Link field (mono 11px), e.g. `site.org/profile/host-name?surface=event`.
  - Email, Message and Embed buttons in a 3-column grid.
  - Explainer text.
- `ser-offer`: SERIES / Series name / "Weekly · Mondays · free" / **Subscribe**. Body:
  - Italic line.
  - Description.
  - WHEN / TIME / WHERE strip: 3 columns with ruled top, bottom and dividers.
  - "Hosted by Host Name and Another host"; each name is a link to `pf-owner` or `pf-guest`.
  - Next session card, which pushes `ser-session`.
  - "▸ EARLIER SESSIONS (6)".
- `ser-sub`: SUBSCRIBE / Subscribe to the series? / "One email per session" / **Subscribe**. Body: explainer text and an email field.
- `ser-session`: SESSION 7 / Session title / "Mon 14 Dec · 6 pm PT" / **I'm coming** (pushes `evt-rsvp`). Body: date block, host (opens `pf-owner`), description and an attachment row.
- `art-offer`: ARTWORK / Title of the work / "1 of 1 · ships in 5 days" / **Order · $420**. Body:
  - The work at 180px tall.
  - Three thumbnails, each 44px tall; the selected one has a bronze border.
  - MEDIUM / SIZE / EDITION rows with an 80px label column and dashed dividers.
  - Artist note.
- `art-order`: ORDER / Delivery / "Total $435" / **Continue to pay**. Body:
  - Shipping radios: "Ship to me · 5 days" ($15) or "Collect from the studio" (free).
  - Address field, shown only for shipping.
  - Totals.
- `pay`: PAY / Confirm and pay / "Secure · Stripe" / **Pay $X**. Body:
  - Summary card (For / Detail / Total).
  - "Paying as Your name · CHANGE".
  - A Stripe card element placeholder.
  - Note: "Card details go to Stripe, not this site."
- `done`: DONE / per flow / – / **Done** (closes). Body:
  - 46px sage `#8da882` check disc with a pop-in animation.
  - Confirmation line and note.
  - Optionally a link to the talk.
  - Quiet button `Add to calendar` for service and event.
- `pf-owner`: PROFILE / Host Name / "312 following" / **Follow**. Body:
  - Portrait at 150px tall.
  - Role, terracotta `#ce8b62` in kicker style.
  - Bio.
  - Link chips (Site, Instagram, Email).
  - "Offered here" rows, each pushing that offer: a 30px kind box, the title, and mono meta. The first row is bronze `ON NOW …` and pushes the featured event with `featured:true`.
  - "Writing" rows.
  - After following, the foot reads **✓ Following**; clicking it unfollows.
  - The head mark is a 36px round portrait (bronze border) in box and thumb modes.
- `pf-guest`: CO-HOST / Another host / "88 following" / **Follow**, with head button `⤢ Their site`. Body:
  - Portrait, role, bio and links.
  - "Here": the series card, which pushes `ser-offer`.
  - "On their site": a dashed card with ↗, which opens their own site.
  - Note.
- `pf-member`: MEMBER / Name / "8 replies on this site" / **Reply in the talk** (pops back). Body:
  - Role line.
  - "Their replies here": a quote and a mono "ON … · 2H" line for each.
  - Note that members have no page. There is no portrait.
- `follow`: FOLLOW / Follow Host Name / "By email · unfollow any time" / **Follow**. Body:
  - 42px avatar, name and role.
  - "New offers and writing from {name}, by email. At most one a week."
  - Email field.
  - "or sign in" link.
  - Pushes `done` with flow `fol`, which reads "You're following".

**Flows (storyboards 3c–3g, 4d–4h, 5e)**
- Service: `svc-offer → pay → done`
- Event: `evt-offer → evt-rsvp → done` (or `→ share`)
- Writing: `wr-read ↔ wr-read` (replace) `→ talk`
- Series: `ser-offer → ser-sub → done`, or `ser-offer → ser-session → evt-rsvp`
- Artwork: `art-offer → art-order → pay → done`
- Profile: `pf-owner → follow → done`, then back to the profile showing ✓ Following

### B. Profile page with a featured offer (3a desktop, 4b phone)
- Desktop page, 800px:
  - Top bar: site name in heading font at 17px, plus `Profile` (active: bone border with inset bronze underline) and `+ Follow` (bronze outline).
  - Header: grid `112px | 1fr | auto`. A 112px photo; the name at `calc(32px*var(--fhx))`; a terracotta role; a bio with max-width 420.
  - Follow button: the bronze fill sweeps in from the left (`background-size` from 0% to 100%, .45s `cubic-bezier(.6,0,.2,1)`). Underneath it, "312 FOLLOWING" in mono and the links.
- **On now**: the featured offer card. Grid `230px | 1fr`, border `#5a6064` with a 2px bronze top border, background `#202326`. It has a pulsing live dot, mono date, the title at `calc(28px*var(--fhx))`, and the buttons **I'm coming** (opens the surface here) and `Go to its page →`.
- **Also offered**: 3-column cards with a 2px bronze top border, a 30px kind box, a mono kind label, the title and meta. A `+` circle sits at the top right. Hover: `translateY(-4px)`, bronze border, shadow `0 14px 24px -14px rgba(0,0,0,.8)`, 0.22s `cubic-bezier(.3,1.4,.5,1)`.
- **Writing shelf**: one lead piece (cover, kicker, title, standfirst) beside a list. "All writing (8) →".
- Popup: centred, 440px wide, over a `rgba(10,11,12,.66)` scrim. When the stack is open, the browser bar shows `?surface=…`.
- Phone (320px frame): the same content as a single column, with offers as full-width list rows. Sheets rise from the bottom (`translateY(100%)→0`, .42s `cubic-bezier(.2,.9,.25,1)`) over a `rgba(10,11,12,.6)` scrim.

### C. Writing page with a docked stage (3b desktop, 4c phone)
The surface is docked into the page (`docked=true`), with `‹ ›` to move between pieces and a strip of piece cards below it; the selected card has a 2px bronze border. "Open the talk" pushes onto the stage. On phone the stage fills the screen and the strip is a sideways-scrolling shelf (128px cards) above the home bar.

### D. Profile card (5d), desktop hover only
- 270px wide, background `#24282a`, border `1px solid #5a6064` with a 2px bronze top border, shadow `0 22px 40px -16px rgba(0,0,0,.85)`, padding `13px 13px 12px`, gap 10.
- Caret: a 6px bronze triangle above the card, 38px from the left.
- Contents:
  - 44px round portrait with a bronze border.
  - Name at `calc(18px*var(--fhx))` and a terracotta role.
  - One line of bio.
  - A context line above a rule, in mono 8.5px: "◆ ON NOW · EVENT TITLE · SAT 14 DEC", "◎ CO-HOSTS · ANOTHERHOST.ORG ↗" or "8 REPLIES ON THIS SITE".
  - Actions: `+ Follow` (bronze outline, becomes filled `✓ Following`) and `Profile →`. Members get `Profile →` only.
- It opens after a short pause on a name and closes when the pointer leaves both the name and the card. There is no ✕ and no primary. On phone there is no card: a tap opens the profile sheet directly.

## Interactions & behaviour
- Push animation: `dcPush`, from `opacity:0; translateX(22px)` to rest, .3s `cubic-bezier(.2,.9,.25,1)`.
- Done check: `dcPop`, scale .4 → 1.08 → 1, .5s `cubic-bezier(.3,1.5,.5,1)`.
- The scrim fades over .3s. Clicking it closes the stack. Esc pops one layer.
- Radio slots and shipping options: the border and dot turn bronze, .2s.
- Inputs: on focus, the border turns `#c8a45b`, with no outline.
- Name links in surfaces: underline `#5a6064` with offset 3px. On hover the text and underline turn bronze.
- Writing `Next ›` uses `onReplace`, so the stack depth stays the same.
- Unfollow: clicking **✓ Following** on a profile foot toggles it back off.

## State
- `stack: string[]` holds layer ids. It is mirrored to `?surface=a/b/c`.
- `ctx` is shared by the layers in one stack:
  - `slot` (0–2), `pay` (50–90), `piece` (0–2), `ship` (`ship | collect`)
  - `flow` (`svc | evt | ser | art | fol`), which pay and done read
  - `featured` (bool), `shareSlug`
  - `fwho` (`owner | guest | member`)
  - `f_owner` and `f_guest` (followed flags)
- Per-surface UI state: `copied`, `big` (Aa) and `followed` (talk).
- Site-level settings: font template, icon set, phone head mark and kind colour on or off.
- Data needed: the site owner's profile, the featured offer, other offers with type-specific fields, pieces with series and index, talk threads, follower counts, and open slots. Payment goes through Stripe and returns to the pay layer.

## Design tokens
**Colours**
- Page `#1b1e20`, canvas `#121416`, surface `#24282a`, deep panel or foot `#1f2225`, card `#202326`, inputs `#1b1e20`
- Lines: strong `#5a6064`, mid `#4a5054`, soft `#373c3f`, dotted `#3d4246`, faint `#2c3033`
- Ink: bone `#e9e5dd`, body `#d6d1c7`, secondary `#c9c4ba`, muted `#a3a09a`, faint `#8f8c86`, placeholder `#6f6c67`
- Bronze accent `#c8a45b`, terracotta (roles) `#ce8b62`, sage (success) `#8da882`
- Kind colours (when tint is on):
  - event `#ce8b62`
  - service `#8da882`
  - series `#8ea7c2`
  - artwork `#c48fa6`
  - writing `#c8a45b`
  - talk `#7fafa8`
  - profile `#d9cfbf`
  - share and follow `#c8a45b`
  - done `#8da882`

  The tint covers the icon, the box (border at .38 alpha, fill at .12 alpha) and the 2px rule under the head. **The primary button always stays bronze.**
- Image placeholder: `repeating-linear-gradient(135deg,#202427 0 7px,#262b2e 7px 8px)`

**Radii:** 0 everywhere (square). The only exceptions are avatars and radio dots, which are round.

**Shadows**
- Popup: `0 30px 60px -24px rgba(0,0,0,.85)`
- Sheet: `0 -18px 40px -10px rgba(0,0,0,.7)`
- Card hover: `0 14px 24px -14px rgba(0,0,0,.8)`

**Type.** Mono is always JetBrains Mono, at 8.5–9.5px with letter-spacing .04–.14em. Everything else comes from six **font templates**, switched site-wide through CSS variables:
- `--fh`, `--fhw`, `--fhi`, `--fht`, `--fhl`: heading family, weight, italic, transform and tracking
- `--fhx`: heading size multiplier; sizes are written as `calc(Npx * var(--fhx))`
- `--fb`: body
- `--fq`, `--fqi`: quote family and italic
- `--fu`, `--fuw`, `--fut`, `--ful`: utility, used for buttons
- `--fk`, `--fkl`: kicker

| Template | Heading | Body | Utility / kicker | fhx |
|---|---|---|---|---|
| Para (house) | Fraunces 600 | Spectral | Spectral 600 uppercase .14em / .18em | 1 |
| Gazette | Libre Caslon Display 400 | Libre Caslon Text | IBM Plex Sans Condensed 600 uppercase .1em / .14em | 1.1 |
| Quiet | Instrument Sans 500, −.025em | Instrument Sans | Instrument Sans 600, no transform / .08em | .95 |
| Marquee | Big Shoulders Display 800 uppercase | Archivo | Archivo 700 uppercase .08em / .14em | 1.3 |
| Ledger | Newsreader 500 | IBM Plex Sans | IBM Plex Mono 500 uppercase .06em / .1em | 1.02 |
| Rite | Cormorant Garamond 500 italic | EB Garamond | Marcellus 400 uppercase .16em / .2em | 1.22 |

Quotes use each template's italic serif (Fraunces, Libre Caslon Text, Instrument Serif, Archivo, Newsreader or Cormorant). The exact variable values are in the `<helmet>` block of `Flyer Pages Wireframes.dc.html` (`[data-ft="…"]` rules).

Body sizes: 13px (popup body), 12.5px (rows and inputs), 13.5px or 15.5px (reading). Buttons: utility font at 10–11px.

## Assets: icons (`Surface Icon.dc.html`)
One icon per kind: `evt, svc, ser, art, wr, talk, pf, share, fol, done`.
- Drawn on a 20-unit grid and rendered with `viewBox="1.25 1.25 17.5 17.5"`, which makes them about 14% larger than the grid.
- Colour is `currentColor`.
- Stroke 1.5 for Things and Marks, 2 for Stamps. Miter joins, butt caps.
- `circle(cx,cy,r)` below means a circle subpath.

There are four sets. **Things** is the current default.
- **Things** (line objects):
  - evt, a ticket with a perforation: `M3 5.5H17V8.5A1.5 1.5 0 0 0 17 11.5V14.5H3V11.5A1.5 1.5 0 0 0 3 8.5Z M12.5 7.5v1M12.5 9.5v1M12.5 11.5v1`
  - svc, a clock: `circle(10,10,6.75) M10 6v4.25l2.75 2`
  - wr, a nib: `M10 2.75 14.75 8.25 12.25 15.25H7.75L5.25 8.25Z M10 2.75V8.75 M7 17.75h6`, plus a filled `circle(10,10.25,1.1)`
  - talk, two bubbles: `M7.25 6.5V3.25h9.5v7h-2.5 M3.25 6.5h10v7.25H8.25l-3 2.5v-2.5h-2Z`
  - ser, a stack: `M3.25 8.25h9.5v8.5h-9.5Z M5.75 8.25V5.75h9.5v8.5h-2.5 M8.25 5.75V3.25h9.5v8.5h-2.5`
  - art, an easel: `M4.25 3.25h11.5v8.5H4.25Z M7.5 11.75 5.5 17.25 M12.5 11.75l2 5.5 M10 11.75v3.5 M6.75 9.25 9 7l1.5 1.5 2.75-2.75`
  - pf, a bust: `circle(10,6.75,3.25) M3.75 17.25c0-3.6 2.8-6 6.25-6s6.25 2.4 6.25 6`
  - share: `M8.25 4.25h-4v11.5h11.5v-4 M11 3.25h5.75V9 M16.75 3.25 9.25 10.75`
  - fol, a bell: `M5.25 13.75V9a4.75 4.75 0 0 1 9.5 0v4.75l1.5 1.5H3.75Z M8.25 17.75h3.5`
  - done: `M4.25 10.25 8.25 14.25 15.75 6`
- **Marks** (typographic): a point on a line, two overlapping circles, a pilcrow, quote marks, three dots (the next one open), a square in a square, a dot-and-arc person, ↗, +, ✓.
- **Stamps** (solid): a stage curtain, a calendar with a booked slot, an open book, a solid bubble, a loop, a palette, a solid bust, a paper plane, a solid bell, and a check disc.
- **Current** (legacy text glyphs): ◆ ◇ ◎ ▣ ◉ ☰ ● ↗ + ✓.

The full path data for every set is in the `build()` method of `Surface Icon.dc.html`.

Transaction layers show the icon of the offer they belong to: pay uses its flow's icon, and RSVP uses the event icon.

**Images:** none are final. Every poster, portrait, cover, work and thumbnail is a placeholder slot. Fonts are Google Fonts, linked in the helmet of each file.

## Files
- `Flyer Pages Wireframes.dc.html`: the main canvas, with all rounds. Its interactive controls are the font templates (2a–2f), the icon set columns (6a), and the phone head and kind colour switches (round 7).
  - Round 7: phone heads.
  - Round 6: icons.
  - Round 5: profiles.
  - Round 4: phone sheets and head rules.
  - Round 3: the surface system and storyboards.
  - Round 2: font templates, writing formats and live pages.
  - Round 1: sketches.
- `Offer Surface.dc.html`: the surface component, covering every layer and both shells. **This is the main implementation reference.**
- `Surface Icon.dc.html`: icon sets and kinds.
- `support.js`: the runtime needed to open the `.dc.html` files in a browser. It is not part of the design.

## Open items (not yet designed)
- An enquire-first service variant, where you enquire before seeing a time and price.
- Sheets snapping between half and full height.
- What a follower sees in their Center.
