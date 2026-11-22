# elktours mobile: design breakdown (Gee, 2026-11-15)

Sources: `pack/` (README, screens-guest.md, screens-board.md, screens/*.html), my notes `notes/guest-map.md` and `notes/shell-editing-board.md`, and Jay's `backend-map.md`, which is the contract.

## Justin's decisions (2026-11-15)
1. **Mobile layout, desktop kept.** Below `md` (768px) the new design applies. At `md` and above, today's pages are unchanged. URLs stay the same.
2. **Copy and look stay editable on guest pages.** Root and list pages are Puck pages built from new mobile blocks. Tour and experience pages are record templates with editable labels. Colour and type come from Site style tokens. Board and manage screens are tool UI and are not editable.

## How the two layouts live together
- Each guest `page.tsx` fetches its data once, then draws `<div className="elk-m md:hidden">` (the mobile tree) beside `<div className="hidden md:block">` (today's tree, untouched). This is CSS-only, so it is safe with caching and resizing. **Heavy media must not load twice:** mobile film, video and map components mount only when `matchMedia('(max-width: 767px)')` matches (`useIsMobile()` in `components/mobile/use-is-mobile.ts`). Desktop gets the mirror guard where needed.
- `app/layout.tsx` gains `<MobileShell>`, which is `md:hidden`. It holds the bottom nav, the sheet host and the toast position. `SiteHeader` and `SiteFooter` get `hidden md:block` on guest routes. The fixed editor buttons (EditPageButton, SiteStyleButton, TourEditBar) sit above the nav using `bottom: calc(var(--shell-nav-h) + 12px)` below md.
- The mobile Puck documents are **separate docs** from the desktop ones, so editing one layout never breaks the other: `puck:m-discover`, `puck:m-tours`, `puck:m-experiences`, `puck:m-about`, `puck:m-places`, `puck:m-people`, `puck:m-feed`, `puck:m-tour-detail` and `puck:m-experience-detail`. Each has a code default (the design as drawn) until someone saves it. They are edited at `/studio/m-<name>` in a phone-width (390) canvas.

## Tokens (additions to `apps/elktours/src/app/globals.css`, read through Site style)
Existing variables cover ivory, brass, card, ink, muted, terracotta and brass-light. New ones below are **derived** where possible so Site style edits flow through:
| New var | Value | In SITE_STYLE schema? |
|---|---|---|
| `--verdigris` | `#86b9ab` → `160 26% 63%` | yes (independent hue) |
| `--foreground-soft` | `#e6e0d4` | derived from foreground |
| `--faint` | `#8f8a82` | derived |
| `--m-screen` | the 3-stop zinc gradient | yes (like `--eac-block-band`) |
| `--m-card` `--m-card-raised` `--m-sheet` `--m-well` | `#31353c` / `#343941` / `#2f3339` / `#3d424a` | card yes; the rest derived |
| `--hair-1..4` | `hsl(var(--foreground)/.08 .12 .16 .2)` | derived |
| `--brass-line`, `--brass-halo` | primary at .45 / .16 | derived |
| `--scrim` | `rgba(10,11,13,.55)` | no |
| `--radius-card` `--radius-sheet` `--radius-input` | 22px / 30px / 16px | yes (length) |
| `--site-font-kicker` | Venture | yes (new font slot) |
| `--m-ease-sheet`, `--m-dur-screen` | `cubic-bezier(.2,.8,.2,1)`, .32s | no |
Utility classes in `components/mobile/mobile.css`: `.m-arch` (top radius 50% of width via `--arch-w`, bottom `--arch-b`), `.m-porthole`, `.m-frame-brass` (double gold frame), `.m-cut` (cut-corner clip-path), `.m-kicker`, `.m-rule`, `.m-dropcap`, `.m-enter`.

## Shell primitives — `apps/elktours/src/components/mobile/` (class c, plain React, token-styled)
| Component | Props (short) | Notes |
|---|---|---|
| `MobileShell` | `{ nav: "guest"\|"board"\|null, badge?, children }` | in layout; holds SheetHost |
| `GuestTabBar` | `{ active: "discover"\|"tours"\|"experiences" }` | `data-chrome="nav"`, parts `bar item active badge`; only on the 3 roots |
| `BoardTabBar` | `{ role, count }` | Board · ◆+ · Schedule/My page (phase 6) |
| `BackButton` | `{ href? }` | history back, else href |
| `Sheet` | `{ open, onOpenChange, tall?, title, children }` | radix Dialog, slide-up, grab bar, scrim tap closes |
| `PrimaryButton` | `{ children, disabled?, href?, onClick? }` | 56px, cut corners |
| `Chip`, `ChipRow` | `{ selected, onClick }` | |
| `SectionHeader` | `{ label, more?: {label, href} }` | kicker + fading rule |
| `ArchFrame` | `{ w, h, bottom, brass?, src?, alt, children }` | tours/places |
| `Porthole` | `{ size, src?, verdigris?, initial? }` | experiences/artists |
| `CatalogueRow` | `{ thumb, kicker, title, meta, href\|onClick }` | places, feed, forum link rows |
| `StopTimeline` | `{ stops[], openIndex, onToggle }` | Roman numerals, inline expand |
| `FactsStrip` / `FactsGrid` | `{ items: {label, value}[] }` | 4-col / 2×2 |
| `roman(n)` | util | |
| Toast | sonner restyled (top-centre ivory pill, 2.6s) | via `<Toaster>` props + CSS |

## Mobile blocks — `apps/elktours/src/blocks/mobile/` (class a, `defineBlock`, `parts`, `styling:"tokens"`)
Pattern to copy: `packages/blocks/src/blocks/hero-banner.tsx`. Own labels are `inlineEditable` props with a `prop:` part; data words stay locked. Record-bound blocks use resolvers (`lib/puck/config.server.ts`) and strip on save (RESOLVED_KEYS). Registered in a new `MOBILE_BLOCKS` list beside `PAGE_BLOCKS` in `lib/puck/catalogue.ts`, so they appear only in `m-*` docs.

| Block id | Screen(s) | Editable props (owner's words) | Data (resolver → Jay contract) |
|---|---|---|---|
| `m-masthead` | 01 | wordmark lines, issue label | city (static Paris v1) → opens City sheet |
| `m-page-title` | 01,02,06,11,12,15 | kicker, title, intro, readMoreLabel, readMoreHref | counts ("N tours") optional |
| `m-search-row` | 01,02 | placeholder | → /tours?q focus |
| `m-featured-tour` | 01 | sectionLabel; `binds` tour (default: pinned/next) | tour + next departure + seatsLeft |
| `m-places-shelf` | 01 | sectionLabel, moreLabel | favourite places (`listPublicPlaces` favourites) |
| `m-experiences-panel` | 01 | label, heading, line | public experiences (upcoming) |
| `m-guides` | 01 | sectionLabel, moreLabel | guides + their next tours |
| `m-link-rows` | 01 | each row's kicker/title/line (Feed, Catalogue, Forum) | feed newest post, place count, forum unread |
| `m-tour-list` | 02 | chip labels, emptyText | `listTours` + next dates |
| `m-experience-list` | 06 | — | experiences |
| `m-artists-row` | 06,12 | sectionLabel, moreLabel | `listPeople({kind:"artist"})` |
| `m-suggest-pill` | 06,12,22 | label | → /suggest |
| `m-prose-sections` | 11 | drop-cap paragraph, three ruled sections (rows) | — |
| `m-people-grid` / `m-people-slider` | 10,11 | chip labels | `listPeople` |
| `m-places-catalogue` | 12 | chip labels "All/Favourites", favouriteText | places + tag order |
| `m-feed-list` | 15 | — | feed threads |
| **Tour template** `m-tour-hero`, `m-tour-head`, `m-tour-blurb`, `m-tour-route`, `m-tour-dates`, `m-tour-bookbar` | 03 | labels: "The route", hint line, "Meet at", "Next dates", "per person", CTA label, hero pill labels | tour record, `publicTourAssets()` + `metadata.heroLead`, stops, `listTourSlots` |
| **Experience template** `m-exp-hero`, `m-exp-facts`, `m-exp-body`, `m-exp-tours`, `m-exp-dates`, `m-exp-private` | 07 | section labels, CTA "Ask about a private visit" | experience record, accepted dates |

## Code screens (class c, not in Puck): fixed copy v1, rule text from settings
| Screen | Route (mobile tree) | Built from |
|---|---|---|
| 04 Date & time | `/tours/[slug]/dates` (new route, mobile-first; desktop keeps the BookingForm on the tour page) | `listTourSlots`, `bookingRuleText` |
| 05 Pay + success | `/tours/[slug]/book` | `quoteBooking`, `bookTourAction` → Stripe redirect; success on `/bookings/[token]` restyled |
| 08 Artist profile / 09 Guide profile | `/people/[slug]` (new) | profile reads; ArtDirect link out |
| 13 Place sheet | surface `place-sheet` in HubSurfaces | `getPublicPlace` |
| 14 Suggest | `/suggest` (new) | `visitor_suggestions` |
| 16 Post preview / 17 Web view | surfaces `post`, `webview` | feed thread + replies; `/api/link-preview` unfurl card + Open in browser |
| 18–21 Forum | existing `/forum/[[...segments]]` | `@elkdonis/forum-ui`, restyled by a mobile CSS scope; compose/visibility per Jay |
| 22 City sheet | surface `city` | static v1 |
| 30–41 Board | `/manage/*` mobile trees (phase 6) | Jay's board contract |

## Settings the house editor reaches
`elktours:settings` (Jay's `getSiteSettings`/`saveSiteSettings`): belowMinimumRule, holdGuidePosts and so on. These appear as **root fields** in the `m-*` Studio (root settings panel) and also on a small `/manage/settings` form. Either one writes the same key.

## Copy storage decision (answers Jay)
Copy lives as **Puck block props** in the `m-*` docs. `org_site_sections` stays for desktop only. Nothing new is needed from the backend for copy.

## Build plan (Gee lane)
- **G1 (now): tokens, fonts, shell primitives.** Worker A. Files: globals.css (additions only), `components/mobile/*`, `layout.tsx` (MobileShell mount + header/footer md split), the sonner restyle, the site-style-schema additions.
- **G2 (now, parallel): Puck plumbing for `m-*` docs.** Worker B. Files: `lib/puck/catalogue.ts` (MOBILE_BLOCKS), `lib/puck/mobile.ts` (doc keys + code defaults), the phone-width canvas at `/studio/m-<name>`, and the page-split helper `components/mobile/split.tsx`. Pilot: `/tours` (02) end to end with `m-page-title` + `m-tour-list`.
- **G3: guest booking path** 01 → 02 → 03 → 04 → 05 on Jay's adapter.
- G4 experiences/people/about → G5 places → G6 feed/forum → G7 board.

## Open questions (mine; mirrored in QUESTIONS.md)
- Artist profile: built here at `/people/[slug]` with a link out to ArtDirect (rec), or link straight out?
- `/studio/m-*` doubles the number of docs an editor might touch. Should the Studio list group them as "Phone"? (rec: yes, one "Phone layout" group)
