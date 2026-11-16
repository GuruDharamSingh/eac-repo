# RSVP and booking as one logic (2026-11-16)

Design only. No code, migration, build, commit or database write was made. Database checks were read-only `SELECT`s on `elkdonis_dev` (live data), run 2026-11-16 via `sudo docker compose exec -T postgres psql`. Status labels: **verified** (how), **assumed**, **unknown**.

Direction (Justin, 2026-11-16): "Merge rsvps sure, consider logic straightening with booking or vice versa." Also decided the same day: participants (followers who RSVP, comment, post to the forum) are part of the org, publishing under the org's name needs member or above (member rule 2); RSVPing to a members-only thread gives member info by design (#42); booking pays at the book step (booker confirm stays link-only for the dock). amrit-canada is the oldest site and must not be the canonical shape; hub + Channel is the main admin surface.

Sources read: `packages/actions/atlas/JOURNAL.md`, `atlas/reports/drift.md` (rsvp-to-event, cancel-rsvp, ig-rsvp-join/cancel, guest RSVP, service-book-and-pay), `docs/open/BOOKING_MODULE_2026-11-14.md` (incl. section 8 history), `packages/services/src/thread-rsvp.ts`, `packages/booking/src/**`, `packages/commerce/src/server/orders.ts` (`confirmOrderPaid`), the RSVP routes in the apps.

## 1. What exists

### 1.1 Free RSVP, signed in: `thread_rsvps`

One table, `thread_rsvps(thread_id, user_id, status, flavour, promise_next, created_at, updated_at)`, PK (thread_id, user_id). `status` yes|no|maybe|waitlist|subscribed (the service type `RsvpStatus` has only yes|no|maybe|waitlist; `subscribed` is written by `meeting-series.ts:2008`). `user_id` NOT NULL, so no guests. No money, no hold, no refund, no payment link. Capacity = count of `yes` rows against `threads.attendee_limit` (`checkRsvpEligibility`, `thread-rsvp.ts`), checked and then written in two statements with no lock: two people can both pass the check for the last seat (**verified** by reading `checkRsvpEligibility` + `setRsvpStatus`). Nothing writes `waitlist` (**verified** by grep: no caller sets it).

Counts (verified by query): 49 rows = yes 44, maybe 3, subscribed 2. `yes` by thread kind: meeting 21, series_session 15, reading_group 6, post 1, workshop 1. `is_rsvp_enabled`: meeting 26, series_session 18, workshop 4, post 3, series 3, reading_group 1. `attendee_limit` set on 2 threads.

Readers of `thread_rsvps` (must keep working): `center.ts`, `forum.ts`, `join-link.ts`, `media-authz.ts` (via `isEnrolledInWorkshop`), `meeting-series.ts`, `paath-day.ts`, `attendee-reminders.ts`, `org-calendar.ts`, `profiles.ts` (data deletion list).

### 1.2 The member RSVP route: six copies (plus a seventh being retired)

`apps/*/src/app/api/threads/[id]/rsvp/route.ts`, all thin wrappers on the same four service calls, differing in everything around them:

