# RSVP and attendance map (2026-10-10)

This maps how RSVPs, attendance and enrolment work across the EAC monorepo as of 2026-10-10, around 19:00 EDT. It covers storage, services, entry points per app, UI surfaces, side effects and what an RSVP means for each kind. The diagram version is `index.html` in this folder. Screenshots: `screenshot-1280.png` (full page, 1280 px) and `screenshot-390.png` (phone width).

Method:
- Code was read on the shared tree. Four read-only search passes covered services, entry points, UI and side effects, and the main claims were checked by hand.
- The live schema and row counts come from `\d` and `SELECT` on `elkdonis_dev`.
- Nothing in code or data was changed. The only writes were the files in this folder.

Status labels:
- **verified (code)**: read in source at the cited line.
- **verified (db)**: queried on `elkdonis_dev` on 2026-10-10.
- **assumed**: inferred and not checked.
- **in progress**: the file was being edited by another session while this was written.

**In progress.** IFAC's series and subscription work was being edited during the survey:
- `packages/services/src/meeting-series.ts` was untracked and went from 798 to 1247 lines between 18:57 and 18:59. Its line numbers below may already have moved.
- Also untracked: `apps/ifac/src/app/api/series/**`, `apps/ifac/src/app/api/hub/series/**`, `apps/ifac/src/app/series/**`, `apps/ifac/src/components/site/**` and `apps/ifac/src/lib/reminders.ts`.
- `packages/services/src/index.ts` is modified (series exports were added at 18:59).

## 1. Storage

### `thread_rsvps`: the one RSVP table (verified, db `\d`)

| column | type | note |
|---|---|---|
| `thread_id` | varchar(21) | FK → `threads(id)` ON DELETE CASCADE |
| `user_id` | uuid | FK → `users(id)` ON DELETE CASCADE. **There are no guest rows**: every row is an account |
| `status` | varchar(20), default `yes` | CHECK `yes` / `no` / `maybe` / `waitlist` |
| `created_at`, `updated_at` | timestamptz | `updated_at` drives the cycle expiry (§5.4) |
| `flavour` | text, nullable | migration 130. Free text; the vocabulary is in code (`standing-meeting.ts:54`) |
| `promise_next` | boolean, default false | only meaningful with `flavour = 'next_time'` |

- The primary key is `(thread_id, user_id)`, so one row per person per thread. There is an index on `user_id` and no `kind` column.
- Eligibility lives on `threads`: `is_rsvp_enabled`, `attendee_limit`, `rsvp_deadline`, `min_attendees`, plus `recurrence_pattern` / `recurrence_until` for cycles.
- `docs/reference/workshops-and-lms.md:43` lists a column `registered_at`. The live column is `created_at` (verified, db).

Row counts (verified, db, 2026-10-10). Total: 28 rows on 17 threads from 8 users.

| org | thread kind | status | rows | with flavour | promise_next | first | last |
|---|---|---|---|---|---|---|---|
| inner_group | meeting | yes | 15 | 2 | 1 | 2026-06-10 | 2026-10-01 |
| inner_group | workshop | yes | 1 | 0 | 0 | 2026-07-16 | 2026-07-16 |
| fourth_way_book_readers | reading_group | yes | 5 | 0 | 0 | 2026-09-26 | 2026-10-03 |
| ifac | meeting | maybe | 3 | 3 | 3 | 2026-09-17 | 2026-09-24 |
| ifac | series_session | yes | 3 | 0 | 0 | 2026-10-08 | 2026-10-10 |
| amrit_canada | meeting | yes | 1 | 0 | 0 | 2026-09-13 | 2026-09-13 |

- `flavour` values: NULL 23, `next_time` 4, `certain` 1. No row has status `no` or `waitlist`.
- 9 of the 28 rows sit on archived threads.
- 2 rows on fourth_way `reading_group` threads have `is_rsvp_enabled = false`, so they were written by a path that skips eligibility (assumed: seed data or the group-creation flow).
- No row is on a series parent thread, so there are no subscriptions yet. The IFAC series thread `Gnove0JPbyLYG4_QCTt-V` has 0 rows.

RSVP-enabled threads by org and kind (verified, db):

| org | kind | rsvp enabled | with limit | recurring | total |
|---|---|---|---|---|---|
| inner_group | meeting | 10 | 1 | 4 | 18 |
| inner_group | workshop | 3 | 0 | 1 | 6 |
| inner_group | post | 1 | 1 | 0 | 1 |
| ifac | meeting | 6 | 0 | 6 | 6 |
| ifac | series_session | 4 | 0 | 0 | 4 |
| fourth_way_book_readers | reading_group | 1 | 0 | 1 | 1 |
| fourth_way_book_readers | post | 1 | 0 | 0 | 1 |
| amrit_canada, sunjay | meeting | 1 each | 0 | 0 / 1 | 1 each |
| BuddhasEngines | workshop | 1 (draft, price 3.00) | 0 | 0 | 1 |
| elastrocal, hidden-enneagram | service | 0 | 0 | 0 | 1 each |

### Related tables (verified, db)

