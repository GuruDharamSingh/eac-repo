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
  createServiceBooking,
  createThreadOrder,
  getPayoutIdentity,
  parseProposedTimes,
  type PurchasableThreadKind,
} from "@elkdonis/commerce/server";
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
  customerEmail: string;
  customerName?: string | null;
  customerId?: string | null;
  notes?: string | null;
  /** A sliding-scale amount, minor units; omit for the list price. */
  amountMinor?: number;
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
    paymentMethod: "stripe",
  });
  const route = input.returnRoute ?? "/api/checkout/return";
  const { url } = await startStripeCheckout({
    orderId: order.id,
    successUrl: `${base}${route}?order=${encodeURIComponent(order.id)}&to=${encodeURIComponent(input.returnPath)}`,
    cancelUrl: `${base}${input.cancelPath}${input.cancelPath.includes("?") ? "&" : "?"}payment=cancelled`,
    imageBase: base,
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
