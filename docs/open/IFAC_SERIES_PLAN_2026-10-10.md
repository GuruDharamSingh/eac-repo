# IFAC series: plan of efforts (2026-10-10)

The developer's notes of 2026-10-10 on the IFAC series ("Art for Non-Professionals",
to be renamed "Explorations in Art Forms by Non Professionals") are grouped below into
efforts that can be taken one at a time. Each effort lists the request, what exists
today (from read-only investigation the same day), the proposed approach, and the
decisions that are still open. No code was written for E1–E7. Mockups:
`docs/open/series-mockups-2026-10-10/` (variant A chosen).

## E0. Already in source, not deployed
Done in source on 2026-10-10 (type checks pass for ifac and cms-ui); ifac needs a rebuild.
The live site therefore still shows the old anchor scroll.
- Anchor jump to `#week-N` lands below the sticky header and opens that week
  (`apps/ifac/src/app/site.css:466-473`, `components/site/session-list.tsx:38-64`).
- Planner contrast (`packages/cms-ui/src/surface/surface.css:1337,3425-3436`,
  `apps/ifac/src/app/hub/hub-readable.css:364-384`).
- Series settings in the planner: title (slug kept), lede, `metadata.joinDetails`
  {url, meetingId, passcode, other}; shown only to signed-in viewers who said they are
  coming, and in confirmation/reminder emails; the public `.ics` no longer carries a link.
- Hub compose declutter, breadcrumb bar (`components/hub/HubCrumbBar.tsx`), Publish → page,
  "Open in Studio".

Missing from the settings: day, time and time zone. The live series runs Thursdays at
23:00 UTC; the Zoom invitation is Mondays 6:00 PM Pacific.

## E1. Series composer (mockup variant A)
Request: variant A as the series editor, with the series card collapsible; joining by a
pasted link or a "Make a Talk room" toggle; keep the materials type labels.
Exists: `create_talk_room` toggle and `createTalkRoom` (`packages/cms-ui/src/compose/content-fields.ts:497-513`,
`packages/services/src/nextcloud.ts:353`); the token is stored in `threads.nextcloud_talk_token`
and `seriesJoinUrl` already falls back to it (`packages/services/src/meeting-series.ts:103-105`).
Planner: cms-ui `SeriesPlannerSurface`.
Approach: rebuild the planner layout as variant A in cms-ui; add schedule fields (weekday,
time, zone, first/last date); add the Talk toggle; add "One meeting | Series" to `/hub/compose`.
Depends on: E6 DST fix (schedule edits would otherwise inherit the UTC stepping).

## E2. Public presentation (landing, series page, week page)
Requests:
- Header: logo only (drop "International Fine Art Collectors" beside it); the series nav item reads "Current series".
- Landing: small "Current series" eyebrow above the series title; primary button is the
  upcoming session's title and goes to the top of the series page; secondary "All sessions".
- Landing "Join IFAC": remove the block border and heading; show the Baroque frame larger.
- Series page session cards: cover image in the card header band (between session/title/host
  and the action on the right); materials out of the collapsed card.
- Materials visible in the expanded card and on the week page to signed-in viewers (any role),
  locked for signed-out visitors.
- Replace "Whole series to calendar" with two buttons on the section divider:
  "Subscribe to series" (E4) and "Talk about this series" (E5).
Exists: header `apps/ifac/src/components/site/chrome.tsx:46-90`; landing `apps/ifac/src/app/page.tsx`;
materials are currently ungated (`series/[slug]/page.tsx:63-65`, `[n]/page.tsx:75-102`).
Gate: `viewer.role !== null` via `getViewer` (`apps/ifac/src/lib/auth.ts:42-56`).

## E3. Sign-in and the "RSVP" wording
Requests: drop "RSVP"; prompt "Let us know you're coming" with the button "I'm coming";
signed-out visitors see an inline sign-in panel in the page instead of a redirect, explaining
that an account supports the network and optionally brings confirmation and reminder emails;
remove the light block behind the Baroque frame.
Exists:
- Every IFAC sign-in path inserts a `viewer` row (`packages/auth-server/src/api-routes.ts:147-151`).
  SSO handoff arrival does not (`packages/auth-server/src/handoff.ts:238-300`); a visitor
  signed in elsewhere has role `null` on IFAC until they sign in here or press Follow.
