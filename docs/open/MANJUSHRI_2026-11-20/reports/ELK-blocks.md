# ELK-blocks: block-forward pieces on elktours (2026-11-21)

Source only. No commits, installs, migrations or production writes. Two scratch production builds (`blkbefore`, `blkafter`, `.next` in `~/scratch/manjushri/elk/next-blk*`) were served in one-off containers on port 4021 with mail, Stripe, reminder and slot-sweep timers off; both removed. `apps/elktours/next-env.d.ts` restored from the backup after each build. A first `next dev` copy was abandoned: `/` made it restart ("approaching the used memory threshold"), so the proof uses production builds.

## What each piece was, and what it is now

Finding: "MobilePageButton" is not a name in the code. The group "forum, the office, the places catalogue" is the second half of `m-link-rows` (`blocks/mobile/discover.tsx`). No stored phone document exists (`site_config` has only `puck:landing` and `puck:tour-detail` for elktours), so phone pages are drawn from `MOBILE_DEFAULTS` (code); nothing stored needs converting for the phone pieces.

| # | Was | Now | Block id | Done |
|---|---|---|---|---|
| 1 | Places catalogue row, forum, and a log-in/name/Office button inside `m-link-rows` (`viewer.office` = owner or guide) | New block with a list of buttons | `m-page-buttons` (new); `m-link-rows` gains `showButtons` (default true) so its Feed row can stand alone | yes |
| 2 | `GuestTabBar` in `MobileShell` (3 fixed items, 3 root paths) | New block drawing the same markup from settings; shell bar untouched and steps aside only while the block is on the page | `m-phone-menu` (new) | yes |
| 3 | `m-places-shelf`: guides' starred places | Same block, new optional settings | `m-places-shelf` | yes |
| 4 | `m-guides`: first 6 guides, bio clamped to 3 lines, expand in place | Same block, new settings | `m-guides` | yes |
| 5 | `m-experiences-panel`: next 3 public experiences as a list | Same block, new settings | `m-experiences-panel` | yes |
| 6 | Live part `tour-cards` in `app/page.tsx` (no settings) | Block; the saved landing's `part` node is turned into it at read time (`landing-hero.ts`, row unchanged) | `tour-cards` (new) | yes |
| 7 | `m-masthead` header, no media | Optional cover picture/film behind the text | `m-masthead` | settings built, off by default; look not seen |

Existing ids were kept; the new settings are optional props (a stored node without them draws as before), so no id was renamed or replaced. New ids: `m-page-buttons`, `m-phone-menu`, `tour-cards`.

## Settings (plain words)

1. **Phone page buttons**: Buttons (list). Each: words, where it goes, who sees it (everyone / only signed out / anyone signed in / members and above / guides and above / owners only), look (row with dot / small pill / catalogue card), width (full / half, consecutive halves share a line), catalogue kicker and line below (`{count}` = public places), a **second form** for a role (words, link) and a **third form** for a higher role (the last form that includes the viewer wins; `{name}` = first name, else "Account"). Empty list = the standard three. Default list reproduces today: places catalogue (everyone), forum (everyone), "Log in" -> second form signed-in `{name}` -> /account -> third form guide `The Office` -> /manage.
2. **Phone menu**: shape (floating pill = today / softly rounded / square / flat bar), items (words, link, icon, who sees it; up to 6), pages it shows on (list; `/tours/*` = everything under; empty = `/`, `/tours`, `/experiences`; always shown inside `/studio`).
3. **Places shelf**: Which places (starred by a guide = today / places I choose); Places I choose (list, add/remove/reorder): place (record picker, `binds: "place"`) and cover picture (picker, `binds: "place-photo"`: choose the place, then one of its own pictures; empty = the place's own cover). References only; a cover that is not one of that place's own public pictures is ignored; non-public or gone places are never drawn.
4. **Guides**: who is shown (every guide / only those I list), order (site / by name / as I list them), most shown (6), description length (compact 2 lines / 3 lines = today / full), list each guide's tours (yes), tap goes to (opens in place = today / profile page), and a list of guides (picker `binds: "guide"`) each with a **short description for this site**, stored in the block's settings, not on the person.
5. **Experiences panel**: mode (list = today / feature: first one large / description: each with its short description), which (next public / ones I choose), how many (3), list of chosen experiences (picker).
6. **Tour cards**: which tours (**Only tours with coming dates = default** / All published tours / Tours I choose), how many (6), order (site / soonest / title), chosen tours (picker), empty words.
7. **Phone header**: picture, film, how dark the wash (55 %), where the text sits (top / middle / bottom), header height (360 px). Off while picture and film are empty.

## What each reads (`reads` on the declaration)

- `m-page-buttons`: viewer (signed-in, role), site org.
- `m-phone-menu`: viewer (signed-in, role), place (placement; the current path via `usePathname`), site menu.
- `m-places-shelf`, `m-experiences-panel`, `m-guides`: site org, plus a `record` read via the list prop (`picks`/`people`).
- `tour-cards`: site org, record via `picks` (tour).
- `m-masthead`, `m-link-rows`: viewer, site org (declared now; they had none).
A block works out the site, the viewer's role and the current page itself; the settings ask only for what it cannot know. Not learnable from `metadata`: the current path on the server (the menu reads it in the browser with `usePathname`).

## How role visibility is enforced

On the server, from the session. The resolver (`lib/puck/mobile-buttons.ts`, `mobile-menu.ts`) calls `getViewer()` and returns `shown`: only the buttons or items this person may see, in the form that applies to them. The block component draws `shown` and never the stored `buttons`/`items`, and it is a server component, so a visitor's HTML (and the flight data) holds no label or link they may not see. An unknown audience value shows to nobody. Links are checked (`/path`, `https:` or `mailto:` only; `javascript:` and `//host` are dropped). The editor's copy of the resolver (`mobileButtonsAction`) gives an owner or guide every button tagged with who it is for; anyone else calling it gets what their own session would see.

## Proof

**Pixels** (signed out, production builds, `~/scratch/manjushri/blocks/shots/`: `p1`, `p2` before; `a2` after; 390 and 1440 wide, full page; the phone landing also at viewport and scrolled 700):
- Before vs before (`p1` vs `p2`): the same except `m__people` 11 px and the phone landing's featured-tour card (72,510 px in box 30,403 to 368,653: the card's animated 3D route / badge, differs between two runs of the same build).
- Before (`p1`) vs after (`a2`): **identical** for `/` at 1440 (`d__root`) and 390 (`m__root`, `m__root_view`, `m__root_view2`), and for `/tours`, `/experiences`, `/places`, `/people`, `/about` at both widths, except `m__people` 40 px in the same small region where the baseline itself moved by 11 to 29 px.
- A first "after" build was NOT identical: the phone landing was 18 px short (the buttons lost the 34 px top margin when the Feed row was empty) and the Log in pill was too wide. Fixed (`afterFeed`, pill width only when full-width); the second build passed as above.
- The desktop landing (stored tree with the `tour-cards` part swapped to the block, `puck:landing` row unchanged): identical.