| table | role in RSVP / attendance | rows (2026-10-10) |
|---|---|---|
| `guest_submissions` (`kind` CHECK `rsvp` / `interest` / `contact` / `question`) | Signed-out RSVPs: name, email, `metadata.phone`, `metadata.wants_reminder`. `thread_id` is nullable (ON DELETE SET NULL). `linked_user_id` exists but no row is linked | `rsvp`: inner_group meeting 8, amrit_canada meeting 1, no thread 1 (IFAC's older form sends no thread) |
| `contacts` (`status` new / contacted / joined / unsubscribed) | Guest RSVP routes upsert the guest into the org's address book | `source='rsvp'`: inner_group 5, amrit_canada 1. `source='ifac_rsvp'`: ifac 1 |
| `thread_reminder_sends` PK `(thread_id, occurrence_at, kind)`, `kind` default `attendees` | Reminder dedupe ledger, claimed before sending | attendees: inner_group meeting 5 (1 recipient), inner_group workshop 1, ifac meeting 4 (**0 recipients**), amrit_canada 2, sunjay 1. host: inner_group 2 |
| `meeting_hosts` PK `(thread_id, occurrence_at, role)` | Per-occurrence host / co-host (rota, series weeks) | ifac host 3 / co-host 3 (1 assigned); inner_group meeting 2, workshop 1 |
| `meeting_occurrence_notes` PK `(thread_id, occurrence_at)` | `attended jsonb` (an after-the-fact register), `note`, `plan`, the series week's `title/summary/materials/cover_image_url`, `topic_thread_id` (the week's RSVP thread) | 7 rows; **0 with a non-empty `attended`**; 3 `topic_thread_id` links (ifac) |
| `workshop_join_requests` (`status` pending / paid / cancelled) | Legacy paid-join requests (eTransfer) | inner_group pending 3. **None paid; no code sets `paid`** |
| `commerce_order` / `commerce_order_line.thread_id` | A paid seat. `confirmOrderPaid` writes the RSVP | 1 order line on a thread (hidden-enneagram service, paid; services do not enrol) |
| `service_bookings` | Booking a service (not an RSVP) | 0 |
| `network_arrivals` | Sign-in arrival log, read by `/manage/people`. Not RSVP data | 37 rows, 11 users |
| `lms_enrolments` | LMS enrolment. `syncWorkshopEnrolments` can copy RSVPs into it | 3 |
| `email_sends` (`kind`) | Mail ledger | `rsvp`: inner_group 15, ifac 6, sunjay 2. `reminder`: inner_group 2, sunjay 1. All `queued` |

Series week threads (`kind = 'series_session'`, verified, db):
- There are 4 rows for IFAC series `Gnove0JPbyLYG4_QCTt-V`.
- Week 1 has two threads: `XVycMZle2Lqr7BOtKW2P1` (published, linked from the notes row) and `jRBPq29Ii6yKkSNcku3TL` (archived, unlinked).
- Assumed cause: an earlier test or a race in `ensureSeriesSessionTopic`, which has no lock (§7).

There is no `series_subscriptions` table and no `rsvp_guests` table. Planned design: a subscription is a `thread_rsvps` `yes` on the series parent (`docs/open/IFAC_SERIES_PLAN_2026-10-10.md:116`; the earlier draft at :81 proposed a table).

## 2. Services (shared packages)

### Core primitives: `packages/services/src/thread-rsvp.ts` (verified, code)

These are kind-agnostic and side-effect free.

| fn | line | R/W | notes |
|---|---|---|---|
| `checkRsvpEligibility(threadId, extra=0)` | :29 | R | `is_rsvp_enabled`, `rsvp_deadline`, `count('yes') + extra >= attendee_limit`. No waitlist fallback |
| `countConfirmedRsvps` | :63 | R | `status = 'yes'` |
| `getRsvpStatus` | :72 | R | |
| `setRsvpStatus` | :80 | W | upsert `ON CONFLICT (thread_id,user_id)`. Updates `status` only, so a stale `flavour` / `promise_next` is left behind |
| `deleteRsvp` | :94 | W | DELETE |

### Other writers and readers

| path:line | fn | R/W | notes |
|---|---|---|---|
| `packages/services/src/standing-meeting.ts:54` | `RSVP_FLAVOURS` | - | `certain`→yes; `early`/`hesitant`/`maybe`/`next_time`→maybe; `wont`→no |
| `standing-meeting.ts:95` | `getMeetingAttendance` | R | status, flavour, promise_next |
| `standing-meeting.ts:118` | `setMeetingAttendance` | W | second upsert on the same key; writes `flavour` and `promise_next`; no eligibility check (the caller does it) |
| `standing-meeting.ts:142` | `clearMeetingAttendance` | W | same DELETE as `deleteRsvp` |
| `standing-meeting.ts:210` | `resolveMeetingLight` | R | counts `yes`+`maybe` against `threads.min_attendees`, plus `metadata.meetingLight` |
| `standing-meeting.ts:275`, `:312` | `setMeetingLight` / `clearMeetingLight` | W | `threads.metadata.meetingLight`; no `org_id` filter |
| `packages/services/src/meeting-rota.ts:234`, `:256` | `assignMeetingRole` / `clearMeetingRole` | W | `meeting_hosts`; no membership check |
| `meeting-rota.ts:355`, `:384` | `getOccurrenceRecord` / `saveOccurrenceRecord` | R/W | `meeting_occurrence_notes.attended` + `note`. The upsert sets `note` to NULL when only `attended` is passed |
| `meeting-rota.ts:427` | `suggestAttendanceFromTalk` | R | Talk chat and guest sessions → suggestions. The source type `'rsvp'` (:333) is declared but nothing produces it |
| `meeting-rota.ts:548`, `:605` | `listHostRemindersDue` / `claimHostReminder` | R/W | `thread_reminder_sends` kind `host`, claim before send |
| `packages/services/src/reading-circle.ts:738` | `ensureCircleSessionTopic` | W | per-sitting `post` topic (`metadata.circleSession`), `isRsvpEnabled`, no limit |
| `reading-circle.ts:344`, `:868`, `:886` | `recordCircleStop`, `setCircleSessionNotes`, `setCircleSessionPlan` | W | `meeting_occurrence_notes`; duplicate note and plan writers |
| `packages/services/src/meeting-series.ts:416` (in progress) | `getMeetingSeries` | R | weeks, hosts, notes, `yes` count per week topic |
| `meeting-series.ts:686` (in progress) | `saveSeriesSession` | W | week notes; the topic retitle UPDATE has no `org_id` filter (:724) |
| `meeting-series.ts:739` (in progress) | `ensureSeriesSessionTopic` | W | creates a published PUBLIC `series_session` thread whose author is the acting user, then links it from the notes row |
| `meeting-series.ts:791` (in progress) | `rsvpSeriesSession` | W | eligibility on the week topic, then `setRsvpStatus` yes or `deleteRsvp`. **It creates the topic even when `going: false`** |
| `meeting-series.ts:812`, `:834` | `getSeriesRsvps`, `listSeriesSessionAttendees` | R | |
| `meeting-series.ts:949`–`:986` (in progress, 0 callers) | `setSeriesSubscription`, `isSubscribedToSeries`, `listSeriesSubscribers`, `unsubscribeSeriesByEmail` | R/W | subscription = `yes` on the series thread, no capacity check. Unsubscribe deletes by email, **any status** |
| `meeting-series.ts:1086` (in progress, 0 callers) | `saveSeriesSchedule` | W | re-keys notes and hosts when the schedule moves; inserts a `thread_reminder_sends` row |
| `packages/services/src/workshop-offerings.ts:784` | `isEnrolledInWorkshop` | R | `thread_rsvps` yes UNION `workshop_join_requests` paid |
| `packages/services/src/center.ts:188`, `:241`, `:330` | `/center` queries | R | `rsvp_count`, `viewer_attending`, next event, per-org counts. **No cycle check** |
| `packages/services/src/org-calendar.ts:438` | `listOrgEventsInRange` | R | `rsvp_count` |
| `packages/services/src/viewer-alerts.ts:53` | `getViewerAlerts` | R | upcoming = yes with `scheduled_at >= now()`; misses recurring threads |
| `packages/services/src/forum.ts:664`, `:842` | forum thread / "happening" | R | counts |
| `packages/email/src/address-book.ts:93` | `listAddressBook` | R | treats every `thread_rsvps` row (any status, `no` included) as a mailable "guest" |
| `packages/commerce/src/server/orders.ts:543` (insert :711–720) | `confirmOrderPaid` | W | inside the payment transaction: `thread_rsvps` yes for `workshop` / `event` lines when the order has a `customer_id`. No capacity check |
| `packages/commerce/src/server/service-orders.ts:74` | `createThreadOrder` | R | price and registration checks; no `attendee_limit` / deadline check |
| `packages/checkout/src/server/thread-checkout.ts:95`, `:155` | `startThreadCheckout`, `checkoutReturn` | - | Stripe session; the return calls `syncStripeOrder`, which calls `confirmOrderPaid` |
| `packages/lms/src/authoring.ts:202` | `syncWorkshopEnrolments` | R/W | RSVP yes + paid join → LMS entitlements. Only called by sophia's staff action |
| `packages/utils/src/recurrence.ts:74` | `isWithinCurrentCycle` | pure | true if a timestamp is after the last occurrence's end; non-recurring never expires |
| `packages/hooks/src/useThreadRsvp.ts:28`, `useRealtimeAttendees.ts:19` | client hooks | - | used only by `apps/inner-gathering` (retiring) |
| `packages/email/src/index.ts:381`, `:400`, `:420`, `:439` | `sendReminderEmail`, `sendMeetingTriggerEmail`, `sendRsvpConfirmation`, `sendRsvpNotification` | - | only app routes call them |