- Signed-out "RSVP" links to `/login?mode=signup` (`components/site/series-rsvp.tsx:81-86`).
- Light block: `.login-card` paper background (`apps/ifac/src/app/globals.css:690-697`).
- "RSVP" appears in about 174 user-facing places; 29 in ifac; shared email subjects in
  `packages/email/src/index.ts:430,445`.
Approach: IFAC copy and inline panel first; shared email subjects next; other apps later.

## E4. Subscribe to series, and the emails
Request: "Subscribe to series" with a confirm dialog; subscribers get a reminder a couple of
days before each session with its details, the join link and the updated upcoming list; the
session's thread card appears in the email and is available as a block in the email suite.
Exists: email `ThreadCard` (`packages/email/src/components/cards.tsx:121-149`); newsletter
"Gathering card" block (`packages/newsletter/src/blocks.ts:438`); HMAC unsubscribe tokens
(`packages/newsletter/src/server.ts:188-233`); reminder scheduler and ledger
(`apps/ifac/src/lib/reminders.ts`, `thread_reminder_sends`).
Missing: subscription storage (no table); an N-days window; occurrence walking (the scheduler
only sees weeks that already have a topic thread); an upcoming-sessions list; an IFAC
unsubscribe route.
Defects: reminder subject is always "Starting soon" (`packages/email/src/index.ts:390`);
a Gathering card in a reminder layout mails a literal `{threadUrl}` (`merge-fields.ts:176-183`).
Approach: migration for `series_subscriptions`; `POST /api/series/subscribe`; a subscriber pass in
reminders.ts (kind `subscribers`); `upcomingSessions` in the reminder template; an "Upcoming
sessions" newsletter block.

## E5. Forum: series category, session topics, live card (separate session)
Request: creating a series creates a forum category (or subcategory) holding a general thread
and one topic per session, each showing a live card of the session.
Exists: `org_feeds.parent_slug` subcategories; the reading-circle pattern (`ensureCircleSpace`,
`ensureCircleSessionTopic`, `packages/services/src/reading-circle.ts:582-784`). Session threads
are `series_session`, in `OFF_FEED_KINDS`, have no section, and 404 in the forum. No
`data-eac-card` resolver exists; the forum composer is plain text.
Open questions: top-level category or subcategory under a `series` parent; session topics as
`post` (circle model) or `series_session` taken off `OFF_FEED_KINDS`; visibility (PUBLIC or
ORGANIZATION); card embedded in the body or drawn by the thread page from metadata; who may
create the category; migrating the existing session threads.

## E6. Platform model and correctness
From the morning's research:
- **DST: occurrences step in UTC, so the series shifts by an hour after 2026-11-01.**
- `/api/hub/series` host assignment is not org-scoped (`packages/services/src/meeting-rota.ts:244`).
- Target model: `kind='series'` with materialised session rows, one `featured_series`
  key replacing `standing_meeting` and `presented_series`; IFAC first, circles, workshops and
  standing meetings later.

## E7. Hub pages by default (platform)
A `pageFor` connector in `SurfaceProvider.open` would make cards open pages wherever a page
exists. IFAC lacks `/hub/publish`, `/hub/calendar`, `/hub/documents`, `/hub/files`.
innergathering Cards 2 is the reference.

## Decisions (developer, 2026-10-10, second pass)
- Times shown in Pacific, Eastern and Paris; DST fix only if contained.
- Series settings offer a pasted link or "Create a Talk room" explicitly.
- Hosts: assigned by guide/owner; hosts must be members of the org. Hosts get an email on
  assignment (link to update the week), the host reminder, and a notice when someone confirms.
- Week page keeps in-place editing, restyled with the compose page's layout. Planner stays as is.
- Subscriptions are `thread_rsvps` rows on the series' parent thread; per-week attendance stays on
  the week thread. Subscribing is not confirming attendance; the weekly email offers "I'm coming".
