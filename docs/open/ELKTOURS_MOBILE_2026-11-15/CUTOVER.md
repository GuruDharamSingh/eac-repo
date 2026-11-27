# Cutover: elktours departures onto the booking tables (Step B)

Drafts only. Nothing here is applied. Companion files in this folder: `migrations-draft/booking_slots_per_slot_columns.sql` (gap 5) and `migrations-draft/tour_departures_backfill.sql` (gap 13). Background: `../backend-map-booking.md`, `../booking-phase2-gotchas.md`.

The first versions of both drafts were run once on `elkdonis_dev` inside a transaction that was rolled back (12 offers, 3 slots, 0 bookings, both FKs repointed, nothing persisted). That was outside the rules (DDL on the live database) and is not to be repeated; the backfill has since changed (slot `waitlist_cap`) and has not been run. Re-test on a scratch database with all migrations applied before asking for the live apply.

## Preconditions

- Mobile UI is live on the adapter (`lib/tour-slots.ts`, `lib/slot-actions.ts`) and has been used for a while on `tour_departures`.
- Phase-2 code is in place and built: `set_dates` in `@elkdonis/booking` (done), plus the pieces still to write for the switch (listed under "Code to write").
- Migration 263 is still pending: never run a plain `db:migrate`. Each migration below is applied alone (file plus its `app_schema_migrations` row in one transaction), numbered next free (268, 269 at the time of writing).
- Build coordination with the Check session (6e55f6): `@elkdonis/services` imports `@elkdonis/booking` and every app compiles it.

## Steps

