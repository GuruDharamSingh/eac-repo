import { getTourBookingTokenForOrder } from "@elkdonis/commerce/server";
import { publicOriginFrom } from "@elkdonis/checkout/booking";
import { syncStripeOrder } from "@elkdonis/checkout/stripe";

/**
 * Where Stripe sends the buyer after paying. Reconcile the order (the shared
 * webhook on the market host may be a second behind), then hand the buyer
 * their booking page. If the payment has not settled yet, fall back to the
 * tour page with `?payment=pending`; the webhook finishes the job and the
 * confirmation email carries the booking link.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order");
  const to = url.searchParams.get("to");
  const path = to && /^\/(?!\/)/.test(to) ? to : "/";
  const base = publicOriginFrom(request.headers, process.env.NEXT_PUBLIC_APP_URL);

  let token: string | null = null;
  if (orderId && /^[0-9a-f-]{36}$/i.test(orderId)) {
    await syncStripeOrder(orderId).catch((err) => console.error(`[elktours] checkout return ${orderId}:`, err));
    token = await getTourBookingTokenForOrder(orderId).catch(() => null);
  }

  const target = new URL(token ? `${base}/bookings/${token}` : `${base}${path}`);
  if (!token) target.searchParams.set("payment", orderId ? "pending" : "cancelled");
  return Response.redirect(target.toString(), 303);
}
