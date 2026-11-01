# IFAC: "Art for Non-Professionals" series and public site reshape (2026-10-08)

Handover for the session that reshaped the IFAC public site around the weekly
series "Elkdonis Arts Collective presents Art for Non-Professionals, by
International Fine Art Collectors" and added a shared meeting-series pattern.
Everything below is uncommitted on `elastrocal-and-network-work`.

## Current state (verified 2026-10-08 unless marked)

- **Migration 201 applied**: `meeting_occurrence_notes` gained `title`,
  `summary`, `materials jsonb`, `cover_image_url`, `topic_thread_id`
  (`\d` checked after `db:migrate`).
- **Shared service** `packages/services/src/meeting-series.ts`: a series is a
  recurring meeting thread; per-week host (`meeting_hosts`), title, write-up,
  cover, materials; per-week RSVP through a `series_session` topic thread
  (`OFF_FEED_KINDS`), guests in `guest_submissions`. `presented_series`
  `site_config` key names the series a site leads with. Reference:
  `docs/reference/data-model.md` "Meeting series".
- **Shared hub UI** (cms-ui): `hub/SeriesFace` (card) and
  `hub/SeriesPlannerSurface` (custom surface key `meeting-series`: per-week
  host, co-host, title, write-up, cover, materials with upload/library/link).
  Styles appended to `surface/surface.css` (`.eac-series*`). Registered on IFAC
  in `components/hub/HubSurfaces.tsx`; the face is in both hub views
  (`hub/page.tsx` cards view, `hub/site-view.tsx` page view). Verified by
  opening the popup signed in as a QA guide: it listed 11 weeks with the
  seeded titles and hosts and the materials editor.
