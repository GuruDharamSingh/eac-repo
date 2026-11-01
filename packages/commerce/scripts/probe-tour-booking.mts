/**
 * Probe the tour booking path without Stripe or email (migration 208).
 *
 * Run from the admin container with SendGrid disabled so no mail leaves:
 *
 *   docker compose exec -T -e SENDGRID_API_KEY= admin sh -c \
 *     'cd packages/commerce && npx tsx scripts/probe-tour-booking.mts <tourThreadId> <payableUserId>'
 *
 * It temporarily makes `payableUserId` (someone with a payout identity) the
 * tour's author so settlement resolves, creates a card order for 3 places,
 * attaches the booking, checks the seats are held, confirms it as the
 * webhook would, checks the seats are confirmed, then deletes everything it
 * made and restores the author. Nothing it writes survives.
 */
import { db } from "@elkdonis/db";
import {
  checkDepartureAvailability,
  createThreadOrder,
  createTourBooking,
  getTourBookingByToken,
  listTourDepartures,
  markTourBookingPaid,
} from "../src/server/index";

const [tourId, payee] = process.argv.slice(2);
if (!tourId || !payee) throw new Error("usage: probe-tour-booking.mts <tourThreadId> <payableUserId>");

const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok   ${msg}`);
};

const [tour] = (await db`SELECT id, org_id, author_id FROM threads WHERE id = ${tourId} AND kind = 'tour'`) as unknown as { id: string; org_id: string; author_id: string }[];
if (!tour) throw new Error("no such tour");
const originalAuthor = tour.author_id;
let orderId: string | null = null;
let bookingId: string | null = null;

try {
  await db`UPDATE threads SET author_id = ${payee} WHERE id = ${tourId}`;

  const [dep] = await listTourDepartures(tourId, { upcomingOnly: true });
  assert(dep, "a scheduled departure exists");
  const before = dep!.seatsTaken;

  const avail = await checkDepartureAvailability(dep!.id, 3);
  assert(avail.ok, "3 places are available before booking");
  const tooMany = await checkDepartureAvailability(dep!.id, dep!.seatsLeft + 1);
  assert(tooMany.ok === false, `asking for ${dep!.seatsLeft + 1} places is refused: ${(tooMany as { error?: string }).error}`);

  const order = await createThreadOrder({
    orgId: tour.org_id,
    threadId: tourId,
    kinds: ["tour"],
    customerEmail: "probe-buyer@example.invalid",
    customerName: "Probe Buyer",
    quantity: 3,
    paymentMethod: "stripe",
    itemNoun: "place",
  });
  orderId = order.id;
  const [line] = (await db`SELECT quantity, unit_price_minor FROM commerce_order_line WHERE order_id = ${orderId}`) as unknown as { quantity: number; unit_price_minor: string }[];
  assert(Number(line!.quantity) === 3, "order line quantity is 3");
  assert(order.totalMinor === Number(line!.unit_price_minor) * 3, `order total ${order.totalMinor} = unit ${line!.unit_price_minor} × 3`);

  const made = await createTourBooking({ orderId, departureId: dep!.id, partySize: 3, note: "probe" });
  bookingId = made.id;
  const [held] = await listTourDepartures(tourId, { upcomingOnly: true });
  assert(held!.seatsTaken === before + 3, `unpaid booking holds 3 seats (${before} → ${held!.seatsTaken})`);

  let dup: string | null = null;
  try { await createTourBooking({ orderId, departureId: dep!.id, partySize: 3 }); } catch (e) { dup = (e as Error).message; }
  assert(dup, `a second booking on the same order is refused: ${dup}`);

  const [row] = (await db`SELECT buyer_token, status FROM tour_bookings WHERE id = ${bookingId}`) as unknown as { buyer_token: string; status: string }[];
  assert(row!.status === "awaiting_payment", "booking is awaiting_payment");
  assert((await getTourBookingByToken(row!.buyer_token)) === null, "buyer page hides an unpaid booking");

  await markTourBookingPaid(orderId);
  await markTourBookingPaid(orderId); // idempotent
  const [paid] = (await db`SELECT status FROM tour_bookings WHERE id = ${bookingId}`) as unknown as { status: string }[];
  assert(paid!.status === "confirmed", "after payment the booking is confirmed");
  const buyerView = await getTourBookingByToken(row!.buyer_token);
  assert(buyerView && buyerView.partySize === 3 && !("guideEmail" in buyerView), "buyer page shows the booking without the guide's email");
  const [after] = await listTourDepartures(tourId, { upcomingOnly: true });
  assert(after!.seatsTaken === before + 3 && after!.confirmedBookings >= 1, "confirmed seats count");
} finally {
  if (bookingId) await db`DELETE FROM tour_bookings WHERE id = ${bookingId}`;
  if (orderId) await db`DELETE FROM commerce_order WHERE id = ${orderId}`;
  await db`UPDATE threads SET author_id = ${originalAuthor} WHERE id = ${tourId}`;
  const [check] = (await db`SELECT author_id FROM threads WHERE id = ${tourId}`) as unknown as { author_id: string }[];
  console.log(check!.author_id === originalAuthor ? "ok   cleanup: author restored, probe rows deleted" : "FAIL cleanup");
  await db.end();
}