There are 5 writers of `thread_rsvps` in packages: `setRsvpStatus`, `setMeetingAttendance`, `confirmOrderPaid`, and in meeting-series `setSeriesSubscription` (via `setRsvpStatus`) and `unsubscribeSeriesByEmail`. Apps add raw INSERTs in `apps/inner-gathering` (see §3).

## 3. Entry points per app (verified, code)

Write shapes:
- **A**: `POST` / `DELETE /api/threads/[id]/rsvp`
- **B**: `POST /api/hub/rsvp {threadId,status}`
- **C**: `POST /api/hub/meeting/attendance {threadId,flavour,promiseNext|clear}`
- **D**: `POST /api/series/rsvp {seriesId,occurrenceAt,going}`
- **E**: guest `POST /api/rsvp`

| app | entry point | auth | calls | notes |
|---|---|---|---|---|
| ifac | `api/hub/rsvp/route.ts:26` (B) | hub member (`getHubViewer`) | eligibility → `setRsvpStatus` / `deleteRsvp` | no email |
| ifac | `api/hub/meeting/attendance/route.ts:30` (C) | hub member | `setMeetingAttendance` / `clearMeetingAttendance`; eligibility only for a new yes | ≈ innergathering copy |
| ifac | `api/series/rsvp/route.ts:19` (D, **in progress**) | any signed-in network user (raw `getServerSession`, no org role); signed out → 401 (:78) | `getMeetingSeries` → `rsvpSeriesSession` | going=true mails `sendRsvpConfirmation` (with the join link) and the owner notice |
| ifac | `api/rsvp/route.ts:6` (E) | guest, name + email | inline INSERT `guest_submissions` (:40), `contacts` source `ifac_rsvp` (:53) | no eligibility, deadline or capacity check; `status` is folded into `message`; caller `components/rsvp-form.tsx` has no importer (orphan) |
| ifac | `api/hub/meeting/record/route.ts:55` | any member | `saveOccurrenceRecord` (attended) | identical to innergathering |
| ifac | `api/hub/series/route.ts:77` (in progress) | member | `saveSeriesSettings`, `assignMeetingRole` (:146), `saveSeriesSession` | not an RSVP write; uses the raw rota functions, not `assignSeriesRole` |
| ifac | `api/series/comment/route.ts:15` (in progress) | signed in | `ensureSeriesSessionTopic`, `postReply` | creates the week topic as a side effect |
| innergathering | `api/threads/[id]/rsvp/route.ts:114` POST, `:273` DELETE (A) | signed in, any role | eligibility (:130). **Paid**: `createThreadOrder` → Stripe URL (:141–181). **Free**: `setRsvpStatus` (:183) | materials share (:188); min-attendees one-shot (:204); emails (:219, :239, :253). DELETE does not touch a paid order |
| innergathering | `api/rsvp/route.ts:19` (E) | guest | INSERT `guest_submissions` (:82), `contacts` (:91) | 409 when closed, past deadline or **priced** (:74); no capacity check |
| innergathering | `api/hub/meeting/attendance/route.ts:34` (C), `api/hub/meeting/record` | member | as ifac | |
| innergathering | `api/checkout/return/route.ts:18` | Stripe return | `syncStripeOrder` → `confirmOrderPaid` | hand-written older form of `checkoutReturn` |
| innergathering | `api/threads/[id]/trigger-email/route.ts:22` | editor | reads yes rows and guests | manual blast |
| sunjay | `api/threads/[id]/rsvp/route.ts:107` / `:233` (A) | signed in | eligibility, `setRsvpStatus` (:127) | no paid branch, no materials share; emails (:173, :199, :213) |
| sunjay | `api/rsvp/route.ts:19` (E) | guest | `guest_submissions` (:70) | **no price check** |
| sunjay | `api/center/attendance/route.ts:31` (C-variant) | member | `setMeetingAttendance` without `promiseNext` (:93) | third copy; innergathering's comment says it was folded in, but it still exists |
| amrit-canada | `api/threads/[id]/rsvp/route.ts:103` / `:229` (A), `api/rsvp/route.ts:19` (E) | as sunjay | as sunjay | guest route byte-identical to sunjay's; no hub attendance route, and its hub passes no `attendance` prop, so nothing posts to it |
| arts-collective | `api/threads/[id]/rsvp/route.ts:85` / `:126` (A) | `getCurrentUser` | refuses paid workshops with **402** (:107); eligibility; `setRsvpStatus` (:119); materials grant / revoke | **matches any org's published PUBLIC thread** (network host); no emails; no guest path |
| fourthwayBookreaders | `api/threads/[id]/rsvp/route.ts:28` / `:56` (A) | signed in; org-scoped | `setRsvpStatus` (:40); for `reading_group` it grants `viewer` in `user_organizations` (:45–51) | DELETE keeps the viewer role |
| fourthwayBookreaders | `lib/circle-actions.ts:401` `rsvpSession` (server action) | affiliate; signed out → `redirect('/login')` with no `next` (:403) | `ensureCircleSessionTopic`, then set or delete | **silently does nothing** when ineligible (:409) |
| inner-gathering (retiring, running) | `api/threads/[id]/rsvp/route.ts:73` / `:301` | `session.user.id` (not `db_user_id`) | `setRsvpStatus` (:112), in-app `notifications` (:143) | **not org-scoped, no price check**; 400 instead of 409 |
| inner-gathering | `api/workshops/[id]/join/route.ts:28` | signed in | free: raw INSERT yes (:102). Paid: eTransfer order (:178), `workshop_join_requests` pending (:191), raw INSERT `maybe` (:205) | |
| inner-gathering | `api/meetings/[id]/attendees/route.ts:66` PATCH | **any signed-in user** (TODO at :92) | raw upsert of **any user's** status on **any thread** (:94–99) | authorization hole (verified, code; live reachability not probed) |
| inner-gathering | `api/meetings/[id]/trigger-email/route.ts:13` | guide / admin | read only | its `confirmUrl` points to `/api/meetings/[id]/rsvp/reconfirm`, which does not exist |
| art-auction | `api/stripe/webhook/route.ts:12`; `app/admin/actions.ts:28`; `app/studio/actions.ts:387` | Stripe signature / admin / store manager | `confirmOrderPaid` | the only webhook in the repo; eTransfer confirmation is the only way a legacy paid join becomes a seat |
| sophia | `api/lms/[action]/route.ts:5` | signed out → `/login?next=` | `enrol` / `withdraw`; `studio-sync-rsvps` → `syncWorkshopEnrolments` | LMS, not deployed |
| admin | `api/rsvp/route.ts:5` GET | `requireAdminApi` | reads `guest_submissions` with hard-coded `org_id='amrit_canada'` | read only |
| artdirect, sunjay, elastrocal, hidden-enneagram | `api/checkout/return` | Stripe return | `checkoutReturn` with `kinds: ["service"]` | service bookings; no RSVP |
| forum, danamccool, pigeonshoot, blog-*, elkdonis-arts-collective, artdirect | none | | | no RSVP writes. artdirect sets `isRsvpEnabled` on offerings (`lib/offering-actions.ts:89`) but has no route |