- **IFAC public site**: `/` (thin letterboxed banner, series hero with a
  50 s rotating card, "Who we are" beside the Baroque sign-up frame,
  publications strip), `/series/[slug]` (RSVP card, session list with the
  next week open, join panel gated behind sign-in + RSVP, host rota),
  `/about` (statement plus one artists/dealers/team grid with filters),
  `/publications` (blog, members' writing, videos). All under `.ifs`
  (`src/app/site.css`, `src/components/site/`). Rendered at 1280 and 390 px
  through headless Chrome; the older `site-chrome.tsx` still serves hub,
  forum, manage and person pages.
- **Routes**: `/api/hub/series` (GET planner data, POST week fields or
  host assignment; member read, organiser or that week's host write),
  `/api/series/rsvp` (member toggle or guest name+email; mails confirmation
  and owner notification; join link mailed to members only),
  `/series/[slug]/calendar.ics?at=` (one week, or the whole series with an
  RRULE). Verified with curl signed out and signed in; one member RSVP
  created topic `art-for-non-professionals-session-1` with
  `metadata.seriesSession`.
- **Times** print in the series zone plus Central and Pacific
  (`src/lib/series-time.ts`; `metadata.series.alsoZones`). The RSVP mail puts
  the three-zone line in `summary`; the templates still print Eastern on
  their own (hard-coded `America/Toronto`).
- **Email shell**: side padding reduced (28 px body, 12 px container) and a
  phone media query added in `EmailShell.tsx`. Not mailed to a real client
  this session.
- **Google button** in the Baroque frame restyled to Google's white/hairline
  look (`baroque-signup.css`). Shared by every site that uses the frame.
- **Sample data** (placeholder): series thread `Gnove0JPbyLYG4_QCTt-V`, slug
  `art-for-non-professionals`, Thursdays 7:00 pm Eastern from 2026-10-08,
  60 min, online, no Zoom link; five weeks with hosts (Eric Brummel, Hans
  Maack, Berni Laplante, Michele DeParis, Jaswant Bains) and invented titles,
  seeded by `apps/ifac/scripts/seed-anp-series.ts`. Week 1's topic thread is
  authored by the owner (reassigned from the QA account).
- **Builds**: IFAC rebuilt five times today, the last with the hero
  emphasis fix (`/` renders `Art for <em>Non‑Professionals</em>`, curl
  checked); backup of the pre-session build
  `~/eac-backups/next/ifac-20261008-1635.tgz`. QA account and its rows removed.
- Mockup that set the direction: `docs/open/ifac-anp-mockup-2026-10-08/`.

## Open items

1. **The hub's standing meeting now resolves to the series.** The flagged
   `standing_meeting` thread (`WICmSS4ILHCm7b45sFZ3Q`, "Weekly Meeting") is
   archived, so `getStandingMeeting` falls through to the first WEEKLY
   occurrence, which is the new series. Pre-existing stale flag; an owner
   should flag (or create) IFAC's own weekly meeting.
2. **Zoom link**: set `meeting_url` on the series thread (compose surface,
   "Links and rooms"); until then the join panel shows a blurred placeholder
   and the mail carries no link.
3. **DST**: occurrences step 7 days in UTC, so from 5 Nov the series prints
   6:00 pm Eastern. Platform-wide (`packages/utils/src/recurrence.ts`), noted
   in data-model.md; a zone-aware step needs a data migration of
   `occurrence_at` keys.
4. Real hosts, titles and copy: replace the seeded weeks from the hub's Series
   planner. Roster people without accounts (Hans, Berni, Michele, Jaswant)
   are not in the planner's host picker (`listRotaCandidates` lists members).
5. `check-types` in `@elkdonis/services` reports pre-existing errors in
   `packages/utils` and `packages/nextcloud` (DOM lib); none in the new code.
6. The hub cards view keeps the Series face at normal width beside the
   standing meeting; widening it is a face-width change (ask first).
7. Guest RSVP sends one confirmation per submit (a repeat submit updates the
   row but still mails). Not tested end to end with a real inbox.

## Revision after the owner's review (2026-10-08, late)

Direction from the owner: bring back the old site's clear, bordered sections
in orange and purple; make the hero a real event stage; publications only on
their own page; the Baroque frame dark; the About page in its old shape
without the role pills; a deeper ground; the logo band without black sides.
Done and deployed (seventh build):
- `site.css` tokens: ground `#0b0b0d`, orange `#ff8c00`/`#ff9a1f` for headings
  and calls to action, purple `#9c40d8` frames; gold stays inside the Baroque
  frame. `.ifs-block` bordered sections with the IFAC seal and sans uppercase
  headings; `.ifs-stage` event stage; `.ifs-team` / `.ifs-roster`; dark
  Baroque overrides on `.ifs-join`.
- Landing: banner (blurred copy of the image fills the sides, logo contained
  on top), then three blocks: the event stage (`components/site/event-stage.tsx`,
  whole events rotating every 50 s: this week's session, the IFAC Art Auction
  on the Collective Market as a standing card with no dates, next week's
  session), "International Fine Art Collectors" about block, "Join IFAC" with
  the dark Baroque frame. No publications strip.
- About: "IFAC Team" heading, statement block, team portrait cards (the old
  list, portraits from the directory), then Artists and Art Dealers rosters as
  the old landing listed them. `hero-rotator.tsx` removed.
Rendered at 1280 and 390 px; the series page keeps its layout with the new
tokens.

## Revision 3 (2026-10-08, night)

Owner's second review: colours back to the earlier gold with indigo frames
(`#5c62e6`) in place of purple; base type 18 px, buttons 52 px, nav 1.02 rem
(older readers); the stage drops the "Event · weekly series", "presents" and
"by" lines and prints date, time and "Online · free" as one facts row with no
duration; Central time removed (Pacific only, also in the series thread's
`metadata.series.alsoZones`); the series title never breaks at its hyphen
(`unbreakable()` / `.nb`); on phones the stage is one picture with the text
on a blurred translucent card. **Seed data removed**: the five sample weeks'
hosts, titles, write-ups and materials were deleted, the test topic thread
archived and the seed script deleted; the series thread itself remains, so the
stage and series page show "To be announced" until hosts fill weeks in from
the hub's Series planner. Empty weeks are listed four at a time and the rota
hides until a host is set. Header: drop the owner's IFAC lettering into
`apps/ifac/public/ifac-lettering.(svg|png|webp)` and the header uses it in
place of the seal on the next request (checked at render time, no rebuild).
Eighth build of the day.

## Revision 4 (2026-10-08, late night)

- **Reminders**: `apps/ifac/src/instrumentation.ts` + `src/lib/reminders.ts`
  run every 5 minutes: attendee letters to members with a `yes` on a week's
  topic thread the day before (`thread_reminder_sends.kind='attendees-day'`)
  and within the series' `reminder_minutes_before` (default 60, kind
  `attendees`), plus the rota's host reminder (kind `host`). Scheduler
  registration seen in the container log after restart; no letter has fired
  yet (first week is 2026-10-08 23:00 UTC).
- **RSVP is members only**: the guest form and the route's guest path are
  gone; a signed-out visitor is sent to `/login?mode=signup&next=…`.
- **Hub Series card** navigates to `/hub/series/[id]`, a page that mounts
  the shared planner (`components/hub/SeriesPlannerPage.tsx`,
  `SurfaceChromeProvider` now exported from `@elkdonis/cms-ui/surface`);
  the popup registration stays for other hosts.
- **Lettering**: the owner's PNGs under `public/ifac/images/` were trimmed to
  their letters into `public/ifac-lettering.png` (header, 30 px tall, and the
  stage's empty panel) and `public/ifac-banner-lettering.png` (banner, over
  the blurred collage).
- Ground darker (`#050506`); phone sign-up frame narrowed to hug the form
  (sigil, rule and subtitle hidden); About: artists, dealers and the team in
  one roster look (56 px portraits, role line), team last.
- Live data: the owner set a host and co-host on week 1 at 23:36 and made its
  RSVP topic; left in place.

## Week pages (2026-10-09, early)

`/series/[slug]/[n]` (`apps/ifac/src/app/series/[slug]/[n]/page.tsx`): one
week as its own page, added beside the series page (owner: leave the series
page, add "See detail page"). Date box, title, write-up, cover, materials;
RSVP (members only) with the join-link gate; the host from their directory
profile (portrait, role, first bio paragraph, link to their page), co-host;
previous and next week cards; a Conversation block that lists `listReplies`
on the week's topic thread and posts through `/api/series/comment` →
`postReply` with IFAC's forum viewer (the topic is made on first use). The
organiser or that week's host sees "Edit this week" (`week-editor.tsx`):
title, write-up, cover URL and link materials, saved through
`/api/hub/series`. Rows on the series page and the RSVP card link to it.
Verified: 200 for week 1, 404 for week 99, comment route refuses signed-out;
rendered at 1280 and 390 px. Not exercised signed in this round (edit and
comment paths rely on the planner route and `postReply`, both verified
earlier or shared).
