# Email and RSVP: debrief for the simplification work (2026-10-10)

This debrief is for the session that simplifies the platform's RSVP and email handling. It covers how RSVPs are stored, written and expired today, who sends which letter and how it is logged, and the email package's build, template store, merge tokens and unsubscribe paths. It ends with an ordered plan and the questions that are the developer's to answer.

The survey ran on 2026-10-10 between about 19:00 and 19:55 EDT, against the shared tree and `elkdonis_dev`. It was read-only: `SELECT`, `\d`, and two read-only checks in the `admin` container. No code or data was changed. Line numbers are for that time. `apps/ifac/src/lib/reminders.ts`, `packages/services/src/meeting-series.ts` and `packages/email/src/seed.ts` were being edited by other sessions while this was written.

Companion document: `docs/open/rsvp-map-2026-10-10/README.md` ("the map"). It has the full per-app entry-point table, the UI surfaces and its own risk list. Claims taken from it without re-checking are marked "(map)".

Labels: **verified** (code: read at the cited line; db: queried 2026-10-10; run: command executed), **assumed**, **unknown**.

## 1. Target (developer decisions, 2026-10-10)

1. **One kind of RSVP.** Every RSVP is the same record, handled the same way, and every RSVP needs a signed-in person. The "guest RSVP" and "member RSVP" split goes.
2. **Subscriptions.** A series subscription is a standing request for reminder emails. Each letter asks the person to confirm for that session ("I'm coming"), and only a confirmed person gets the video link. Subscribing does not count as attendance. It is stored as `thread_rsvps.status = 'subscribed'` on the series thread (migration 202). The same model is to apply to every recurring meeting, the standing weekly meeting card included.
3. **Expiry.** An RSVP on a recurring meeting does not carry over to the next cycle.
4. **Retired app.** The `apps/inner-gathering` container was stopped on 2026-10-10. It must not be restarted, and its code paths can be removed.

## 2. Current state

### 2.1 The two kinds of RSVP today

**Member RSVP.** This is one row in `thread_rsvps` (verified, db `\d`):
- Primary key `(thread_id, user_id)`, so there is one row per person per thread.
- ~~`status` is CHECK `yes|no|maybe|waitlist`. Migration 202 (`subscribed`) is written but not applied.~~ Correction 2026-10-10 ~19:45 EDT: migration 202 is applied; the CHECK is `yes|no|maybe|waitlist|subscribed` (verified, db, `pg_get_constraintdef`).
- Also: `flavour`, `promise_next`, `created_at`, `updated_at`.
- 29 rows on 17 threads from 8 users. 7 of these rows are `yes` on IFAC `series_session` week topics (4) or `maybe` on IFAC meetings (3) (verified, db).
- It is written through `setRsvpStatus` (`packages/services/src/thread-rsvp.ts:80`), `setMeetingAttendance` (`standing-meeting.ts`, map), `confirmOrderPaid` (map) and the series functions.

**Guest RSVP.** This is a signed-out form that writes two tables:
- One `guest_submissions` row (`kind='rsvp'`; name, email, `metadata.phone`, `metadata.wants_reminder`; `thread_id` nullable; `linked_user_id` never set).
- An upsert into `contacts` (`source='rsvp'` or `'ifac_rsvp'`, `ON CONFLICT DO NOTHING`).

Guest rows on 2026-10-10 (verified, db):
- `guest_submissions` holds 10 `rsvp` rows and no other kind, with 7 distinct emails:
  - inner_group: 8 (6 on "Daily Online Presence", DAILY; 2 on "Board Meeting", 2026-09-27);
  - amrit_canada: 1, on an archived thread;
  - IFAC: 1 with no thread.
- 5 of the 10 emails match an existing `users.email`, so those people had accounts but answered as guests. None also has a member row on the same thread.
- Every guest row is for an occurrence that has passed: the daily cycle has rolled, the one-off has passed, or the thread is archived. No guest row stands for a future attendance.
- `contacts`: 7 rows from RSVP sources (inner_group 5, amrit_canada 1, ifac 1). One of them has an account.

Where the two differ:

| Aspect | Member (`thread_rsvps`) | Guest (`guest_submissions` + `contacts`) |
|---|---|---|
| Identity | `users.id` from the session | free-text name + email, unverified |
| Storage | one row per (thread, user), updated in place | one row per submission, no dedupe (a resubmit adds a row) |
| Eligibility | `checkRsvpEligibility` (`thread-rsvp.ts:29`): enabled, deadline, capacity | enabled + deadline in innergathering / sunjay / amrit (`api/rsvp/route.ts:65-70`); **no capacity check** anywhere; IFAC checks nothing (`apps/ifac/src/app/api/rsvp/route.ts:24-38`) |
| Price | innergathering sends priced threads to Stripe (`api/threads/[id]/rsvp/route.ts:141`); arts-collective answers 402; sunjay, amrit and fourthway have no check (map) | innergathering refuses priced threads with 409 (`api/rsvp/route.ts:74`); sunjay and amrit do not check (verified, code) |
| Confirmation mail | only when `previous !== 'yes'` (innergathering `:218`, sunjay `:157`, amrit `:153`) | on every submission (innergathering `api/rsvp/route.ts:110`, sunjay/amrit `:98`, ifac `:67`) |
| Owner notice | author email, else `siteConfig.fallbackNotifyEmail`, only when `previous !== 'yes'` | same recipient on every submission; IFAC uses `NEXT_PUBLIC_IFAC_OWNER_EMAIL ?? info@ifacgroup.com` (`ifac api/rsvp/route.ts:63`) |
| Counted in capacity | yes (all-time `yes`, `thread-rsvp.ts:63`) | no |
| Counted on display | everywhere | only in the template apps' `getAttendanceCount` / attendee lists and IFAC `/manage` (map §5.6) |
| Reminders | IFAC series week topics, sunjay, amrit (and the retired tick) | sunjay and amrit only (`apps/sunjay/src/lib/reminders.ts:68-73`); IFAC stores `wants_reminder: true` and nothing reads it |
| Manual blast (meeting-trigger) | yes, cycle-filtered | yes, cycle-filtered on `created_at` (`innergathering api/threads/[id]/trigger-email/route.ts:72-77`) |
| Mailing list side effect | none | `contacts` row, which makes the guest a **newsletter recipient**: `listRecipients` reads `contacts` minus unsubscribed (`packages/newsletter/src/server.ts:154`) |
| Join link | ungated except IFAC series pages | no join link (no account) |

