# Backend map: booking side of the elktours mobile redesign (2026-11-15)

Read-only survey. No code, migration, build, commit or Stripe call. DB checks were SELECT/`\d` on `elkdonis_dev` through `eac-postgres`. Claims are marked **verified** (file:line or query) or **assumed**. Scope: guest Dates (04), Pay (05); board Schedule (31), New slots (32), Slot (33), Decisions (34), booking counts on Board (30). The phase-1 session's 13 gotchas (`booking-phase2-gotchas.md`) are folded in and cited as G1-G13.

## 0. Headline findings

1. **Live data is almost nothing.** `tour_departures` 3 rows, all on one archived sample tour ("Montmartre at Golden Hour (sample)"), all in the past (26 Oct, 28 Oct, 2 Nov; 0 future). `tour_bookings` 0. Orders on tour threads, ever: 0. `service_commissions` 0 (so none with `departure_id`). `booking_offers`, `bookings`, `booking_slots` 0. 8 tours are published and none has a departure. **Verified** (queries 2026-11-15). The risk is the live code path and a partner who is now able to be paid, not data volume.
2. **Dana is ready to be paid.** Dana McCool: role `owner` in elktours, `payout_method=stripe`, Stripe account present, `stripe_onboarded_at` 2026-11-03, country FR. **Verified** (query). elktours has `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY`, no webhook secret and no webhook route (only `/api/checkout/return`). **Verified** (container env names; `ls app/api`; `handleStripeWebhook` appears only in art-auction). Keys are live, no test key (G13).
3. **The design needs four things no table has**: a minimum ("runs with N"), a booking cutoff, a waitlist, a per-slot price. `tour_departures` has none (`\d`, verified). `booking_offers` has `min_to_run`, `close_before_minutes`, `waitlist`, `capacity_per_slot` but at offer level; the module stores no price (`265_booking_module.sql`, verified). The guide-decides vs auto-cancel setting exists nowhere.
4. **Phase 1 cannot book a departure yet** (G1-G5): `PHASE1_MODES`, no `set_dates` branch in `createBooking`, `saveOffer` hardcodes party 1/1, checkout passes quantity 1, `markBookingPaid` confirms only open_hours + instant.

## 1. What exists today vs phase 1

| Concern | Today in elktours | Phase 1 `@elkdonis/booking` |
|---|---|---|
| Dated run | `tour_departures` (thread, org, starts_at, capacity, guide_user_id, status scheduled/cancelled, note); no min, cutoff, price, duration (duration is on the thread). verified `\d` | `booking_slots` (offer_id, starts_at, ends_at, capacity, guide_user_id, status, note, source incl. `departure`). verified 265 |
| Seats | computed: confirmed + unpaid younger than 75 min (`packages/commerce/src/server/tours.ts` ~290-300); `createTourBooking` locks departure `FOR UPDATE` (tours.ts:540-590) | same rule; host advisory lock then slot `FOR UPDATE` (`packages/booking/src/server/bookings.ts:327-433`), but only open_hours / request_time |
| Party size | `tour_bookings.party_size`, max 20 (`MAX_PARTY_SIZE`), per-tour `maxParty` in `metadata.tour`; price per person = order line quantity (`startTourCheckout`, `packages/checkout/src/server/thread-checkout.ts:175-198`) | columns `min_party`, `max_party`, `price_unit` exist; `saveOffer` hardcodes 1/1 (G2); checkout quantity 1 (G3) |
| Statuses | booking awaiting_payment/confirmed/cancelled; departure scheduled/cancelled | adds held/expired/waitlisted/awaiting_seller/completed/no_show |
| Cutoff, minimum | none in code (booking doc §1.3: `min_attendees` unenforced) | columns only, no enforcement |
| Waitlist | none | `offer.waitlist` + `waitlisted` status; refused in phase 1 (doc §8) |
| Cancel/refund | `cancelDeparture` marks confirmed bookings cancelled, emails "reply about a refund" (tours.ts:420-455); `cancelTourBooking` same | `hostCancelBooking` sets `refund_status='due'` and `refund_due_minor`; no Stripe call. `refundStripeOrder` exists (`packages/checkout/src/server/stripe.ts:595`, full refund, destination clawback) used by katie and art-auction, not tours |
| Manifest | `listDepartureBookings` (tours.ts:657) in `departures-panel.tsx` | none per slot (`listHostBookings` is per host) |
| Guide overlap | none (no clash logic in `schedule-plan.ts` or planner components; grep) | open-hours host overlap only; wrong for departures (G5) |
| Mail | booker + guide on paid, cancel mail (tours.ts:597-625) | `notify.ts`; reminders global, every 5 min from artdirect (G8) |
| Buyer page | `/bookings/<token>` and `calendar.ics` read `tour_bookings` (G9) | `bookings.buyer_token` |
| Payment methods | Stripe-hosted Checkout, no `payment_method_types` set, so Apple Pay / Google Pay appear by themselves where supported (`packages/payments/src/providers/stripe.ts:225-236`); destination charge to the single maker when onboarded (`checkout/src/server/stripe.ts:58-90`) | same order path |