Sign-in with RSVP intent:
- No link carries an `rsvp=` or `intent=` parameter. After sign-in the person returns to the page, at best, and clicks again.
- Links with `next=`: ifac `components/site/series-rsvp.tsx:84`, ifac `app/series/[slug]/page.tsx:207`, fourthway `components/rsvp-button.tsx:32`, inner-gathering `join-workshop-modal.tsx:264`.
- Bare `/login` without `next`: the `rsvp-panel.tsx` copies (innergathering :213 / :266, sunjay :177, amrit :177), the `attendee-list.tsx` copies (:23), sunjay `blocks/event.client.tsx:179`, fourthway `circle-page.tsx:287` and `circle-actions.ts:403`, arts-collective `OfferingPage.tsx:84`.
- Silex embeds (`packages/silex-render/src/embeds.tsx:312`, `:696`, `:927`) link to signup or login with no `next`.

## 4. UI surfaces (verified, code)

| surface | path:line | shows / takes | writes via | rendered by |
|---|---|---|---|---|
| `StandingMeetingFace` / `RsvpControl` | `packages/cms-ui/src/hub/StandingMeetingFace.tsx:134`, `:702` | "N coming"; six-answer menu, "Promise?", take back | C (`:109`, `:290`) | ifac hub `:285` (default options); innergathering hub `:207` (own options); count only on amrit `:148`, sunjay `:174` and sunjay landing / Puck |
| `MeetingBanner` | `packages/cms-ui/src/hubsite/MeetingBanner.tsx:76` | "Join video" (ungated, `:255`), answer menu, light | C (`:134`), no clear path | ifac `site-view.tsx:211`, innergathering `site-view.tsx:185`, `cards-view.tsx:123` |
| `SeriesFace` | `packages/cms-ui/src/hub/SeriesFace.tsx:32` | weeks; `rsvpCount` typed but not rendered | - | ifac hub `:301`, `site-view.tsx:218` |
| `SeriesPlannerSurface` | `packages/cms-ui/src/hub/SeriesPlannerSurface.tsx:77` | "N going" per week (`:419`); join settings "shown only to people who have RSVP'd" (`:288`) | `/api/hub/series` | ifac `HubSurfaces.tsx:291` |
| `PlanAheadSurface` / `OccurrenceRecord` | `packages/cms-ui/src/hub/PlanAheadSurface.tsx:65`, `:453` | attendance register (checkboxes) | `/api/hub/meeting/record` | ifac, innergathering hubs |
| `ThreadSurface` | `packages/cms-ui/src/surface/surfaces/ThreadSurface.tsx:27` | "I'm coming" toggle (`:240`), capacity / deadline, "Sign in to say you're coming" (no link, `:266`), Join (`:107`, ungated) | `connectors.rsvp` (`hub/connectors.ts:265`; default A; ifac overrides to B at `HubSurfaces.tsx:336`) | every host with a `SurfaceProvider` |
| `ThreadView`, `thread-mapper` | `surface/ThreadView.tsx:50`, `surface/thread-mapper.ts:105` | "Coming: N of L" | - | |
| `CenterPage`, `OrgStrip` | `packages/cms-ui/src/center/CenterPage.tsx:142`, `:309`, `:429`; `OrgStrip.tsx:74` | "N RSVPs", "going" | - | `/center` in amrit, arts-collective, fourthway, innergathering, sunjay |
| compose fields | `packages/cms-ui/src/compose/content-fields.ts:282` | authoring: take RSVPs, limit, deadline, min attendees, joining link | - | |
| blocks | `packages/blocks/src/blocks/thread-feed.tsx:206`; `server/person-page.server.ts:164`; `offering-spotlight.tsx:82` | "N coming"; "RSVP" / "Book" labels | links only | |
| silex embeds | `packages/silex-render/src/embeds.tsx:249`, `:677`, `:792`, `:886` | "Reserve a place", "Join or RSVP" → signup | links only | arts-collective, hidden-enneagram |
| `useThreadRsvp`, `useRealtimeAttendees` | `packages/hooks/src/useThreadRsvp.ts:28`, `useRealtimeAttendees.ts:19` | | A | **inner-gathering only (legacy)** |
| `rsvp-panel.tsx` | amrit / sunjay (identical, 188 lines); innergathering (fork with paid + sliding scale, 277 lines) | member toggle + guest form (name, email, reminder) | A + E | `[feed]/[slug]` pages, sunjay blocks, innergathering `OfferingsBand.tsx:116` |
| `attendee-list.tsx`, `manage/content/[id]/attendees/page.tsx` | three copies each | members + guests union | - | amrit, sunjay, innergathering |
| arts-collective `RsvpPanel`, `JoinWorkshopButton` | `components/sites/RsvpPanel.tsx:15`, `sites/workshop/JoinWorkshopButton.tsx:10` | "Count me in"; a 402 on paid shows as an error | A (no body) | `OfferingPage.tsx:126`, `:187`; `sites/[slug]/profile/page.tsx:203` |
| ifac `RsvpPanel` | `apps/ifac/src/components/hub/RsvpPanel.tsx:14` | "Count me in", "N coming · L places" | B | `hub/meetings/[slug]/page.tsx:190` |
| ifac `SeriesRsvp`, `SessionList`, series pages (in progress) | `components/site/series-rsvp.tsx:10`; `session-list.tsx:36`; `app/series/[slug]/page.tsx:78`; `[n]/page.tsx:67` | per-week "I'm coming", avatars, "N going"; **join link gated on `rsvps[at] === 'yes'`** | D | public series pages |
| ifac `RsvpForm` | `apps/ifac/src/components/rsvp-form.tsx:6` | guest form | E | **no importer (orphan)** |
| fourthway `RsvpButton`, `SessionPanel` | `components/rsvp-button.tsx:12`; `components/circle/circle-page.tsx:31` | "Join the group" / "RSVP"; per-sitting form action | A; `rsvpSession` action | circle page, closing band, thread page |
| sunjay Puck event blocks | `apps/sunjay/src/blocks/event.client.tsx:236`; `lib/puck/data-event.ts:57` | panel; room gated on membership | A + E | sunjay pages |
| admin `/rsvp` | `apps/admin/src/app/rsvp/page.tsx:49` | amrit guest RSVPs | - | admin |
| inner-gathering components | `meeting-card.tsx:139`, `attendee-modal.tsx:39`, `gathering-details.tsx`, `join-workshop-modal.tsx:75`, `workshop-page.tsx:143`, `featured-row.tsx:177` | legacy (Mantine) | A, PATCH attendees, `/join` | `apps/inner-gathering` (retiring) |