### 2.2 The duplicate routes

Member route `POST/DELETE /api/threads/[id]/rsvp` (verified, code, except where marked):

| App | Auth / scope | Price | Writes | Mail | Variant |
|---|---|---|---|---|---|
| innergathering | `getViewer`; org-scoped (`:63-64`) | priced → `createThreadOrder` + Stripe (`:141-181`) | `setRsvpStatus` (`:183`); workshop materials share (`:188`); `min_attendees_notified` (`:204`) | confirmation `:219`, owner `:239`, minimum reached `:253`; no `threadId` passed | 1 (paid fork of 2) |
| sunjay | `getViewer`; org-scoped | none | `setRsvpStatus` (`:127`), `min_attendees_notified` (`:143`) | confirmation `:173` with app-local `meeting` config body and materials as links; owner `:199`; minimum `:213` | 2 |
| amrit-canada | as sunjay; the file differs only in the emblem constant and log prefixes (verified, `diff`) | none | as sunjay | `:169`, `:195`, `:209` | 2 |
| arts-collective | `getCurrentUser`; any org's published PUBLIC thread (`:36-42`) | 402 on paid (`:110`) | `setRsvpStatus` (`:119`), materials grant/revoke (`:121`, `:145`) | none | 3 |
| fourthwayBookreaders | org-scoped (`:22`) | none | `setRsvpStatus` (`:40`); `reading_group` grants org `viewer` (`:45-51`) | none | 4 |
| inner-gathering (stopped) | not org-scoped; `session.user.id` (map) | none | `setRsvpStatus`, in-app `notifications` (map) | mails with no `orgId` (map) | 5 |

The map counts four behaviours. It treats innergathering as a fork of the sunjay/amrit route.

Guest route `POST /api/rsvp` (verified, code):

| App | Thread check | Eligibility | Price | contacts source | Notes |
|---|---|---|---|---|---|
| innergathering | org, published | enabled, deadline | 409 on priced (`:74`) | `rsvp` | |
| sunjay, amrit-canada | org, published | enabled, deadline | none | `rsvp` | the two files are identical except log prefixes (verified, `diff`) |
| ifac | optional `event_id`; an unmatched id is stored as NULL | none | none | `ifac_rsvp` | answer folded into `message` as "Status: …" (`:48`); `wants_reminder` forced true (`:49`); its form `components/rsvp-form.tsx` has no importer (map) |

Other RSVP writers (map, re-checked where cited):
- IFAC hub `POST /api/hub/rsvp` (`setRsvpStatus` at `apps/ifac/src/app/api/hub/rsvp/route.ts:61`; no mail).
- The attendance routes `api/hub/meeting/attendance` (ifac, innergathering) and sunjay `api/center/attendance` (drops `promiseNext`).
- IFAC `api/series/rsvp` and `api/series/coming`, through `answerSeriesWeek` (`apps/ifac/src/lib/series-mail.ts:129`).
- The fourthway `rsvpSession` server action (`lib/circle-actions.ts:410`).
- `confirmOrderPaid`.
- inner-gathering `join` and the `attendees` PATCH. The PATCH accepts any user's status for any thread, with a TODO at `:92` (verified, code). It is now unreachable because the container is stopped (section 2.12).

### 2.3 Expiry on recurring meetings

How it works now:
- `isWithinCurrentCycle(ts, scheduledAt, pattern, duration)` (`packages/utils/src/recurrence.ts:74`) returns true when `ts` is after `lastOccurrenceEnd` (`:41`).
- The cycle is a fixed interval from the thread's `scheduled_at`: DAILY 1 day, MONTHLY 30 days, WEEKLY/CUSTOM 7 days, stepped in UTC (`:24-33`).
- Non-recurring threads never expire (verified, code).
- It is applied only in the GET of the member route (innergathering `:100`, sunjay `:93`, amrit `:89`; the retired app `:51`). The GET reports an old row as "not answered". The template apps' `lib/data.ts` counts and the trigger-email recipient query use the same cutoff (`trigger-email/route.ts:57-68`) (verified, code).
- Rows are never rewritten or deleted at rollover.

Why old `yes` rows still count:
- **Capacity.** `countConfirmedRsvps` counts all `yes` rows (`thread-rsvp.ts:63-67`). A full recurring meeting therefore refuses its own past attendees' new answer. The attendance routes skip the check only for a current holder (`apps/ifac/src/app/api/hub/meeting/attendance/route.ts:78-90`).
- **Meeting light.** `resolveMeetingLight` counts `yes`+`maybe` with no time filter (`packages/services/src/standing-meeting.ts:230`). Example (verified, db): inner_group "Daily Online Presence" (`8w3PZ5d0zevDsqfJLdLor`, the inner_group standing meeting, DAILY, `min_attendees` 2) has 5 `yes` rows, the newest from 2026-10-01. None belongs to the current daily cycle, yet the light reads 5 ≥ 2.
- **`/center`, calendar, forum and alerts.** `center.ts:194-195`, `:248`, `:336`; `org-calendar.ts:439`; `forum.ts:664`, `:842` count `status='yes'` with no cycle filter. `viewer-alerts.ts:56` instead drops recurring threads entirely (verified, code).
- **Reminders.** The sunjay/amrit tick mails every `yes` and every guest ever recorded for the thread (`apps/sunjay/src/lib/reminders.ts:61-74`). It reminds only the primary `scheduled_at`, so a recurring meeting is reminded once until someone moves `scheduled_at` (`:39-46`). sunjay's "Ritual Theatre Lab" shows this (verified, db): ledger occurrence 2026-10-03 00:30, `scheduled_at` now 2026-10-24.
- **One-shot flags.** `min_attendees_notified` is set once and never reset (innergathering `:204`).

Why a re-answer sends nothing:
- `previous = getRsvpStatus()` reads the old row's status regardless of cycle.
- A person who said yes last week and says yes again this week has `previous === 'yes'`, so neither the confirmation nor the owner notice is sent (innergathering `:218`, `:238`; sunjay `:157`, `:198`; amrit `:153`, `:194`). `setRsvpStatus` does bump `updated_at` (`thread-rsvp.ts:89`), so the GET then reports them as current.

Series weeks already avoid all of this (verified, code):
- Each week has its own `series_session` topic thread, created on first use by `ensureSeriesSessionTopic` (`meeting-series.ts:740`). Its rows are naturally per occurrence.
- That function has no lock or unique key; week 1 has two topic threads (map).
- `rsvpSeriesSession` creates the topic even for `going: false` (`:799`).
- The first person to answer becomes the topic's `author_id` (`:764`).
- Live rows: three week topics are linked, holding 1, 2 and 1 `yes`. None has `metadata.seriesSession.publishedAt`, so all three weeks are drafts (verified, db).