| App | Lines | Eligibility | Paid | Materials | Emails | Other |
|---|---|---|---|---|---|---|
| arts-collective | 149 | `checkRsvpEligibility` | refuses priced workshop (402) | Nextcloud share on join/leave | none | thread must be PUBLIC and published, no org filter |
| amrit-canada | 242 | yes | none | none | confirmation + owner | cycle check for recurring, min-attendees nudge, GET |
| sunjay | 246 | yes | none (no paid refusal) | none | confirmation + owner | min-attendees nudge; filters published only, not visibility (#11) |
| elktours | 242 | yes | none | none | confirmation + owner | same as amrit with Khanda fallback |
| fourthwayBookreaders | 67 | yes | none | none | none | reading group join inserts a viewer row with raw SQL |
| innergathering | 287 | yes | **paid branch**: `createThreadOrder` + `startStripeCheckout` | `shareWorkshopMaterials` | confirmation + owner | org and published filter; previous yes skips a second charge |
| inner-gathering (hyphen) | 347 | | | | | being retired (service removed from compose 2026-11-16) |

Cancel (DELETE, same files): `deleteRsvp` only. Materials revoke exists in arts-collective and innergathering, absent in the rest. amrit and sunjay send no cancel email (the drift report records no cancel email elsewhere either). A paid cancel in innergathering deletes the RSVP and never touches the order: **no refund step** (security round 1 note 7, drift.md).

Other member doors writing `thread_rsvps`: standing-meeting attendance `hub/meeting/attendance/route.ts` (ifac, innergathering; sets flavour and promise_next; never reads price, no published filter: security round 1 note 2; the ifac copy was read and reads no price), ifac `api/hub/rsvp`, `api/series/rsvp` (6-line re-export in ifac and sunjay), fourthway `rsvpSession` (circle-actions.ts:401, creates the session topic first), `subscribeToSeries` in `meeting-series.ts`.

### 1.3 Guest RSVP: `guest_submissions`

`apps/{sunjay,amrit-canada,elktours,innergathering,admin}/src/app/api/rsvp/route.ts` (140 to 152 lines). Writes `guest_submissions(kind='rsvp', name, email, message, metadata{phone, wants_reminder})` and upserts `contacts`. 21 rows, all with an email (verified). It checks `is_rsvp_enabled` and `rsvp_deadline` only: **no capacity check, no rate limit, no captcha, no length caps, no email verification, and it sends a confirmation email to any typed address** (security round 2, sunjay/amrit/elktours notes in drift.md). The count shown to the public adds guest rows to member RSVPs. ifac removed its guest route (developer decision 2026-10-10: all ifac RSVPs signed in).

### 1.4 Paid places

- **Paid workshop / event**: the buyer pays through `createThreadOrder` (kinds workshop, event, `itemNoun: 'place'`) then `startStripeCheckout`. `confirmOrderPaid` inserts `thread_rsvps(yes)` inside the payment transaction (`orders.ts:~934-948`), only when the order has a `customer_id` (guests cannot buy). Only innergathering's route starts this flow; arts-collective refuses priced workshops. Legacy: `workshop_join_requests` (pending 3, no paid rows) is still read by `isEnrolledInWorkshop` (`workshop-offerings.ts:796`), which counts `thread_rsvps.yes` OR a paid join request as enrolment, so any RSVP opens the workshop gate and materials. Data: 0 orders on workshop or event lines, 1 `yes` RSVP on a priced thread (workshop `th_Iutg4U9dGrOGuBb3gx`, org inner_group, price 20.00): a free-door RSVP on a priced place, the #44 shape (verified by query).
- **Capacity for paid places**: none. `extraConfirmedCount` in `checkRsvpEligibility` was meant to fold in paid joins and nobody passes it. No hold exists: a seat is only taken when payment lands, so a full workshop can oversell.
- **Cancel / refund**: no code. Cancel deletes the RSVP; no refund, no email.

### 1.5 The booking module (`packages/booking`, migrations 265, 266, 267)

Tables (verified by `\d`/query): `booking_offers` (12 rows, all mode `set_dates`, all on kind `tour`), `booking_slots` (13 rows: 10 `manual`, 3 `departure`), `bookings` (0 rows), `booking_rules`, `booking_components`. Phase 1 deployed on artdirect 2026-11-15; `BOOKING_TABLES: "1"` is set on the elktours service in `docker-compose.yml:2089` (**verified**), so elktours departures run on `booking_slots` already, with the old `tour_departures` (3 rows) and `tour_bookings` (0), `service_bookings` (0) left in place. `ACCEPTED_MODES = open_hours, request_time, set_dates`; `sessions` and `rsvp` refused (`types.ts`).

Per booking: `status` held | awaiting_payment | requested | awaiting_seller | awaiting_booker | confirmed | waitlisted | cancelled | expired | completed | no_show (CHECK verified). Capacity: slot row `SELECT ... FOR UPDATE`, seats = confirmed/awaiting + unexpired holds (`bookings.ts:~91, 131, 468-490`), hold sized by `hold_expires_at` (CHECK requires it for held/awaiting_payment), `expireLapsedHolds()` sweeper and `expireBookingForOrder`. Money: booking row first, then order via `startBookingCheckout`; `markBookingPaid(orderId)` is called from `confirmOrderPaid` beside the two legacy hooks (`orders.ts:~974-990`). Cancel: `cancelAs` computes `refundShare` from the offer's policy and records `refund_status='due'` + `refund_due_minor`; **no Stripe refund is called**; a payment landing after the hold expired re-confirms with only a logged warning and no slot re-check (agent H note 4). Emails: `notify.ts` announces new, confirmed, cancelled (with refund line), reminders (`sendDueBookingReminders`). Buyer link `/bookings/<token>` and `.ics`. Guests supported (`booker_email`, `buyer_token`). Gaps: `waitlisted` is read (counts, `waitlist_cap`) but **never written, and nothing promotes** (no promote function in the package); no `attended` write path (`completed` and `no_show` exist in CHECK, nothing sets them); `rsvp` and `sessions` modes refused; org calendar does not read bookings (booking doc section 8).

### 1.6 Legacy booking in commerce (`packages/commerce`)

- `tours.ts` + `tour_departures`/`tour_bookings` (3 / 0 rows): party size, 60 min hold + 15 grace, row lock, cancel emails "reply about a refund", no refund issued; known defects: capacity can be lowered below seats taken, paying after cancel re-confirms (agent H notes 3). Used when `BOOKING_TABLES` is off.
- `service-bookings.ts` + `service_bookings` (0 rows): one-to-one propose/confirm times, seller-only cancel, no refund; callers artdirect/sunjay/hidden-enneagram/elastrocal `booking-actions`. HE's `saveBookingTimes` is authorised by knowing the paid order id (agent H note 8). Three copies of "book a service" (artdirect, sunjay near-identical, HE differs).

### 1.7 Comparison

| Path | Table | Guest | Money | Capacity | Hold | Waitlist | Cancel | Refund | Emails |
|---|---|---|---|---|---|---|---|---|---|
| Member RSVP | thread_rsvps | no | no | count check, no lock | none | never written | delete row | n/a | per app, mostly none |
| Standing-meeting attendance | thread_rsvps | no | none, ignores price | same | none | no | clear | n/a | none |
| Guest RSVP | guest_submissions | yes, unverified | no | none | none | no | none | n/a | confirm to any address |
| Paid workshop (innergathering) | commerce_order + thread_rsvps on paid | no | Stripe | none | none (order `dueHours` only) | no | delete row | none | confirmation after RSVP only |
| Booking module | bookings + booking_slots | yes via token | Stripe, order after row | row lock, computed seats | yes, expires | read-only, not written | `cancelAs` | recorded `due`, not issued | yes |
| Legacy tours | tour_bookings | token | Stripe | lock, computed | 75 min | no | manual | manual | yes |
| Legacy service | service_bookings | token | Stripe | none | none | no | seller only | manual | yes |

## 2. The one model

**A place on a thing.** The thing is anything with seats: an event occurrence (a `threads` row of kind meeting, event, workshop, series_session, reading_group), a service slot, or a tour departure. All three are already `booking_slots` rows or can be: `booking_slots(offer_id, starts_at, capacity, session_thread_id)` exists (the `departure` and `manual` sources are live; `session_thread_id` and `source=series` were designed for the week-per-thread case).

A place (`bookings` row) has:
- **state**: `held` (seat reserved, not yet confirmed) → `confirmed` → `cancelled` | `completed` (attended) | `no_show`; plus `waitlisted` (and promotion back to `held`/`confirmed`) and `expired` for a lapsed hold. This is already the booking CHECK list; no new state is needed.
- **optional payment leg**: `order_id` null = free; non-null = priced. Free is a place created straight to `confirmed`; priced is `awaiting_payment` with a hold, then `markBookingPaid`.
- **identity**: `booker_user_id` (signed in) or `booker_email` + `buyer_token` (guest). A guest place carries a verified email (see 3).
- **approval**: `instant` or `seller_confirms` (already `booking_offers.approval`).

How today's paths map:
- Free RSVP: place, no order, `confirmed`, `source='rsvp'` (the column already lists `rsvp` as a value in the design). It still **writes `thread_rsvps(yes)`** as the attendance read model for the nine readers (this is the standing decision of 2026-11-14, option 3a). So there is one write path and two tables: `bookings` is the record, `thread_rsvps` the projection.
- Paid workshop: place + checkout (`startBookingCheckout`), `markBookingPaid` projects `thread_rsvps(yes)`.
- Service booking: place on a slot (`open_hours`/`request_time`), checkout. Already the module's own path.
- Guest RSVP: place with verified email, same table, no `thread_rsvps` row (guests cannot hold one).
- Tour departure: place with `party_size`, already live behind `BOOKING_TABLES`.

**Cheap RSVPs that need no capacity** ("maybe", "subscribed", flavour, promise_next, "I will come next week" on a standing meeting): stay in `thread_rsvps` only, no booking row. This is the 2026-11-14 rule: a booking exists when the thing has capacity, price, a slot, a party size or an approval step. Standing meetings have none of these today (only 2 threads have `attendee_limit`), so almost all current RSVPs stay as they are, and what changes is the code that writes them (one handler), not their table. Rule for the handler: a thread with an `attendee_limit`, a price, or an approval step goes through `createBooking`; a thread with none writes `thread_rsvps` directly through the same handler.

### Can `packages/booking` be the home?

Yes for places, holds, locks, money, refund records, guests, reminders. What it lacks (each a bounded piece of work):

| Need | State | Work |
|---|---|---|
| Capacity lock | present (slot `FOR UPDATE`) | for an event with no slot rows: create one `booking_slots` row per thread on first RSVP (the design's "slot row on first booking") |
| Holds that expire | present | free places need none; paid workshops get `hold_minutes` like tours |
| Refunds | records `due` only, never issued; late-payment-after-expiry re-confirms without slot re-check | add a re-check in `markBookingPaid`; a single approved refund action (atlas row already named: "packages/booking cancelAs with refund-due, then a single approved refund action"); Justin's call whether it may call Stripe |
| Waitlist | read-only | write `waitlisted` when the slot is full and `offer.waitlist`; promote oldest on cancel/expiry (decision 9 on 2026-11-14 already chose automatic) |
| Attendance | statuses exist, nothing writes them | a host action: mark completed / no_show; reminders and the standing-meeting "attended" read it |
| `rsvp` and `sessions` modes | refused | accept `rsvp`; `sessions` waits for the series dates fix |
| Guests with capacity | token only | verified-email step (below) |
| thread_rsvps projection | none | `confirmBooking` upserts, `cancelBooking` deletes, in the same transaction |
| Org calendar reading bookings | not wired | later, additive |

## 3. Where membership comes in

- **An RSVP grants participant standing** (Justin's rule). The handler's final step after a confirmed place on a thread that is not `PUBLIC`: ensure an `org_followers` row (viewer standing, never member). It never changes a role (fourthway's raw viewer insert is the one existing case, to be replaced by this). Participants may read, RSVP, comment and post to the forum; publishing under the org's name stays at member or above (already enforced; the handler must not widen it).
- **Members-only threads stay RSVP-able by design (#42).** The handler therefore filters on org and `status='published'` only, never on visibility. The consequence is recorded: the members-only gates are soft by intent. The handler needs a comment saying so, because arts-collective's route filters PUBLIC (the opposite) and the next reader will "fix" it. Keep arts-collective's PUBLIC filter only as an app option `visibility: 'public-only'` if Justin wants the subdomain route to stay narrow.
- **Paid places do not open materials until paid (#44).** `isEnrolledInWorkshop` is the gate (`thread_rsvps.yes` OR paid join request). With one handler, a free RSVP on a priced thread is refused (402, as arts-collective does now) in every app, and materials open only when `markBookingPaid` projects the `yes`. Unwind the existing case: the one `yes` on priced workshop `th_Iutg4U9dGrOGuBb3gx` (inner_group) is a candidate for either leave-as-is (a comp) or removal; the project should ask, not decide (question 3).
- **Standing meeting attendance** (no price, no slot) is not a place; it keeps the `thread_rsvps` flavour/promise model but must call the same `rsvp eligibility` function, including a price refusal (security round 1 note 2).

## 4. Migration order

Constraint: production builds are running; any rebuild is Justin's go. Follow the repo rule (one app rebuild at a time, `.next/lock` check). Migrations use "next free number"; never edit an applied file.

### Step 1: one RSVP handler in `@elkdonis/services`

New file `packages/services/src/rsvp-handler.ts`, exported like `connectionsHandlers` (`rsvpHandlers(options) => { GET, POST, DELETE }` for the member door; `guestRsvpHandler(options)` for the guest door), built on the existing `thread-rsvp.ts` primitives (kept; `checkRsvpEligibility` gains a lock-safe variant using one `SELECT ... FOR UPDATE` on the thread row or, for capacity-limited threads, the booking path). Options per app: `orgId`, `getViewer`, `emailsOn`, `emblem`, `materials: 'nextcloud'|'none'`, `visibility`, `paid: 'refuse'|'checkout'` (step 2 turns on `checkout`).

Shared behaviour (the union of what the copies do now, none of the defects): org + published filter; viewer required; eligibility; price refusal (#44); capacity under lock; waitlist write when full and the offer allows; previous-status guard; recurrence-cycle check (amrit/elktours GET); min-attendees nudge as a one-shot; confirmation to the person and notification to the owner, both optional per app; materials sync (Nextcloud) on join/leave; participant standing; same response shape. Cancel: delete row, revoke materials unless still entitled (arts-collective's `stillEntitled` check), email optional. Guest: validated email, per-IP and per-email rate limit, length caps, capacity and deadline check, a confirmation link that must be clicked before the place counts (verified email), no email to unverified addresses beyond that one message.

Files to change (replace body with a mount of the handler; `drift` rows in the atlas then fold in as hosts):
- `apps/arts-collective/src/app/api/threads/[id]/rsvp/route.ts`
- `apps/amrit-canada/src/app/api/threads/[id]/rsvp/route.ts` and `apps/amrit-canada/src/app/api/rsvp/route.ts` (guest)
- `apps/sunjay/src/app/api/threads/[id]/rsvp/route.ts` and `.../api/rsvp/route.ts`
- `apps/elktours/src/app/api/threads/[id]/rsvp/route.ts` and `.../api/rsvp/route.ts`
- `apps/fourthwayBookreaders/src/app/api/threads/[id]/rsvp/route.ts` and `src/lib/circle-actions.ts` (`rsvpSession`)
- `apps/innergathering/src/app/api/threads/[id]/rsvp/route.ts` (wait for step 2) and `.../api/rsvp/route.ts`
- `apps/admin/src/app/api/rsvp/route.ts` (guest, 49 lines)
- `apps/ifac/src/app/api/hub/rsvp/route.ts`, `apps/ifac/src/app/api/hub/meeting/attendance/route.ts`, and `apps/innergathering/src/app/api/hub/meeting/attendance/route.ts` (adopt the price refusal and org filters; keep flavour)
- `apps/inner-gathering/...` is retired: no change.
- New: `packages/services/src/rsvp-handler.ts`, `packages/services/src/index.ts` (export), `packages/actions/atlas/areas/*` (hosts folded into the `rsvp-to-event`/`cancel-rsvp` rows).
- Data migrations: none. The guest route needs somewhere to hold unverified places and rate-limit counters: either reuse `guest_submissions` (add nothing, status in `metadata`) or a small migration (`guest_rsvp_verifications`, token + expiry). Prefer reuse in step 1 and decide the table with the guest rows (21 existing rows stay as they are: all have emails, none verified; they are history, not places).
- Rebuilds (in this order, one at a time, each verified after): arts-collective (the member door of record), sunjay, amrit-canada, elktours, fourthwayBookreaders, innergathering, ifac, admin. Packages are bind-mounted, so apps that do not rebuild keep their old code until rebuilt.
- Risk: lowest of all steps. Behaviour gains are the price refusal in sunjay/amrit/elktours/fourthway (previously none) and capacity under lock.

### Step 2: the paid branch (innergathering's checkout) into the same handler

Handler option `paid: 'checkout'` turns the 402 refusal into: create a place (`awaiting_payment`, hold) via `createBooking` on a per-thread slot, then the existing `createThreadOrder` + `startStripeCheckout` through a new `startBookingCheckout` variant, return `{requiresPayment, checkoutUrl}`. `markBookingPaid` confirms and projects `thread_rsvps(yes)` and shares materials (move the share call into a post-payment hook so it happens after payment, not on RSVP). `confirmOrderPaid` keeps its direct `thread_rsvps` upsert for workshop/event lines during the transition (idempotent with the projection); remove it in a later cleanup when no order can be paid without a booking row.

Files: `packages/booking/src/server/bookings.ts` (event-slot creation, `source='rsvp'`, late-payment slot re-check, projection), `packages/booking/src/server/offers.ts` (accept mode `rsvp`: `core/types.ts` `ACCEPTED_MODES`), `packages/checkout/src/server/thread-checkout.ts` (workshop/event checkout variant), `packages/commerce/src/server/orders.ts` (hook, later remove the upsert), `packages/services/src/workshop-offerings.ts` (`isEnrolledInWorkshop` reads confirmed bookings too), `packages/services/src/rsvp-handler.ts`, `apps/innergathering/.../rsvp/route.ts`, then the other apps flip `paid` from `refuse` to `checkout` one by one.
Migrations: one additive migration only if needed for `booking_offers` on non-tour threads (a unique `(thread_id)` already exists); the backfill is the empty set: **0 orders and 0 paid join requests exist on workshop/event lines**, 3 `pending` `workshop_join_requests` (legacy, leave), and the single priced-workshop RSVP (question 3). No counts to move.
Rebuilds: innergathering first (it already has the flow), then arts-collective (turns its 402 into checkout), then any site that sells workshops.
Money: stays link-only for the dock (Justin's rule), real card test needed (see section 5).

### Step 3: service bookings

`service-book-and-pay` already ends on `startBookingCheckout` + `createBooking` for artdirect; the remaining copies are sunjay (refuses `one_on_one` on a stale "unapplied" comment), hidden-enneagram (pay first, times after, `saveBookingTimes` authorised by order id), elastrocal. Move each to one kit action over `startBookingCheckout`; HE keeps `request_time` ("pay first") as a mode, with its auth fix (check the buyer token, not the order id).
Files: `apps/artdirect/src/lib/booking-actions.ts` (already on the module), `apps/sunjay/src/lib/booking-actions.ts` (drop the refusal, fix the comment), `apps/hidden-enneagram/src/lib/booking-actions.ts`, `apps/elastrocal/src/app/services/[slug]/actions.ts`, `packages/commerce/src/server/service-bookings.ts` (stops being called, not deleted), `docs/reference/commerce.md` (stale "not yet applied" text).
Data: `service_bookings` 0 rows, no move. Retire later (drop `service_bookings`) only after a release with it unread.
Rebuilds: artdirect (no change if nothing differs), hidden-enneagram, elastrocal, sunjay, one at a time.

### Step 4: tours, behind `BOOKING_TABLES`

State today: `BOOKING_TABLES=1` is on for elktours already; 12 offers, 13 slots (3 `departure` copies), 0 `bookings`. The wider cutover is not an RSVP step: it is retirement of the legacy tables once the flag has held for a release. Remaining work: tour guest bookings by token are live; the legacy defects (capacity below seats taken, paid-after-cancel re-confirm, no refund) disappear because `booking_slots` already locks and `markBookingPaid` re-checks (once fixed in step 2); the **ownership check on elktours tour authoring** (security #33) is independent and must be done in `apps/elktours/src/lib/tour-actions.ts` regardless.
Files: `apps/elktours/src/lib/tour-slots.ts`, `departures.ts`, `slot-actions.ts`, `instrumentation.ts` (remove the flag branch once stable), `packages/commerce/src/server/tours.ts` (retire).
Data migration: `tour_departures` 3 rows already mirrored as 3 `booking_slots` (verified, `source='departure'`); `tour_bookings` 0 rows. Migration C (drop `tour_bookings`, `tour_departures`, `service_bookings`) is a later separate migration, after one release; `service_commissions.departure_id` FK must be repointed first (booking doc section 3 step 4).
Rebuild: elktours only.

## 5. Risks

- **Money.** Booking creates the row before the order, so a failed checkout leaves an `awaiting_payment` row; `expireLapsedHolds` is the only cleanup and runs from the artdirect tick and elktours instrumentation, not from every app: the sweeper must be mounted wherever a paid place can be created (assumed; confirm the tick in each app). A payment that lands after the hold expired re-confirms without checking the slot: fix before enabling paid places on a limited-seat workshop. Refunds are `due` only: a paid cancel in the new model would be *recorded* where today it is silently deleted (an improvement), but nothing issues money (question 2). No Stripe live key in probes: verify the paid path to order creation and `markBookingPaid` in a rolled-back transaction; a real card payment end to end is still an open item from the booking doc.
- **Double booking.** Today's RSVP count-then-insert is racy; the module's lock is the fix, but only for capacity-limited threads (2 now). A mixed state (some apps on the old route, some on the handler) is safe only if both write `thread_rsvps` and the handler counts `thread_rsvps` plus open bookings for a thread with both. Do step 1 for all apps in one rollout window.
- **Emails.** The handler sends a confirmation per app where only some did before (arts-collective, fourthway sent none): either keep `emailsOn` per app (recommended) or announce the change. Guest verification changes who can receive mail; `sendRsvpConfirmation` to unverified addresses stops. The booking module's mail was previously silent on artdirect until the SendGrid key was added (history 2026-11-15): check `SENDGRID_API_KEY` per app before enabling.
- **Existing data.** `thread_rsvps` is not backfilled and stays canonical for attendance (no rows move). `guest_submissions` rsvp rows (21) stay history and are not places; counts shown on pages that add guests to members will change when guest places become `bookings`: pick one count source per page. `maybe` and `subscribed` remain `thread_rsvps`-only. The recurring-cycle logic (a yes expires with its cycle) lives only in two copies and must be carried into the handler, or recurring meetings will show everyone attending forever.
- **Membership.** Participant standing from RSVP is new for sunjay, amrit and fourthway (they currently do not follow a non-affiliate). It widens who can post in forums on those sites: confirm per org (question 4).
- **Hidden coupling.** `join-link.ts`, `media-authz.ts` and `meeting-series.ts` read `thread_rsvps` directly; guest places (booking rows only) do not open them, which is the safer default but should be decided (booking doc open question on join paths).

## 6. Open questions for Justin

1. **Guests on RSVP**: should a guest RSVP need a verified email (click a link) before it counts, and may a guest take a seat on a capacity-limited event? Or is guest RSVP just "tell the host I am coming" (no seat)? (Drives step 1's guest handler and the 21 existing guest rows.)
2. **Refunds**: when a paid place is cancelled, should the platform issue the Stripe refund automatically per the policy, or keep "recorded as due, the seller refunds by hand" (the 2026-11-14 phase 1 choice)? Same question for a departure cancelled by the guide.
3. **The one priced RSVP**: workshop `th_Iutg4U9dGrOGuBb3gx` (inner_group, 20.00) has one free `yes` RSVP. Leave it (comp), remove it, or make that person pay?
4. **Participant standing**: should an RSVP on sunjay, amrit-canada and fourthway automatically make the person a follower (viewer) of the org, as the member rule implies? arts-collective's own rule (it gives no membership) was an explicit choice.
5. **Waitlist**: automatic promotion with an emailed pay link and a hold (the 2026-11-14 decision 9) now applies to free RSVPs too: yes?
6. **Standing meetings**: attendance with flavour and "promise next" stays a plain RSVP row with no booking, as proposed. Should "attended" be recorded (host marks who came), and for which kinds?
7. **arts-collective's PUBLIC filter** versus the other apps' org-and-published filter: keep the subdomain route narrow or make all routes follow "members-only is RSVP-able by design"?
8. **Rollout**: do step 1 across all apps in one batch after the current builds finish, or app by app?
