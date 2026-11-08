// Round 3 (2026-11-07): the "When would suit you?" save, tested with an EXACT
// REVERT. It writes one test order (status paid, email @example.invalid, no
// Stripe session), one line for the service, then exercises the same calls
// saveBookingTimes makes (lib/booking-actions.ts) EXCEPT markServiceBookingPaid,
// which emails the seller and the buyer: its one UPDATE (awaiting_payment ->
// awaiting_seller) is repeated here by hand. Then it deletes the booking, the
// line and the order, and checks nothing is left. No email, no Stripe call.
//   docker compose run --rm --no-deps -T -e STRIPE_SECRET_KEY= -w /app/apps/hidden-enneagram admin \
//     node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/booking-times-test.ts
import { randomUUID } from "node:crypto";
import { db } from "@elkdonis/db";
import { createServiceBooking, parseProposedTimes } from "@elkdonis/commerce/server";
import { bookingAfterPayment } from "../src/lib/booking-after";

let failed = 0;
const expect = (ok: boolean, what: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) failed++;
};

async function main() {
  const [svc] = await db`SELECT id, title FROM threads WHERE org_id = 'hidden-enneagram' AND slug = 'one-on-one-enneagram-reading' AND kind = 'service' LIMIT 1`;
  if (!svc) throw new Error("no service");
  const orderId = randomUUID();
  const number = `R3-TEST-${Date.now()}`;
  try {
    await db`INSERT INTO commerce_order (id, number, customer_email, customer_name, status, payment_method, subtotal_minor, total_minor, currency, notes)
             VALUES (${orderId}, ${number}, 'r3-times-test@example.invalid', 'Round 3 test', 'paid', 'stripe', 12000, 12000, 'CAD', 'round 3 save test; deleted by the same script')`;
    await db`INSERT INTO commerce_order_line (order_id, description, quantity, unit_price_minor, currency, thread_id, org_id)
             VALUES (${orderId}, ${svc.title as string}, 1, 12000, 'CAD', ${svc.id as string}, 'hidden-enneagram')`;

    expect((await bookingAfterPayment(orderId, svc.id as string)).state === "open", "a paid order with no times: the form shows (open)");
    expect((await bookingAfterPayment(orderId, randomUUID())).state === "none", "the same order on another service's page: nothing");

    const soon = new Date(Date.now() + 3 * 86400_000);
    const parsed = parseProposedTimes([soon.toISOString(), new Date(soon.getTime() + 86400_000).toISOString()]);
    expect(parsed.ok === true, "two proposed times parse");
    if (parsed.ok === false) throw new Error(parsed.error);
    await createServiceBooking({ orderId, buyerTimeZone: "America/Los_Angeles", proposedTimes: parsed.times, message: "round 3 test note" });
    const [row] = await db`SELECT status, array_length(proposed_times, 1) AS n, buyer_time_zone, last_message, seller_user_id FROM service_bookings WHERE order_id = ${orderId}`;
    expect(row?.status === "awaiting_payment" && Number(row?.n) === 2 && row?.buyer_time_zone === "America/Los_Angeles" && row?.last_message === "round 3 test note", "booking row saved: 2 times, zone, note");
    console.log(`  seller on the booking: ${row?.seller_user_id}`);

    // markServiceBookingPaid's UPDATE, without its two emails.
    await db`UPDATE service_bookings SET status = 'awaiting_seller', updated_at = NOW() WHERE order_id = ${orderId} AND status = 'awaiting_payment'`;
    expect((await bookingAfterPayment(orderId, svc.id as string)).state === "sent", "after sending: the form is gone (sent)");
    let refused = false;
    try {
      await createServiceBooking({ orderId, proposedTimes: parsed.times });
    } catch {
      refused = true;
    }
    expect(refused, "a second save is refused (already past awaiting_payment)");
  } finally {
    await db`DELETE FROM service_bookings WHERE order_id = ${orderId}`;
    await db`DELETE FROM commerce_order_line WHERE order_id = ${orderId}`;
    await db`DELETE FROM commerce_order WHERE id = ${orderId}`;
    const [left] = await db`SELECT (SELECT count(*) FROM commerce_order WHERE id = ${orderId}) + (SELECT count(*) FROM commerce_order_line WHERE order_id = ${orderId}) + (SELECT count(*) FROM service_bookings WHERE order_id = ${orderId}) AS n`;
    expect(Number(left?.n) === 0, `reverted: no rows left for ${number}`);
  }
  console.log(failed ? `${failed} FAILED` : "all expectations passed");
}
main().then(() => process.exit(failed ? 1 : 0)).catch((e) => { console.error(String(e)); process.exit(1); });