#### Options for per-occurrence answers

| | A. One thread per occurrence (series-week model) | B. `occurrence_at` on `thread_rsvps` | C. Keep one row, apply the cutoff everywhere |
|---|---|---|---|
| Change | generalise `ensureSeriesSessionTopic` to every recurring thread | new key column; PK becomes `(thread_id, user_id, occurrence_at)` with a NOT NULL sentinel for "not occurrence-bound"; readers filter by occurrence | shared SQL helper for the cutoff; edit every reader |
| Old rows | stay on the parent and become history | backfill each row's `occurrence_at` to the occurrence its `updated_at` answered; they stop counting | unchanged, filtered out |
| Answer ahead (next week, `promise_next`) | yes, on the next topic | yes, a row for the next `occurrence_at` | no: one row per person |
| Subscription and attendance by the same person on one thread | parent holds `subscribed`, topic holds `yes` | two rows, different `occurrence_at` | **collides on the PK**: `setSeriesSubscription` overwrites an attendance row on the parent (`meeting-series.ts:971-976`) |
| Capacity, light, counts | correct per topic with no reader changes | each reader adds `AND occurrence_at = <current>` | each reader adds the cutoff; MONTHLY stays 30 days; UTC stepping |
| Cost | a thread per occurrence (365 a year for a daily meeting); each is a forum/feed object (`series_session` is in `OFF_FEED_KINDS`); needs a unique key and a non-person author | one migration; every `status='yes'` reader edited; occurrence keys must be JS-computed (rule in `.claude/rules/areas/threads.md`, microsecond comparison) | lowest; does not fix the subscription collision or answering ahead |
| Fits existing keys | `meeting_hosts`, `meeting_occurrence_notes` and `thread_reminder_sends` are keyed `(thread_id, occurrence_at)`, not by topic | same key shape as those three tables | n/a |

Recommendation: **B** as the store, assumed to be the better fit; the developer decides (section 5).
- Under A, every recurring meeting would get a thread per occurrence just to hold RSVPs. Under B, RSVPs use the same `(thread_id, occurrence_at)` key as hosts, notes and the reminder ledger, and subscriptions can sit beside attendance.
- Series week topics can stay as discussion pages (E5 in the IFAC plan) while their RSVP rows move to `(series_id, occurrence_at)`. Or they can stay on the topics with `occurrence_at` = the topic's `scheduled_at`.
- `reading_group` rows mean "joined the group", not attendance (map §6), so they must keep the sentinel and never expire.

### 2.4 Subscriptions (series, in source; not live)

In source (verified, code; db where stated):
- `setSeriesSubscription`, `isSubscribedToSeries`, `listSeriesSubscribers` and `unsubscribeSeriesByEmail` are at `meeting-series.ts:955-1022`.
- `POST/GET /api/series/subscribe` exists (`apps/ifac/src/app/api/series/subscribe/route.ts`). Its header says no button calls it yet.
- Until migration 202 is applied, the insert fails the CHECK and the route answers 503 (`meeting-series.ts:978-981`). Migration 202 is unapplied (verified, db).

The subscriber letter (`apps/ifac/src/lib/reminders.ts:220-320`, edited during this survey):
- It goes out `reminderDays` (default 2) before each published, non-past week, and not when the week is less than 3 hours away.
- The ledger kind is `subscribers`, keyed on `(series_id, week_at)`.
- A subscriber who has not said yes gets an "I'm coming" link. It is a signed `/api/series/coming` link with an HMAC over `(series, at, userId)`: GET shows a button and POST writes (`apps/ifac/src/app/api/series/coming/route.ts`).
- Since this survey began, the join link and join details go only to subscribers who already said yes (`reminders.ts:286-296`).
- No week is published yet, so no subscriber letter can send (verified, db).

To generalise to every recurring meeting:
- A subscription is a `subscribed` row on the recurring thread, under the occurrence sentinel in option B.
- An "I'm coming" answer is a `yes` row for one `occurrence_at`.
- The standing meeting card (`StandingMeetingFace`) would write per-occurrence rows. "We'll make it next time" and `promise_next` become a row for the next occurrence instead of a flag.
- One reminder engine (step 4) mails subscribers N days ahead and confirmed attendees shortly before.
- **The join link must be gated on a `yes` for that occurrence.** Today only the IFAC series pages gate it. `MeetingBanner.tsx:255`, `ThreadSurface.tsx:107`, the template `[feed]/[slug]` pages and the confirmation and reminder letters show it to anyone who can see the page (map §5.4).

Generic `yes` readers are safe from `subscribed` rows: the migration header's argument holds, because they all filter `status='yes'`. `listAddressBook` is the exception (section 2.10).

### 2.5 Sending: who sends what

Rules that apply to all rows below (verified, code):
- `email_sends` gets a row only when `orgId` is passed (`packages/email/src/client.ts:114`). Its `thread_id` is set only when `threadId` is passed (`:147`).
- `renderWithOverrides` (`packages/email/src/index.ts:294`) applies stored org words only when the caller passed no `bodyText` (`:349-354`). A caller's `copy` slot beats the stored slot of the same id (`:358`). A stored layout (`config.html`) replaces the body whatever the caller passed (`:331-342`). With no `orgId` it returns the network template untouched (`:300`).
- Owner-notice and trigger links are built from `request.nextUrl.origin` in every route that sends them: innergathering `api/rsvp:103`, `api/threads/[id]/rsvp:208`, `trigger-email:85`, and the same lines in sunjay and amrit. `CLAUDE.md` says that origin reads `0.0.0.0:<port>` (**assumed** for these routes; not probed). innergathering's trigger falls back to that URL as `meetingUrl` (`trigger-email/route.ts:96`).

