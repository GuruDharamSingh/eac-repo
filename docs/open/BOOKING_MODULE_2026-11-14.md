# Booking module: survey and design (2026-11-14)

Design for one booking module that serves four forms (offering, meeting with places, elktours departures, event programme with extras) and is also a section in the Studio forms. Survey and design only: no code, migration, build, commit or database write was made; database checks were `SELECT`/`\d` on `elkdonis_dev` (live data). No Stripe call was made. Status labels: **verified** (how), **assumed**, **unknown**. Companion documents: `docs/open/STUDIO_FORMS_SPLIT_2026-11-14.md` (forms packages), `docs/reference/commerce.md` (orders, bookings), `docs/open/ELKTOURS_BRIEF_2026-10-18.md`.

Direction (developer, 2026-11-14): booking is "its own concern so far as that i want it to be well fleshed out, then also a natural part of many forms that may need it." Parked, not to be blocked: agreements between a curator or guide and an artist (percentage or goal amount), the platform as arbiter.

## 1. Current state

Three booking mechanisms exist, each with its own table, capacity rule and notifications. A fourth (plain RSVP) has no payment. No shared availability concept exists.

### 1.1 Tours: departures and party size (migration 208, 236)
- `tour_departures` (thread, org, `starts_at`, `capacity`, `guide_user_id`, `status` scheduled|cancelled) and `tour_bookings` (order, departure, `party_size`, status awaiting_payment|confirmed|cancelled, `buyer_token`). **Verified** 2026-11-14 by `\d`; rows: 3 departures, 0 bookings.
- Seats taken = confirmed bookings plus unpaid ones younger than `HOLD_MINUTES` (60 + 15 grace), computed in a lateral join, not stored (`packages/commerce/src/server/tours.ts:~250-275`, `HOLD_MINUTES` ~:57). **Verified** by reading.
- Race control: `createTourBooking` locks the departure row `FOR UPDATE` and re-counts (`tours.ts`, `createTourBooking`); a pre-check runs before the order exists (`checkDepartureAvailability`). **Verified** by reading; not exercised (no probe run: probes call Stripe).
- Party size is order line `quantity`; price is per person (`createThreadOrder({quantity})`, `packages/commerce/src/server/orders.ts`; `startTourCheckout` at `packages/checkout/src/server/thread-checkout.ts:175`). Max party 20 (`MAX_PARTY_SIZE`).
- Paid → `markTourBookingPaid` after commit, idempotent (`orders.ts:~980`). Cancel (departure or booking) marks rows cancelled and emails; refunds are manual ("Reply to this email about a refund", `tours.ts`, `cancelDeparture`, `cancelTourBooking`). **Verified** by reading.
- Buyer page `/bookings/<token>` on the selling site; `.ics` per booking (`tourBookingIcs`).
- Experiences (migration 236): `threads.kind='experience'`, linked to a `kind='service'` thread by `metadata.experience.serviceThreadId` (`apps/elktours/src/lib/experiences.ts:32`); tour stops can point at an experience (`tour_stops.experience_id`, `tours.ts` `saveTourStops`). `service_commissions` (an org proposes to book an artist's service per run/per guest/flat) has `payment_status` pinned to `'stub'` by a CHECK, so no money path exists; 0 use of the table outside `apps/elktours/src/lib/commissions.ts`. **Verified** by `\d` and grep.

### 1.2 One-to-one services: proposed and confirmed times (migration 174)
- `service_bookings` is **applied**: `app_schema_migrations` row `174_service_bookings.sql` applied 2026-09-28 02:39 UTC; `\d service_bookings` shows the table; 0 rows. **Verified** by query 2026-11-14.
- **Stale claims to correct** (not edited here): `docs/reference/commerce.md` ("not yet applied") and the comment at `apps/sunjay/src/lib/booking-actions.ts:11-12` ("unapplied on 2026-10-03"). sunjay still refuses `one_on_one` services in code (`booking-actions.ts`, "Send an enquiry instead") because of that comment; the refusal is now unnecessary on the data side (assumed: the migration runner state is the whole story; the code in `service-bookings.ts` was not run).
- Model: one row per paid order; the buyer proposes 1-3 times (`parseProposedTimes`, `MAX_PROPOSED_TIMES = 3`, at least an hour ahead, within a year), the seller or buyer confirms one of the other side's open times or counter-proposes; `proposed_times timestamptz[]` holds the open proposal only, `scheduled_at` the agreed start; status awaiting_payment → awaiting_seller ⇄ awaiting_buyer → confirmed | cancelled. Seller answers at arts-collective `/hub/bookings`, buyer at `/bookings/<token>`; `.ics` for both. Seller-only cancel; no automatic refund (`packages/commerce/src/server/service-bookings.ts`, `startServiceCheckout` at `thread-checkout.ts:149`). **Verified** by reading and `docs/reference/commerce.md`.
- Callers: artdirect `apps/artdirect/src/lib/booking-actions.ts` (person's own service in `oad`), hidden-enneagram `apps/hidden-enneagram/src/lib/booking-actions.ts` ("Book and pay": Stripe first, times asked after payment through `saveBookingTimes`), elastrocal `apps/elastrocal/src/app/services/[slug]/actions.ts`, sunjay (group and async only). No availability: the seller's open hours are not stored anywhere.
- Offering fields: `threads.kind='service'` + `workshop_pages` sidecar; `metadata.bookingType` one_on_one|group|async (`packages/services/src/service-offerings.ts:369`, read at :121); `workshop_pages.registration_status` open|waitlist|full|closed (CHECK, verified by `\d`); `session_count`, `session_duration_hrs`, `recurrence_label`, `registration_deadline`, `price_sliding_min`, `price_member`. None of these is enforced as capacity: `registration_status` is a hand-set label (assumed from `bookingAvailability` reading no capacity; not every reader checked).

### 1.3 Meetings: RSVP, limit, waitlist
- `thread_rsvps(thread_id, user_id, status, flavour, promise_next)`; status CHECK yes|no|maybe|waitlist|subscribed; `user_id` NOT NULL, so guests cannot hold a row (`docs/reference/commerce.md`, "Paid workshops"). 48 rows: yes 43, maybe 3, subscribed 2 (**verified** by query). 26 meetings, 4 workshops, 16 `series_session` rows, 2 series, 1 reading group have `is_rsvp_enabled`; `attendee_limit` is set on 1 meeting and 1 post (verified by query).
- Capacity check is `checkRsvpEligibility`: `is_rsvp_enabled`, `rsvp_deadline`, `attendee_limit` against the count of `yes` rows, with an `extraConfirmedCount` hook for commitments held elsewhere (`packages/services/src/thread-rsvp.ts:34-65`). No code writes the `waitlist` status (assumed from grep of `thread-rsvp.ts`; app routes not all read). `min_attendees` exists on `threads` (migration 024) and is carried by compose adapters; no enforcement ("runs with N or more") found: **unknown**.
- Paid workshops/events: `confirmOrderPaid` inserts the `thread_rsvps` row in the payment transaction for kinds workshop and event (`orders.ts:~930-955`). Guests cannot buy.
- Readers of `thread_rsvps`: at least `center.ts`, `forum.ts`, `join-link.ts`, `viewer-alerts.ts`, `series-people.ts`, `meeting-series.ts`, `paath-day.ts`, `attendee-reminders.ts`, `org-calendar.ts` (grep, 2026-11-14). The table is a widely used read model, so replacing it is costly.
- Series: `series_sessions` (migration 203; slot/starts_at/status per week, RLS `tenant_isolation`, verified by `\d`; 14 rows) is the set-dates source for a series; each week is a thread and RSVPs attach per week. The `slot_at` column is nullable and reserved for hand-picked weeks, but code refuses non-rule dates (`docs/open/STUDIO_FORMS_SPLIT_2026-11-14.md` §2.4).

### 1.4 Shared infrastructure
- Orders: `createThreadOrder` (single thread, `quantity`, optional sliding amount, `dueHours` at `orders.ts:~258`, kinds guard `PurchasableThreadKind`), `startThreadCheckout` (`thread-checkout.ts:114`), `checkoutReturn`, `confirmOrderPaid` with post-commit hooks for service and tour bookings (`orders.ts:~974-981`), `releaseExpiredOrders` (cancels orders past `payment_due_at`, `orders.ts:~1128`). An order has one thread line today: extras bought with a main ticket in one checkout need a multi-line variant (**unknown** whether `commerce_order_line` already supports several thread lines in one order; the table does; `createThreadOrder` does not).
- Payee: settlement resolves from the thread author (`resolveSettlement`); a departure's guide does not move money (`tours.ts` header). Platform fee 10%/5% for services is not built (`docs/reference/commerce.md`).
- Calendar: `org-calendar.ts` reads `threads` of `SCHEDULED_KINDS = event, meeting, series, workshop, reading_group` (:81) with `rsvp_count` from `thread_rsvps` (:551). It does not read `tour_departures`, `tour_bookings` or `service_bookings`. elktours has its own `/manage/schedule` and `listOrgDepartures`.
- Reminders: `attendee-reminders.ts` reads `thread_rsvps` and `threads.reminder_minutes_before` (:77-169). No reminder exists for tour or service bookings (**assumed**; grep found none).
- Other: `availability_polls/slots/responses` (migration 004) are for scheduling polls, not bookings; unrelated.
- Money rule: no probe script may run with the live Stripe key. Any build verification must avoid creating Stripe objects (see §6, question 1).

### 1.5 The Schedule form canvas (2026-11-11, round 1, unreviewed)
Read 2026-11-14 through the Artifact tool (Main, Tour, Agent, Bookings boards read in full; Advanced, Client, ClientTour, Artist not opened). Summary:
- One form, "Kind" switch: **Open hours** (length, weekday toggles, hours ranges with "+ Hours", Where: online with a Talk room per booking, in person, by phone; Starting date; "first week as clients see it" preview in the site's time zone) and **Set dates** (length, Seats, "Runs with N or more", Repeats rule + start time + until, a Departures list of date/start/guide/seats bar/state with "+ Date", "Booking closes N hours before", Agents "may hold seats for N hours"). Simple and Advanced tabs.
- **Agent**: an outside reseller who books for a client: client name/email, tour, departure picker with seats left, party size, note; price, agent commission, client total; three actions: hold seats for 48 hours, send a pay link, take a card now; "Your holds" list with Pay and Release. Agent semantics are an assumption of the canvas (memory note), not a developer decision.
- **Org calendar** (Bookings board): week/month/list, filter by person, three kinds drawn (reading booked, tour with seats of capacity and "held by an agent", dashed "waiting for an answer"), a "Needs an answer" queue (Confirm / Other times / Offer a date / Decline), "Held seats" with countdown, "This week" totals, an `.ics` link. **Artist day** (phone) not read.
- The canvas already assumes capacity, held seats, request-a-time and set dates in one form, which matches the model below.

## 2. Proposed design

### 2.1 One model for what can be booked
A **bookable** (`booking_offers`) is attached to one thread (a service, meeting, tour, experience, event, series). It says how time is offered, how many, at what price and under what terms. A **slot** (`booking_slots`) is one concrete occurrence with its own capacity. A **booking** (`bookings`) takes quantity from one slot, or, in request-a-time mode, asks for a time.

`booking_offers` (one per thread; fields):
- `mode`: `open_hours` | `set_dates` | `request_time` | `sessions` (set-dates whose slots are a series' weeks) | `rsvp` (free, no slot rows; `thread_rsvps` semantics).
- `duration_minutes`; `time_zone`; `capacity_per_slot` (null = unlimited, 1 for one-to-one); `min_party`, `max_party`; `min_to_run` (maps `min_attendees`, "runs with N or more"); `close_before_hours`, `lead_time_hours`; `max_ahead_days`.
- Pricing: no new price. Price stays on the thread (`threads.price`, sliding fields on `workshop_pages`); the offer carries `price_unit` = `per_booking` | `per_person` and uses the existing `quantity` for per-person. Free = no price.
- Holds: `hold_minutes` (default 75, the current tour value, so a card hold matches Stripe's session plus grace) and `agent_hold_hours` (null = agents may not hold).
- Approval: `approval` = `instant` | `seller_confirms` (instant for open hours and set dates; request-a-time is always seller-confirms).
- Cancellation: `cancel_free_until_hours`, `cancel_refund_percent_after` (0-100), `cancel_policy_text` (shown to the booker). Stored and shown now; refunds stay manual in phase 1 (§6, decision 4).
- Waitlist: `waitlist` boolean.
- Status/visibility follow the thread's, not a copy; the offer has `status` open|paused|closed.

`booking_rules` (open hours): `offer_id`, `weekday` 0-6, `from_time`, `to_time`, `valid_from`, `valid_until`, optional `capacity`. Slots for open hours are **computed** from rules minus existing bookings and busy times, and a `booking_slots` row is **created on first booking** (unique on `offer_id, starts_at`), so no rolling pre-generation job is needed and the row is the lock target. Assumed trade-off: the read path computes up to `max_ahead_days` per request (small, per-offer).

`booking_slots`: `id`, `offer_id`, `org_id`, `starts_at`, `ends_at`, `capacity`, `guide_user_id`, `status` scheduled|cancelled, `note`, `source` manual|rule|series|departure, `session_thread_id` (nullable; the series week this slot mirrors), `created_at/updated_at`. Seats taken stay **computed** (confirmed + unexpired holds), as `tours.ts` does today, with `SELECT … FOR UPDATE` on the slot row before inserting a booking.

How each existing structure maps:

| Existing | Becomes | Disposition |
|---|---|---|
| `tour_departures` | `booking_slots` (`source='departure'`, same id kept) | replaced; backfill 3 rows (verified count) |
| `tour_bookings` | `bookings` | replaced; backfill 0 rows (verified count) |
| `service_bookings` (174) | `bookings` in `request_time` mode; proposal columns move onto `bookings` | replaced; 0 rows; table left untouched then dropped by a later migration |
| `thread_rsvps` | kept as the attendance read model; written by the booking service when a booking confirms on a meeting/workshop/event | kept (≥9 readers); `waitlist` status finally written |
| `threads.attendee_limit / rsvp_deadline / min_attendees / is_rsvp_enabled` | read by the offer for `rsvp` mode; forms write the offer, the service mirrors the three columns for old readers | kept, mirrored |
| `series_sessions` | slot source for `sessions` mode (materialised `booking_slots` row per bookable week, keyed `session_thread_id`) | kept; stays authoritative for the schedule |
| `workshop_pages.registration_status` | derived: `full` when slots are full, `closed` when offer paused; manual `waitlist` label folds into `offer.waitlist` | kept, derived |
| `metadata.bookingType` | `one_on_one` → `request_time` or `open_hours`; `group` → `set_dates`; `async` → no offer (or `rsvp` with no slots) | kept as a label, offer is the source |
| `service_commissions` | stays; becomes an agreement type later (§2.6) | kept, not touched |
| `availability_polls` (004) | unrelated | kept |

### 2.2 One booking record
`bookings`: `id`, `org_id`, `offer_id`, `slot_id` (null while a request has no time), `thread_id` (denormalised for listing), `booker_user_id` (null for guests), `booker_email`, `booker_name`, `booker_time_zone`, `party_size` (default 1), `status`, `source` (`web` | `agent` | `seller` | `rsvp`), `agent_user_id` / `agent_org_id` (nullable, reserved), `order_id` (nullable, unique: null means free or unpaid-hold), `hold_expires_at`, `proposed_by`, `proposed_times timestamptz[]`, `scheduled_at` (request-a-time result; equals slot start otherwise), `notes` (booker), `answers jsonb` (intake questions; written with `db.json`), `buyer_token` (unique, same private-link model as today), `waitlist_position` (computed, not stored), `cancelled_at`, `cancelled_by` (`booker`|`seller`|`system`), `cancel_reason`, `refund_status` (`none`|`due`|`issued`|`declined`), `parent_booking_id` (for extras, §2.5), `agreement_id` (nullable, reserved, no FK until agreements exist), `created_at/updated_at`. RLS `tenant_isolation` on `org_id` like `series_sessions` (assumed pattern from migration 227; not re-read).

Statuses: `held` (agent or pay-link hold, no order yet) · `awaiting_payment` (order exists, seats held until `hold_expires_at`) · `requested` / `awaiting_seller` / `awaiting_booker` (request-a-time, same meanings as 174) · `confirmed` · `waitlisted` · `cancelled` · `expired` (hold lapsed) · `completed` · `no_show`. CHECK ties `confirmed` to a non-null `scheduled_at`, as 174 does.

Free and paid relation:
- Free booking or RSVP: no `order_id`; created `confirmed` (instant) or `requested`; the service also upserts `thread_rsvps` `yes` for signed-in bookers (guests have only the `bookings` row, which fixes the "guests cannot RSVP" limit for capacity-limited events without changing `thread_rsvps.user_id NOT NULL`).
- Paid booking: booking row `awaiting_payment` is created in the same transaction as the slot lock and `createThreadOrder` is called with `quantity = party_size` (current pattern: order first, then row; the new order is booking first then order, so the lock covers both). `confirmOrderPaid` calls `markBookingPaid(orderId)` after commit (replaces the two existing hooks). Cancel by expiry: `releaseExpiredOrders` → `expireBookingForOrder`.
- Plain RSVP intent with no capacity ("yes/maybe/no/subscribed") stays in `thread_rsvps` only; no booking row. A booking exists when the thing has capacity, price, a slot, a party size or an approval step.

Waitlist: if the slot is full and `offer.waitlist`, the booking is created `waitlisted` (no order). When seats free (cancel, expiry, capacity raised) the service promotes the oldest waitlisted booking that fits: free → `confirmed`; paid → `held` for `hold_minutes` with a pay link emailed. Hold expiry returns the seat to the next in line.

Holds and expiry: seats count = `confirmed` + (`awaiting_payment`|`held` with `hold_expires_at > now()`). A scheduled job (the existing expiry sweeper pattern, `releaseExpiredOrders`) marks lapsed rows `expired`. Agent holds use `held` with `hold_expires_at = now + agent_hold_hours` and no order; the order is created when the pay link is opened, using the existing `dueHours` input.

Cancellation and refund: the service computes the refund share from the offer's policy at cancel time and records `refund_status='due'` with the amount; it does not call Stripe in phase 1. The seller sees "refund due" in the manifest and issues it from the order as today.

### 2.3 Request-a-time (one-to-one)
`mode=request_time`, or `open_hours` with `approval=seller_confirms`. The proposal columns of 174 move onto `bookings` unchanged in meaning (`proposed_by`, `proposed_times`, `scheduled_at`, `last_message`). Open-hours offers skip negotiation: the booker picks a computed slot and the booking is confirmed (or goes to the seller for confirmation). Recommended order of operations for paid one-to-one: pick a time first, then pay; the existing "pay first, times after" flow (hidden-enneagram) remains available as `request_time` (**assumed** acceptable; the developer chose it in round 3 of that site).

### 2.4 Package boundary
- `packages/booking` (`@elkdonis/booking`): tables' data layer and rules. Depends on `@elkdonis/db` and the mail helper only, **not** on `@elkdonis/commerce`: `commerce` calls `markBookingPaid`/`expireBookingForOrder` from it, `checkout` composes both (`startBookingCheckout`: lock → create booking → `createThreadOrder` → Stripe session). This avoids a cycle (today commerce owns `tours.ts` and `service-bookings.ts` and checkout imports commerce). Contents: `offers`, `slots` (computeOpenHours, slotsForSeries), `availability` (seatsLeft, canBook), `bookings` (create, confirm, propose, cancel, hold, release, promoteWaitlist), `policy` (refund share), `notify`, `ics`. All bookings reads are org-scoped; guest reads by token only.
- `@elkdonis/services` `booking-offers.ts`: the org-checked saves forms call (`saveBookingOffer(orgId, actor, threadId, input)`, `listBookings`, `cancelBooking`, `answerRequest`), as directed in the forms split. Offer saves run in the same call as the thread save (`upsertServiceOffering`, `saveMeetingContent`, `saveTour…`) so a form never writes a thread and an offer in two round trips.
- `@elkdonis/studio-forms` **Booking section**: a section type usable inside any form (service, meeting, tour, event). Quick-Form shows four rows: Kind (Open hours | Set dates | Ask for a time), Length, Seats (shown for Set dates and meetings), Price follows the form's own Price row. Norm-Form adds hours ranges, repeats and departures list, party limits, "runs with", booking closes, holds, Where, intake questions, cancellation policy, waitlist, approval. The section's output is `BookingOfferInput`, validated by `@elkdonis/booking`. Layout matches the Schedule canvas (ledger rows). Deep-Form (`@elkdonis/studio`) adds the departures grid and the org calendar.
- Public surface: `BookingPanel` in `@elkdonis/checkout/components` next to `ServiceBookingForm` and `BookingScheduler` (plain CSS, already the booking UI), with three bodies: pick a time, pick a departure + party size, request times. A site mounts it on the thread page, or opens it in the existing surface popup (cms-ui surfaces, as the Center journeys do). Buyer page stays `/bookings/<token>` (already in middleware passthrough on arts-collective/elktours; other sites to add), seller console `/hub/bookings` on arts-collective and `/manage/bookings` on org sites.
- Org calendar and reminders read bookings through `@elkdonis/booking`: `readOrgCalendarWindow` gains a bookings source (slots with seats taken, "needs an answer", held seats) next to threads; `attendee-reminders.ts` gains a bookings reader (confirmed bookings with a `slot.starts_at`, using the thread's `reminder_minutes_before`). Both are additive.
- Agents and agreements stay out of the schema except the nullable `agent_*`, `agreement_id`, `parent_booking_id` columns.

### 2.5 The four forms
1. **Offering/service**: `service` form + Booking section. One-to-one → `open_hours` or `request_time`; group class → `set_dates` (+ optional `sessions` when the class is a series); commission → `request_time`, `price_unit=per_booking`. Replaces the `bookingType` select.
2. **Meeting with places/RSVP**: `meeting` form + Booking section limited to Seats and "runs with". Writes offer mode `rsvp` and mirrors `attendee_limit`/`min_attendees`. A meeting without a limit gets no offer, as now. Series: `sessions` offer on the series, slots from `series_sessions`; each week keeps its own thread RSVP.
3. **elktours tours and experiences**: `tour` offer in `set_dates`, `price_per_person`, `capacity_per_slot`, `guide_user_id` per slot. Booking row per party. An **agency** tour includes artists' offerings as stops: a component link (`booking_components`: `offer_id` → `component_offer_id`, `role` stop|extra, `required`, `per` person|party) says the tour includes an artist's offering; the artist's own offering remains bookable on its own. `tour_stops.experience_id` (and experience → service thread) already carries the link for display; `booking_components` carries it for capacity and money.
4. **Event programme + extras**: one `set_dates` offer for the main programme (a ticket), and other offerings inside the event space as `booking_components` of role `extra`. A booker takes the ticket, and optionally extras; each is a child `bookings` row with `parent_booking_id`, one order with several lines. This needs `createThreadOrder` extended to several thread lines (§1.4, unknown) and is therefore a later phase; the schema reserves it now.

### 2.6 Parked: agreements and the platform as arbiter
`bookings.agreement_id` and `booking_components.agreement_id` are nullable with no FK. A later `agreements` package (percentage or goal amount, curator/guide ↔ artist, arbiter = platform) hangs its terms there; settlement (`resolveSettlement`, payee model 096-098) reads the agreement to split a paid order. `service_commissions` (stub payment) is its predecessor and is left untouched until then.

## 3. Migration plan
Numbers: use "next free number" at the time (`/new-migration`; list `packages/db/migrations/` first; 263 is still pending and others are concurrent). Never edit an applied file, including 174.

1. **Migration A, schema**: `booking_offers`, `booking_rules`, `booking_slots`, `bookings`, `booking_components` (empty at first), indexes on `(slot_id, status)`, `(org_id, created_at)`, `(booker_user_id)`, unique `(offer_id, starts_at)` on slots, unique `order_id`, unique `buyer_token`; RLS `tenant_isolation` on all with `org_id`. Additive; nothing reads it until step 3.
2. **Code phase 1** (no migration): `@elkdonis/booking`, `booking-offers.ts` in services, `startBookingCheckout`, `markBookingPaid` hook beside the existing two in `confirmOrderPaid`.
3. **Migration B, backfill** (idempotent `INSERT … ON CONFLICT DO NOTHING`, run in a transaction, dry-run as a `SELECT` count first): `tour_departures` → `booking_slots` with the same `id` and a `booking_offers` row per tour thread (3 departures, verified count); `tour_bookings` → `bookings` (0 rows now; the statement stays for safety); `service_bookings` → `bookings` (0 rows). `thread_rsvps` is **not** backfilled (it stays canonical for attendance). The elktours code switch happens only after the backfill row counts match.
4. **Switch readers**: elktours (`tours.ts` becomes a thin wrapper over `@elkdonis/booking`; `service_commissions.departure_id` FK still points at `tour_departures`, so repoint it to `booking_slots` in the same step), calendar, reminders, `/hub/bookings`.
5. **Migration C, retire** (only after one release with the old tables unread and still empty or fully backfilled): drop `tour_bookings`, `tour_departures`, `service_bookings`. 174 itself is not touched: it is applied; "unapplied" is a documentation error, not a pending file. If a future environment has 174 unapplied, the runner order still applies it harmlessly (empty table, later dropped).
6. **Docs**: correct `docs/reference/commerce.md` (174 applied 2026-09-28) and the sunjay comment when those files are edited.

## 4. Phasing
**Phase 1 (build first): one-to-one booking of a person's offering from open hours, on artdirect, with a free path and a paid path.** Reasons: (a) both existing one-to-one tables are empty (0 rows, verified), so the new model needs no data migration and the first build changes nothing live; (b) it exercises what elktours cannot: open-hours computation, holds, the confirm/propose negotiation, cancellation policy, org calendar and reminders; (c) elktours is in production mode with a paying partner and three departures; changing it first adds risk without new capability; (d) the Booking section's Quick-Form rows (Kind, Length, hours) are the minimum of the forms split.
Scope: migration A; open hours + request-a-time modes; instant book and seller-confirms; free bookings (no Stripe) and paid bookings on the existing path; seller console; buyer page; `.ics`; cancellation fields shown, refunds manual.
**Phase 2: elktours departures** on the same tables (backfill, party size, per-person price, guide per slot, manifest, calendar). Parity with `tours.ts` is the acceptance test.
**Phase 3: meetings and series** (seats, "runs with", waitlist with promotion, guests, `thread_rsvps` mirror), then **agents** (holds, pay link) if confirmed.
**Phase 4: composites** (`booking_components`: tour stops with artists' offerings, event extras; multi-line orders); **agreements** stay parked until Phase 4 shows what terms they need.

## 5. Rules and constraints
- Take seats under a row lock on the slot, then insert: two buyers must not both read "2 left" (the pattern in `createTourBooking`).
- Count only confirmed and unexpired holds as taken: a stored counter drifts when holds lapse.
- Write jsonb through `db.json(x)`, not `${JSON.stringify(x)}::jsonb` (`CLAUDE.md`).
- Take the acting user from `getServerSession()`; a booker's email alone identifies a guest only through `buyer_token`.
- Org checks live in `@elkdonis/services`; the package functions take `orgId` and refuse rows of another org.
- Verification without live Stripe: free-path flow end to end; paid path up to order creation and `markBookingPaid` via a rolled-back transaction; no Stripe objects.

## 6. Decisions for the developer
1. **First flow.** (a) One-to-one from open hours on artdirect, then elktours (recommended; both existing one-to-one tables empty). (b) elktours departures first. (c) Both together.
2. **Booking storage.** (a) New canonical `bookings` + `booking_slots`, old tables backfilled then dropped (recommended). (b) Generalise `tour_bookings` and keep `service_bookings` beside it. (c) Keep the three tables behind one service interface.
3. **RSVP relation.** (a) `thread_rsvps` stays the attendance read model; a booking exists only when there is capacity, price, slot or approval (recommended). (b) Move all RSVPs into `bookings`. (c) Keep RSVP wholly separate and let only paid offers use bookings.
4. **Refunds.** (a) Policy recorded and shown, refund `due` flagged, seller issues it by hand from the order (recommended for phase 1). (b) Automatic Stripe refund per policy. (c) Platform decides disputes (arbiter) from the start.
5. **One-to-one default.** (a) Instant booking from open hours, request-a-time kept as a separate mode (recommended). (b) Always propose and confirm (current 174 behaviour). (c) Per-offering choice with no default.
6. **Open-hours slot storage.** (a) Computed from rules, a slot row created on first booking (recommended). (b) Pre-generated rolling window (60 days). (c) Computed only, with locking on the offer row.
7. **Agents (resellers).** (a) Defer; reserve columns only (recommended; the term is the canvas's assumption). (b) Build holds and pay links in phase 3. (c) Build with commission now.
8. **Package home.** (a) New `@elkdonis/booking` data package plus org-checked saves in `@elkdonis/services` (recommended; avoids a commerce cycle). (b) Extend `@elkdonis/commerce`. (c) Put it all in `@elkdonis/services`.
9. **Waitlist promotion.** (a) Automatic: oldest fitting waitlisted booking is promoted, with a pay link and a hold if paid (recommended). (b) Seller promotes by hand. (c) No waitlist in phase 1-2.

**Decided (developer, 2026-11-14, "probably all reccommended"):** option (a) on all nine: 1 one-to-one from open hours on artdirect first, elktours in phase 2; 2 new `bookings` + `booking_slots`, old tables backfilled later then dropped; 3 `thread_rsvps` stays the attendance read model; 4 refund policy recorded and shown, refund due flagged, seller refunds by hand; 5 instant booking from open hours, request-a-time a separate mode; 6 open-hours slots computed from rules, slot row created on first booking; 7 agents deferred, columns reserved; 8 `@elkdonis/booking` data package with org-checked saves in `@elkdonis/services`; 9 automatic waitlist promotion.

**Units (developer, 2026-11-15):** durations are minutes in every new column and input; `workshop_pages.session_duration_hrs` is left as is and converted in the adapter. Price stays on the thread (`threads.price`, numeric major units); the booking tables store no price, and conversion to minor units stays at the order boundary (`createThreadOrder`).

## 7. Open questions
- **Stripe test mode**: is a test-mode key available for verifying the paid path? None was checked (`.env` was not read). Without it, the paid path is verified only to order creation (**unknown**).
- Whether `commerce_order_line` and `createThreadOrder` can carry several thread lines in one order (needed for extras): schema suggests yes for lines, the function takes one `threadId` (**unknown**; confirm before phase 4).
- `min_attendees` ("runs with N or more"): no enforcement found; who is told when a departure does not reach it, and by when (**unknown**).
- Time zone of open hours: the offer's zone versus the person's; elktours displays Paris time (`formatParis`), the service flow stores the buyer's zone (`buyer_time_zone` default America/Toronto). One rule is needed (**assumed**: offer zone, shown in both).
- Busy times for open hours: whether a person's Nextcloud or org calendar blocks slots (not designed; the org-calendar mirror is write-only today, **assumed**).
- Hand-picked series dates: the series code refuses them today (`STUDIO_FORMS_SPLIT_2026-11-14.md` §2.4); `sessions` mode depends on that being fixed, or on slots owning the dates.
- Guest bookers on paid group events: guests cannot hold a `thread_rsvps` row; the booking row solves attendance, but join-link access (`join-link.ts`) reads RSVPs and would need to read bookings (**unknown** how many join paths).
- Canvas boards not read: Advanced, Client, ClientTour, Artist (phone day); the doc's section 1.5 covers only the four boards read.
- Whether tours' agent holds must be per-agent-org; not specified by the developer.

## 8. History
- 2026-11-15 (later): booking reminders (migration 267, artdirect tick), the Offering form hosts (arts-collective, hidden-enneagram) show `bookingWarning`, artdirect given `SENDGRID_API_KEY` (it had none, so its mail had failed silently) and recreated; live build `_buxs_AeSDh-Iu3YuBtxv`. Org calendar still does not read bookings.
- 2026-11-15: phase 1 built and deployed on artdirect (build `lC1Hood2CKiB0y83TrlnI`). Migrations 265 (schema A as §3, with `host_user_id`, `slot_step_minutes`, `buffer_minutes`, `questions`, `refund_due_minor`, `duration_minutes`, `last_message*`, `confirmed_at`; durations in minutes) and 266 (`bookings.site_url`) applied alone (263 left pending). Deviations from §2: no `requested` status is written (free requests go straight to `awaiting_seller`); waitlist and `sessions`/`set_dates`/`rsvp` modes are refused in phase 1 (`PHASE1_MODES`); calendar and reminders are not wired. State and verification: `docs/reference/commerce.md` "Booking module". Open: a real card payment end to end; the owner's signed-in render on a live service; surfacing `bookingWarning` in hosts' Offering forms (arts-collective, hidden-enneagram ignore it); `bookings.offer_id` is `ON DELETE RESTRICT`, so deleting a thread with bookings fails unless the bookings go first (threads are archived, not deleted, so this only affects test cleanup).
- 2026-11-14: created from a read-only survey (source, `\d` and counts on `elkdonis_dev`, the Schedule canvas). Documentation corrections noted in §1.2 and §3 step 6 were not applied.
