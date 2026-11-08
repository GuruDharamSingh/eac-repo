import type { NextRequest } from "next/server";
import { checkoutReturn, publicOriginFrom } from "@elkdonis/checkout/booking";

/**
 * Where Stripe sends a buyer back after paying for a booking. Reconciles the
 * order (the webhook on market.arts-collective.com may land a second later),
 * then returns them to the service page. See @elkdonis/checkout/booking.
 *
 * Round 3 (2026-11-07): the order id rides along to a service page
 * (`/services/<slug>?booked=1&order=<id>`), where "When would suit you?"
 * asks for the times after payment (lib/booking-after.ts).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const res = await checkoutReturn(request, publicOriginFrom(request.headers, process.env.NEXT_PUBLIC_APP_URL));
  const order = request.nextUrl.searchParams.get("order");
  const location = res.headers.get("location");
  if (!order || !UUID.test(order) || !location) return res;
  const target = new URL(location);
  if (!/^\/services\/[^/]+$/.test(target.pathname)) return res;
  target.searchParams.set("order", order);
  return Response.redirect(target.toString(), 303);
}
