import { db } from "@elkdonis/db";
import { syncStripeOrder } from "@elkdonis/checkout/stripe";

// ============================================================================
// "Book and pay" (round 3, 2026-11-07): the buyer pays first, from one button,
// and suggests times AFTER, on the page Stripe returns them to
// (`/services/<slug>?booked=1&order=<id>`, see app/api/checkout/return).
//
// The order id in that address is the buyer's key to this one step, as the
// Stripe success URL already carries it. It only ever unlocks: a PAID order
// for THIS service whose times have not been sent yet. Once they are sent the
// booking row is past `awaiting_payment` and nothing here can change it again
// (createServiceBooking refuses). Server only.
// ============================================================================

const PAID = new Set(["paid", "fulfilled", "completed"]);

export type BookingAfterPayment =
  /** Paid, times not suggested yet: show "When would suit you?". */
  | { state: "open"; orderId: string; email: string | null }
  /** Paid, and the times are already with the seller. */
  | { state: "sent"; orderId: string }
  /** Not paid (yet), or not this service's order. */
  | { state: "none" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function read(orderId: string, serviceId: string) {
  const rows = (await db`
    SELECT o.id, o.status, o.customer_email, b.status AS booking_status
      FROM commerce_order o
      JOIN commerce_order_line l ON l.order_id = o.id AND l.thread_id = ${serviceId}
      LEFT JOIN service_bookings b ON b.order_id = o.id
     WHERE o.id = ${orderId}
     LIMIT 1
  `) as unknown as Array<{ id: string; status: string; customer_email: string | null; booking_status: string | null }>;
  return rows[0] ?? null;
}

/** Where the buyer of `orderId` stands on `serviceId`'s page. Never throws. */
export async function bookingAfterPayment(orderId: string | null | undefined, serviceId: string): Promise<BookingAfterPayment> {
  if (!orderId || !UUID.test(orderId)) return { state: "none" };
  try {
    let row = await read(orderId, serviceId);
    if (!row) return { state: "none" };
    // The return hop already reconciled; a webhook a second late is caught here once more.
    if (!PAID.has(row.status)) {
      await syncStripeOrder(orderId).catch(() => null);
      row = await read(orderId, serviceId);
      if (!row || !PAID.has(row.status)) return { state: "none" };
    }
    if (row.booking_status && row.booking_status !== "awaiting_payment") return { state: "sent", orderId };
    return { state: "open", orderId, email: row.customer_email?.trim() || null };
  } catch (err) {
    console.error("[hidden-enneagram] bookingAfterPayment:", err);
    return { state: "none" };
  }
}
