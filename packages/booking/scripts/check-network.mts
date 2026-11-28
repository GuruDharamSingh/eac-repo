// Network-sold service -> booking module (2026-11-27). Run in a throwaway container on eac-network:
//   cwd packages/booking:  node ../../node_modules/tsx/dist/cli.mjs scripts/check-network.mts
// Every write happens inside one transaction that is rolled back (the script throws a sentinel at the end), and a
// final read through the normal connection proves nothing persisted. No Stripe call exists in this script; the
// order is a bare commerce_order row inserted inside the transaction.
import { randomBytes } from "node:crypto";
import { db } from "@elkdonis/db";
import { bookerLabel, bookerWho, expireLapsedHolds, getBookingByToken, getHostBookingOrg, listHostNetworkBookings, markBookingPaid, recordNetworkBooking } from "../src/index";

type Tx = typeof db;
let pass = 0;
const failures: string[] = [];
const ok = (c: unknown, m: string) => { if (!c) throw new Error(m); };
async function t(name: string, fn: () => Promise<void>) {
  try { await fn(); pass++; console.log("ok   ", name); } catch (e) { failures.push(name); console.log("FAIL ", name, "\n      ", (e as Error).message); }
}
class Rollback extends Error {}

const [thread] = await db<Array<{ id: string; org_id: string; author_id: string }>>`
  SELECT t.id, t.org_id, t.author_id FROM threads t
  WHERE t.kind = 'service' AND t.status = 'published' AND t.org_id <> 'oad' AND t.author_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM booking_offers o WHERE o.thread_id = t.id)
  LIMIT 1`;
if (!thread) { console.error("no suitable service thread"); process.exit(2); }
const token0 = randomBytes(6).toString("hex");
let token = "";
let orderId = "";
let bookingId = "";

