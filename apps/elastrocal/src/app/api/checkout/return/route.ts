import type { NextRequest } from "next/server";
import { checkoutReturn, publicOriginFrom } from "@elkdonis/checkout/booking";
import { BASE_PATH } from "@/lib/base-path";

/**
 * Where Stripe sends a buyer back after paying for a reading. Reconciles the
 * order (the webhook on market.arts-collective.com may land a second later),
 * then returns them to the service page under this app's basePath.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = publicOriginFrom(request.headers, process.env.NEXT_PUBLIC_APP_URL);
  return checkoutReturn(request, `${origin}${BASE_PATH}`);
}
