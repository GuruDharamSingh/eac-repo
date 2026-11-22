# Booking phase 2 gotchas (from the phase-1 session, 2026-11-15)

Ownership: the phase-1 session handed packages/booking to Jay and has nothing in flight. Phase 1 is commit 6fa65f39 and reminders e36fc3fc on work/2026-11-08. Live artdirect build _buxs_AeSDh-Iu3YuBtxv. Migrations 265-267 are applied.

Builds and migrations:
- 263 is pending, so do NOT run a plain db:migrate. Apply ours alone: file plus tracker row in one transaction.
- Coordinate builds with the Check session (6e55f6). Every app compiles @elkdonis/services, and services imports @elkdonis/booking.

Gotchas:
1. Phase-1 gates. validateOfferInput refuses anything but PHASE1_MODES (open_hours, request_time). createBooking has no set_dates branch. listOpenSlots returns [] for other modes.
2. offers.ts saveOffer hardcodes min_party 1 and max_party 1, and sets capacity_per_slot = capacity ?? 1. BookingOfferInput has no party or price_unit fields. Tours need them.
3. startBookingCheckout passes quantity: 1 to createThreadOrder. per_person pricing must pass partySize (as startTourCheckout does).
4. markBookingPaid confirms only mode=open_hours AND approval=instant. set_dates must confirm too.
5. Locks. createBooking takes an advisory lock on the host, which is fine. computeOpenSlots blocks overlapping time across the same host's offers, which is wrong for departures. For set_dates, lock the slot row and count against slot.capacity only. Seats taken = confirmed + requested/awaiting_* + unexpired held/awaiting_payment.
6. Backfill FKs. Both service_commissions.departure_id and tour_stop_notes.departure_id reference tour_departures. Repoint both.
7. bookings.offer_id is ON DELETE RESTRICT and bookings.thread_id cascades. Deleting a test thread that has bookings fails unless the bookings are deleted first.
8. Reminders are global: sendDueBookingReminders runs from artdirect every 5 min for all orgs. reminder_minutes_before defaults to 1440, so set it for tours or it doubles up with elktours' own reminders. Pass the elktours public origin as siteUrl (bookings.site_url).
9. elktours /bookings/[token] and calendar.ics read tour_bookings tokens, while new tokens are bookings.buyer_token. During the switch, read both.
10. createBooking requires booker name + email. Stripe-first flows must pass a name.
11. UI: BookingPanel (@elkdonis/checkout/components) only does open hours and suggest times, so departures + party size is new. The studio-forms BookingSection only does open_hours/request_time.
12. Testing. EMAIL_SANDBOX=1 in admin (no SendGrid key). Use throwaway tsx scripts from apps/artdirect that delete their rows in finally. packages/booking/scripts/check-core.mts is the pure check (32/32). Don't use saveOffering for test threads (markArtist lists the author in the directory; docs/reference/testing.md).
13. There is no Stripe test key and the keys are live. Stop at order creation and markBookingPaid.
