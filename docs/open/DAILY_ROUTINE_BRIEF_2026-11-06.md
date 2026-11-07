# Daily routines on the action layer; Akhand Path as the first (brief, 2026-11-06)

A routine is a course that repeats: the same few steps, run once per day (or
per week), each step ticking from platform state. The LMS action layer runs it
(`docs/open/LMS_ACTION_LAYER_BRIEF_2026-11-06.md`, shape C "runbooks", with the
subject being a day) and the dock carries today's step across the network.
The first routine is the Akhand Path reading on fourthwayBookreaders; a
daily video post (record → clip → publish → post, from
`docs/open/STUDIO_PIPELINE_DESIGN_2026-11-06.md`) is the second, on the same
machinery. Design only; nothing built.

## 1. Developer direction (2026-11-06)

- Routines (daily, a series or course obligation) are run by the LMS layer
  and its dock, which also serves as the platform assistant (MCP direction,
  LMS brief §7.2); not a Studio feature.
- Start with the daily routine; look at the Akhand Path and move it onto it.
- Later the same day: a routine is any playbook of the publishing process,
  "covering the basis and giving options to elevate": a post, then the post
  with a video, then videos as a named series with its overlay, then a
  routine that repeats it (a channel or project), which may get its own page
  or channels, and may become an organisation itself. "That's the LMS and CMS
  working together." (§3.0)
- The LMS's part is the assistant: it is what the MCP (LMS brief §7.2) and
  the dock expose. The playbook is read and advanced through those two doors;
  the CMS (registry runners) does the work.

## 2. Current state (code read and queries, 2026-11-06)

Akhand Path (`apps/fourthwayBookreaders`, `elkdonis-arts.org/books/akhand-path`;
the developer named amrit-canada, the code is in fourthway):
- Thread `R9Oyo2AkSHDWoQsHxpJsu`, org `fourth_way_book_readers`, kind
  `reading_group`, INVITE_ONLY, `metadata.paath.startedOn` 2026-10-03.
