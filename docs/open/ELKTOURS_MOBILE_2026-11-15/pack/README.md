# Handoff: Elkdonis Experiences mobile (apps/elktours)

## Overview
A mobile design for `apps/elktours` in `GuruDharamSingh/eac-repo`. It has two sides that share one data set:

- **Guests** browse Paris as a city guide, book tour dates, read about experiences hosted by local artists, browse a places catalogue, read the guides' feed and use a forum.
- **Guides, artists and the office** work from a shared board: schedule and slots, below-minimum decisions, experiences on tour stops, tour page media, places, feed posts and review queues.

This bundle is the reference for rebuilding those screens in the real app and wiring them to the platform.

## About the design files
The files here are **design references built in HTML**. They are prototypes that show the intended look and behaviour. They are not production code and should not be shipped or copied in as-is.

The task is to **recreate these designs inside `apps/elktours`** using what the repo already has: its Next.js app router, `@elkdonis/cms-ui`, `@elkdonis/forum-ui`, `@elkdonis/primitives`, `@elkdonis/commerce`, and the tokens in `apps/elktours/src/app/globals.css`. Where the repo already has a working component for something (booking form, route preview, forum, asset panel), restyle and re-lay it out for mobile rather than writing a parallel one.

## Fidelity
**High fidelity** for layout, colour, type, spacing, component shapes and interactions. Recreate these closely.

**Placeholders**, not to be copied:
- Photos are striped boxes labelled `photo · …`. Real images come from each tour, place, artist and experience.
- The fly-over film and the live 3D map are CSS stand-ins. The real ones are the film asset and `RoutePreview` already in the repo.
- All names, prices, dates, places, feed posts and forum topics are seed data.
- Copy written by the designer and awaiting the owner's wording: the About page, the intro lines on Discover and Tours, the stop notes.

## How to open the prototype
Serve this folder over http and open `Elkdonis Experiences.dc.html`. It is a pan-and-zoom canvas of about 55 live phones, grouped by turn (newest first) and labelled `1a`…`6e`. Every phone is `Elkdonis App.dc.html` mounted with different props, and all phones share one in-memory store, so an action on one phone shows on the others.

`Elkdonis App.dc.html` is the whole app in one file:
- **Template**: inline-styled HTML with `{{ value }}` holes, `<sc-if>` and `<sc-for>`. Each screen is one `<sc-if value="{{ is.NAME }}">` block. All exact sizes, colours and radii are in the inline styles.
- **Logic**: `class Component` at the bottom. Seed data constants come first, then `renderVals()` computes every value the template reads.
- `support.js` is the prototype runtime. Ignore it.

Screen line numbers in `Elkdonis App.dc.html` are given in the two screen documents.

## Documents in this bundle
- `README.md` — this file: tokens, shell, build order, open questions.
- `screens-guest.md` — every guest screen: layout, components, copy, behaviour.
- `screens-board.md` — every guide, artist and office screen.
- `data-and-state.md` — entities, how they map to the repo, state, rules, what is new.
- `screens/` — **one HTML file per screen** (list below).
- `github.md` — which repo files each screen was drawn from.

## Per-screen HTML
`screens/` holds the markup of each screen as its own file, cut from `Elkdonis App.dc.html`. Read these for exact structure and inline styles. They are source, not rendered pages: dynamic values appear as `{{ name }}`, `<sc-if>` is a conditional and `<sc-for>` a loop. Opened in a browser they show the layout with those placeholders unfilled; for real content use the live prototype.