- Upcoming lists show published weeks only; unfilled weeks are drafts. Far-off weeks: no work.
- "RSVP" wording is not changed platform-wide now. No featured-series key. Hub pages (E7): not now.
- Later: a shared hero-layout package (text overlay, background, banners, video).
- Next: mockups of the series page top for signed-out visitors
  (`docs/open/series-page-top-mockups-2026-10-10/`).

## Suggested order
E0 deploy → E6 DST and host scoping → E2 + E3 (IFAC public pages and sign-in) → E1 composer →
E4 subscribe and emails → E5 forum (own session) → E7.

## Handover (2026-10-10, late)
Approved by the developer and **run 2026-10-11 00:24–00:28 EDT** (migration 203 applied, 3 rows backfilled; ifac rebuilt; innergathering rebuilt; IFAC series flipped to `kind='series'`). Original order:
1. Apply migration 203 (`series_sessions`, backfill 3 IFAC weeks) to `elkdonis_dev`; tested on
   `elkdonis_scratch`.
2. Immediately rebuild ifac (back up `.next`; no planner edits between 1 and 2). Ships: week
   cancel/move, series mailings (`/manage/email/series/<id>#mailings`), landing About/menu fixes
   (round 4), Event removed from IFAC compose (`hideEvents`), and the planner Manage tab if its
   worker finished (check `git status` / `packages/services/src/series-analytics.ts`).
3. Rebuild innergathering (runs the calendar sync tick for every org; must carry the push-only
   series code before step 4). Ships today's shared package changes plus its own uncommitted files.
4. Then: `UPDATE threads SET kind='series' WHERE id='Gnove0JPbyLYG4_QCTt-V' AND org_id='ifac'
   AND kind='meeting'`; re-check series pages, calendar, planner.
Designs: `docs/open/SERIES_KIND_DESIGN_2026-10-10.md`, `docs/open/SERIES_EMAIL_DESIGN_2026-10-10.md`.
Scratch DB `elkdonis_scratch` exists (approved); drop it when the series work is done.
Open: email.md note on series mailings; calendar/Nextcloud DST mismatch (UTC stepping);
cancel/move send no emails; `.manage-console .button` contrast.

## Session and series covers, rich write-ups (2026-10-13)
Built and deployed 2026-10-13 (ifac rebuilt 14:05 EDT; backup `~/eac-backups/next/ifac-20261013-1402.tgz`).
- Migration 205 (applied 2026-10-13): `meeting_occurrence_notes.subtitle`, `body_html`, `cover_frame`.
  `saveSeriesSession` sanitises `bodyHtml` (`sanitizeRichText`) and rewrites `summary` as its plain
  text, so mail, `.ics` and descriptions keep reading `summary`. A save without `bodyHtml` leaves both alone.
- Cover framing: `{fx, fy, zoom}` (focal point + zoom, gallery convention). Shared editor
  `CoverFramer` and `coverFrameStyle`/`coverEmbedSrc` in `packages/cms-ui/src/files/` (`cover-frame.ts`
  has no "use client"; server pages import it).
- Series cover: `metadata.series.cover = {url, kind: image|video|embed, posterUrl, frame}`
  (`seriesCoverOf`); `metadata.coverImageUrl` is set to the picture or the video's poster.
  "About the series" is `threads.body` (rich text, sanitised on write and render).
- Planner (`SeriesPlannerSurface`): thumbnails in every row; week subtitle, rich write-up, framer
  with a 16:9 and a portrait (this-week card) preview; series settings "About the series" and
  "Cover and card" (picture, video file with optional still, YouTube/Vimeo link).
- Public: cover under the series title (video plays muted on a loop), About section (`#about`,
  "Learn more about the series" jumps there when it exists), subtitles and rich write-ups on the
  this-week card, session list and week page; in-place week editor matches the planner.
- Verified: preview render (desktop, 390px), signed-in planner and week editor screenshots,
  frame round-trip, production build and edge 200s, production planner without console errors.
  Not verified: an uploaded video file (no IFAC video exists; YouTube embed tested), the hub
  Series card (unchanged), emails with the new fields (they read `summary` as before).
- Session 2 (19 Oct) content replaced 2026-10-13 with "Putting Art as Tai Chi into Practice";
  previous row kept in the session's scratchpad only. Its placeholder material `heart-1-d3fxzw.jpg` was left.

