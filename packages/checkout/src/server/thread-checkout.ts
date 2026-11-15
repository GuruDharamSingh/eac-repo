/**
 * Booking a thread by card — a service, or a paid workshop or event — in one
 * call, plus the return hop Stripe sends the buyer back through.
 *
 * Before 2026-09-27 each app assembled this itself: innergathering's RSVP
 * route created the order and started the session inline; hidden-enneagram
 * booked services by eTransfer only; elastrocal and ArtDirect had no booking.
 * Every app now calls `startThreadCheckout` from its own server action and
 * mounts `checkoutReturn` at `/api/checkout/return`, so the order, the split
 * and the session are made the same way everywhere.
 *
 * Nothing here decides who may book: the caller has already found the thread
 * on its own site (org-scoped) and passes the buyer from the session or the
 * form. Commerce refuses anything that is not published, not open for
 * booking, unpriced, or outside a sliding scale.
 */

import {
  checkDepartureAvailability,
  createServiceBooking,
  createThreadOrder,
  createTourBooking,
  getPayoutIdentity,
  parsePartySize,
  parseProposedTimes,
  MAX_PARTY_SIZE,
  type PurchasableThreadKind,
} from "@elkdonis/commerce/server";
import type { StripeCollectOptions } from "@elkdonis/payments";
import { attachOrder, createBooking, releaseBooking } from "@elkdonis/booking";
import { isCardPaymentAvailable, startStripeCheckout, syncStripeOrder } from "./stripe";

/**
 * Whether a card booking can be taken for something `authorId` offers, and if
 * not, why — checked before showing the form, so a visitor is not handed a
 * form that commerce will refuse. `no_payouts` mirrors resolveSettlement: an
 * author with neither an eTransfer address nor a Stripe account cannot be
 * paid, and their money is never routed to the collective instead.
 */
export async function bookingAvailability(
  authorId: string | null
): Promise<{ ok: true } | { ok: false; reason: "no_card" | "no_payouts" }> {
  if (!isCardPaymentAvailable()) return { ok: false, reason: "no_card" };
  if (!authorId) return { ok: true };
  const identity = await getPayoutIdentity(authorId).catch(() => null);
  if (!identity?.payoutEmail && !identity?.stripeAccountId) return { ok: false, reason: "no_payouts" };
  return { ok: true };
}

/** The sentence a visitor sees for each reason above. */
export const BOOKING_UNAVAILABLE: Record<"no_card" | "no_payouts", string> = {
  no_card: "Card payments are not switched on for this site yet.",
  no_payouts: "Booking opens once they have set up how they are paid.",
};

/**
 * The origin a browser used to reach this app, for URLs handed to Stripe.
 *
 * Not `request.nextUrl.origin`: apps start with `-H 0.0.0.0`, which that
 * reports. The edge's forwarded headers carry the real host; the configured
 * public URL is the fallback. Takes a Headers object so a server action
 * (`await headers()`) and a route handler (`request.headers`) both use it.
 */
