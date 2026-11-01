# A `series` thread kind: design (2026-10-10)

Design for replacing IFAC's "meeting with `metadata.series`" with a proper `series` kind and
lazily materialised sessions. From a read-only survey on 2026-10-10 (code read, `\d`, SELECT).
Companions: `docs/open/IFAC_SERIES_PLAN_2026-10-10.md` (E6),
`docs/open/SERIES_EMAIL_DESIGN_2026-10-10.md`, `docs/open/EMAIL_RSVP_DEBRIEF_2026-10-10.md`.

## 1. Current state (verified 2026-10-10)

- `threads.kind` is `varchar(20)` with no CHECK, so `series` needs no column change.
- IFAC series `Gnove0JPbyLYG4_QCTt-V`: kind `meeting`, WEEKLY, `scheduled_at` 2026-10-13 01:00Z,
  `metadata.timeZone` America/Los_Angeles, `nextcloud_last_sync` set. Week topics `5kx2B74…` #1,
  `NG24eOT…` #2, `Ho_Ec15…` #3 (published; slugs `session-2`, `session-3`, `session-3-2` no
  longer match numbers). Two archived week-1 topics at 2026-10-08 23:00 with notes/hosts rows
  still keyed to that slot.
- Week numbers derive from the anchor (`meeting-series.ts:182-187`): a schedule move renumbers
  every week; `/series/[slug]/[n]` looks weeks up in a 12-past/24-ahead window
  (`[n]/page.tsx:34-36`).
- **DST mismatch from 2026-11-02:** the series pages step in the series zone, but
  `pushThreadToCalendar` writes a UTC DTSTART + RRULE (`org-calendar.ts:262-288`,
  `nextcloud/src/calendar.ts:93`) and `expandOccurrences` steps in UTC
  (`utils/src/recurrence.ts:24-33`), so the hub calendar and Nextcloud will show 17:00 Pacific.

## 2. Readers of `threads.kind` and the decision for `series`

| Reader | Decision |
|---|---|
| `OFF_FEED_KINDS` `thread-kinds.ts:40` | leave `series` out (stays in feeds/forum/search); keep `series_session` in |
| `SCHEDULED_KINDS` `org-calendar.ts:71`; cms-ui `surface/types.ts:1255`; `arts-collective/lib/org-console.ts:21,136` | include (feeds calendar, `syncOrgCalendarEvents`, forum "upcoming", `getPreviousMeetingOccurrence`) |
| `getStandingMeeting` `org-calendar.ts:514-547` | exclude by kind, replacing the `presented_series` filter |
| `featureMeeting` `thread-admin.ts:89`; standing flags in apps' `/api/hub/threads/[id]`; `ThreadSurface.tsx:160` | exclude (a series cannot be the standing meeting) |
| `getOfferingThread`, forum `visibleTo`, search | no change (kind-agnostic) |
| cms-ui compose catalogue, `content-fields.ts:40,117` | add `series` (section 5) |
| `surface/kinds.ts:19` | meeting accent |
| `loadSeries` / `listMeetingSeries` `meeting-series.ts:381,433` | accept `series`; keep `meeting`/`event` as legacy aliases until the IFAC row flips; drop `workshop` |
| IFAC `seriesIds` `ifac/lib/reminders.ts:213` | include |
| sunjay `reminders.ts:36`, amrit `reminders.ts:32` | exclude (they remind only `scheduled_at`) |
| Nextcloud sync `org-calendar-sync.ts:169` | include, push-only for series (excluded → deleted as orphan; pulled → `scheduled_at` changes without moving weeks) |
| Essay card picker `arts-collective/lib/studio-actions.ts:234` | treat as meeting |
| Newsletter `GATHERING_KINDS` `newsletter/src/blocks.ts:251` | include |
| `EVENT_KINDS` `person-page.ts:64`, `presence.ts:176`, `blocks/server/person-page.server.ts:60` | include |
| IFAC `api/rsvp/route.ts:29`, `lib/data.ts:69` | exclude |
| IFAC `api/hub/meeting/attendance/route.ts:45-49` | refuse `series` (an attendance write would overwrite a `subscribed` row on the same key) |
| IFAC `lib/cms/actions.ts:248` | keep the kind; never rewrite `kind`/`scheduled_at`/recurrence of a series from compose |
| commerce, `artist-offerings.ts:187`, arts-collective `network.ts:115` | exclude (unchanged) |

## 3. Sessions: lazily materialised

- The rule (zone-aware `seriesOccurrencesFrom`) still produces empty future slots; a slot becomes
  a row the first time anything is written to it (host, write-up, publish, RSVP).
