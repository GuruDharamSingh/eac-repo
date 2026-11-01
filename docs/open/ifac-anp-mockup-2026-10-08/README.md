# IFAC "Art for Non-Professionals": design mockup (2026-10-08)

Static HTML mockup for the IFAC site reshape around the weekly series
"Elkdonis Arts Collective presents Art for Non-Professionals, by International
Fine Art Collectors". Status 2026-10-08 (evening): built and deployed on IFAC; see
`docs/sessions/2026-10-08_ifac-series.md`. The mockup is kept as the design record.
Open `index.html`, `event.html`, `about.html`, `email.html` in a browser, or
see `shots/` (1280 px and 390 px renders, headless Chrome).

## Pages

- `index.html`: 64 px sticky header; 150 px banner (84 px on phones) cropped
  from the existing `img-banner.jpg`; hero with the series call to action and a
  rotating card (one slide per 45–60 s: this week, next week, about IFAC);
  split section "Who we are" + the cms-ui Baroque sign-up frame on the dark
  ground; publications strip (blog cards + video row); footer with the
  Elkdonis line.
- `event.html`: series header, sticky RSVP card for this week, session list
  (date box, title, host; first row open with host notes and materials, next
  four collapsed; hover lifts a row), "Joining on Thursday" panel with the
  Zoom link gated behind sign-in + RSVP, host rota, link to the planner.
- `about.html`: statement (existing copy), then one people grid merging
  artists, dealers and team, with filter chips.
- `email.html`: RSVP confirmation at 600 px max, single column, 20 px
  gutters, date box, Join and Add-to-calendar buttons, materials list.

## Proposed tokens (anp.css)

Ground `#141416`, panel `#1b1b1f`, ink `#f2efe8`, muted `#b7b1a6`,
gold `#c9a24a` (fills, ink `#141416` on it), gold text `#e3c572`.
Serif: Cormorant Garamond. Sans: Source Sans 3. Contrast ratios in the
stylesheet header. Purple frame and cyan from the current site are dropped.

## Placeholders (not facts)

Thursday 7 pm Eastern, session titles, host rota order, "12 going", the Zoom
URL, and the materials are example content. Hosts shown are the current
About-page team. The "Hosting this season" chip and "Host · date" chips are
proposed, not data.

## Data mapping (for the build)

- Series = one `threads` row, `kind` `meeting` (or `event`), `recurrence_pattern`
  `WEEKLY`, `format` `online`, `video_link` = Zoom, `is_rsvp_enabled`.
- Sessions = occurrences; per-occurrence host, notes and materials via
  `meeting_hosts` / `meeting_occurrence_notes` (migration 136, `meeting-rota.ts`,
  `PlanAheadSurface`).
- Per-occurrence RSVP does not exist (`thread_rsvps` is per thread); the
  reading-circle pattern (a `post` thread per session, `metadata.circleSession`)
  is the available workaround and gives each session a forum discussion.
- RSVP mail: `packages/email` `rsvp-guest.tsx` / `rsvp-owner.tsx` with an
  IFAC override (`email_template_settings`), narrower padding on phones.