1. **Freeze check.** Dry-run block at the top of `tour_departures_backfill.sql`: expect departures 3 (all past, on the archived sample tour), bookings 0, commissions 0, no duplicate starts, no unpaid hold younger than 75 minutes. Re-count at the time; the numbers change if anyone schedules or books first.
2. **Migration A** `booking_slots_per_slot_columns.sql`. Additive nullable columns; nothing reads them yet.
3. **Migration B** `tour_departures_backfill.sql` with `-v site_url=https://elkdonisexperiences.com`. One offer per tour thread, slots and bookings with the same ids, same `buyer_token`s, both FKs repointed. Old tables untouched.
4. **Verify** with the "AFTER" block (slots = departures, bookings = tour_bookings, offers = tour threads).
5. **Ship code that reads the new tables** (one release, behind one flag, see "How the adapter switches"). Build elktours; app container recreate is Justin's yes.
6. **Parity tests** (below) against the live DB with mail sandboxed; no Stripe objects.
7. **Flip the flag.** Watch `/manage/schedule`, a guest Dates page, and a test booking on a throwaway tour (order created, not paid).
8. **One release with the old tables unread.** Keep them as the rollback source.
9. **Rollback** if needed: flip the flag back; if anything was booked on the new tables, copy those rows into `tour_bookings` first; the SQL is in the ROLLBACK block of migration B.
10. **Retire** (later, separate migration, Justin's yes): drop `tour_bookings`, `tour_departures` once nothing reads them.

## How the adapter switches

One switch, `BOOKING_TABLES=1` (or a `site_config` flag; Justin's call), read in `lib/tour-slots.ts` and `lib/slot-actions.ts`. The exported signatures do not change.

| Function | Today reads | After the switch |
|---|---|---|
| `listTourSlots` | `listTourDepartures` (commerce) | `listSlots(orgId, offerId)` of `@elkdonis/booking` (returns `DatedSlot` with seats, state, waitlist count) |
| `quoteBooking` | `getDeparture` | slot by id from booking; price still `threads.price`, or `slot.price_minor` once the order can take it |
| `listBoardSlots`, `getBoardSlot`, `boardCounts`, `listDecisions` | `listOrgDepartures` | one org-wide slots query (to write), with slot columns `COALESCE(slot.x, offer.x)` for min, cutoff, waitlist cap |
| `getSlot` manifest | `listDepartureBookings` | bookings of the slot (to write: `listSlotBookings(orgId, slotId)`) |
| `createSlots` | `createDeparture` | insert `booking_slots` (source `manual`) after `checkNewSlot` (to write: `createSlot`) |
| `updateSlot`, `cancelSlot` | `updateDeparture`, `cancelDeparture` | booking functions: update slot; cancel slot cancels bookings and sets `refund_status = 'due'` (to write) |
| `runSlot`, `reopenSlot`, `closeSlotNow`, `offerWaitlistPlace` | refuse (not available) | write `run_decision`, `close_before_minutes`, `waitlist` promotion (to write) |
| `bookTourAction` | `startTourCheckout` (commerce `createTourBooking`) | `startBookingCheckout` with `slotId`, `partySize` (already supports `per_person` quantity) |

`metadata.tourBooking` stays the per-tour default; after the backfill it is also copied into the offer, and from then on a save of `saveTourBookingDefaults` must update the offer too (to write).

## How the token page reads both sources

`/bookings/<token>` and `calendar.ics` in elktours read `tour_bookings` today (gotcha G9). The backfill keeps every `buyer_token`, so after migration B an old link resolves in both tables. Order of lookup during the release in between: `getBookingByToken(token)` from `@elkdonis/booking` first, then `getTourBookingByToken(token)` as fallback (covers a booking made after migration B but before the switch, written to `tour_bookings`). Both are one extra query. After the old tables are retired the fallback goes. The return hop after payment (`getTourBookingTokenForOrder`) gets the same two-step lookup by order id (`getBookingForOrder`).

### Exact lines to switch at cutover (`apps/elktours/src/lib/booking-lookup.ts` is written; these callers are not edited)

`getBookingByAnyToken(token)`, `getBookingTokenForAnyOrder(orderId)` and `buyerBookingIcs(view)` return/accept one shape (`BuyerBookingView`) with every field the page and file already use.

| File (owner) | Line | Now | Change to |
|---|---|---|---|
| `src/app/bookings/[token]/page.tsx` (Gee) | 4 | `import { getTourBookingByToken } from "@elkdonis/commerce/server";` | `import { getBookingByAnyToken } from "@/lib/booking-lookup";` |
| same | 24 | `const b = await getTourBookingByToken(token);` | `const b = await getBookingByAnyToken(token);` |
| `src/app/bookings/[token]/calendar.ics/route.ts` (Gee; this route is under `app/bookings`, not `app/api`) | 1 | `import { getTourBookingByToken, tourBookingIcs } from "@elkdonis/commerce/server";` | `import { buyerBookingIcs, getBookingByAnyToken } from "@/lib/booking-lookup";` |
| same | 5 | `const b = await getTourBookingByToken(token);` | `const b = await getBookingByAnyToken(token);` |
| same | 7 | `return new Response(tourBookingIcs(b), {` | `return new Response(buyerBookingIcs(b), {` |
| `src/app/api/checkout/return/route.ts` (Jay) | 1 | `import { getTourBookingTokenForOrder } from "@elkdonis/commerce/server";` | `import { getBookingTokenForAnyOrder } from "@/lib/booking-lookup";` |
| same | 22 | `token = await getTourBookingTokenForOrder(orderId).catch(() => null);` | `token = await getBookingTokenForAnyOrder(orderId).catch(() => null);` |

The lookup reads only columns that exist today, so these edits are safe before the migrations too. Until the return route is switched, a paid booking-table order still lands on its page: `bookTourAction` passes `returnPathFor: (token) => /bookings/<token>` as the return path, and the route falls back to it (with `?payment=pending`, which the page ignores).

### Sweep tick (patch for `apps/elktours/src/instrumentation.ts`; not applied)

```diff
@@ export async function register() {
   if (process.env.NEXT_RUNTIME !== "nodejs") return;
+
+  // Slot sweeper: expire lapsed holds and auto-cancel slots that closed below their minimum
+  // (only under the auto_cancel rule). A no-op unless BOOKING_TABLES=1. Idempotent and safe on
+  // several instances (cancelling locks the slot row and re-checks its status).
+  if (process.env.DISABLE_SLOT_SWEEP !== "1") {
+    const sweep = async () => {
+      try {
+        const { sweepTourSlots } = await import("@/lib/tour-slots");
+        await sweepTourSlots();
+      } catch (err) {
+        console.error("[elktours] slot sweep tick error:", err);
+      }
+    };
+    setTimeout(sweep, 30_000);
+    setInterval(sweep, TICK_MS);
+  }
+
   if (process.env.DISABLE_REMINDER_SCHEDULER === "1") return;
```

It sits before the reminder early-return so turning reminders off does not stop the sweeper.

## Code status before step 5

Written 2026-11-15, typechecked, NOT run against a database (the slot code needs the per-slot columns, and nothing may be written to those tables on the live DB before migration A):
- `packages/booking/src/server/slots.ts`: `listOrgSlots`, `getOrgSlot`, `stateOfSlot`, `listSlotBookings`, `createSlots` (org lock, guide clash, closed-already, exists), `updateSlot`, `cancelSlot` (refunds recorded due, mail after commit, no Stripe), `runSlot`, `reopenSlot`, `closeSlotNow`, `setOfferDefaults`, `sweepSlots`. Pure parts (`resolveSlotSettings`, `reopenCloseBeforeMinutes`, `closeNowCloseBeforeMinutes`) are in core and covered by `check-core.mts` (83 checks).
- elktours adapter: `BOOKING_TABLES=1` switches `tour-slots.ts` and `slot-actions.ts` to those functions (flag off = unchanged). `sweepTourSlots()` exists but nothing schedules it.
- Still to do: the booking-side checkout switch in `bookTourAction` (to `startBookingCheckout` with `slotId`), the token page two-source lookup, a tick that calls `sweepTourSlots()`, and the items below. Needs a scratch database with all migrations applied (not the live one) to exercise the DB paths, including this migration pair.

Remaining:
- Booking package: waitlist join and promotion.
- `confirmOrderPaid` / `cancelOrder` hooks already call `markBookingPaid` / `expireBookingForOrder` and now confirm `set_dates`.
- Sweeper `sweepSlots()`: auto-cancel below minimum when the site rule is `auto_cancel`, expire holds, promote waitlist. Run from an existing tick (artdirect's instrumentation) or elktours' own; reminders stay off for tours (offer `reminder_minutes_before` NULL) because that tick is global.
- A Stripe webhook or reconcile step for elktours (it has only the return hop).

## Parity tests (acceptance: parity with `tours.ts`)

Run with `EMAIL_SANDBOX=1`, throwaway tsx scripts from apps/artdirect that delete their rows in `finally` (do not use `saveOffering`). Stop at order creation; call `markBookingPaid` on a rolled-back path. No Stripe objects (no test key; the keys are live).

1. Free path: slot, booking of party 3, seats left drop by 3, manifest row, `.ics`.
2. Paid path to order: `startBookingCheckout` creates the booking `awaiting_payment` with a hold and an order of quantity = party; `markBookingPaid` confirms it.
3. Seat race: two parallel bookings of the last seat; exactly one succeeds.
4. Party limits: 0 and over-max refused; over seats-left refused with the same sentences as `tours.ts`.
5. Hold expiry frees the seats; a late payment still confirms and is logged.
6. Cutoff: after `closesAt` booking is refused ("Booking for that date has closed.").
7. Cancel slot: bookings cancelled, `refund_due` flagged, mail sandboxed.
8. Guide clash across tours is refused at `createSlots`/`updateSlot`. ~~(createSlots)~~ 2026-11-24: elktours creates with `allowClash`, so a clash at creation is a warning in the preview and the slot is still created; `updateSlot` (moving a slot) still refuses it. The 120-per-run cap is removed (`createSlots` sends 200 per call to the booking package).
9. Old token resolves on the page; the order's return hop finds its token.
10. `listTourSlots` / `listBoardSlots` output equal (field by field) before and after the switch for the same data.

## Needs Justin's yes

- Applying migration A and migration B on the live database (and the numbers they take).
- Rebuilding and recreating the elktours container, and any other app that compiles the changed packages.
- Turning the flag on in production.
- Anything that calls Stripe: automatic refunds on cancel (first cut records "refund due"; the owner refunds per order), a webhook for elktours, a real card payment test.
- Per-slot price override: needs an order amount override (`createThreadOrder.amountMinor` is for sliding scales; not verified). Keep or drop.
- Reminders for tour bookings: off by default; on means the artdirect tick mails elktours guests.
- Retiring `tour_departures` / `tour_bookings` (later migration).