Join-link gating:
- **Gated on RSVP**: only the IFAC series pages (in progress).
- **Gated on enrolment**: arts-collective workshop page (`app/sites/[slug]/workshop/[workshopSlug]/page.tsx:54–59`) and innergathering workshop resources (`[feed]/[slug]/page.tsx:145`).
- **Gated on membership**: sunjay Puck events and the fourthway circle (sessions, call, recordings; `circle-page.tsx:256`).
- **Ungated**: everything else, including `ThreadSurface`, `MeetingBanner`, the template `[feed]/[slug]` "Join online", innergathering `CallSlot`, the fourthway closing band and thread page, and the IFAC hub meeting page.

## 5. Side effects

### 5.1 Emails (verified, code)

Senders in `packages/email/src/index.ts`:

| sender | line | template | kind | notes |
|---|---|---|---|---|
| `sendRsvpConfirmation` | :420 | `rsvp-guest` | `rsvp` | join link is `talkRoomUrl ?? meetingUrl` (`templates/rsvp-guest.tsx:137`) |
| `sendRsvpNotification` | :439 | `rsvp-owner` | `notification` | |
| `sendReminderEmail` | :381 | `reminder` | `reminder` | |
| `sendMeetingTriggerEmail` | :400 | meeting-trigger | `reminder` | renders without `renderWithOverrides`, so an org's saved meeting-trigger template is ignored |

A send is recorded in `email_sends` only when `orgId` is passed (`packages/email/src/client.ts:114`). Legacy inner-gathering sends pass no `orgId` and are not recorded.

