import type { NextRequest } from "next/server";
import { syncStripeOrder } from "@elkdonis/checkout/stripe";
import { siteOrigin } from "@/lib/origin";
import { getOrderById } from "@elkdonis/commerce/queries";
import { dropPaidOrderFromCart, UUID_RE } from "@/lib/shop";

/**
 * Where Stripe's hosted page sends a buyer back after paying. Reconciles the
 * order (the webhook, which lives on the marketplace, may land a second
 * later; both call confirmOrderPaid, which is idempotent), then redirects to
 * THIS site's /orders/<id>?paid=1.
 *
 * Only a uuid is read from the query and the destination is built here from
 * this site's own origin, so nothing arriving through Stripe can steer the
 * redirect off-site (the same guard checkoutReturn has for its `to`).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = await siteOrigin();
  const orderId = new URL(request.url).searchParams.get("order");
  if (!orderId || !UUID_RE.test(orderId)) return Response.redirect(`${origin}/`, 303);

  await syncStripeOrder(orderId).catch((err) => console.error(`[katie-the-potter] return ${orderId}:`, err));
  // The cart is kept through a card checkout (so backing out loses nothing);
  // a confirmed payment takes the bought pieces out of it.
  const order = await getOrderById(orderId).catch(() => null);
  if (order && ["paid", "fulfilled", "completed"].includes(order.status)) await dropPaidOrderFromCart(orderId);
  return Response.redirect(`${origin}/orders/${orderId}?paid=1`, 303);
}
