/**
 * @elkdonis/booking: one booking module for offerings, meetings, tours and
 * events (docs/open/BOOKING_MODULE_2026-11-14.md; migrations 265-266).
 *
 * Server-only (the database). Browser code imports `@elkdonis/booking/core`.
 * Depends on @elkdonis/db and @elkdonis/email only, not on commerce:
 * commerce calls `markBookingPaid` / `expireBookingForOrder`, and checkout
 * composes a booking with an order (startBookingCheckout).
 */
export * from "./core";
export * from "./server/offers";
export * from "./server/bookings";
export * from "./server/slots";
export { bookerUrl, hostUrl } from "./server/notify";