| Letter | Sender (path:line) | Template key / ledger `kind` | `email_sends` | `thread_reminder_sends` | Can the org-edited template change the words? |
|---|---|---|---|---|---|
| Confirmation, member | innergathering `api/threads/[id]/rsvp/route.ts:219` | `rsvp-guest` / `rsvp` | yes, `thread_id` NULL | – | **yes, and it does**: inner_group's stored `rsvp-guest` is a layout (section 2.7). No `threadId`, so per-thread keys never resolve |
| Confirmation, member | sunjay `:173`, amrit `:169` | `rsvp-guest` / `rsvp` | yes, NULL thread | – | stored words only when the app-local `meeting` / `meeting:<id>` config has no `bodyText` (`apps/sunjay/src/lib/email-template-settings.ts:15`); a stored layout would win; no rows exist |
| Confirmation, guest | innergathering `api/rsvp:111`; sunjay/amrit `:99`; ifac `:67` | `rsvp-guest` / `rsvp` | yes, NULL thread | – | yes (no `bodyText` passed); inner_group layout applies; ifac has no rows |
| Confirmation, series week | ifac `lib/series-mail.ts:181` | `rsvp-guest` / `rsvp` | yes, `thread_id` = week topic | – | stored org words yes; `threadId` is the week topic, so `rsvp-guest:<seriesId>` never resolves; `links: []` (no materials) beats stored links |
| Owner notice | same routes `:239`/`:199`/`:195`; guest `:127`/`:115`/`:75`; series `series-mail.ts:199` (host/co-host, else the owner address) | `rsvp-owner` / `notification` | yes | – | stored words yes; a stored layout would mail every token verbatim: `rsvp-owner` has no `MERGE_FIELDS` entry (`merge-fields.ts:142-209`) and is `editable: false` in `samples.ts` |
| Minimum reached | innergathering `:253`, sunjay `:213`, amrit `:209` | `rsvp-owner` / `notification` | yes | – | as above |
| Reminder, IFAC attendee ("day", "soon") | `apps/ifac/src/lib/reminders.ts:120-193` (`purpose: attendee`) | `reminder` / `reminder` | yes, `thread_id` = topic | `attendees-day`, `attendees` on the topic | no: `bodyText` always passed (`:170`); a layout or other copy slots would apply |
| Reminder, IFAC subscriber | `reminders.ts:252-320` (`purpose: subscriber`) | `reminder` / `reminder` | yes, `thread_id` = series | `subscribers` on (series, week) | no for body (`bodyText` at `:294`) or `reminder.intro` (`copy` at `:293`); `reminder:<seriesId>` would resolve for layout and other slots |
| Reminder, IFAC host / co-host | `reminders.ts:322-365` (`purpose: host`) | `reminder` / `reminder` | yes | `host`, `co-host` via `claimHostReminder` (`meeting-rota.ts:618`) | no (`bodyText`, `copy` passed) |
| Host assigned (IFAC) | `series-mail.ts:80-119` (`purpose: host-assigned`) | `reminder` / `reminder` | yes, `thread_id` = series | none: no dedupe; `assignSeriesRole` returns `changed` for the caller (`meeting-series.ts:888`) | no |
| Reminder, sunjay / amrit attendee | `apps/sunjay/src/lib/reminders.ts:104`, `apps/amrit-canada/src/lib/reminders.ts:100` | `reminder` / `reminder` | yes, `thread_id` NULL (verified, db: sunjay row `SjSGkKh4…`) | `attendees` (`:53`); its NOT EXISTS ignores `kind` (`:43-46`) | only when the app config has no `bodyText` |
| Reminder, innergathering host | `apps/innergathering/src/lib/reminders.ts:41` | `reminder` / `reminder` | yes | `host` | no (`bodyText` always) |
| Reminder, retired tick | `apps/inner-gathering/src/lib/reminders.ts:76` | `reminder` / none | **no** (no `orgId`) | `attendees`, all orgs but amrit (`:28`) | no (`renderWithOverrides` short-circuits) |
| Meeting trigger (manual reminder / cancellation / confirmation) | innergathering `trigger-email:90`, sunjay `:133`, amrit `:129` | `meeting-trigger` / **`reminder`** | yes, `thread_id` NULL | – | **no, never**: `sendMeetingTriggerEmail` calls `renderMeetingTriggerEmail` directly (`index.ts:438`), yet the suite lists the key as editable (`samples.ts`, `editable: true`); sunjay/amrit pass the app-local config `bodyText` |

Ledger evidence (verified, db):
- Live `email_sends` rows: `rsvp` ifac 7, inner_group 15, sunjay 2; `notification` 29; `reminder` inner_group 2 (host), sunjay 1. All are `queued`, because `email_events` has 0 rows.
- `thread_reminder_sends` rows not mirrored in `email_sends`, so assumed to come from the retired tick:
  - inner_group "Board Meeting" 2026-09-27, 1 recipient;
  - "Creative Writing" 2026-08-03, 1 recipient;
  - ifac "Weekly Meeting" 2026-10-05 and the IFAC series parent 2026-10-08 22:00, both 0 recipients.
- A second series-parent row (occurrence 2026-10-13 01:00, written 23:10 UTC) came from a blocking insert in `saveSeriesSchedule`. That insert is no longer in `meeting-series.ts` (verified, grep at 19:50).
- `email_sends.kind` is `reminder` for six different letters. A ledger reader cannot tell a trigger blast from a subscriber letter.

### 2.6 The template store

Mechanics:
- Storage is `email_template_settings (org_id, template_key, config)`, unique on `(org_id, template_key)`.
- `resolveOrgTemplate` (`packages/email/src/template-store.ts:219`) prefers `<key>:<threadId>` over `<key>`, but only when the sender passes `threadId`.

Rows on 2026-10-10 (verified, db): 5 rows, all `inner_group`.
- `rsvp-guest`: `html` + `project`, updated 2026-09-17.
- `welcome`: `links`.
- Three per-thread rows (`reminder:th_a78…`, `rsvp-guest:th_a78…`, `rsvp-guest:th_dGH…`) on two archived legacy threads.
- **IFAC has none.**

Gaps:
- **No shared UI writes a per-thread key.** Writers are the app-local helpers in sunjay and amrit (key `meeting`, a scheme outside `TEMPLATE_KEYS`) and the retired app.
- **Per-series overrides cannot work as wired.** Senders pass different thread ids:
  - the series week confirmation and the attendee reminders pass the week topic id;
  - the subscriber, host and host-assigned letters pass the series id.
  - So `rsvp-guest:<seriesId>` never applies, and `reminder:<seriesId>` would reach only some of the series' reminders.
- Every reminder sender passes `bodyText`, so stored body words are ignored there in any case.
- sunjay and amrit keep a second per-thread config (`materialIds`, `recipients`, `bodyText`) in the same table under `meeting:<id>`. Their own routes read it and pass it as caller props.

### 2.7 inner_group's stored confirmation layout mails literal tokens

