import { NextResponse, type NextRequest } from "next/server";
import { syncStripeOrder } from "@elkdonis/checkout/stripe";
import { publicOrigin } from "@/lib/public-origin";

/**
 * Where Stripe sends a buyer back to after a hosted checkout.
 *
 * The webhook is the source of truth and confirms the order on its own, but it
 * is registered against one public URL and may land a second or two later.
 * Reconciling here means the person is already enrolled by the time the page
 * paints, rather than looking at a workshop that still says "join". Both paths
 * end in `confirmOrderPaid`, which is idempotent, so whichever is second does
 * nothing.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("order");
  const to = request.nextUrl.searchParams.get("to");

  // Only ever bounce somewhere on this site. `to` arrives via Stripe, so an
  // absolute URL here would make this an open redirect.
  const path = to && /^\/(?!\/)/.test(to) ? to : "/";

  if (orderId) {
    await syncStripeOrder(orderId).catch((err) =>
      console.error(`[innergathering] checkout return ${orderId}:`, err)
    );
  }

  const target = new URL(path, publicOrigin(request));
  target.searchParams.set("joined", "1");
  return NextResponse.redirect(target);
}
