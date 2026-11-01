# Collect-Art mock-ups (2026-10-28)

Export of the design canvas "IFAC Auction Landing"
(https://claude.ai/artifact/VbodsezFdCiaujWXPak1ma, private to the developer's
account), taken 2026-10-28 from version `1793226369-87aa`. The mock-ups explore a
re-presentation of `apps/art-auction`: the landing page, the auction series, lot
detail pages and an About page. Design only; no app code was changed.

## Contents

- `index.html`: list of every board, linking to the static pages.
- `pages/<Board>.html`: standalone static HTML, inline styles, Google Fonts only.
  Opens in a browser. Links between boards point to sibling files.
- `source/<Board>.dc.html` and `source/canvas.json`: the canvas source files.
  `.dc.html` needs the canvas runtime (`support.js`) to render. `canvas.json`
  holds board titles, sizes and layout.
- Not exported as static pages: `Main`, `LotC`, `LotD`. They use template holes
  and state (live timer, carousel, Latest bids and More-from-series toggles). Read
  them in `source/`.

## Boards

| Board | Title |
|---|---|
| Main | Landing page (first round, dark, lot carousel) |
| SeriesA / B / C | Series highlight cards: timeline, journal, standings |
| LotA / B / C / D | Lot detail: two columns, gallery stage, art first (mobile), desktop image-left |
| About | About page (copy is provisional; the developer is supplying final text) |
| Main2 / Main3 | Landing B: series first; Landing C: featured lot stage |
| Series | Series page: video hero, curator write-up, proceeds, lots, journal, articles, forum discussion |
| Main4 | Landing D: final direction (dark) |
| Intro0 | The live site's current intro section, rebuilt for comparison |
| IntroA / B / C / D | Intro section options in the live site's light palette (2026-10-25 pivot) |

## Conventions in the mock-ups

- Bracketed text (`[Series name]`, `[CURATOR NAME]`) is placeholder content.
- Figures, dates, lot titles and "Artist Name" are sample data, not production data.
- Dark boards: black ground, silver text (`#b9c3d6`/`#eef2f9`), burgundy accent
  (`#8c1f3a`), Cormorant Garamond + Jost.
- Intro boards: the live site's palette (`apps/art-auction/src/app/globals.css`),
  Fraunces + Inter.

## Open items

- The live site credits the host as "InnerGathering": the `inner_group` profile
  display name. `apps/art-auction/src/lib/auction-hosts.ts` says the host is
  Elkdonis Arts Collective (unverified which name is intended).
- IFAC's profile name is "International Fine Art Collectors"; some dark boards say
  "Fine Arts". Not settled.
- The series-information form (curator write-up, proceeds, articles, video) is not
  designed.
