import type { NextRequest } from "next/server";
import { siteOrigin } from "@/lib/origin";
import { UUID_RE } from "@/lib/shop";
import { advance, getShipment } from "@/lib/shipping/shipments";

/**
 * Where Stripe's shipping-payment page sends the buyer back
 * (?shipment=<order_shipment id>). Confirms the payment through the shared
 * sync path (@elkdonis/checkout/stripe syncShippingPayment ->
 * applyShippingPaymentSession, the same recorder the network's webhook uses;
 * quote-only writes Katie's ledger entry in the same transaction), then
 * `advance`: quote-only emails Katie "Ship this order" once (no label is
 * bought); the parked label flow buys the label (never before payment).
 * Lands on /orders/<id>/shipping. Works without the webhook.
 *
 * Only a uuid is read from the query and the destination is built from this
 * site's own origin, so nothing arriving through Stripe can steer the
 * redirect off-site. The shipment id alone grants nothing: the page it lands
 * on applies the order page's access rule.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = await siteOrigin();
  const id = new URL(request.url).searchParams.get("shipment");
  if (!id || !UUID_RE.test(id)) return Response.redirect(`${origin}/`, 303);
  const row = await getShipment(id).catch(() => null);
  if (!row) return Response.redirect(`${origin}/`, 303);
  try {
    await advance(row);
  } catch (err) {
    console.error(`[katie-the-potter] shipping return ${id}:`, err);
  }
  return Response.redirect(`${origin}/orders/${row.orderId}/shipping?paid=1`, 303);
}