This is a consequence of section 2.6 combined with the token rule in section 2.9.
- The stored `rsvp-guest` layout (4,129 bytes) contains 12 tokens (verified, db): `{guestName} {meetingTitle} {when} {location} {orgName} {threadKind} {summary} {calendarUrl} {threadUrl} {talkRoomUrl} {materialsUrl} {reminderSettingsUrl}`.
- The live innergathering build (BUILD_ID 2026-10-09 00:12) applies a stored layout with `values: mergeValuesFor(...)` (verified, in the bundled chunk `.next/server/chunks/_18c53e0b._.js`).
- The member route passes no `threadKind`, `summary`, `calendarUrl`, `threadUrl`, `talkRoomUrl`, `materialsUrl` or `reminderSettingsUrl`, and passes `location` only when the thread has one (`route.ts:219-228`). The guest route passes fewer still (`api/rsvp/route.ts:111-118`).
- `fillHtml` leaves unfilled tokens as they are (`merge-fields.ts:300-313`). Every inner_group confirmation since the layout was saved therefore carries text such as `{threadUrl}` (**assumed** from code and data; no bodies are stored, so the sent letters were not inspected). `email_sends` shows 15 inner_group `rsvp` sends, 2026-09-19 to 2026-10-06.
- The layout has no token for `meetingUrl`, so these letters carry no join link.

### 2.8 The `@elkdonis/email` build

Apps load `dist/` (verified, `packages/email/package.json:5-13`). No app aliases `src`, and `transpilePackages` does not change resolution. Production-mode apps (ifac, innergathering, sunjay, amrit-canada, arts-collective, fourthway) bundle the dist at build time, so a dist rebuild reaches each of them only on its next `next build`.

State during the survey (verified: mtimes, `grep` of `dist/index.mjs`, process list):
- Until 19:43 EDT the dist dated from 2026-09-20 14:11. It lacked `reminderSubject`, `reminderKicker` / `purpose`, `MERGE_ALIASES` (the `{threadUrl}` / `{coverImageUrl}` aliases) and the EmailShell phone styles.
- **At 19:43:42 EDT another session rebuilt the dist.** It now contains all of these and the `seed.ts` fix (section 2.9).
- An ifac `next build` was running at 19:44 (`next build` and postcss processes in `eac-ifac`, `.next` without a `BUILD_ID`). It will bundle the new dist.
- innergathering (built 2026-10-09), sunjay (10-04), amrit-canada (10-03), arts-collective (10-05) and fourthway (10-04) still carry the 09-20 dist.

What the rebuilt dist ships to an app on its next build (verified, `git diff packages/email`):
- `index.ts`: subject by lead time (`reminderSubject`, `:387`), kicker and preview by `purpose`.
- `templates/reminder.tsx`: `purpose` (`attendee | host | host-assigned | subscriber`), the footer sentence per purpose, and "Unsubscribe from this series" for subscribers.
- `merge-fields.ts`: `MERGE_ALIASES` for `reminder` and `meeting-trigger` (`:253-261`).
- `seed.ts`: `extractRegion` matches `marker=` (`:56-59`).
- `components/EmailShell.tsx`: **another session's uncommitted edit of 2026-10-08.** Narrower card padding (`:470`, `:478`), `data-eac-container`, and a `<style>` block in `<head>` with a 620 px media query (`:321-328`). This changes how every letter on every org looks.
  - `.claude/rules/areas/email.md` says not to use `<style>`. `check:portability` still reports "nothing that renders unreadable" (verified, run 19:46).
- Other `src` changes since 09-20 were not ruled out: the comparison used marker strings, not a full diff (unknown).

Subjects that change for existing senders once an app is rebuilt (verified, code):
- sunjay/amrit attendee reminders no longer always read "Starting soon": they get "Tomorrow — X", "On Monday — X" and so on (`index.ts:396-412`).
- Callers that pass no `purpose` get the attendee footer as before.

### 2.9 `check:fields` and "seeded to nothing"

Cause (verified, run):
- The 2026-10-08 EmailShell edit put `[data-eac-body]` and `[data-eac-footer]` into a `<style>` in `<head>`.
- `extractRegion` used `html.indexOf(marker)`, which found the head first: offset 1010, before `</head>` at 1124, with no `<table` before it. It therefore returned `''` for every editable letter.
- An inline `tsx` render of `rsvp-guest` and `reminder` in the `admin` container showed the bare marker at 1010 and the attribute `data-eac-body=` at 3347 / 3422.

Fix and status:
- Another session fixed it at 19:43:28 EDT by matching `${marker}=` (`packages/email/src/seed.ts:56-59`).
- `check:fields` then passed for welcome, provisioning, rsvp-guest, reminder and meeting-trigger (verified, run in `admin`, about 19:44).
- The fix shipped in the 19:43:42 dist.

Effect while it was broken: only `src` was affected, so `check-types` for `@elkdonis/email` failed. Live editors used the old dist, so their seeding was unaffected (assumed).

### 2.10 Merge fields and tokens

Tokens:
- `fillHtml` leaves unknown or unfilled tokens verbatim on purpose (`merge-fields.ts:216-223`, `:300-313`). In a stored layout, a field the sender did not pass reaches the recipient as `{name}`.
- Template mode of the newsletter "Gathering card" (`packages/newsletter/src/blocks.ts:439-442`, markup at `:300-349`) writes `{meetingTitle} {threadKind} · {orgName} {when} {location} {summary} {threadUrl}`. The "writing" card adds `{coverImageUrl}` (`:320`).
  - `reminder` and `meeting-trigger` name the link `rsvpUrl`, so a card in their layouts mailed `{threadUrl}`. Fixed in source by `MERGE_ALIASES`; live only after rebuilds.
  - `rsvp-guest` declares `threadUrl` but not `coverImageUrl`.
  - `rsvp-owner` declares no fields.
  - A `meeting-trigger` layout is never used (section 2.5).
- Fixed zone: every template, the merge-field `when` reader and `reminderSubject` use `America/Toronto` (`merge-fields.ts:32`, `templates/reminder.tsx:91`, `index.ts:400`). IFAC states Pacific / Eastern / Paris and works around it by putting its own three-zone line in `summary` (`series-mail.ts:188`).

Newsletter thread cards:
- The card time uses the fixed zone `CARD_TZ = "America/Toronto"` (`packages/newsletter/src/server.ts:406-425`).
- The card URL is `${baseUrl}/${section ?? "posts"}/${slug}` (`:448`). A thread with no `section`, such as series parents, week topics and standing meetings, gets `/posts/<slug>`. That path is not where IFAC serves a series (`/series/<slug>`) (assumed to 404; not probed).