## Several series (2026-10-18)
Built in source 2026-10-18 from the developer's choice of mockups (`docs/open/series-index-mockups-2026-10-18/`):
B's cards as a carousel, A's type sizes and rows, a List | Calendar switch, D's series page, E's editing, plus an
"Earlier series" shelf and share previews. Verified in the dev preview (`ifac-preview`): desktop and 390px renders of
/series (list and calendar) and /series/art-for-non-professionals, signed-in /hub/series and the planner, API round-trips.
**Not deployed**: the ifac rebuild was held because another session's uncommitted /center, journey and payout work was in
the tree (2026-10-18 17:00).
- Storage, no migration: `site_config.series_page` {eyebrow, heading, introHtml, order}; `presented_series` = featured;
  `threads.metadata.series.accent|listed`. Services: `packages/services/src/series-page.ts`.
- Only `kind='series'` threads are listed; the old "Weekly Meeting" meeting thread is not.
- Pages: `apps/ifac/src/app/series/page.tsx` (new), `series/[slug]/page.tsx` (rework), `hub/series/page.tsx` (new),
  `api/hub/series-page/route.ts` (new); nav item "Series" → /series; landing: one slide per listed series.
- Defaults taken (developer may change): only published weeks listed; one landing slide per series; colour per series.
- Data written while testing: `site_config` rows `series_page` (empty intro, order = the one series) and
  `presented_series` (unchanged value); `metadata.series.accent='gold'`, `listed=true` on the current series.
- `components/site/session-list.tsx` is no longer used by the series page.
- 2026-10-18, second pass (developer's review): planner series settings in mockup E's layout (fields left, live dark
  preview right, "Hide/Show preview" button remembered per browser); "How the card reads" (rhythm line from the
  schedule or own words: `metadata.series.rhythm`; status label auto or hidden: `statusChip`); "Where it shows" as
  switches, with a separate landing-slides switch (`metadata.series.landing`); "Other ways to join" removed from the
  form (stored values kept); "Repeats: every 1–4 weeks" (`metadata.series.interval`, used by the series clock, the
  public .ics and the org calendar's RRULE INTERVAL). Session form: same split and preview (row, next-session band,
  write-up start) and a cover that can be a picture, a video file (with a still) or a YouTube/Vimeo link
  (shared `CoverField`, migration 206 `meeting_occurrence_notes.cover_media`, applied 2026-10-18;
  `SeriesSession.coverStillUrl` for cards, mail and share previews). Series page editor in /hub/series has its
  preview. Verified in the dev preview with a temporary organiser (deleted): screenshots, a scripted live edit, a
  YouTube session cover saved, rendered and reverted. Not deployed (rebuild held).

## Planner: series banner and "+ New series" (2026-10-18)

- The series' own row in the planner (`SeriesSettingsForm`, `packages/cms-ui/src/hub/SeriesPlannerSurface.tsx`) is a dark
  banner ("The series", name large, schedule and join summary, a "Series settings" button) above a "Sessions · n past ·
  n coming" label, so it no longer reads as a week. Styles: `surface.css` "The series planner, take two".
- Tabs are Weeks · Manage · **+ New series**. The new tab opens the same settings form, blank (placeholders as suggested
  text), always open, with the schedule ("When it meets") inside it and a "Create the series" button. Create mode:
  `SeriesSettingsForm`'s `create` prop; the schedule is a controlled `ScheduleForm`; the Talk room option waits until the
  series exists.
- Create = `POST /api/hub/series/new` (name + schedule; `apps/ifac/src/app/api/hub/series/new/route.ts`; organisers only;
  creates a published `series` thread, its weekly schedule and a calendar entry, as Compose does), then the rest of the form
  through `POST /api/hub/series` on the new id, then the page opens the new planner. The planner reads published series
  only, so the thread is published; it is **unlisted** by default (the form's "Listed on the Series page" switch is off).
- Untouched: the Manage tab, the email suite and everything under `/manage/email`.
- Verified 2026-10-18 on ifacgroup.com as a guide: banner, tabs, form, one creation (thread, `series_sessions` 0 rows as
  expected for lazily made weeks, `listed: false`, schedule and zone stored), redirect to the new planner. Both test series
  and their calendar entries were removed.