| trigger | path:line | to | condition |
|---|---|---|---|
| member RSVP | sunjay `api/threads/[id]/rsvp/route.ts:173`, `:199`, `:213`; amrit `:169`, `:195`, `:209`; innergathering `:219`, `:239`, `:253` | member; author or `siteConfig.fallbackNotifyEmail`; one-shot "minimum reached" | `previous !== 'yes'`. A yes left over from an earlier cycle therefore suppresses both mails when someone answers again in a new cycle |
| guest RSVP | sunjay / amrit `api/rsvp/route.ts:99`, `:115`; innergathering `:111`, `:127`; ifac `:67`, `:75` | guest; owner (ifac: `NEXT_PUBLIC_IFAC_OWNER_EMAIL ?? info@ifacgroup.com`) | on every submission (no dedupe) |
| series week RSVP (in progress) | ifac `api/series/rsvp/route.ts:100`, `:117` | member (with join URL, ID and passcode, and an `.ics` link); IFAC owner address, not the week's host | every `going=true` POST, with no `previous` check, so re-clicking resends both |
| legacy RSVP | inner-gathering `api/threads/[id]/rsvp/route.ts:260–270`; `api/workshops/[id]/join/route.ts:142` | attendee, guide | every POST; no `orgId` |
| manual blast | sunjay / amrit `api/threads/[id]/trigger-email`; innergathering `:22` | `yes` of the current cycle + guests (cycle filter via `lastOccurrenceEnd`) | editor |
| legacy blast and cancel | inner-gathering `api/meetings/[id]/trigger-email/route.ts:13`; `api/content/[id]/route.ts:403` | every `yes` row ever written (no cycle filter); hand-built HTML | guide; the reconfirm link 404s |
| cancelling an RSVP | every DELETE handler | nobody | no cancellation mail anywhere |
| waitlist promotion | - | - | not implemented |

### 5.2 Reminders (verified, code)

Every app with reminders runs a 5-minute tick from `instrumentation.ts`, unless `DISABLE_REMINDER_SCHEDULER=1`. Each tick claims a `thread_reminder_sends` row before sending.

| file | window | recipients | ledger kind | notes |
|---|---|---|---|---|
| `apps/ifac/src/lib/reminders.ts` (in progress) | "day" letter at 22.5–24 h; "soon" letter at `reminder_minutes_before` (default 60) | `yes` on `series_session` topics (:93) | `attendees-day`, `attendees` | Only RSVPed people get the join details (:105). The subscriber letter (`reminderDays`, default 2) is defined in `meeting-series.ts:274` but **not sent yet**. The draft flag `publishedAt` is not checked. Host letter at :155 |
| `apps/sunjay/src/lib/reminders.ts`, `apps/amrit-canada/src/lib/reminders.ts` | `reminder_minutes_before` (NULL = off) | `yes` UNION guest emails; no cycle filter | `attendees` (NOT EXISTS ignores kind) | Identical except branding (sunjay still passes `emblemAlt: "Khanda"`, :118). Primary `scheduled_at` only, so a recurring meeting is reminded once, ever |
| `apps/innergathering/src/lib/reminders.ts` | 65 min | hosts only (`listHostRemindersDue`) | `host` | no attendee reminders |
| `apps/inner-gathering/src/lib/reminders.ts` (legacy, container running) | `COALESCE(reminder_minutes_before, 60)` (:34) | `yes` only | `attendees` (NOT EXISTS ignores kind, :35) | **Reaches every org except `amrit_canada` (:28)**: sunjay (ignoring its NULL = off), ifac series parents (where `yes` will mean "subscribed") and others. No `orgId`, so no branding and no ledger. `meeting-series.ts` ~:1233–1243 inserts a ledger row to block it after a schedule move (in progress) |
| shared | `packages/services/src/meeting-rota.ts:548`, `:605` | hosts | `host` | the only shared part. Co-hosts are never reminded. The attendee loop is copied 4 times |

### 5.3 Calendar files (verified, code)

- Server `.ics`: `apps/ifac/src/app/series/[slug]/calendar.ics/route.ts` (in progress).
  - Public. `?at=` gives one week; without it, an RRULE series.
  - UTC times with no TZID. Never carries the join link.
- Client data URLs: `packages/cms-ui/src/surface/ics.ts:40` (`buildIcs`, puts `meetingUrl` in `URL:` at :61; used by `ThreadSurface.tsx:221` and the template `[feed]/[slug]` pages). sunjay `blocks/offering-card.client.tsx:40` is its own copy and puts the Talk / meeting URL in `LOCATION:`.
- In email: only the IFAC series mails pass `calendarUrl` (`rsvp-guest.tsx:209`, `reminder.tsx:230`).

### 5.4 Join-link gates, cycle expiry and the meeting light (verified, code)

- RSVP-gated join: IFAC series pages only (`app/series/[slug]/page.tsx:78`, `[n]/page.tsx:67`).
  - Join details are kept out of `threads.meeting_url` because the forum returns that column to anyone who can see the thread (`forum.ts:659`, `:685`).
  - `seriesJoinUrl` still falls back to `meetingUrl` / `videoLink` (`meeting-series.ts:297`).
- Everywhere else the link goes to anyone who can see the page or hub: `MeetingBanner.tsx:255`, `ThreadSurface.tsx:107`, the template `[feed]/[slug]` pages, and confirmation and reminder mails.
- There are no time-window gates.
- `isWithinCurrentCycle` (`packages/utils/src/recurrence.ts:74`) is called only in the GET of `api/threads/[id]/rsvp` (sunjay :93, amrit :89, innergathering :100, inner-gathering :51).
  - The same `lastOccurrenceEnd` cutoff is applied in the template apps' `lib/data.ts` (`getAttendanceCount`, `listAttendees`, …) and in the trigger-email routes.
  - inner-gathering has a SQL twin (`lib/data.ts:29`) that treats `'NONE'` differently.
- An RSVP is never rewritten when a cycle rolls over: the row stays and drops out only where a cutoff is applied. Stale rows still count toward:
  - capacity (`countConfirmedRsvps`);
  - the `rsvpCount` in owner mail;
  - `min_attendees_notified` (one-shot and never reset);
  - reminders;
  - `resolveMeetingLight`;
  - the forum and `/center` counts.
- Meeting light: `resolveMeetingLight` (`standing-meeting.ts:210`) counts all-time `yes` + `maybe` against `min_attendees`. The host override is `threads.metadata.meetingLight`.
  - The forum's "match light" is a theme toggle (`packages/forum-ui/src/shell.tsx:140`) and is unrelated.