## 2. Screens

### 04 Dates (guest)
Needs: slots per day with "N of M places left" / "Full, waitlist open (N waiting)" / "Booking closed", closing time, guide, party stepper (max 6 or places left), total, rule text, CTA Continue or Join the waitlist.
- Exists: departures with `seatsLeft` and guide name (`listTourDepartures`, verified); party number input capped at `min(maxParty, seatsLeft)` (`booking-form.tsx`, verified). The design's cap of 6 is a UI constant; code allows 20.
- Missing: per-slot close time and "closed" state, minimum-reached text, waitlist count and cap, rule text.
- Contract: `listTourSlots(tourId, {from?, to?}): TourSlotView[]` with `{slotId, startsAt, endsAt, guide{id,name}|null, capacity, seatsLeft, minToRun, closesAt, state:'open'|'full_waitlist'|'full'|'closed'|'cancelled', minimumReached, shortBy, waitlistCount, waitlistCap, priceMinor, currency}`; `getBookingRule(): {kind:'guide_decides'|'auto_cancel'}` plus `bookingRuleText(rule, min, guideShort)` so Dates and Pay show identical text.
- Home: pure `slotState` and `bookingRuleText` in `@elkdonis/booking/core`; reads in booking server; elktours adapter `lib/tour-slots.ts` maps to the view.

