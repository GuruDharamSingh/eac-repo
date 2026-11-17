/**
 * The paid branch of a member RSVP, with its dependencies passed in so it can
 * be checked without Stripe, a database or a network (see
 * packages/booking/scripts/check-rsvp.mts). `rsvp-paid.ts` binds the real ones.
 *
 * Money rules it keeps:
 *  - money moves only on Stripe's hosted page: this answers with its URL;
 *  - the maker (the thread's author) is the payee. An org holds no connected
 *    account, so a thread whose author has no payout route is refused here,
 *    in one dry sentence, rather than failing inside commerce;
 *  - a seat is granted by `confirmOrderPaid` when the payment lands, never here.
 *
 * Structural types only: this file imports nothing, so @elkdonis/services
 * (which knows PaidContext) and @elkdonis/checkout stay independent.
 */

export interface RsvpPaidThread {
  id: string;
  slug: string;
  section: string | null;
  author_id: string | null;
  price: string | number | null;
  price_sliding_min: string | number | null;
}

export interface RsvpPaidContext {
  request: Request;
  thread: RsvpPaidThread;
  viewer: { userId: string; email: string };
  body: Record<string, unknown>;
}

export type RsvpPaidRefusal = "no_card" | "no_payouts";

export const RSVP_PAID_REFUSAL: Record<RsvpPaidRefusal, string> = {
  no_card: "This event takes payment. Card payments are not switched on for this site yet.",
  no_payouts: "This event takes payment. Its organiser hasn't set up payments yet.",
};

export interface RsvpPaidDeps {
  /** Whether the thread can be paid for, and if not why (bookingAvailability). */
  availability(authorId: string | null): Promise<{ ok: true } | { ok: false; reason: RsvpPaidRefusal }>;
  /** Create the order and open Stripe Checkout. Returns the hosted page's URL. */
  start(input: {
    threadId: string;
    customerEmail: string;
    customerId: string;
    /** A chosen sliding-scale amount (minor); omitted unless the thread has a scale. */
    amountMinor?: number;
    /** Same-site path the buyer returns to, and where "cancel" lands. */
    threadPath: string;
    request: Request;
  }): Promise<{ orderId: string; url: string }>;
}

/** MAJOR to minor, the boundary commerce works in. */
function toMinor(v: string | number | null | undefined): number {
  const n = v == null ? 0 : Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function threadPathOf(t: { section: string | null; slug: string }): string {
  return t.section ? `/${t.section}/${t.slug}` : "/";
}

export function makeRsvpPaid(deps: RsvpPaidDeps) {
  return async function paid(ctx: RsvpPaidContext): Promise<Response> {
    const { thread, viewer, body, request } = ctx;
    const gate = await deps.availability(thread.author_id).catch(() => ({ ok: false as const, reason: "no_payouts" as const }));
    if (gate.ok === false) {
      return Response.json({ error: RSVP_PAID_REFUSAL[gate.reason], reason: gate.reason }, { status: 409 });
    }
    const priceMinor = toMinor(thread.price);
    const floorMinor = toMinor(thread.price_sliding_min);
    const chosen = Number(body.amountMinor);
    const amountMinor = Number.isFinite(chosen) && chosen > 0 ? Math.round(chosen) : priceMinor;
    try {
      const { orderId, url } = await deps.start({
        threadId: thread.id,
        customerEmail: viewer.email,
        customerId: viewer.userId,
        // Commerce rejects a chosen amount where no sliding scale exists.
        amountMinor: floorMinor > 0 ? amountMinor : undefined,
        threadPath: threadPathOf(thread),
        request,
      });
      return Response.json({ requiresPayment: true, checkoutUrl: url, orderId });
    } catch (err) {
      console.error(`[rsvp-paid] ${thread.id}:`, err);
      const message = err instanceof Error && err.message ? err.message : "Could not start checkout.";
      return Response.json({ error: message }, { status: 400 });
    }
  };
}
