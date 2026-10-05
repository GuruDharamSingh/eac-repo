import type { NextRequest } from "next/server";
import { checkoutReturn, publicOriginFrom } from "@elkdonis/checkout/booking";

/**
 * Where Stripe sends a buyer back after paying for a booking. Reconciles the
 * order (the webhook on market.arts-collective.com may land a second later),
 * then returns them to the service page. See @elkdonis/checkout/booking.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return checkoutReturn(request, publicOriginFrom(request.headers, process.env.NEXT_PUBLIC_APP_URL));
}