try {
  await db.begin(async (txRaw) => {
    const tx = txRaw as unknown as Tx;
    const [o] = await tx<Array<{ id: string }>>`
      INSERT INTO commerce_order (number, customer_email, status, payment_method, total_minor, metadata)
      VALUES (${"TEST-" + token0}, 'buyer@example.invalid', 'pending_payment', 'stripe', 8000,
              ${tx.json({ networkSale: true, sellerOrgId: "oad", threadOrgId: thread.org_id })})
      RETURNING id`;
    orderId = o!.id;

    await t("service order -> pending booking linked to the order, in the thread's org, stub offer closed", async () => {
      const r = await recordNetworkBooking({ threadId: thread.id, orderId, buyer: { name: "Test Buyer", email: "buyer@example.invalid" }, siteUrl: "https://directory.example.invalid", tx });
      ok(r.ok === true, "not ok: " + JSON.stringify(r));
      if (r.ok !== true) return;
      ok(r.status === "awaiting_payment" && r.holdExpiresAt && !r.existing, "status/hold " + r.status);
      token = r.token; bookingId = r.bookingId;
      const [b] = await tx<Array<{ order_id: string; org_id: string; status: string; hold: Date | null }>>`
        SELECT order_id, org_id, status, hold_expires_at AS hold FROM bookings WHERE id = ${bookingId}`;
      ok(b!.order_id === orderId, "order link");
      ok(b!.org_id === thread.org_id, "org " + b!.org_id);
      const [of] = await tx<Array<{ mode: string; status: string; host_user_id: string }>>`
        SELECT o.mode, o.status, o.host_user_id FROM booking_offers o WHERE o.thread_id = ${thread.id}`;
      ok(of!.mode === "request_time" && of!.status === "closed" && of!.host_user_id === thread.author_id, "stub offer " + JSON.stringify(of));
    });

    await t("retry for the same order returns the same booking (no duplicate)", async () => {
      const r = await recordNetworkBooking({ threadId: thread.id, orderId, buyer: { email: "buyer@example.invalid" }, tx });
      ok(r.ok === true && r.existing && r.bookingId === bookingId, JSON.stringify(r));
    });

    await t("refuses a non-service thread and a bad email", async () => {
      const [ev] = await tx<Array<{ id: string }>>`SELECT id FROM threads WHERE kind <> 'service' AND status = 'published' LIMIT 1`;
      const a = await recordNetworkBooking({ threadId: ev!.id, orderId, buyer: { email: "x@example.invalid" }, tx });
      ok(a.ok === false, "non-service accepted");
      const b = await recordNetworkBooking({ threadId: thread.id, orderId, buyer: { email: "nope" }, tx });
      ok(b.ok === false, "bad email accepted");
    });

    await t("token page lookup returns it (awaiting_payment, order linked)", async () => {
      const b = await getBookingByToken(token, tx);
      ok(b && b.id === bookingId && b.status === "awaiting_payment" && b.orderId === orderId, JSON.stringify(b));
      ok(b!.threadTitle.length > 0, "thread title");
    });

    await t("author's listing: network list returns it; oad-scoped host list is not where it lives", async () => {
      const l = await listHostNetworkBookings("oad", thread.author_id, { includePast: true }, tx);
      ok(l.some((x) => x.id === bookingId), "missing from network list");
      ok((await getHostBookingOrg(thread.author_id, bookingId, tx)) === thread.org_id, "host booking org");
      ok((await getHostBookingOrg("00000000-0000-0000-0000-000000000000", bookingId, tx)) === null, "another host sees org");
      const none = await listHostNetworkBookings("oad", "00000000-0000-0000-0000-000000000000", { includePast: true }, tx);
      ok(!none.some((x) => x.id === bookingId), "listed for another host");
    });

    await t("paid order flips the booking: awaiting_payment -> awaiting_seller, hold cleared; idempotent", async () => {
      await markBookingPaid(orderId, tx);
      let b = await getBookingByToken(token, tx);
      ok(b?.status === "awaiting_seller" && b.holdExpiresAt === null, JSON.stringify(b?.status));
      await markBookingPaid(orderId, tx);
      b = await getBookingByToken(token, tx);
      ok(b?.status === "awaiting_seller", "second call changed it");
      const l = await listHostNetworkBookings("oad", thread.author_id, {}, tx);
      ok(l.find((x) => x.id === bookingId)?.status === "awaiting_seller", "listing shows paid state");
    });

    await t("guest label: name, else email local part, else Guest; never the address", async () => {
      ok(bookerLabel({ bookerName: "Ana", bookerEmail: "a@b.c" }) === "Ana", "name");
      ok(bookerLabel({ bookerName: null, bookerEmail: "maria.k@example.invalid" }) === "maria.k", "local part");
      ok(bookerLabel({ bookerName: " ", bookerEmail: "@x" }) === "Guest", "guest");
      ok(bookerWho({ bookerName: null, bookerEmail: "ana@example.invalid" }) === "ana · ana@example.invalid", "host text keeps the address");
      const [g] = await tx<Array<{ booker_name: string | null }>>`
        SELECT booker_name FROM bookings WHERE order_id = (SELECT id FROM commerce_order WHERE number = ${"TEST-" + token0}) AND booker_email = 'buyer@example.invalid'`;
      ok(g && g.booker_name === "Test Buyer", "named booking keeps its name");
    });

    await t("abandoned card: existing sweep expires an awaiting_payment network booking past its hold; a live hold is kept", async () => {
      const [o2] = await tx<Array<{ id: string }>>`
        INSERT INTO commerce_order (number, customer_email, status, payment_method, total_minor, metadata)
        VALUES (${"TEST2-" + token0}, 'late@example.invalid', 'pending_payment', 'stripe', 8000, ${tx.json({ networkSale: true })}) RETURNING id`;
      const [o3] = await tx<Array<{ id: string }>>`
        INSERT INTO commerce_order (number, customer_email, status, payment_method, total_minor, metadata)
        VALUES (${"TEST3-" + token0}, 'live@example.invalid', 'pending_payment', 'stripe', 8000, ${tx.json({ networkSale: true })}) RETURNING id`;
      const old = await recordNetworkBooking({ threadId: thread.id, orderId: o2!.id, buyer: { email: "late@example.invalid" }, now: new Date(Date.now() - 3 * 3600_000), tx });
      const live = await recordNetworkBooking({ threadId: thread.id, orderId: o3!.id, buyer: { email: "live@example.invalid" }, tx });
      ok(old.ok === true && live.ok === true, "record");
      if (old.ok !== true || live.ok !== true) return;
      const n = await expireLapsedHolds(tx);
      ok(n >= 1, "swept " + n);
      const st = async (id: string) => (await tx<Array<{ status: string; cancel_reason: string | null }>>`SELECT status, cancel_reason FROM bookings WHERE id = ${id}`)[0]!;
      const a = await st(old.bookingId);
      ok(a.status === "expired" && a.cancel_reason === "hold expired", JSON.stringify(a));
      ok((await st(live.bookingId)).status === "awaiting_payment", "live hold was expired");
      // A payment that still lands for the lapsed one confirms it (money is in): existing behaviour.
      await markBookingPaid(o2!.id, tx);
      ok((await st(old.bookingId)).status === "awaiting_seller", "late payment not honoured");
    });

    await t("order without networkSale metadata is not in the network list", async () => {
      await tx`UPDATE commerce_order SET metadata = '{}'::jsonb WHERE id = ${orderId}`;
      const l = await listHostNetworkBookings("oad", thread.author_id, { includePast: true }, tx);
      ok(!l.some((x) => x.id === bookingId), "listed without networkSale");
    });
    throw new Rollback();
  });
} catch (e) {
  if (!(e instanceof Rollback)) { console.error(e); failures.push("transaction"); }
}

const [left] = await db<Array<{ n: number }>>`SELECT count(*)::int AS n FROM bookings WHERE buyer_token = ${token || "none"}`;
const [leftO] = await db<Array<{ n: number }>>`SELECT count(*)::int AS n FROM booking_offers WHERE thread_id = ${thread.id}`;
await t("rolled back: no booking row, no stub offer persisted", async () => { ok(left!.n === 0 && leftO!.n === 0, `${left!.n}/${leftO!.n}`); });
console.log(`${pass} passed, ${failures.length} failed`);
await db.end({ timeout: 2 });
process.exit(failures.length ? 1 : 0);