### 5.5 Notifications, roles, shares

- In-app `notifications` rows are written only by legacy inner-gathering (`api/threads/[id]/rsvp/route.ts:143`, `:179`; `api/content/[id]/route.ts:365`, `:384`). They use `JSON.stringify(...)::jsonb`.
- The audit actions `meeting_rsvp` and `meeting_attended` are declared in `packages/db/src/events.ts:21` and never logged. There are no analytics events.
- `network_arrivals` is not written on RSVP.
- Side writes made by RSVP routes:
  - `contacts` upsert (guest routes).
  - Org `viewer` role (fourthway `reading_group`).
  - Nextcloud workshop materials share and unshare (innergathering :188 / :285; arts-collective; legacy).
  - Supabase realtime on `thread_rsvps` (legacy hooks).

### 5.6 Attendance counts

- All computed on read. There is no counter column.
- All-time `yes`: `thread-rsvp.ts:63`, `forum.ts:664`, `:842`, `center.ts:194`, `org-calendar.ts:438`, `arts-collective/src/lib/org-console.ts:130`, `admin/src/app/page.tsx:96`.
- Cycle-filtered members + guests: the template apps' `getAttendanceCount`.
- Guests only: `ifac/src/lib/data.ts:65`, shown on IFAC `/manage`.
- Per series week: `meeting-series.ts:467`.
- Light: `yes` + `maybe`.

## 6. What an RSVP means, per kind

| kind / case | where the row goes | meaning of `yes` | expiry | gates | example data |
|---|---|---|---|---|---|
| Standing meeting (recurring `meeting` parent) | `thread_rsvps` on the meeting thread, often with `flavour` / `promise_next` | "coming to the next occurrence". `maybe` = soft yes. `next_time` + promise = coming to the one after | **cycle**: the GET in innergathering / amrit / sunjay / inner-gathering reports a row as current only if `isWithinCurrentCycle(updated_at, …)`. The row is never deleted. `/center`, calendar, alerts, address book and counts ignore the cycle | none on the join link; the light counts yes+maybe against `min_attendees` | inner_group 15 yes; ifac 3 maybe / `next_time` |
| One-off `meeting` / `event` | `thread_rsvps` on the thread; guests in `guest_submissions` | coming | none (non-recurring never expires) | none | amrit 1 |
| Series week (IFAC, in progress) | `thread_rsvps` on the week's `series_session` topic (created on first RSVP or comment; `meeting_occurrence_notes.topic_thread_id`) | coming to that week | the week is past → no RSVP (`api/series/rsvp/route.ts:35`) | **join link and details shown only to `yes`** | ifac 3 yes on 3 topics |
| Series parent (IFAC, being added) | `thread_rsvps` `yes` on the series thread itself (`meeting-series.ts:48`, `:949`) | subscribed to the series (reminder N days before each published week, default 2) | until unsubscribed (`unsubscribeSeriesByEmail`, any status) | none | 0 rows; functions have no callers yet |
| Reading circle (`reading_group`) | `thread_rsvps` on the group thread | **joined the group**; grants the `viewer` org role (fourthway `rsvp/route.ts:45`) | none; leaving keeps the role | circle sessions, call and recordings need an org role, not the RSVP | fourth_way 5 yes |
| Circle sitting | `thread_rsvps` on the per-sitting `post` topic (`metadata.circleSession`) | coming to that sitting | none | none beyond membership | 0 rows |
| Workshop | `thread_rsvps` yes (free, or paid via `confirmOrderPaid`), or legacy `workshop_join_requests` paid | **enrolment**: opens materials, Talk room, roster (`isEnrolledInWorkshop`) | none | enrolment gates the workshop page and files | inner_group 1 yes; 3 pending join requests |
| Service (`kind='service'`) | `commerce_order` + `service_bookings`; no RSVP | booking | | | 0 bookings |
| Guest (signed out) | `guest_submissions` kind `rsvp` + `contacts` | intent only; not counted by `countConfirmedRsvps`, not enrolled | none | none | 10 rows |

## 7. Inconsistencies and risks

Ordered by consequence. All are verified (code) unless marked.

1. **Authorization hole in a running legacy app.** `apps/inner-gathering/src/app/api/meetings/[id]/attendees/route.ts:66–99` lets any signed-in user set any user's RSVP status on any thread (TODO at :92).
   - The `inner-gathering` container is running (verified, `docker compose ps`). A live probe was not run.
   - The same app's `api/threads/[id]/rsvp` is not org-scoped and has no price check (:100–112), so a paid workshop can be joined free there.
2. **The legacy reminder tick sends network-wide.**
   - `apps/inner-gathering/src/lib/reminders.ts:28` selects RSVP-enabled `meeting` / `event` / `workshop` threads in every org except `amrit_canada`, and mails their `yes` rows without branding or the `email_sends` ledger.
   - It overrides sunjay's "NULL = no reminder" with `COALESCE(…, 60)`.
   - Its NOT EXISTS has no kind filter, so a `host` ledger row also suppresses the attendee mail.
   - Once series subscriptions exist, it will treat subscribers on a series parent as attendees of the anchor occurrence. The in-progress `saveSeriesSchedule` inserts a ledger row to block that one case.
3. **Answering again in a new cycle sends nothing.**
   - The member routes in sunjay, amrit and innergathering send confirmation and owner mail only when `previous !== 'yes'`, and a row from an earlier cycle still reads `yes` there.
   - `checkRsvpEligibility` counts stale and already-held `yes` rows, so a full recurring meeting can refuse its own attendees' re-POST. Only the attendance routes skip the check for an existing holder.
4. **Three different flavour→status maps.**
   - `RSVP_FLAVOURS` (`standing-meeting.ts:54`): early / hesitant / next_time → `maybe`.
   - cms-ui `DEFAULT_FLAVOURS` (`StandingMeetingFace.tsx:89–106`): adds `this_week` and `temporary`; early / hesitant → `yes`; next_time → `no`.
   - innergathering hub (`app/hub/page.tsx:229`) maps `maybe` → `yes` for display.
   - The IFAC hub page passes no `options` (`app/hub/page.tsx:297`), so its face offers `this_week` and `temporary`. The server rejects those with 400 "That isn't one of the answers" (`api/hub/meeting/attendance/route.ts:64`). For early / hesitant / next_time, the face shows a different status from the one stored.