| File | Side | Lines in Elkdonis App.dc.html |
|---|---|---|
| `screens/01-discover.html` | guest | 23–141 |
| `screens/02-tours.html` | guest | 143–179 |
| `screens/03-tour-detail.html` | guest | 181–306 |
| `screens/04-date-time.html` | guest | 308–356 |
| `screens/05-booking-payment.html` | guest | 358–428 |
| `screens/06-experiences.html` | guest | 1036–1061 |
| `screens/07-experience.html` | guest | 733–778 |
| `screens/08-artist-profile.html` | guest | 780–812 |
| `screens/09-guide-profile.html` | guest | 1091–1119 |
| `screens/10-local-artists.html` | guest | 1188–1198 |
| `screens/11-about.html` | guest | 1169–1186 |
| `screens/12-places.html` | guest | 1063–1089 |
| `screens/13-place-sheet.html` | guest | 1354–1376 |
| `screens/14-suggest.html` | guest | 1121–1135 |
| `screens/15-feed.html` | guest | 1276–1285 |
| `screens/16-post-preview-sheet.html` | guest | 1378–1392 |
| `screens/17-web-view-sheet.html` | guest | 1394–1399 |
| `screens/18-forum.html` | guest | 1200–1222 |
| `screens/19-forum-section.html` | guest | 1224–1236 |
| `screens/20-topic.html` | guest | 1238–1256 |
| `screens/21-start-a-topic.html` | guest | 1258–1274 |
| `screens/22-city-sheet.html` | guest | 1333–1352 |
| `screens/23-guest-nav.html` | guest | 1319–1323 |
| `screens/30-board.html` | board | 814–923 |
| `screens/31-schedule.html` | board | 430–490 |
| `screens/32-new-slots.html` | board | 524–660 |
| `screens/33-slot.html` | board | 662–731 |
| `screens/34-decisions.html` | board | 492–522 |
| `screens/35-artist-signup-wizard.html` | board | 925–990 |
| `screens/36-collaborate.html` | board | 992–1034 |
| `screens/37-tour-page-media.html` | board | 1287–1317 |
| `screens/38-place-edit.html` | board | 1152–1167 |
| `screens/39-share-post.html` | board | 1137–1150 |
| `screens/40-board-nav.html` | board | 1325–1331 |
| `screens/41-toast.html` | guest | 1401–1403 |

## Shell
- Design size is a **390 × 844** screen. Content scrolls vertically inside it; top padding 58–62px clears the status bar.
- **Bottom nav (guest)**: floating bar, left/right 18px, bottom 24px, height 66px, padding 6px, radius 33px, background `rgba(27,30,35,.9)` with 14px backdrop blur, 1px border `rgba(241,236,226,.12)`. Three equal buttons: **Discover | Tours | Experiences**. Label: Venture 12px, letter-spacing .16em, uppercase. Active: brass fill `#c9a25c`, ink text `#1b1e23`. Shown only on those three root screens.
- **Bottom nav (board)**: same bar. **Board** (with a count badge) | a 40px brass diamond **+** | **Schedule** (guides, office) or **My page** (artists).
- **Back button**: 44px circle, 1px border `rgba(241,236,226,.16)`, background `rgba(241,236,226,.04)`, `←`.
- **Bottom sheets**: slide up over a `rgba(10,11,13,.55)` scrim; radius 30px 30px 0 0, background `#2f3339`, 1px brass top border, 40×4px grab bar. Tap the scrim to close.
- **Toast**: ivory pill at top, 2.6s.
- **Primary button**: 56px high, brass fill, ink text, Basteleur 700 16px, cut corners: `clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px)`. Disabled: `#565b63` fill, `#a19d96` text.
- **Chip**: 34–38px high pill, 1px border `rgba(241,236,226,.2)`, Basteleur 13–14px. Selected: brass fill, ink text.
- **Section header**: Venture 11px .2em uppercase brass label, then a 1px rule fading from `rgba(201,162,92,.6)` to transparent.