### 2.11 Unsubscribe and preferences

Tokens and pages (verified, code):
- `unsubscribeToken` is an HMAC-SHA256 of `orgId:email` (`packages/newsletter/src/server.ts:188`). The secret is `NEWSLETTER_SECRET`, then `INTER_APP_JWT_SECRET`, then `SILEX_SESSION_SECRET` (`:172-178`).
- The IFAC series links reuse the HMAC over their own scope strings (`series-mail.ts:26-27`).
- `/unsubscribe` pages exist only in innergathering and hidden-enneagram (verified, `ls`). Both set `contacts.status='unsubscribed'` on GET through `unsubscribeContact` (an UPDATE, so an address with no `contacts` row is unaffected).
- IFAC has `/api/series/unsubscribe` (series only), which also writes on GET. Its `coming` route uses GET then POST because mail scanners open links (`api/series/coming/route.ts:13-16`). The two choices disagree.
- amrit-canada, sunjay and arts-collective have no unsubscribe route.

`contacts.status` (`new|contacted|joined|unsubscribed`):
- `unsubscribed` is honoured only by `listRecipients` (newsletter) and by `listAddressBook` / `listMailable` (address book; `listMailable` is unused, per `email.md`).
- **`sendEmail` checks no suppression** (`client.ts:60-133`). An address unsubscribed through `/unsubscribe` still gets confirmations, reminders, trigger blasts and subscriber letters.
- SendGrid unsubscribe events also set `unsubscribed` (`ledger.ts:201-208`). No events arrive, because `SENDGRID_EVENT_PUBLIC_KEY` is unset and `email_events` has 0 rows.