5. **Two meanings of `yes` on the same table (in progress).**
   - A subscription is a `yes` on the series parent; attendance is a `yes` on the week topic.
   - Generic readers count every `yes` as attendance: `center.ts:194/195/241/333`, `org-calendar.ts:438`, `viewer-alerts.ts:53`, `forum.ts:664/842`, `email/address-book.ts:93`, and `arts-collective/src/lib/commitments.ts:72`.
   - The series parent is `kind='meeting'` and WEEKLY, so it is in `SCHEDULED_KINDS` and on the calendar. Subscribers will show as "N coming" and appear in `/center` "going" lists.
   - The IFAC reminder pass reads only week topics (`apps/ifac/src/lib/reminders.ts:62–76`), but the legacy inner-gathering tick reads parent `yes` rows (item 2).
6. **Cycle expiry is applied in four route GETs and nowhere else.** `/center` "going", the next-event card, per-org counts, calendar `rsvp_count`, `ThreadSurface` counts and the address book all count a `yes` from a past cycle.
   - `viewer-alerts.ts` instead drops recurring threads entirely.
7. **Several write paths for one row.**
   - `setRsvpStatus` and `setMeetingAttendance` are two upserts on the same key. The first leaves a stale `flavour` / `promise_next`, so a plain "I'm coming" keeps an old `flavour='wont'`.
   - `confirmOrderPaid` and the inner-gathering raw INSERTs are further writers.
   - IFAC alone has four RSVP write paths: B, C, D and the orphan E.
8. **Capacity and waitlist are only partly implemented.**
   - Only `checkRsvpEligibility` checks `attendee_limit`. `setMeetingAttendance` (the caller checks only a new yes), `confirmOrderPaid`, `createThreadOrder`, `setSeriesSubscription` and every guest route skip it.
   - No code writes `waitlist` except the legacy PATCH, and nothing promotes from a waitlist.
   - The `rsvp-panel.tsx` copies show a waitlist message (sunjay / amrit `:124`, innergathering `:163`) for a state the server never produces.
9. **Paid seats.**
   - DELETE on innergathering's member route cancels a paid seat without touching the order. Refunds never delete the RSVP.
   - The sunjay and amrit guest routes and the amrit / sunjay / fourthway / ifac member routes have no price check. No priced RSVP-enabled thread is published in those orgs today (verified, db: the 4 priced rows are draft or archived).
   - `workshop_join_requests` never reaches `paid`.
10. **Copies that have drifted.**
   - `api/threads/[id]/rsvp` exists in 6 apps with 4 behaviours.
   - `api/rsvp` (guest) in 4 apps with 3 behaviours.
   - Attendance in 3 apps; sunjay's copy drops `promiseNext`.
   - `rsvp-panel.tsx` in 3 apps (2 identical + 1 fork); `attendee-list.tsx` and the `attendees` manage page are triplicated.
   - Org scoping differs: arts-collective accepts any org's PUBLIC thread (by design on the network host); inner-gathering has none.
11. **Series week topics (in progress).**
   - `ensureSeriesSessionTopic` (`meeting-series.ts:739`) has no lock or unique key on `(seriesId, occurrenceAt)`. Week 1 already has two topic threads (one archived).
   - The first RSVPer becomes `author_id` of a published PUBLIC thread.
   - `rsvpSeriesSession` creates the topic even for `going: false`.
   - The series RSVP route admits any signed-in network user with no org role (`api/series/rsvp/route.ts:37`).
   - `docs/reference/apps.md:253` still says "members and guests", but guests now get 401.
   - The `SeriesRsvp` doc comment (`series-rsvp.tsx:6`) is stale, and it does not refresh the server-rendered count or join link after an answer.
12. **Guest data has no path to an account.** `guest_submissions.linked_user_id` is never set (0 rows), and guest RSVPs never become `thread_rsvps` after sign-up.
    - The IFAC guest route stores `wants_reminder = true`, but no reminder pass reads `guest_submissions` for IFAC (see §5).
    - Admin `/rsvp` reads only `amrit_canada` (`apps/admin/src/app/api/rsvp/route.ts`).
13. **Sign-in loses the intent.** Most RSVP prompts link to bare `/login` with no `next`, and none carries an RSVP intent. `ThreadSurface` says "Sign in to say you're coming" with no link.
14. **`meeting_occurrence_notes.attended` is unused in practice.** There are 0 non-empty rows, it is not linked to RSVPs (`'rsvp'` source never produced), and `saveOccurrenceRecord` sets `note` to NULL when only `attended` is sent.
15. **Dead or legacy.**
    - The `apps/inner-gathering` RSVP stack (hooks, routes, `workshop_join_requests`) and `useThreadRsvp` / `useRealtimeAttendees` are used only there.
    - The `/api/meetings/[id]/rsvp/reconfirm` link target does not exist.
    - ifac `RsvpForm` and admin `MeetingCard` have no importers.
    - `syncWorkshopEnrolments` is only reachable from sophia.
    - `listMeetingSeries` and `setPresentedSeries` have no callers.
    - The new series functions at `meeting-series.ts:862–1247` have no callers yet (in progress).
16. **Documentation drift.**
    - `workshops-and-lms.md:43` lists `registered_at`, but the live column is `created_at`.
    - `email.md:250` lists ifac `api/rsvp` but not the series route.
    - `apps.md:253` describes guests on the series route.

## 8. Open items

- Run a live unauthenticated probe of the inner-gathering PATCH route through the edge. It was not run here (permission declined); the hole is verified in code only.
- Decide whether subscribers on a series parent must be excluded from generic `yes` counts before `setSeriesSubscription` is wired (owner: the IFAC series session).
- Pick one flavour vocabulary and make the cms-ui default import it, or have hosts always pass `options`.
- Retire or lock down the `apps/inner-gathering` RSVP routes before it is shut down.