export function publicOriginFrom(headers: Headers, fallback?: string | null): string {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (host && !host.startsWith("0.0.0.0")) {
    const proto =
      headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return (fallback ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
}

export interface StartThreadCheckoutInput {
  orgId: string;
  threadId: string;
  kinds?: readonly PurchasableThreadKind[];
  /** What the buyer is told they are paying for — "booking", "place". */
  itemNoun?: string;
  /**
   * The buyer's email. May be "" when `collect.email` is set: Stripe's page
   * asks for it, and syncStripeOrder / the webhook write it onto the order
   * (katie's "Buy now" path).
   */
  customerEmail: string;
  customerName?: string | null;
  customerId?: string | null;
  notes?: string | null;
  /** A sliding-scale amount, minor units; omit for the list price. */
  amountMinor?: number;
  /** How many places (a tour's party size); the price is per place. Default 1. */
  quantity?: number;
  /**
   * The app's public base: origin plus any basePath (elastrocal's `/astro`).
   * Every path below is relative to it.
   */
  baseUrl: string;
  /** Same-site path the buyer returns to once paid, e.g. `/services/reading`. */
  returnPath: string;
  /** Same-site path for "I changed my mind" on Stripe's page. */
  cancelPath: string;
  /** Where `checkoutReturn` is mounted. Default `/api/checkout/return`. */
  returnRoute?: string;
  /**
   * Optional (2026-11-07, hidden-enneagram "Book and pay"): what Stripe's
   * page asks for (email, shipping address, phone) for a booking started
   * from one button with no form. Passed to startStripeCheckout as is.
   * Omitted = the session every caller always got.
   */
  collect?: StripeCollectOptions | null;
}

/** Create the card order and open Stripe Checkout; the caller redirects to `url`. */
export async function startThreadCheckout(
  input: StartThreadCheckoutInput
): Promise<{ orderId: string; url: string }> {
  const base = input.baseUrl.replace(/\/$/, "");
  const order = await createThreadOrder({
    orgId: input.orgId,
    threadId: input.threadId,
    kinds: input.kinds,
    itemNoun: input.itemNoun,
    customerEmail: input.customerEmail,
    customerName: input.customerName ?? null,
    customerId: input.customerId ?? null,
    notes: input.notes ?? null,
    amountMinor: input.amountMinor,
    quantity: input.quantity,
    paymentMethod: "stripe",
  });
  const route = input.returnRoute ?? "/api/checkout/return";
  const { url } = await startStripeCheckout({
    orderId: order.id,
    successUrl: `${base}${route}?order=${encodeURIComponent(order.id)}&to=${encodeURIComponent(input.returnPath)}`,
    cancelUrl: `${base}${input.cancelPath}${input.cancelPath.includes("?") ? "&" : "?"}payment=cancelled`,
    imageBase: base,
    ...(input.collect ? { collect: input.collect } : {}),
  });
  return { orderId: order.id, url };
}

/**
 * Book a service by card, with times proposed when it is scheduled one to
 * one (migration 174). The times are checked BEFORE the order exists, so a
 * bad proposal never leaves an unpaid order behind; the booking row is made
 * right after the order and before the buyer can pay. Throws an Error whose
 * message is for the buyer.
 */
export async function startServiceCheckout(
  input: StartThreadCheckoutInput & {
    /** Omit (or null) for a service that is not scheduled one to one. */
    schedule?: { times: unknown; timeZone?: string | null } | null;
  }
): Promise<{ orderId: string; url: string }> {
  const { schedule, ...order } = input;
  const parsed = schedule ? parseProposedTimes(schedule.times) : null;
  if (parsed && parsed.ok === false) throw new Error(parsed.error);
  const started = await startThreadCheckout({ ...order, kinds: order.kinds ?? ["service"] });
  if (parsed && parsed.ok) {
    await createServiceBooking({
      orderId: started.orderId,
      buyerTimeZone: schedule!.timeZone ?? null,
      proposedTimes: parsed.times,
      message: input.notes ?? null,
    });
  }
  return started;
}

/**
 * Book places on a tour departure by card (migration 208). Seats are checked
 * before the order exists and again, locked, when the booking row is made.
 * Throws an Error whose message is for the buyer.
 */
export async function startTourCheckout(
  input: Omit<StartThreadCheckoutInput, "quantity" | "kinds"> & {
    departureId: string;
    partySize: unknown;
  }
): Promise<{ orderId: string; url: string }> {
  const partySize = parsePartySize(input.partySize);
  if (!partySize) throw new Error(`Party size must be between 1 and ${MAX_PARTY_SIZE}.`);
  const availability = await checkDepartureAvailability(input.departureId, partySize);
  if (availability.ok === false) throw new Error(availability.error);
  const { departureId, partySize: _p, ...rest } = input;
  const started = await startThreadCheckout({ ...rest, kinds: ["tour"], quantity: partySize, itemNoun: rest.itemNoun ?? "place" });
  await createTourBooking({
    orderId: started.orderId,
    departureId,
    partySize,
    note: input.notes ?? null,
  });
  return started;
}

/**
 * Book a priced offer of the booking module (migration 265) by card.
 *
 * Order of operations (design §2.2): the time is taken first, under the
 * host lock, as an `awaiting_payment` booking with a hold; then the order is
 * made and linked to the booking; then the card session. A refusal at any
 * step gives the hold back, so a failed checkout never keeps a time. The
 * order's payment window (75 minutes) matches the hold. Throws an Error
 * whose message is for the buyer.
 */
export async function startBookingCheckout(
  input: Omit<StartThreadCheckoutInput, "quantity" | "returnPath"> & {
    offerId: string;
    /** open_hours: the chosen start (ISO). */
    startsAt?: string | null;
    /** request_time: up to three proposed starts (ISO). */
    proposedTimes?: unknown;
    timeZone?: string | null;
    answers?: unknown;
    partySize?: number;
    /** Public base of this site (origin + basePath), stored for links in mail. */
    siteUrl?: string | null;
    /** Where the buyer lands once paid, given the booking's private token. */
    returnPathFor: (token: string) => string;
  }
): Promise<{ orderId: string; url: string; bookingId: string; token: string }> {
  const booking = await createBooking({
    orgId: input.orgId,
    offerId: input.offerId,
    startsAt: input.startsAt ?? null,
    proposedTimes: input.proposedTimes,
    partySize: input.partySize,
    booker: {
      userId: input.customerId ?? null,
      email: input.customerEmail,
      name: input.customerName ?? null,
      timeZone: input.timeZone ?? null,
    },
    notes: input.notes,
    answers: input.answers,
    paid: true,
    siteUrl: input.siteUrl ?? input.baseUrl,
  });
  if (booking.ok === false) throw new Error(booking.error);

  const base = input.baseUrl.replace(/\/$/, "");
  let orderId: string | null = null;
  try {
    const order = await createThreadOrder({
      orgId: input.orgId,
      threadId: input.threadId,
      kinds: input.kinds,
      itemNoun: input.itemNoun ?? "booking",
      customerEmail: input.customerEmail,
      customerName: input.customerName ?? null,
      customerId: input.customerId ?? null,
      notes: input.notes ?? null,
      amountMinor: input.amountMinor,
      quantity: 1,
      paymentMethod: "stripe",
    });
    orderId = order.id;
    if (!(await attachOrder(booking.bookingId, order.id))) {
      throw new Error("That time is no longer held. Choose it again.");
    }
    const route = input.returnRoute ?? "/api/checkout/return";
    const returnPath = input.returnPathFor(booking.token);
    const { url } = await startStripeCheckout({
      orderId: order.id,
      successUrl: `${base}${route}?order=${encodeURIComponent(order.id)}&to=${encodeURIComponent(returnPath)}`,
      cancelUrl: `${base}${input.cancelPath}${input.cancelPath.includes("?") ? "&" : "?"}payment=cancelled`,
      imageBase: base,
      ...(input.collect ? { collect: input.collect } : {}),
    });
    return { orderId: order.id, url, bookingId: booking.bookingId, token: booking.token };
  } catch (err) {
    await releaseBooking(booking.bookingId, orderId ? "card session not opened" : "order not created").catch(() => {});
    throw err;
  }
}

/**
 * The return hop, as a route handler body: reconcile the order (the webhook
 * may be a second behind), then send the buyer to `to` on this site with
 * `?booked=1`. `to` arrives through Stripe, so only a same-site path is
 * followed; anything else goes to the base.
 */
export async function checkoutReturn(request: Request, baseUrl: string): Promise<Response> {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order");
  const to = url.searchParams.get("to");
  const path = to && /^\/(?!\/)/.test(to) ? to : "/";

  // Order ids are uuids; anything else is a hand-typed URL, not worth a query.
  if (orderId && /^[0-9a-f-]{36}$/i.test(orderId)) {
    await syncStripeOrder(orderId).catch((err) =>
      console.error(`[checkout] return ${orderId}:`, err)
    );
  }

  const target = new URL(`${baseUrl.replace(/\/$/, "")}${path}`);
  target.searchParams.set("booked", "1");
  return Response.redirect(target.toString(), 303);
}