SendGrid ASM group:
- `asm.groupId` goes on every send that has an `orgId` (`client.ts:92`, `:125`), transactional or not. All six stored identities have one (verified, db).
- So a recipient who unsubscribes through SendGrid's group link stops getting that org's RSVP confirmations and reminders as well (assumed to be SendGrid's behaviour; not tested).

`reminderSettingsUrl`:
- No reminder-settings page exists.
- The field is passed only by the IFAC subscriber letter, as its unsubscribe link (`reminders.ts:306`). The admin preview passes an example URL.
- The footer link "Change when reminders reach you, or turn them off" therefore never appears in a real attendee reminder, and attendees have no way to stop reminders.

### 2.12 The address book counts every RSVP row as a "guest"

- `listAddressBook` (`packages/email/src/address-book.ts:89-97`) selects every `thread_rsvps` row on the org's threads, of any status and on any thread status, and labels it source `guest`. These are account holders, not guests.
- The real guests reach the address book only through the `contacts` rows the guest routes write.
- Once migration 202 is applied, `subscribed` rows also appear as `guest`, and so do `no` answers (`flavour='wont'`) and archived threads' rows.

### 2.13 The IFAC hub attendance route rejects the face's default answers

- IFAC's hub renders `StandingMeetingFace` without `attendance.options` (`apps/ifac/src/app/hub/page.tsx:285-299`), so the face offers its `DEFAULT_FLAVOURS` (`packages/cms-ui/src/hub/StandingMeetingFace.tsx:89-106`): `certain`, `this_week`, `early`, `hesitant`, `temporary`, `next_time`.
- The route validates against `RSVP_FLAVOURS` (`packages/services/src/standing-meeting.ts:54-73`): `certain`, `early`, `hesitant`, `maybe`, `next_time`, `wont`.
- `this_week` and `temporary` get 400 "That isn't one of the answers" (`apps/ifac/src/app/api/hub/meeting/attendance/route.ts:64-66`) (verified, code).
- For `early` / `hesitant` the face expects `yes` but the server stores `maybe`. For `next_time` it expects `no` but the server stores `maybe`.
- IFAC's `standing_meeting` key points at an archived thread (`WICmSS4ILHCm7b45sFZ3Q`) (verified, db), so the face may not be rendered at all today (assumed).

### 2.14 The retired `apps/inner-gathering` container

- The `inner-gathering` service is `exited` as of 19:42 EDT (verified, `docker compose ps -a`).
- The service has `restart: unless-stopped` and **no compose profile** (verified, `docker compose config`). A bare `docker compose up -d` with no service list would start it again (assumed from Compose behaviour).
- The following are inactive while it stays stopped:
  - its reminder tick, which mailed `yes` rows in every org except amrit, with no `orgId`, no ledger and `COALESCE(reminder_minutes_before, 60)` (`apps/inner-gathering/src/lib/reminders.ts:28-34`);
  - the unauthenticated-by-role attendees PATCH (`api/meetings/[id]/attendees/route.ts:88-99`);
  - its non-org-scoped RSVP route.
- `meetings.elkdonis-arts.org` is served by this container, so it presumably returns 502 now (assumed; not probed).

Code that can go with it:
- the whole `apps/inner-gathering` tree;
- `packages/hooks/src/useThreadRsvp.ts` and `useRealtimeAttendees.ts` (used only there, map);
- the `packages/db/src/queries/forum.ts` reply functions (`.claude/rules/apps/inner-gathering.md`);
- the SQL twin of the cycle maths in its `lib/data.ts`;
- its `email-template-settings.ts`, which writes `JSON.stringify(...)::jsonb`.

## 3. Constraints for the work

- Apply migration 202 before shipping any subscribe button: until then `setSeriesSubscription` answers 503.
- Take the next migration number with `/new-migration` right before writing; 202 is the latest file. Several sessions claim numbers.
- Do not let the new RSVP key compare `occurrence_at` against `threads.scheduled_at` in SQL. Pass JS-computed instants as `= ANY($list::timestamptz[])`, because timestamptz keeps microseconds (`.claude/rules/areas/workshops.md`).
- Keep `thread-rsvp.ts` free of kind branches and side effects, and keep paid seats granted only in `confirmOrderPaid` (`.claude/rules/areas/workshops.md`).
- Rebuild `@elkdonis/email` inside a container after changing it, then rebuild each production app that should get the change. Before any build, read `git diff packages/email`: the dist ships every session's uncommitted edits, as the 19:43 rebuild did with EmailShell.
- Do not restart `inner-gathering`. Remove or profile its service in `docker-compose.yml` only with the developer's agreement, since it held `meetings.elkdonis-arts.org`.
- Treat `reading_group` RSVPs as membership: excluding them from expiry keeps the fourthway circles' members.

## 4. Proposed simplification plan

Steps are ordered so each one can ship alone. "Rows" are live counts on 2026-10-10.

### Step 0. Stop the bleeding

Changes:
- Apply migration 202.
- Make the IFAC hub pass `attendance.options` built from `RSVP_FLAVOURS`, or make the cms-ui default import that vocabulary through a data-only module.
- Either clear inner_group's `rsvp-guest` layout tokens that no sender fills, or pass `threadUrl`, `threadKind`, `summary` and `calendarUrl` from the innergathering routes.
- Build external links with `publicOrigin()` instead of `request.nextUrl.origin` in the RSVP and trigger routes.

Risks:
- Editing the inner_group layout is an edit to production template data, so confirm the target with the developer first.
- The origin change touches three apps that need rebuilds.

Rows: `thread_rsvps` CHECK (schema only); 1 `email_template_settings` row if the layout is edited.

Apps: ifac, innergathering, sunjay, amrit-canada (rebuilds), cms-ui.

### Step 1. Per-occurrence RSVP key (option B, if chosen)

Changes:
- Migration: add `occurrence_at timestamptz NOT NULL DEFAULT <sentinel>` and change the PK to `(thread_id, user_id, occurrence_at)`.
- Backfill: for recurring threads, set `occurrence_at` to the occurrence each row's `updated_at` answered, computed in JS through one shared function. That function should be the series clock, so DST is handled.
- `subscribed` and `reading_group` rows keep the sentinel.

Risks:
- Every reader that counts `yes` must filter by occurrence, or it counts zero (it would count only sentinel rows). Readers: `thread-rsvp.ts`, `standing-meeting.ts`, `center.ts`, `org-calendar.ts`, `forum.ts`, `viewer-alerts.ts`, `address-book.ts`, `arts-collective/src/lib/commitments.ts:71-74`, the template apps' `lib/data.ts`, `meeting-series.ts`, `confirmOrderPaid`.
- Two occurrence clocks exist (UTC `expandOccurrences` and the zoned series clock). Pick one before the backfill.
- Rows written by IFAC week topics need a decision: stay on topics or move to `(series, at)`.

Rows: 29 `thread_rsvps` (8 `yes` on published recurring threads; 3 of them are `reading_group`).

Apps: every app that reads RSVPs. Services are source-exported, so one type error fails every app's check.

### Step 2. One RSVP service and one route shape

Changes:
- Write `packages/services/src/rsvp.ts` with `answer({orgId, threadId, occurrenceAt?, userId, answer, flavour?, promiseNext?})`. It does:
  - org scoping;
  - eligibility, with capacity counted per occurrence and the caller's own seat excluded;
  - the price gate (priced → checkout result, never a `yes`);
  - one upsert that writes `status`, `flavour` and `promise_next` together.
- It returns `{ changed, previous, status, count }`.
- One shared handler (for example `@elkdonis/rsvp/route` or a cms-ui server export) mounted as `app/api/rsvp/route.ts` in each app with `{ orgId, origin, mail }`. It replaces routes A, B, C, D and the fourthway action.
- `api/series/coming` stays as the signed-link entry point. It is account-bound, not a guest path (see Q4).
- Side effects (materials share, viewer-role grant for `reading_group`) become per-kind hooks that the handler calls after the write.

Risks:
- The paid flow in innergathering (Stripe) and the 402 in arts-collective must be preserved.
- arts-collective's network-wide PUBLIC scope is deliberate.
- Client components post to five URL shapes, and all must move: `rsvp-panel.tsx` ×3, `RsvpPanel` ×2, `ThreadSurface` connector, `StandingMeetingFace`, `MeetingBanner`, `series-rsvp.tsx`, fourthway `RsvpButton` / `SessionPanel`.

Rows: none (code only).

Apps: innergathering, sunjay, amrit-canada, arts-collective, fourthway, ifac; cms-ui.

### Step 3. One guest path removed

Changes:
- Delete the four `api/rsvp` guest routes and the guest forms. A signed-out "I'm coming" opens sign-in with `next=` and an RSVP intent parameter that the page replays after sign-in. No link carries an intent today (map §3).
- Stop writing `guest_submissions` with `kind='rsvp'`.
- Keep the 10 rows as history, read-only. None is a current attendance, so none needs converting.
- Drop the guest UNIONs from reminders, the trigger blast, `getAttendanceCount`, the attendee lists and admin `/rsvp` (hard-coded `amrit_canada`).
- Decide what happens to the 7 RSVP-sourced `contacts` rows (Q3).

Risks:
- innergathering's comment on the guest route records the original reason for guests: "4am sadhana" attenders without accounts (`api/rsvp/route.ts:7-16`). Turnout may drop.
- 5 of the 10 guest emails already have accounts, which suggests the sign-in prompt, not account creation, is the barrier (assumed).

Rows: `guest_submissions` 10 (kept); `contacts` 7 (decision).

Apps: innergathering, sunjay, amrit-canada, ifac, admin.

### Step 4. One confirmation and notification function

Changes:
- `sendRsvpMail({ orgId, threadId, occurrenceAt, person, previous, hostIds })` in `@elkdonis/email` or services. It sends:
  - the confirmation, with the join link only for `yes`;
  - the notice to the occurrence's host and co-host, else the author, else the org owner addresses (`identity.ownerEmails`);
  - the one-shot "minimum reached" notice, keyed per occurrence instead of `threads.min_attendees_notified`.
- It sends only when the answer changed for that occurrence, which removes the `previous === 'yes'` problem.
- It always passes `threadId` (the parent), `occurrenceAt` and a full prop set, so stored layouts can fill every declared token.
- Add a cancellation letter: today no DELETE sends anything (map §5.1).

Risks:
- Recipients change: IFAC owner notices move from the env address to stored `ownerEmails`.
- Duplicate sends while old and new routes coexist.

Rows: `threads.notify_on_min_attendees` is set on 2 threads, and `min_attendees_notified` on 1 (verified, db).

Apps: as step 2.

### Step 5. One reminder engine and one ledger

Changes:
- `packages/services/src/reminders.ts` with `runReminderTick(orgId, appOrigin)`, called from each app's `instrumentation.ts`. It walks occurrences, not `scheduled_at`.
- Kinds: `attendee` (day before and/or N minutes before, to `yes` for that occurrence), `subscriber` (N days before, to `subscribed`, with "I'm coming"), `host`, `co-host`, and `host-assigned` (event-driven, but logged).
- Each send claims `thread_reminder_sends (thread_id, occurrence_at, kind)` before mailing. All NOT EXISTS checks filter on `kind`.
- Pass `purpose`, so the subject, kicker and footer follow from it.
- Write `email_sends` with a distinct kind or a `purpose` category for each letter, so the activity tab can tell a reminder from a trigger blast.
- Fold `sendMeetingTriggerEmail` into the same rendering path (`renderWithOverrides`), so the editable `meeting-trigger` key actually applies.

Risks:
- An IFAC week could get both a day-before attendee letter and a subscriber letter. Define the overlap: the current 3-hour rule (`reminders.ts:199`) covers only "soon".
- sunjay's "NULL = off" (`reminder_minutes_before`) must be preserved.
- The first run after deploy must not mail past occurrences. Seed the ledger, or bound the window.

Rows: 16 `thread_reminder_sends` (keys stay valid); `email_sends` 68 (append-only).

Apps: ifac, innergathering, sunjay, amrit-canada (fourthway if circles get reminders).

### Step 6. Template words per org and per series

Changes:
- One key convention: `<templateKey>:<parentThreadId>` for a recurring thread or series. Every sender passes the parent id, never a week topic id.
- Move sunjay/amrit's `meeting` / `meeting:<id>` config into the shared store as per-thread `rsvp-guest` / `reminder` / `meeting-trigger` rows, or into a separate `materials` setting.
- Change the precedence so stored words beat code defaults. Callers pass facts (dates, join details) as fields or slots, not as `bodyText`.
- Add a per-thread "Letters" tab to the shared email suite, which replaces amrit's and sunjay's own `EmailSurface`.
- Give `rsvp-owner` merge fields, or keep it non-editable.

Risks:
- Every reminder caller passes `bodyText` today, and moving those facts into fields changes the letters' wording.
- The `check:fields` constraints apply: unique samples, nothing in the footer.

Rows: 5 `email_template_settings` (inner_group; 3 on archived threads, which can be deleted with the developer's agreement); sunjay/amrit `meeting*` rows: 0 live (verified, db).

Apps: sunjay, amrit-canada, innergathering, ifac, arts-collective (suite hosts).

### Step 7. Unsubscribe and preferences in the shared package

Changes:
- An `/unsubscribe` page and a POST handler exported from `@elkdonis/newsletter/server` (or `@elkdonis/email`), mounted in every sending app.
- One token format with a scope: `newsletter`, `series:<id>` or `reminders:<thread>`. The confirm action is a POST, so GET has no effect for mail scanners.
- One preferences record per (org, email) that `sendEmail` consults before any non-transactional kind.
- Decide whether `asmGroupId` stays on transactional kinds (`client.ts:92`).
- Pass a real `reminderSettingsUrl` in every reminder.
- Set `SENDGRID_EVENT_PUBLIC_KEY` so unsubscribe and bounce events arrive.

Risks:
- Links already mailed must keep verifying. Accept the old `orgId:email` token format alongside the new one, and do not rotate the secret.

Rows: `contacts` (1 `unsubscribed` today); possibly a new preferences table.

Apps: all sending apps (ifac, innergathering, sunjay, amrit-canada, hidden-enneagram, arts-collective).

### Step 8. Remove the retired app's paths

Changes:
- Delete the code listed in section 2.14.
- Remove or profile the compose service.
- Retire the `meetings.elkdonis-arts.org` proxy host (a human task).

Risks: other packages may import its helpers. Check `grep` and `check-types` across the tree.

Rows: none.

Apps: inner-gathering, hooks, db.

### Step 9. Address book and documentation

Changes:
- `listAddressBook` labels `thread_rsvps` rows `attendee` (or `subscriber`), filters `status IN ('yes','subscribed')` and excludes archived threads.
- Update `docs/reference/email.md` (it says "ifac has no reminders", and lists ifac `api/rsvp` but not the series routes) and `docs/reference/workshops-and-lms.md:43` (`registered_at`).

Rows: none. Apps: email suite hosts.

## 5. Open questions for the developer

1. **Occurrence model.** Option B (an `occurrence_at` column), A (a thread per occurrence) or C (cutoff everywhere)? If B, do IFAC week RSVPs move from the topic threads to `(series, occurrence_at)`?
2. **"Yes — 100%, every week".** On the standing meeting card, is this a subscription, or a standing yes that counts for each occurrence until withdrawn? The decision states that subscribing is not attendance. A standing yes would be a third state.
3. **Existing guest data.** Keep the 10 `guest_submissions` rows as history, or delete them? The 7 RSVP-sourced `contacts` are newsletter recipients today without an explicit opt-in. Keep, mark, or remove them?
4. **Signed links.** The subscriber letter's "I'm coming" link writes a `yes` for the account named in the link without a session (`api/series/coming`). Does that satisfy "every RSVP requires sign-in", or must the person sign in first?
5. **Join-link gating.** Gate the video link on a `yes` for the occurrence on every surface (MeetingBanner, ThreadSurface, template pages, letters), or only on series pages? Gating changes what inner_group members see on the hub today.
6. **The retired service.** Remove the `inner-gathering` service from `docker-compose.yml`, give it a profile, or leave it defined but stopped? Who retires the `meetings.elkdonis-arts.org` proxy host?
7. **ASM group on transactional mail.** Should RSVP confirmations and reminders leave out the org's ASM group, so that a newsletter unsubscribe does not stop them?
8. **inner_group's confirmation layout.** May its unfilled tokens be removed from the stored layout (an edit to production data), or should the senders be changed to fill them?
9. **Time zones in letters.** Keep `America/Toronto` as the network default, or state times in each thread's `metadata.timeZone` (with IFAC's three zones as an org setting)?

## 6. Not verified here

- Delivered letter contents. No bodies are stored, so the literal-token claim in section 2.7 rests on code and the stored layout.
- The `0.0.0.0` origin in owner-notice links (assumed from `CLAUDE.md`; not probed).
- Whether `meetings.elkdonis-arts.org` returns 502 now, and the live reachability of the retired PATCH route.
- SendGrid's handling of ASM group unsubscribes for transactional sends.
- A full diff between the 09-20 dist and `src`; markers only.
- The outcome of the ifac build that was running at 19:44 EDT.

## History

- 2026-10-10: written from read-only investigation, about 19:00–19:55 EDT. During the survey, other sessions rebuilt `@elkdonis/email` (19:43:42), fixed `seed.ts` (19:43:28), edited `apps/ifac/src/lib/reminders.ts` (subscriber join-link gating) and started an ifac build.
