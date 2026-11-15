# @elkdonis/booking

One booking module for offerings, meetings, tours and events. Design and the
developer's decisions: `docs/open/BOOKING_MODULE_2026-11-14.md`. Current state:
`docs/reference/commerce.md` "Booking module". Migrations 265-266.

- `.` (server only): offers (`saveOffer`, `getOfferByThread`), open-hours
  slots (`listOpenSlots`), bookings (`createBooking`, `attachOrder`,
  `markBookingPaid`, `expireBookingForOrder`, host and booker answers by
  session user or private token), mail.
- `./core` (pure, safe in the browser): types, time-zone math, `computeOpenSlots`,
  `validateOfferInput`, `refundShare` / `describePolicy`, `bookingIcs`.

Depends on `@elkdonis/db` and `@elkdonis/email` only. Commerce calls into it;
it never imports commerce. Org-checked saves live in
`packages/services/src/booking-offers.ts`. The card path is
`startBookingCheckout` in `@elkdonis/checkout/booking`.

Phase 1 accepts modes `open_hours` and `request_time` only (`PHASE1_MODES`).

Checks (pure, no database), in the admin container:

    docker compose exec -T -w /app/packages/booking admin \
      /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/check-core.mts