**Check** `apps/elktours/scripts/check-blocks.mts`: **75 passed, 0 failed** (every new/changed block loads, has `sample()`, declares `reads`, renders from its sample; registered in the server and client configs; resolved keys listed; visitor / signed-in non-member / member / guide / owner each get exactly their buttons and nothing else in the HTML, including a list with one button per audience and a stored list of all buttons with a visitor's `shown`; second form; unsafe links; menu items by audience; at defaults shelf, guides, experiences and tour cards equal what the pages draw today; "All published tours" returns only published public tours; a chosen guide gets the block's own blurb; an unknown place and a foreign cover are never drawn; a chosen cover is used).
**tsc** `apps/elktours`: 0 `error TS` before, 0 after.

## Justin's message about tours with dates

Today's rule lives in `listTours()` in `apps/elktours/src/lib/tours.ts` (the `EXISTS` over tour departures, status `scheduled`, `starts_at >= NOW()`); it is unchanged and other pages still use it. `includeDrafts` is NOT used: it returns every non-archived tour, drafts included. I added one precise option, `undated?: boolean`, which drops only the dates condition and keeps `status = 'published' AND visibility = 'PUBLIC'`. The `tour-cards` setting "Which tours" is Only tours with coming dates (default, = `listTours()`), All published tours (`undated: true`), Tours I choose (also `undated`, still published and public). To take the dates-only rule off for the whole site he can remove that `EXISTS` condition (or make `undated` the default) in `listTours()`. The phone `m-tour-list` (reads `toursFor` in `mobile-data.ts`) was not touched: cut.

## Decisions

- Page buttons are a new block; `m-link-rows` keeps its id and gains `showButtons`; the default phone landing is `m-link-rows` (Feed row, `showButtons: false`) + `m-page-buttons`.
- The menu block is in the default `m-discover`, `m-tours`, `m-experiences` documents (so it replaces the shell bar there, same look). Any stored phone document without the block keeps the shell bar.
- Existing blocks were extended rather than duplicated (places shelf, guides, experiences): optional props, defaults = today.
- An empty button or item list means the standard list (so a freshly dropped block is useful); consequence: the Puck list starts empty while the canvas shows the three.
- `{count}`/`{name}` tokens in button words; "second/third form" instead of a single swap, because the office button needs two (name for anyone signed in, Office for guides).
- Cover on the masthead is set on `m-masthead` itself (the header block).
- Tour-card stored `part` conversion at read time, as the heading did; the first-visit path (no saved tree) still draws the live part.

## Cuts and unproven

- Not seen: the header cover (picture, film, wash, text position) and the menu shapes/icons rendered; the Feature and Description modes of the experiences panel; the new pickers in the editor (place, cover, guide, experience, tour) and their "Settings..." sheets; the guides "goes to profile" card; the guides/experiences/shelf settings visually. Only their data and default output were proven.
- No signed-in browser check (no session minted); role behaviour is proven in the check script from the same functions the resolver calls, and the real session read (`getViewer`/`getProfile`) was not exercised signed in.
- Phone `m-tour-list` "Which tours / How many / Order" not done.
- "Photon"-style cover media upload not added: the cover uses the image picker kind and a film URL.
- `featuredPerson` reads as `undefined` in `PAGE_BLOCKS` under `tsx` (pre-existing; the check leaves it out).
- The editor canvas for the phone documents does not pass `afterFeed`; spacing there may differ by 18 px.

## Files

New: `src/lib/puck/{viewer-rank,mobile-buttons,mobile-buttons-actions,mobile-pick,mobile-pick-actions,mobile-menu,reference-kinds,reference-fields}.ts`, `src/blocks/mobile/{page-buttons-logic.ts,page-buttons.tsx,phone-menu-logic.ts,phone-menu.tsx,phone-menu.client.tsx}`, `src/components/landing/tour-cards-block.tsx`, `scripts/check-blocks.mts`.
Edited (small hunks): `src/lib/tours.ts` (`undated`), `src/blocks/mobile/{discover.tsx,types.ts,views.client.tsx,index.ts,blocks.css}`, `src/lib/puck/{resolved,config.mobile.server,config.mobile.client,config.client,config.server,catalogue,landing-hero,mobile-defaults}.ts`, `src/components/landing/person-records.ts`.

## What must be rebuilt

`eac-elktours` (all of the above). Nothing else.