## Design tokens
**Colour**
| Token | Value | Use |
|---|---|---|
| Screen | `linear-gradient(180deg,#25282e 0%,#2b2f36 55%,#282b31 100%)` | App background |
| Card | `#31353c` | Rows, cards, inputs |
| Card raised | `#343941` | Featured card, city pill |
| Sheet | `#2f3339` | Sheets, feed/forum panels |
| Well | `#3d424a` | Avatars, thumbs |
| Ink | `#1b1e23` | Text on brass |
| Ivory | `#f1ece2` | Primary text |
| Ivory soft | `#e6e0d4` | Body copy |
| Muted | `#b9b2a5` | Secondary text |
| Faint | `#8f8a82` | Meta, timestamps |
| Brass | `#c9a25c` | Tours, primary actions, rules |
| Brass light | `#dcc08a` | Links, prices, numerals |
| Verdigris | `#86b9ab` | Experiences and artists only |
| Vermilion | `#e8805c` | Below minimum, destructive |
| Hairline | `rgba(241,236,226,.08)` / `.12` / `.16` / `.2` | Borders by weight |
| Brass border | `rgba(201,162,92,.4–.5)` + outline `rgba(201,162,92,.14–.18)` offset 4px | Double gold frame |

These match the "zinc and brass" theme in `globals.css`; map to the existing CSS variables rather than hard-coding.

**Type** (fonts are in `fonts/`, the same files as `apps/elktours/public/fonts`)
| Role | Font | Size / line-height |
|---|---|---|
| Display | Brothers 400 | 46 / 1 (Discover), 40–42 / 1 (page titles), 36–38 (forms), 28–32 (sheets) |
| Card title | Basteleur 700 | 15.5–17 / 1.2–1.25; featured 23 / 1.1 |
| Body | Basteleur 400 | 14–16 / 1.5–1.6 |
| Kicker | Venture | 10–11, letter-spacing .14–.24em, uppercase |
| Meta | ui-monospace | 11–11.5 (forum counts, times) |
| Drop cap | Basteleur 700 | 60 / .82, floated left |

**Shape**
- Tours and places use **arched frames**: top radius = half the width, bottom 8–26px. Hero 358 × 330 → `179px 179px 26px 26px`.
- Experiences and artists use **round portholes** (`50%`).
- Cards 20–24px, sheets 30px, inputs 16px, pills = half height.
- Numerals for stops, steps and gallery counters are **Roman**.

**Motion**
- Screen enter: opacity 0→1 and translateY 8px→0, .32s ease.
- Sheet: translateY 100%→0, .28s `cubic-bezier(.2,.8,.2,1)`; scrim fade .2s.
- Inline expand (stops, guides): fade .25s.
- 3D map camera: transform 2.2s `cubic-bezier(.45,.05,.2,1)`; auto-advance every 2.6s.

## Suggested build order
1. Tokens, fonts, shell (navs, sheets, toast, buttons, chips, section headers).
2. Guest booking path: Discover → Tours → Tour detail (hero media) → Dates → Pay.
3. Experiences tab, experience page, artist profile, Local Artists, About.
4. Places: catalogue, place sheet, tags, favourites, guide edit page.
5. Feed and forum.
6. Board: schedule, slots, decisions, collaborate, tour page media, share a post, review queues.

## Open questions for the owner
- **Mobile web or native?** The design is drawn as a phone app. It is assumed to be the mobile layout of `apps/elktours`; confirm before building.
- **Money for artists.** Invitations show a fee; payouts are not designed.
- **Standalone experiences** are enquiry-only. Should they ever have their own dates?
- **Business profile** for a place is a "coming soon" note only.
- **Blocked link previews.** Many sites refuse to load inside another page. Decide the fallback (open in browser, or a server-rendered preview card).
- **3f Tour page media** is reachable only from the canvas; it needs an entry point from the guide's tour.
- **Forum identity**: pen names, pinned topics and reply-to-reply are not designed.

## Assets
- Fonts: `fonts/Basteleur-Moonlight.woff2`, `fonts/Basteleur-Bold.woff2`, `fonts/BrothersTypeface-Regular.otf`, `fonts/Venture-nRqOR.otf`.
- No icons library. Glyphs used: `← → › ↗ ↳ ♡ ♥ ★ ☆ ☰ ✎ ▶ ❚❚ ✕ ×`, and forum kind glyphs `◉ ✦ ◆` from `packages/cms-ui/src/surface/kinds.ts`.
- No images.