- A day's entry is assembled from four sources (`src/lib/paath.ts:10-28`):
  passages with `circle_units.done_at` in the day (site zone); thoughts
  (`circle_unit_notes`); the day note and stop point (`meeting_occurrence_notes`
  at the day's midnight); recordings in
  `<folder>/Meeting Recordings/<YYYY-MM-DD> Day N/` (browser upload or the Talk call).
- Recordings go on to YouTube through `video_uploads` (migration 193,
  `packages/services/src/youtube-uploads.ts`): `awaiting` until approved, then
  uploaded by the video worker. Day 1 was uploaded 2026-11-01.
- Progress: 1 of 3,921 passages done (2026-10-10); 2 day notes. Nothing
  prompts the next day.

Action layer:
- Registry `packages/actions` (entries with `status` and `run`, `runAction`,
  `action_events`); scopes `person | org | thread`, a `thread` subject is a
  `post` only (`server/run.ts:56`).
- Dock slice 1 deployed on arts-collective 2026-11-07 02:30 UTC
  (`GET /api/actions/dock`, `@elkdonis/dock`): shows the current step of the
  person's active enrolment. Hub host only: the session cookie is host-only,
  so elkdonis-arts.org has no dock.
- LMS courses are linear (`lms_step_state` keyed by enrolment and step);
  `offset_days` unlocks drip a course but there is no repeating run. Runbook
  progress per subject is an open question in the LMS brief (§6).

## 3. Design

### 3.0 The publishing ladder (developer, 2026-11-06)

One playbook, in rungs. Each rung is a set of registry entries (the CMS does
the work, the LMS walks the person through it); finishing a rung offers the
next one, never forces it. A person or a project can stop on any rung.

| Rung | What it is | Registry entries (existing / to add) | Built from |
|---|---|---|---|
| 1 Post | a piece published in the person's channel | `studio` (exists) | Studio Writing |
| 2 Out | the piece posted to socials | add `piece-share` (thread subject) | `share-actions.ts`, `publish_jobs`, Connections |
| 3 With video | a recording made into a clip on the piece | add `piece-video` | Recordings, clip editor, `publishReel`, lineage (248) |
| 4 Series | videos under a name with their own overlay and look | add `show` (a named show + preset) | writing series name; reel edit as preset (pipeline §2.4) |
| 5 Routine | the series on a cadence: today's episode as the dock's step | the routine course (§3.1) over rungs 1-4 for a `day` subject | LMS + dock |
| 6 Channel or project | its own page, feed and social channels | add `show-page`, reuse `org_channels` | series-site pages, ArtDirect, `org_channels` (221) |
| 7 Organisation | the project becomes a collective | `org`, `org-details`, `org-site`, `org-people` (exist) | `org-create.ts`, Center journeys |

Akhand Path sits on rungs 3-5 inside an existing org (fourthway): a reading
with a recording a day and a YouTube channel as its Out. It is the first
routine because its steps exist and are already done by hand; the video
post ladder (rungs 1-5 for a person) is the second.

Elevating carries the work up: a rung-4 series becomes the rung-6 page's
feed; a rung-6 project's pieces, channels and members move into the rung-7
org (`org-create.ts` with the project as the seed). Moving content between
orgs (`threads.org_id`) is a decision of its own, see §6.

### 3.1 A routine is a course with a cadence

A course carries `routine: { cadence: 'daily' | 'weekdays' | 'weekly', zone,
subject: 'day' }` in its settings. Its steps are task steps (registry entries).
Each period is a subject, `day:<YYYY-MM-DD>` (bound to a thread when the
routine is about one, e.g. `paath:<thread id>:<day>`). The registry's `status`
is asked per subject, so "today" is just the steps evaluated for today's
subject.

All Akhand Path steps are derived from state, so slice 1 stores no per-day
progress: today's state is computed on read, and past days are recomputed
from the same tables (the passages, notes and uploads carry their dates).
A streak or history table can come later as a cache.

### 3.2 Akhand Path day: the steps

| Step | Registry entry (new) | Done when (subject = the day) |
|---|---|---|
| Read today's passages | `paath-read` | at least the day's target of `circle_units` done in the day's range (target in `metadata.paath.dailyTarget`, default 1) |
| Record the reading | `paath-record` | a recording in the day folder or a `video_uploads` row for it |
| Write the day note | `paath-note` | a `meeting_occurrence_notes` row for the day with a note or stop point |
| Send the recording | `paath-publish` | the day's `video_uploads` row is `done` (or `queued`/`uploading`: partial) |

`present` for each links to the day page
(`/books/akhand-path/day/<date>`), anchored on the control. Readers only:
`allowed` reuses the paath reader rule (author or `yes` RSVP), so the checks
move from `apps/fourthwayBookreaders/src/lib/paath.ts` to a read-only service
(`packages/services/src/paath-day.ts`) that both the app and the registry use.

### 3.3 The dock for a routine

- The dock route returns, besides the current course step, today's routine
  card: "Akhand Path · Day 35 · 2 of 4" with the next open step and its link.
- Slice 1 runs on arts-collective (where the dock is). Reaching
  elkdonis-arts.org needs either the cookie domain or a dock fetched with a
  token from the hub; that is the LMS brief's dock slice 2, not this one.
- No push: the card is recomputed when the dock opens (it already reads on
  each page).

### 3.4 Daily video post (second routine, same machinery)

Steps: record (a `studio_items` recording created that day), make the clip
(a reel saved that day with the recording as source), publish (a piece made
from it that day, lineage `published`), post (a `publish_jobs` row `done`
that day for the piece). All derived from tables that exist; the Studio's
lineage (migration 248, applied 2026-11-07) supplies the links.

## 3a. Status, step 1 (2026-11-07, source only, not deployed)

Developer: "Ok" to step 1. Defaults taken: the day travels in the status
context (`StatusContext.day`, YYYY-MM-DD; absent = today in the reading's
zone), not as a step param (params are fixed option lists) and not as a new
scope; daily target `metadata.paath.dailyTarget`, default 1 (not set on the row).

- `packages/services/src/paath-day.ts` (export `@elkdonis/services/paath-day`):
  `getPaathDayStatus(userId, day?)`, reader rule, zone arithmetic as paath.ts.
  The app's own `paath.ts` is unchanged (no move yet, so no behaviour change).
- Registry: `paath-read`, `paath-record`, `paath-note`, `paath-publish`
  (catalogue, `server/status.ts` checks, `present.ts` links to
  `elkdonis-arts.org/books/akhand-path/day/<day>`; send links to `/akhand-path`,
  where approval is). Base URL from `FOURTHWAY_BOOKREADERS_URL`, default
  `https://elkdonis-arts.org/books`.
- Verified: `check:registry` 24 entries / 23 checks consistent; check-types 0
  in actions and arts-collective (services 17, none in these files). Probe
  against live rows (read-only), as expected: Day 1 recorded and on YouTube,
  no note; Day 8 (2026-10-10) one passage read (done_at 2026-10-11 UTC, counted
  in the local day), stop point counts as the note, recording awaiting
  approval → partial; today (Day 36) all open; a non-reader refused; a bad
  day falls back to today. Both linked pages answer 307 to `/books/login`
  signed out, through the edge.
- Not done: no course uses the entries yet (step 2); the dock shows nothing
  new; nothing deployed (arts-collective serves the registry from its build).

## 3b. Status, step 2 (2026-11-07)

Developer: "Go-ahead".
- LMS: `StepTask.repeat?: 'daily'` (`packages/lms/src/types.ts`); `stepTask`
  carries it and `settleTaskStep` never records a repeating step as completed
  (`packages/lms/src/tasks.ts`). Source only. Open: `completeStep` still
  accepts a hand-posted `complete` for such a step (lms-ui `actions.ts`).
- Course `akhand-path-daily` (`NSphureY90-0fs6JoPpwE`, org
  `fourth_way_book_readers`, private, v1, run `PZVuufM-6fVGhnwS3DqML`) seeded
  by `packages/lms/scripts/seed-akhand-path-daily.mts` in `eac-sophia`; one
  module "Today", four open, optional task steps with `repeat: 'daily'`.
  Enrolled: the thread's author and the `yes` reader (both owners of the org).
  Written to production: the course, version, steps, staff row, 2 enrolments,
  `lms_events` rows (append-only). Remove: `DELETE FROM lms_courses WHERE slug = 'akhand-path-daily'`.
- Verified: stored step settings carry `repeat: daily`; a probe through
  `getLearnerOutline` + `settleTaskStep` (source code) for both readers: 4
  steps, access open, each "Day 36: …" open, `completedNow` false, 0
  `lms_step_state` rows. Signed out through the edge:
  `/learn/akhand-path-daily` and `/learn/akhand-path-daily/read` 404.
- Not live yet: arts-collective's build predates the `paath-*` entries and
  the repeat rule, so a signed-in reader sees "This step is not known to this
  site yet" until it is rebuilt (and the deployed settle code would record
  completion once a step is done). Not rendered signed in.