### 05 Pay (guest)
Needs: summary, method chips Card / Apple Pay, price line and total, cancellation policy, rule text, CTA "Book and pay EUR N" or "Join the waitlist", success screen (reference, or queue position).
- Payment methods: **Stripe-hosted redirect.** The prototype has an inline "Card number" input; the existing path redirects to Stripe's page, where Apple Pay appears automatically. Recommend chips as a summary only and keep the redirect. An in-page card form means Stripe Elements, a webhook and review (assumed, L).
- Today's call: `bookTourAction({tourSlug, departureId, partySize, name, email, note})` (`apps/elktours/src/lib/tour-actions.ts`) pre-checks `bookingAvailability(tour.authorId)` (passes for Dana: Stripe account onboarded, verified), then `startTourCheckout` and `redirect(url)`; returns `{ok:false,error}` on refusal. Keep this signature for mobile Pay.
- Waitlist: new `joinWaitlistAction({tourSlug, slotId, partySize, name, email}): {ok, position}`; no charge, no order, status `waitlisted`.
- Success screen: `getBookingByToken` (booking) / `getTourBookingByToken` (legacy) after the return hop; reference = `orderNumber` (design's "ELK-4800" is seed); queue position is computed, not stored (doc §2.2).
- Cancellation policy text: `offer.cancelPolicyText` + `describePolicy()` (`core/policy.ts`, verified). Design rule "free until booking closes" = `cancel_free_until_minutes = close_before_minutes` (assumed).
- Per-slot price override (Slot and New slots): module stores no price by decision. Either drop from v1, or add `booking_slots.price_minor` and an order amount override. Whether `createThreadOrder.amountMinor` accepts an arbitrary override or only a sliding-scale value is **not verified**.

### 31 Schedule (board)
Needs: week strip with dots, slots by day, card (time range, tour, state line, seat bar with minimum tick, booked/max, waitlist/shortfall note, guide initial and filter for office).
- Exists: `listOrgDepartures(orgId, {from,to,includeCancelled})` with seatsTaken, capacity, guide; `/manage/schedule/page.tsx` already builds the month strip and week filter (verified).
- Missing: min, close time, state, waitlist count.
- Contract: `listBoardSlots({from, to, guideUserId?, includeCancelled?}): BoardSlot[]` = TourSlotView + `{tourTitle, tourSlug, bookedGuests}`.
- Access: `/manage` is `requireOrgEditor`; Dana and Guru are `owner`; role `guide` exists (`listGuides`) but is not given the board today (assumed from `requireOrgEditor` use). Question below.

### 32 New slots (board)
Needs: tour, multi-date, up to 4 start times, duration, min/max, cutoff, waitlist + size, price override, guide, preview with ready/blocked reason, create only ready ones.
- Exists: `previewScheduleAction` / `createScheduleAction` (`lib/schedule-actions.ts`): weekday repeat, skips existing and past, batch cap 120, span 366 days, re-plans on create; `addDeparturesAction` for hand-picked days; Paris wall-clock handling is correct (`parisInputToDate`). Verified.
- Missing: min, cutoff, waitlist, price per slot; **per-guide overlap check**; "booking would already be closed" check; duration per slot (ends_at today = thread duration).
- Contract: `previewSlots(input): {items:[{startsAt, endsAt, ok, reason:'clash'|'closed'|'exists'|'past'|null, clashWith?:{tourTitle, startsAt}}]}` and `createSlots(input): {created, skipped}`; input `{tourId, dates[], times[], durationMinutes, minToRun, maxPlaces, closeBeforeMinutes, waitlist, waitlistCap, priceMinor?, guideUserId}`.
- Overlap rule: same `guide_user_id`, scheduled, intervals intersect, across all of the org's tours; one `tstzrange` query, rerun under lock inside create.
- Home: `planSlots`/`findClash`/closed check as pure core functions plus a loader in booking server. Keep elktours `schedule-plan.ts` for Paris date arithmetic and feed it; do not rewrite.

### 33 Slot (board)
Needs: state panel; below-minimum Run / Reopen / Cancel+refund; Close now; steppers (cutoff, min, places, price); waitlist switch; guest list; waitlist with Offer to first.
- Exists: `updateDeparture` (start, capacity, guide, note), `cancelDeparture` (emails, no refund), manifest rows, `cancelTourBooking` (verified).
- Missing: everything stateful (run, reopen, close now, min/cutoff/price edits, waitlist, offer, refund).
- Contract (`apps/elktours/src/lib/slot-actions.ts`, `requireOrgEditor`, thin over booking functions): `getSlot(slotId): {slot, manifest: ManifestRow[], waitlist: WaitRow[], rule}`; `runSlot`, `reopenSlot(slotId,{hours})`, `closeSlotNow`, `cancelSlot(slotId, reason?)`, `updateSlot(slotId,{minToRun?, capacity?, closeBeforeMinutes?, priceMinor?, waitlist?, waitlistCap?})`, `offerWaitlistPlace(slotId)`. `ManifestRow = {bookingId, name, email, party, note, status, orderNumber}`.
- Refunds: phase-1 decision 4 is record-due, refund by hand. The design says "refunded and emailed" in one tap. `refundStripeOrder` exists (full refund) but would call live Stripe, untested for tour destination charges, no test key. First cut: cancel records `refund_due`; an explicit owner button per order calls `refundStripeOrder`. Question below.

### 34 Decisions (board)
Two lists: slots below minimum (needs a call) and full slots with a waitlist; banner on Board.
- Exists: nothing. Contract: `listDecisions({guideUserId?}): {below: BoardSlot[], waits: BoardSlot[], rule}`; below = now >= close, booked < min, no `run` decision, rule = guide_decides; waits = waitlist count > 0 and slot not cancelled/past.
- Auto-cancel needs a job. Artdirect's `instrumentation.ts` runs `expireLapsedHolds` and reminders every 5 min (commerce.md, verified); no scheduler found in elktours (assumed). Put `sweepSlots()` (auto-cancel below minimum when rule is auto, expire holds, promote waitlist) in the booking package, called from one existing tick. Reminders are global (G8): set `reminder_minutes_before` on tour offers and pass the elktours public origin as `siteUrl`.

### 30 Board counts
`boardCounts({guideUserId?}) => {belowMinimum, withWaitlist, nextSlot}`; cheap once `slotState` exists.

## 3. Rules from data-and-state.md

| Rule | Today | Phase 1 | Gap and home |
|---|---|---|---|
| close = start - cutoff; open before close | none | `close_before_minutes` per offer | per-slot override column; pure `slotState` |
| Minimum reached / N short | none | `min_to_run` per offer | per-slot override; same function |
| After close, booked >= min: Confirmed | none | none | state function |
| After close, below min: guide decides vs auto-cancel | none | none | one org-level setting, default guide_decides; storage location not found (assumed: org settings jsonb), confirm |
| Needs your call: run / reopen / cancel+refund | none | none | slot `run_decision` + close override; actions in 33 |
| Guest rule text from setting | none | none | `bookingRuleText` copied from prototype `ruleText()` |
| Waitlist, cap, offer to first | none | boolean + status, refused; decision 9 says automatic | cap column, offer step, promotion; reconcile manual vs automatic |
| New-slot overlap per guide | none | open-hours host lock (wrong here, G5) | pure `findClash` |
| New-slot closes in the past | none | none | pure check |
| Party size | 1-20, number input | columns, hardcoded 1/1 on save | fix `saveOffer`, add input |
| Manifest | per departure | none per slot | `listSlotBookings(orgId, slotId)` |
| Seats = confirmed + unexpired holds | yes, 75 min | yes | add requested/awaiting_* per G5 |

## 4. Gap table

| # | Gap | Needed by | Proposed home | Size | Migration |
|---|---|---|---|---|---|
| 1 | Lift `PHASE1_MODES` for `set_dates` in `validateOfferInput`; `createBooking` set_dates branch (slot by id, lock slot row only, count vs `slot.capacity`, no host-overlap); `listSlots(offerId)` (G1, G5) | 04, 05 | booking package | M | No |
| 2 | `saveOffer` / `BookingOfferInput`: add minParty, maxParty, priceUnit, minToRun, closeBeforeMinutes, waitlist; stop hardcoding 1/1 and `capacity ?? 1` (G2) | 32, 33 | booking package | S | No |
| 3 | `markBookingPaid` confirms set_dates too, `scheduled_at` = slot start (CHECK needs it) (G4) | 05 | booking package | S | No |
| 4 | `startBookingCheckout` quantity = partySize for per_person (G3); pass a name for Stripe-first flows (G10) | 05 | checkout package | S | No |
| 5 | Per-slot columns: `min_to_run`, `close_before_minutes`, `waitlist_cap`, `run_decision`, optional `price_minor`; offer values are defaults copied at creation | 31-34 | `booking_slots` | S | **Yes** (additive) |
| 6 | Org setting below_minimum_rule | 04, 05, 34 | elktours org settings (location to confirm) | S | Maybe |
| 7 | Pure `slotState`, `bookingRuleText`, `findClash`, `closesAt`, with checks in `scripts/check-core.mts` | all | `@elkdonis/booking/core` | M | No |
| 8 | Waitlist: join, position, offer to first (hold + pay link), promote on cancel/expiry, cap | 04, 05, 33, 34 | booking package + checkout for pay link | L | No (cap is #5) |
| 9 | Run / reopen / close-now / cancel slot with `refund_due` and mail | 33, 34 | booking package; org-checked wrappers in services `booking-offers.ts` | M | No |
| 10 | Refund execution via `refundStripeOrder` behind explicit owner action | 33 | app action calling checkout | S code, risk M | No |
| 11 | Sweeper (auto-cancel, holds, promotion); set tour reminders; reconcile unpaid orders (no webhook on elktours) (G8) | 34 | booking package fn on an existing tick | M | No |
| 12 | Manifest per slot, waitlist rows, board counts, decisions | 30, 33, 34 | booking package reads | S | No |
| 13 | Backfill `tour_departures` -> `booking_slots` (same id, `source='departure'`), one `booking_offers` per tour thread (set_dates, per_person), `tour_bookings` -> `bookings`; repoint **both** `service_commissions.departure_id` and `tour_stop_notes.departure_id` (G6; `\d` verified) | cutover | migration | M | **Yes** |
| 14 | Buyer page and `.ics` read both token sources during the switch (G9) | 05 | elktours app | S | No |
| 15 | UI: slot list + party + waitlist panel; `BookingPanel` and studio-forms BookingSection do not cover departures (G11) | 04, 05, 32 | elktours app first, promote later | M | No |
| 16 | Role access for guides on the board | 30-34 | app + services check | S-M | No |
| 17 | In-page card form / wallet chips | 05 | decision; keep redirect | L or 0 | No |
| 18 | Org calendar does not read bookings | none here | skip | - | - |

Migration rule: **263 is pending; never run `db:migrate`.** #5 and #13 are two separate files, each applied alone (file plus tracker row in one transaction), numbered next free (268+) after listing `packages/db/migrations/`; never edit an applied file. Builds are coordinated with the Check session (6e55f6) because every app compiles `@elkdonis/services`, which imports `@elkdonis/booking` (G).

## 5. Phase-2 recommendation

**Adapter first, then cut over departures to booking_slots once the mobile UI runs on the final contract.**

- Data risk is small: 3 past departures on an archived sample, 0 bookings, 0 orders, 0 commissions (verified). The backfill is trivial and reversible. The real risk is the live `bookTourAction` path (Dana can now be paid) and the amount of new rule code.
- The mobile screens need min, cutoff, waitlist, run decision. `tour_departures` has no such columns, and decision 2 says it will be dropped, so do not extend it. The permanent home is `booking_slots`.
- **Step A (no switch):** build gaps 1-4, 7, 9, 12 in `@elkdonis/booking` (no migration). Ship the elktours adapter `lib/tour-slots.ts` / `slot-actions.ts` with the section-6 contract. Initially it reads `tour_departures` + `tour_bookings` via `tours.ts` and fills min/cutoff from tour-level defaults, so the UI team builds and tests against the final shape. `bookTourAction` stays unchanged; the live site is untouched.
- **Step B (cutover, one release):** migration #5 alone, then #13 alone (dry-run count first; 3/0/0 must match), switch the adapter to booking tables, read both tokens (#14), leave old tables unread for one release, drop later (booking doc §3 step 5).
- **Parity test before cutover:** free path and paid path to order creation on a throwaway tour with `EMAIL_SANDBOX=1`, scripts that delete their rows in `finally` (G12, not `saveOffering`); two parallel bookings of the last seat (one wins); party 1..max; total = price x party; hold expiry frees seats; cancel marks refund due; manifest matches. No Stripe objects (G13): stop at order creation and `markBookingPaid`.
- **Defer within phase 2:** waitlist (#8) and automatic refunds (#10). Ship Dates, Pay, Schedule, New slots, Slot, Decisions first with "Full" shown and Offer hidden.
- Build order: 7 -> 2, 1, 3, 4 -> adapter -> UI 04/05/31 -> migrations 5 and 13 -> 32 -> 33/34 + sweeper -> waitlist -> refunds.

## 6. Contract for the UI team

Server actions in `apps/elktours/src/lib/`; return `{ok:true,...} | {ok:false,error}` like `ActionResult` (verified in `tour-actions.ts`). Reads are server functions for server components.

Guest: `listTourSlots(tourId,{from?,to?})`; `getBookingRule()` and `bookingRuleText`; `quoteBooking({slotId, partySize}): {totalMinor, currency, perPersonMinor, policyText, ruleText, closesAt}`; `bookTourAction({tourSlug, departureId, partySize, name, email, note})` (exists; `departureId` = slot id after backfill because ids are kept); `joinWaitlistAction({tourSlug, slotId, partySize, name, email})` (new, later); booking by token (both tables during the switch).

Board (`requireOrgEditor`; guide scoping open): `listBoardSlots({from,to,guideUserId?})`; `boardCounts({guideUserId?})`; `listDecisions({guideUserId?})`; `previewSlots(input)` / `createSlots(input)`; `getSlot`, `runSlot`, `reopenSlot`, `closeSlotNow`, `cancelSlot`, `updateSlot`, `offerWaitlistPlace`.

Logic lives in `@elkdonis/booking` and is org-scoped (functions take `orgId`, refuse other orgs, as phase 1 does).

## 7. Risks

- `bookings.offer_id` ON DELETE RESTRICT vs `thread_id` CASCADE (G7): deleting a test tour with bookings fails; delete bookings first.
- Both FKs onto `tour_departures` must be repointed or the later drop fails (G6).
- A payment after hold expiry still confirms (comment in `markBookingPaid`, verified); can oversell a seat; log and tell host.
- Reminders are global (G8): unset tour offers default to 1440 minutes and double up with elktours' own mail.
- No webhook on elktours: a guest who closes the tab before the return hop relies on `syncStripeOrder` elsewhere (assumed); add a reconcile step to the sweeper before the first real departure.

## 8. Open questions for Justin

1. Pay screen: keep Stripe's hosted page (Apple Pay appears there) instead of the in-page card form? Recommended yes.
2. Below-minimum setting: one site-wide switch, default "guide decides"? Where does the owner flip it?
3. Cancel and refund: owner taps to refund each order, or automatic? First cut: owner tap.
4. Waitlist: guide offers by hand (design) or automatic promotion (decision 9)?
5. Per-slot price override: keep in v1 or drop?
6. Do guides (role `guide`) get Schedule, Slot and Decisions for their own slots, or owners only?
7. Where do per-tour defaults (min, max, cutoff, waitlist cap) live: the tour form?
8. Add a Stripe webhook to elktours before the first real departure?
9. OK to wait on the cutover until the UI runs on the adapter, given zero live bookings?
