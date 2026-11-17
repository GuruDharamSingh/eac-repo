import { NextResponse } from "next/server";
import { rsvpRoutes } from "@elkdonis/services";
import { createThreadOrder } from "@elkdonis/commerce/server";
import { isCardPaymentAvailable, startStripeCheckout } from "@elkdonis/checkout/stripe";
import { getViewer } from "@/lib/auth";
import { publicOrigin } from "@/lib/public-origin";
import { shareWorkshopMaterials } from "@/lib/workshop-share";
import { siteConfig } from "@/config/site";

/** MAJOR to minor, the boundary commerce works in. */
function toMinor(v: string | number | null | undefined): number {
  const n = v == null ? 0 : Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/**
 * Member RSVP. Guests use /api/rsvp instead.
 *
 * The one RSVP logic is in @elkdonis/services (rsvp-handler.ts). What this
 * site adds is the paid branch: a priced offering is bought, not joined.
 * Enrolment is granted by `confirmOrderPaid` when the payment lands, never
 * here. (Step 2 of RSVP_BOOKING_ONE_LOGIC moves this into the handler.)
 */
export const { GET, POST, DELETE } = rsvpRoutes({
  orgId: siteConfig.orgId,
  orgName: siteConfig.orgName,
  label: "innergathering",
  shape: "attending",
  who: async () => {
    const v = await getViewer();
    return v ? { userId: v.userId, email: v.email, role: v.role } : null;
  },
  emails: { fallbackNotifyEmail: siteConfig.fallbackNotifyEmail },
  onJoined: ({ thread, userId }) => {
    if (thread.kind === "workshop") void shareWorkshopMaterials(thread.id, userId, "attendee");
  },
  onLeft: ({ thread, userId }) => {
    if (thread.kind === "workshop") void shareWorkshopMaterials(thread.id, userId, "none");
  },
  paid: async ({ request, thread, viewer, body }) => {
    if (!isCardPaymentAvailable()) {
      return NextResponse.json(
        { error: "This one is paid, and card payments are not switched on yet. Please get in touch." },
        { status: 503 }
      );
    }
    const priceMinor = toMinor(thread.price);
    const floorMinor = toMinor(thread.price_sliding_min);
    const chosen = Number(body.amountMinor);
    const amountMinor = Number.isFinite(chosen) && chosen > 0 ? Math.round(chosen) : priceMinor;
    const threadPath = thread.section ? `/${thread.section}/${thread.slug}` : "/";
    try {
      const order = await createThreadOrder({
        orgId: siteConfig.orgId,
        threadId: thread.id,
        kinds: ["workshop", "event"],
        itemNoun: "place",
        customerEmail: viewer.email,
        customerId: viewer.userId,
        paymentMethod: "stripe",
        // Only pass a chosen amount where a sliding scale exists; commerce
        // rejects one otherwise, and rejects anything out of range.
        amountMinor: floorMinor > 0 ? amountMinor : undefined,
      });
      const origin = publicOrigin(request as never);
      const { url } = await startStripeCheckout({
        orderId: order.id,
        successUrl: `${origin}/api/checkout/return?order=${order.id}&to=${encodeURIComponent(threadPath)}`,
        cancelUrl: `${origin}${threadPath}?payment=cancelled`,
        imageBase: origin,
      });
      return NextResponse.json({ requiresPayment: true, checkoutUrl: url, orderId: order.id });
    } catch (err) {
      console.error(`[innergathering] paid join ${thread.id}:`, err);
      const message = err instanceof Error ? err.message : "Could not start checkout.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  },
});
