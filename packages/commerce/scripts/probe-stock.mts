/**
 * Edition stock (./src/server/stock.ts, 2026-11-08): orders hold copies, the
 * artwork is reserved/sold only when no copy is left, cancel and expiry give
 * copies back, two buyers cannot both take the last one.
 *
 * Two modes.
 *
 *   default   against the live DB, through the real server functions, inside
 *             ONE transaction that is rolled back at the end: every function's
 *             own db.begin becomes a savepoint on that one connection.
 *             Nothing is committed. Uses an existing active store (STORE_ID).
 *
 *   race      STOCK_RACE_DB=<database name>: real commits, real concurrent
 *             connections, for the last-copy race. Point it at a THROWAWAY
 *             database with the schema loaded; it refuses elkdonis_dev.
 *
 *   cd ~/eac && sudo -n docker compose run --rm --no-deps -e SENDGRID_API_KEY= \
 *     -e STORE_ID=<active store with a payout email> -w /app/packages/commerce admin \
 *     /app/packages/analytics/node_modules/.bin/tsx scripts/probe-stock.mts
 */

import { createRequire } from "node:module";

let pass = 0;
let fail = 0;
const ok = (label: string, cond: boolean, detail: unknown = "") => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label} ${typeof detail === "string" ? detail : JSON.stringify(detail)}`); }
};
async function throws(label: string, fn: () => Promise<unknown>, re: RegExp) {
  try {
    await fn();
    ok(label, false, "did not throw");
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    ok(label, re.test(m), m);
  }
}

const RACE_DB = process.env.STOCK_RACE_DB?.trim() || null;
const postgres = createRequire("/app/packages/db/package.json")("postgres") as typeof import("postgres").default;

// ── harness ──────────────────────────────────────────────────────────────────
let conn: any = null;
if (RACE_DB) {
  if (RACE_DB === "elkdonis_dev") throw new Error("Race mode commits. Give it a throwaway database.");
  process.env.DATABASE_URL = process.env.DATABASE_URL!.replace(/\/[^/?]+(\?|$)/, `/${RACE_DB}$1`);
  process.env.DB_POOL_MAX = "20";
} else {
  const base = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  conn = await base.reserve();
  await conn.unsafe("BEGIN");
  let n = 0;
  const begin = async (fn: (tx: unknown) => Promise<unknown>) => {
    const sp = `probe_sp_${++n}`;
    await conn.unsafe(`SAVEPOINT ${sp}`);
    try {
      const r = await fn(proxy);
      await conn.unsafe(`RELEASE SAVEPOINT ${sp}`);
      return r;
    } catch (e) {
      await conn.unsafe(`ROLLBACK TO SAVEPOINT ${sp}`);
      throw e;
    }
  };
  const proxy: any = new Proxy(function () {}, {
    apply: (_t, _this, args) => conn(...args),
    get: (_t, prop) => {
      if (prop === "begin") return begin;
      const v = conn[prop];
      return typeof v === "function" ? v.bind(conn) : v;
    },
  });
  (globalThis as any).__db = proxy;
}

const { db } = await import("@elkdonis/db");
const S = await import("../src/server/index.ts");

async function state(artworkId: string) {
  const [r] = (await db`
    SELECT a.status, av.id AS variant_id, av.inventory_qty, av.edition_total
    FROM artwork a JOIN artwork_variant av ON av.artwork_id = a.id
    WHERE a.id = ${artworkId}
  `) as any[];
  return r as { status: string; variant_id: string; inventory_qty: number; edition_total: number | null };
}
async function reservations(orderId: string) {
  return (await db`
    SELECT r.status FROM commerce_order_line l
    JOIN reservation r ON r.id::text = l.metadata->>'reservationId'
    WHERE l.order_id = ${orderId}
  `).map((r: any) => r.status as string);
}

async function storeAndOwner(storeId: string) {
  const [s] = (await db`SELECT id, owner_user_id FROM store WHERE id = ${storeId} AND status = 'active'`) as any[];
  if (!s) throw new Error(`No active store ${storeId}`);
  return { storeId: s.id as string, ownerId: s.owner_user_id as string };
}

async function makePiece(storeId: string, ownerId: string, title: string, kind: "original" | "limited_edition", qty: number) {
  const { id } = await S.createArtwork({
    storeId, artistUserId: ownerId, title, kind, priceMinor: 5000, inventoryQty: qty,
    images: [{ url: "https://example.invalid/probe-stock.jpg" }],
  } as any);
  await S.publishArtwork(id, ownerId);
  return id;
}

const buyer = (n: number) => ({ customerEmail: `probe-stock-${n}@example.invalid`, paymentMethod: "etransfer" as const });

async function order(variantId: string, qty: number, n: number) {
  const item = await S.loadVariantItem(variantId, { qty });
  return S.createOrder({ items: [item], ...buyer(n) });
}

// ── rollback mode ────────────────────────────────────────────────────────────
async function rollbackScenarios() {
  const { storeId, ownerId } = await storeAndOwner(process.env.STORE_ID!);
  const pay = (orderId: string) => S.confirmOrderPaid({ orderId, confirmedByUserId: ownerId, method: "etransfer" });

  console.log("\n1. 3-copy edition: buy 1, buy 1, cancel 1, buy 2");
  const ed = await makePiece(storeId, ownerId, "PROBE stock edition", "limited_edition", 3);
  let s = await state(ed);
  ok("edition_total written on create (3)", s.edition_total === 3, s);
  ok("published edition is available", s.status === "available", s);
  const v = s.variant_id;

  const o1 = await order(v, 1, 1);
  await pay(o1.id);
  s = await state(ed);
  ok("buy 1 (paid): 2 on hand, still available", s.inventory_qty === 2 && s.status === "available", s);
  ok("o1 reservation converted", (await reservations(o1.id)).join() === "converted");

  const o2 = await order(v, 1, 2);
  s = await state(ed);
  ok("buy 1 (unpaid): still available (1 left to sell)", s.inventory_qty === 2 && s.status === "available", s);
  ok("o2 holds an active reservation", (await reservations(o2.id)).join() === "active");

  await throws("ordering 2 while 1 is sellable is refused", () => order(v, 2, 9), /Only 1 of/);
  const cart = await S.getOrCreateCart({});
  await throws("addToCart for 2 is refused early", () => S.addToCart({ cartToken: cart.token, artworkVariantId: v, quantity: 2 }), /Only 1 copy is left/);

  await S.cancelOrder({ orderId: o2.id, reason: "probe" });
  s = await state(ed);
  ok("cancel 1: available, 2 on hand", s.inventory_qty === 2 && s.status === "available", s);
  ok("o2 reservation released, o1 untouched", (await reservations(o2.id)).join() === "released" && (await reservations(o1.id)).join() === "converted");

  const o3 = await order(v, 2, 3);
  s = await state(ed);
  ok("buy 2 (unpaid): last copies held → reserved", s.status === "reserved", s);
  await throws("a further order is refused while reserved", () => order(v, 1, 4), /reserved pending payment/);
  await pay(o3.id);
  s = await state(ed);
  ok("buy 2 (paid): 0 on hand → sold", s.inventory_qty === 0 && s.status === "sold", s);
  await throws("a sold-out edition refuses orders", () => order(v, 1, 5), /no longer available/);

  await S.refundOrder({ orderId: o3.id, actorUserId: ownerId, reason: "probe" });
  s = await state(ed);
  ok("refund 2: back on hand, available", s.inventory_qty === 2 && s.status === "available", s);

  console.log("\n2. one-of-a-kind (original, qty 1): unchanged behaviour");
  const one = await makePiece(storeId, ownerId, "PROBE stock original", "original", 1);
  s = await state(one);
  ok("original has no edition_total", s.edition_total === null, s);
  const p1 = await order(s.variant_id, 1, 6);
  ok("order → reserved", (await state(one)).status === "reserved");
  await throws("second order refused", () => order(s.variant_id, 1, 7), /reserved pending payment/);
  await S.cancelOrder({ orderId: p1.id, reason: "probe" });
  ok("cancel → available", (await state(one)).status === "available");

  const p2 = await order(s.variant_id, 1, 8);
  await db`UPDATE commerce_order SET payment_due_at = NOW() - interval '1 minute' WHERE id = ${p2.id}`;
  const released = await S.releaseExpiredOrders();
  const p2s = (await db`SELECT status FROM commerce_order WHERE id = ${p2.id}`)[0] as any;
  ok("expiry cancels the lapsed order", released >= 1 && p2s.status === "cancelled", { released, p2s });
  ok("expiry → available", (await state(one)).status === "available");

  const p3 = await order(s.variant_id, 1, 9);
  await pay(p3.id);
  s = await state(one);
  ok("pay → sold, 0 on hand", s.status === "sold" && s.inventory_qty === 0, s);
  await S.refundOrder({ orderId: p3.id, actorUserId: ownerId, reason: "probe" });
  s = await state(one);
  ok("refund → available, 1 on hand", s.status === "available" && s.inventory_qty === 1, s);

  console.log("\n3. setArtworkAvailability + edition_total on update");
  await throws("a stranger cannot set availability", () => S.setArtworkAvailability(one, "00000000-0000-0000-0000-000000000000", "sold"), /Artwork not found/);
  await S.setArtworkAvailability(one, ownerId, "sold");
  ok("seller marks sold", (await state(one)).status === "sold");
  await S.setArtworkAvailability(one, ownerId, "reserved");
  ok("seller marks reserved", (await state(one)).status === "reserved");
  await S.setArtworkAvailability(one, ownerId, "available");
  ok("seller marks available", (await state(one)).status === "available");
  const p4 = await order((await state(one)).variant_id, 1, 10);
  await pay(p4.id);
  await throws("available refused with no copy left", () => S.setArtworkAvailability(one, ownerId, "available"), /No copies are left/);
  await throws("a bad value is refused", () => S.setArtworkAvailability(one, ownerId, "draft" as any), /available, reserved or sold/);

  await S.updateArtwork(one, ownerId, { kind: "limited_edition", editionTotal: 10 } as any);
  ok("edition_total written on update (10)", (await state(one)).edition_total === 10);
  await S.updateArtwork(one, ownerId, { priceMinor: 6000 } as any);
  ok("a price edit keeps edition_total", (await state(one)).edition_total === 10);
  await S.updateArtwork(one, ownerId, { kind: "original" } as any);
  ok("back to original clears edition_total", (await state(one)).edition_total === null);
}

// ── race mode ────────────────────────────────────────────────────────────────
async function race() {
  const { storeId, ownerId } = await storeAndOwner(process.env.STORE_ID!);
  const N = 8;

  console.log(`\nR1. ${N} concurrent orders for a one-of-a-kind piece`);
  const one = await makePiece(storeId, ownerId, "RACE original", "original", 1);
  const v1 = (await state(one)).variant_id;
  const r1 = await Promise.allSettled(Array.from({ length: N }, (_, i) => order(v1, 1, 100 + i)));
  const won1 = r1.filter((r) => r.status === "fulfilled").length;
  ok(`exactly one order wins (got ${won1})`, won1 === 1, r1.filter((r) => r.status === "rejected").map((r: any) => r.reason?.message).slice(0, 2));
  ok("piece is reserved", (await state(one)).status === "reserved");

  console.log(`\nR2. 3-copy edition: 2 sold, then ${N} concurrent orders for the last copy`);
  const ed = await makePiece(storeId, ownerId, "RACE edition", "limited_edition", 3);
  const v2 = (await state(ed)).variant_id;
  for (let i = 0; i < 2; i++) {
    const o = await order(v2, 1, 200 + i);
    await S.confirmOrderPaid({ orderId: o.id, confirmedByUserId: ownerId, method: "etransfer" });
  }
  ok("1 copy on hand, available", (await state(ed)).inventory_qty === 1 && (await state(ed)).status === "available");
  const r2 = await Promise.allSettled(Array.from({ length: N }, (_, i) => order(v2, 1, 300 + i)));
  const winners = r2.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<{ id: string }>[];
  ok(`exactly one order wins the last copy (got ${winners.length})`, winners.length === 1);
  ok("edition is reserved", (await state(ed)).status === "reserved");
  const [h] = (await db`
    SELECT COUNT(*)::int AS n FROM commerce_order_line l JOIN commerce_order o ON o.id = l.order_id
    WHERE l.artwork_variant_id = ${v2} AND o.status = 'awaiting_etransfer'
  `) as any[];
  ok("one unpaid hold in the DB", h.n === 1, h);

  console.log("\nR3. concurrent pay + new order on the same edition do not deadlock");
  await Promise.allSettled([
    S.confirmOrderPaid({ orderId: winners[0]!.value.id, confirmedByUserId: ownerId, method: "etransfer" }),
    order(v2, 1, 400),
  ]);
  const s = await state(ed);
  ok("paid last copy → sold, 0 on hand", s.status === "sold" && s.inventory_qty === 0, s);
}

try {
  if (RACE_DB) await race();
  else await rollbackScenarios();
} catch (e) {
  fail++;
  console.error("probe crashed:", e);
} finally {
  if (conn) {
    await conn.unsafe("ROLLBACK");
    console.log("\n(rolled back; nothing committed)");
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  // Fire-and-forget emails (skipped without a key) may still be settling.
  setTimeout(() => process.exit(fail ? 1 : 0), 500);
}