## 3c. Deploy (2026-11-07 ~01:00 EST)

Developer: "Yes continue" to the rebuild. Waited for 10 quiet minutes
(another session was editing `packages/blocks` and sunjay); arts-collective
check-types 0 against the tree; backup `~/eac-backups/next/arts-collective-20261107-0057.tgz`
(previous `NP5IGAuZPQ_xI0crNBzL-`); built in `eac-arts-network`
(`NODE_OPTIONS=--max-old-space-size=3584 NEXT_BUILD_CPUS=2`), restarted, not
recreated; serves `ppb3r1Y96TNhxqbAQRN6x`. Shipped with it: every session's
uncommitted work in the tree, including `packages/blocks`.

Verified through the edge: `/`, `/learn/getting-started`, `/login`,
`/hub/network`, `/api/actions` 200; `/studio` 307; `/learn/akhand-path-daily`
404 signed out; dock 401 signed out; `tenant-smoke` 9/9; `/api/actions` lists
24 entries including the four `paath-*`; the built LMS chunk carries the
repeat skip in `settleTaskStep`. Logs: only stale-tab "Failed to find Server
Action".

Not verified: the course drawn signed in. A throwaway reader account (role in
fourthway, `yes` RSVP, enrolment) was refused by the session's permission
classifier; a reader opening `/learn/akhand-path-daily` is the remaining check.

## 4. Rules

- Steps perform only registered actions; the routine never writes on its own
  (LMS brief §4).
- A day is computed in the routine's zone (Akhand Path: the site's zone,
  `siteConfig.timeZone`), not the server's: a reading at 23:30 belongs to that day.
- Do not change the Akhand Path page's behaviour in the pass that moves its
  queries into `paath-day.ts`: compare the day page before and after.
- The dock files belong to the action-layer work; coordinate before editing
  `packages/dock` and `packages/actions/src/server/dock.ts`.

## 5. Build order

1. `paath-day.ts` (read-only day status) + four registry entries with
   `status` for a `day` subject; `check:registry` passes. No schema.
2. Routine course: an "Akhand Path, daily" course on Sophia with the four
   task steps and `routine` settings; enrol the two readers.
3. Dock: today's routine card on arts-collective.
4. Daily video post routine (3.4).
5. Dock on org domains (LMS brief dock slice 2), so the card shows on the
   Akhand Path page itself.

## 6. Open questions (developer)

1. Daily target: how many passages a day (pace to finish by a date, or a
   fixed number)?
2. Is "Send the recording" a daily step, or does approval stay occasional?
3. Readers enrolled: the two current readers (author + one `yes` RSVP)?
4. Subject scope in the registry: add a `day` scope beside `person|org|thread`,
   or keep the day as a parameter of person-scoped entries (simpler, no
   change to `performAction`'s subject handling).
5. Rung 7: when a project becomes an organisation, do its pieces move to the
   new org (`threads.org_id` changes) or stay the person's and get listed on
   the org (`thread_orgs`)?
6. Which ladder to build first after Akhand Path: the person's video post
   ladder (rungs 1-5), or the rungs 2-3 entries alone (share, video on a
   piece), usable by every course?