- Sidecar `series_sessions` keyed by the session thread id: `number`, `slot_at`, `starts_at`,
  `status` (`scheduled|cancelled`), `published_at`. Content stays in `meeting_occurrence_notes`
  (migration 201; shared with the planner, rota and circles).
- `meeting_occurrence_notes` and `meeting_hosts` stay keyed by `(series_id, occurrence_at)` with
  `occurrence_at = starts_at`; a move rewrites both keys and the session's `scheduled_at` in one
  transaction (lift the parked swap out of `saveSeriesSchedule`, `:1246-1296`).
- Cancel: `status='cancelled'` plus the session thread's `is_rsvp_enabled=false`.
  Move: change `starts_at`, keep `slot_at`; "moved" = `starts_at <> slot_at`.
- Stable URLs: resolve `/series/<slug>/<n>` by `(series_id, number)`, else derived ordinal plus
  `metadata.series.numberOffset` (set by `saveSeriesSchedule`).
- Duplicates: create the thread, insert the sidecar `ON CONFLICT (series_id, slot_at) DO NOTHING
  RETURNING`; on losing the race archive the new thread.

## 4. Migrations (draft; claim numbers with `/new-migration` when written)

- `series_sessions` table with unique `(series_id, number)`, partial unique `(series_id, slot_at)`
  and `(series_id, starts_at) WHERE status <> 'cancelled'`, index `(org_id, starts_at)`; backfill
  from non-archived `series_session` threads linked through `meeting_occurrence_notes`
  (expected 3 rows). Full SQL in the 2026-10-10 survey report; verify with `BEGIN; … ROLLBACK;`.
- Kind flip for IFAC: `UPDATE threads SET kind='series' WHERE id='Gnove0JPbyLYG4_QCTt-V' AND
  org_id='ifac' AND kind='meeting'`. **Apply only after every reader in section 2 is deployed to
  ifac**: flipping first gives 404 series pages, silent subscriber letters, the Nextcloud event
  deleted, and the series missing from the calendar and forum "upcoming".

## 5. Compose

- `catalogue.ts`: a `series` option (kind `series`, `canPublishDated` and `ctx.hasSeries`) with a
  shared `group: "gathering"` so the picker draws "One meeting | Series".
- `content-fields.ts`: `series` in `ContentKind` and `SCHEDULED`; "First session", required
  `time_zone`, "Last session" (`recurrence_until`), WEEKLY fixed; lede, also-zones, reminder
  days; joining = pasted link (+ meeting ID, passcode, other ways) or `create_talk_room`; no host
  group (planner sets hosts).
- IFAC adapter/actions: create via `createThread(kind 'series')` then `saveSeriesSchedule`,
  `saveSeriesSettings`, `ensureSeriesTalkRoom`; update never writes kind/schedule directly; open
  `/hub/series/<id>` after save; map fields in `defaultThreadToAnswers` (`ComposeSurface.tsx:403`).

## 6. Generalisation

- Now: IFAC only. Reading circles later register their sitting topics in the sidecar (kind stays
  `reading_group`). Workshops later: a series with no rule (`slot_at` NULL) replacing
  `workshop_sessions`. Standing meetings: do not convert; add `occurrence_at` to `thread_rsvps`
  (debrief option B).

## 7. Clean-up

- Safe now: stale "until migration 202" comments (`meeting-series.ts:986-987`,
  `subscribe/route.ts:11-12`) and the 23514→503 branch (`meeting-series.ts:1011-1016`); "no button
  calls this yet" (`subscribe/route.ts:17`); duplicate `SERIES_SESSION_KIND` export
  (`meeting-series.ts:54`).
- No callers: `setPresentedSeries` (remove); `listMeetingSeries` (rewrite as the series picker).
- Missing `org_id` filters: `meeting-series.ts:759-760`, `:786`.
- Later: `readPresentedSeriesId` duplicates `getPresentedSeriesId`; consolidate `zonedInputToDate`
  (4 apps), the occurrence helpers, and `ensureSeriesSessionTopic`/`ensureCircleSessionTopic`.
- Data to raise with the developer: IFAC `standing_meeting` points at archived `WICmSS4…`; two
  `attendees` ledger rows on the series thread of unknown origin; detached 2026-10-08 notes/hosts.

## 8. Steps

1. Readers accept `series` (section 2), no data change.
2. Sidecar migration and backfill.
3. Service switch: `getMeetingSeries` reads the sidecar; `ensureSeriesSession`; publish writes the
   column; `cancelSeriesSession` / `moveSeriesSession`; `saveSeriesSchedule` with `numberOffset`;
   week route resolves by row.
4. Kind flip, after step 1 is live on ifac.
5. Compose "One meeting | Series".
6. Clean-ups; drop the `meeting` alias after one stable release.
