// Content-library checkout checks against elkdonis_dev. Run in a throwaway container with a READ-ONLY session:
//   DATABASE_URL='<url>?default_transaction_read_only=on' node .../tsx/dist/cli.mjs scripts/check-checkout.mts   (cwd packages/content)
// Writes: none. The script refuses to run unless `transaction_read_only` is on. Stripe is a stub that records its
// input and never calls out; order creation is a stub except the commerce refusal and read-only-insert checks
// (which a read-only session turns into a failed INSERT, proving every earlier rule passed). Exits 1 on failure.
import { db } from "@elkdonis/db";
import { createThreadOrder } from "@elkdonis/commerce/server";
import { defaultHost } from "../src/host";
import { checkReturnTo, clientIpOf, contentCheckoutRoutes, doneSurfaceFor, finishContentCheckout, isOwnHost, memoryRateLimiter, offerSurfaceFor, redisRateLimiter, startContentCheckout, type ContentPayments } from "../src/server/checkout";
import { resolveContentRefs, searchContent } from "../src/server/search";
import { chargeOfThreadRow, threadChargeFor } from "../src/server/offers";
import { parseDescriptor } from "../../cms-ui/src/surface/url";
import { offerProps } from "../../cms-ui/src/offer-surface/descriptor";

let pass = 0;
const failures: string[] = [];
async function t(name: string, fn: () => Promise<void> | void) {
  try { await fn(); pass++; console.log("ok   ", name); } catch (e) { failures.push(name); console.log("FAIL ", name, "\n      ", (e as Error).message); }
}
const ok = (c: unknown, m: string) => { if (!c) throw new Error(m); };

const ro = (await db`SHOW transaction_read_only`)[0]!.transaction_read_only;
if (ro !== "on") { console.error("Refusing to run: session is not read-only."); process.exit(2); }

const stripeCalls: Array<Record<string, unknown>> = [];
const payments: ContentPayments = {
  isCardPaymentAvailable: () => true,
  startStripeCheckout: async (i) => { stripeCalls.push(i); return { url: "https://stub.invalid/pay" }; },
  syncStripeOrder: async (id) => { syncCalls.push(id); return null; },
};
const syncCalls: string[] = [];
const host = { ...defaultHost(), site: { ...defaultHost().site, domain: "pottery.arts-collective.com" } };
const origin = "https://pottery.arts-collective.com";
const readable = async (_v: unknown, keys: string[]) => ({ results: keys.map((key) => ({ key }) as never), missing: [] as string[] });
const ctx = (orders = {}) => ({ host, payments, origin, orders, resolve: readable as never, limiter: async () => true });

const [dom] = await db<Array<{ domain: string }>>`SELECT domain FROM org_domains LIMIT 1`;
const [org] = await db<Array<{ slug: string }>>`SELECT slug FROM organizations WHERE slug IS NOT NULL LIMIT 1`;

await t("hosts: site domain, org_domains and <slug>.<network host> accepted; forged hosts refused", async () => {
  ok(await isOwnHost("pottery.arts-collective.com", host), "site domain");
  ok(dom && (await isOwnHost(dom.domain, host)), "org_domains " + dom?.domain);
  const net = (process.env.NEXT_PUBLIC_NETWORK_HOST ?? "localhost:3007").replace(/:\d+$/, "");
  ok(org && (await isOwnHost(`${org.slug}.${net}`, host)), "slug host");
  for (const h of ["evil.example", "pottery.arts-collective.com.evil.example", "nonexistent-zz.arts-collective.example", "a@b.com", "x/y", ""]) ok(!(await isOwnHost(h, host)), "accepted " + h);
});
await t("returnTo: strangers, schemes and credentials refused; our hosts accepted", async () => {
  ok(await checkReturnTo("https://pottery.arts-collective.com/x?y=1", host), "own host");
  for (const u of ["https://evil.example/x", "javascript:alert(1)", "//evil.example", "/relative", "https://a:b@pottery.arts-collective.com/", "https://pottery.arts-collective.com.evil.example/"]) {
    ok((await checkReturnTo(u, host)) === null, "accepted " + u);
  }
});

const base = { key: "thread:NOPE", returnTo: origin + "/" };
await t("refusals before any order: bad key, bad returnTo, slot, quantity, guest email, no card", async () => {
  const r = (x: object, c = ctx()) => startContentCheckout(null, { ...base, email: "a@b.co", ...x } as never, c, "1.1.1.1");
  ok((await r({ key: "file:1" })).ok === false, "key");
  ok((await r({ returnTo: "https://evil.example/" })).ok === false, "returnTo");
  ok((await r({ slotId: "s" })).ok === false, "slot");
  ok((await r({ quantity: 0 })).ok === false, "qty0");
  ok((await r({ quantity: 99 })).ok === false, "qty99");
  ok((await r({ email: "nope" })).ok === false, "email");
  ok((await r({}, { ...ctx(), payments: { ...payments, isCardPaymentAvailable: () => false } })).ok === false, "no card");
  ok((await r({}, { ...ctx(), resolve: (async () => ({ results: [{ key: "thread:NOPE", gone: true }], missing: [] })) as never })).ok === false, "gone key refused");
  ok(stripeCalls.length === 0, "stripe untouched");
});

const [svc] = await db<Array<{ id: string; org_id: string; kind: string }>>`
  SELECT t.id, t.org_id, t.kind FROM threads t
  LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
  WHERE t.status = 'published' AND t.visibility = 'PUBLIC' AND t.kind IN ('service','event','workshop')
    AND COALESCE(wp.price_member, t.price, 0) > 0 AND COALESCE(wp.registration_status,'open') = 'open'
    AND t.org_id <> 'oad' AND NOT EXISTS (SELECT 1 FROM booking_offers b WHERE b.thread_id = t.id AND b.status='open')
  LIMIT 1`;
console.log("sample priced thread:", svc ? `${svc.id} org=${svc.org_id} kind=${svc.kind}` : "none");

if (svc) {
  await t("thread of another org: order made as seller oad / networkSale, Stripe stub gets return URLs", async () => {
    let seen: Record<string, unknown> = {};
    const booked: Array<Record<string, unknown>> = [];
    const r = await startContentCheckout(null, { key: `thread:${svc.id}`, returnTo: origin + "/offer", email: "buyer@example.test", quantity: 2 }, ctx({
      createThreadOrder: async (i: Record<string, unknown>) => { seen = i; return { id: "11111111-1111-1111-1111-111111111111" }; },
      recordNetworkBooking: async (i: Record<string, unknown>) => { booked.push(i); return { ok: true, bookingId: "b1", token: "t", status: "awaiting_payment", holdExpiresAt: null, existing: false }; },
    }), "1.1.1.1");
    ok(r.ok === true, JSON.stringify(r));
    // Kind service: a booking is recorded after the order, linked to it (the booking module's own tests cover the rows).
    ok(booked.length === (svc.kind === "service" ? 1 : 0), "booking calls " + booked.length);
    if (booked[0]) ok(booked[0].orderId === "11111111-1111-1111-1111-111111111111" && booked[0].threadId === svc.id, JSON.stringify(booked[0]));
    ok(seen.networkSale === true && seen.orgId === "oad" && seen.threadId === svc.id && seen.quantity === 2 && seen.paymentMethod === "stripe", JSON.stringify(seen));
    const s = stripeCalls.at(-1)!;
    ok(String(s.successUrl).startsWith(`${origin}/api/content/checkout/return?order=1111`), "success " + s.successUrl);
    ok(String(s.successUrl).includes(encodeURIComponent(origin + "/offer")), "to in success");
    // Cancel goes back to the OFFER layer (never Done), with the cancelled line's flag.
    const cu = new URL(String(s.cancelUrl));
    ok(cu.origin + cu.pathname === origin + "/offer" && cu.searchParams.get("payment") === "cancelled", "cancel " + s.cancelUrl);
    ok(cu.searchParams.get("surface") === offerSurfaceFor(svc.kind === "event" ? "event" : "service", `thread:${svc.id}`), "cancel surface " + cu.searchParams.get("surface"));
    ok(String(s.successUrl).includes("&key=" + encodeURIComponent(`thread:${svc.id}`)), "key in success " + s.successUrl);
    ok(s.idempotencyKey === "order-11111111-1111-1111-1111-111111111111", "idempotency " + s.idempotencyKey);
  });
  if (svc.kind === "service") {
    await t("service: Stripe failure releases the booking; a booking refusal opens no card session", async () => {
      const released: string[] = [];
      const before = stripeCalls.length;
      const failingPay: ContentPayments = { ...payments, startStripeCheckout: async () => { throw new Error("stripe down"); } };
      const base = { createThreadOrder: async () => ({ id: "22222222-2222-2222-2222-222222222222" }),
        recordNetworkBooking: async () => ({ ok: true, bookingId: "b2", token: "t", status: "awaiting_payment", holdExpiresAt: null, existing: false }),
        releaseBooking: async (id: string) => { released.push(id); } };
      const r1 = await startContentCheckout(null, { key: `thread:${svc.id}`, returnTo: origin + "/offer", email: "buyer@example.test" }, { ...ctx(base), payments: failingPay } as never, "1.1.1.2");
      ok(r1.ok === false && released.join() === "b2", "release " + released.join() + JSON.stringify(r1));
      const r2 = await startContentCheckout(null, { key: `thread:${svc.id}`, returnTo: origin + "/offer", email: "buyer@example.test" }, ctx({ ...base, recordNetworkBooking: async () => ({ ok: false, error: "no" }) }) as never, "1.1.1.3");
      ok(r2.ok === false && stripeCalls.length === before, "stripe called after booking refusal");
    });
  }
  await t("commerce: networkSale passes every rule up to the INSERT (read-only session rejects it)", async () => {
    let msg = "";
    try { await createThreadOrder({ orgId: "oad", networkSale: true, threadId: svc.id, customerEmail: "buyer@example.test", paymentMethod: "stripe" }); }
    catch (e) { msg = (e as Error).message; }
    ok(/read-only/i.test(msg) || /payouts|card payments only/i.test(msg), "unexpected: " + msg);
    console.log("      ->", msg.slice(0, 120));
  });
  await t("commerce: the same thread WITHOUT networkSale under org oad is still refused (rule unchanged)", async () => {
    let msg = "";
    try { await createThreadOrder({ orgId: "oad", threadId: svc.id, customerEmail: "buyer@example.test", paymentMethod: "stripe" }); } catch (e) { msg = (e as Error).message; }
    ok(/not available to buy here/.test(msg), msg);
  });
  await t("commerce: networkSale still refuses sliding outside range / unknown thread", async () => {
    let m1 = "", m2 = "";
    try { await createThreadOrder({ orgId: "oad", networkSale: true, threadId: "ZZZZZZZZZZZZZZZZZZZZZ", customerEmail: "a@b.co", paymentMethod: "stripe" }); } catch (e) { m1 = (e as Error).message; }
    ok(/not available/.test(m1), m1);
    try { await createThreadOrder({ orgId: "oad", networkSale: true, threadId: svc.id, customerEmail: "a@b.co", paymentMethod: "stripe", amountMinor: 1 }); } catch (e) { m2 = (e as Error).message; }
    ok(/sliding/i.test(m2), m2);
  });
}

await t("return: syncs the order and redirects to `to` with the Done layer; bad `to` falls back to the origin", async () => {
  const oid = "22222222-2222-2222-2222-222222222222";
  const key = "thread:abc_123";
  const good = await finishContentCheckout(new Request(`https://pottery.arts-collective.com/api/content/checkout/return?order=${oid}&k=event&key=${encodeURIComponent(key)}&to=${encodeURIComponent(origin + "/offer")}`, { headers: { host: "pottery.arts-collective.com" } }), { payments, origin, host });
  const loc = good.headers.get("location")!;
  ok(good.status === 303 && loc.startsWith(origin + "/offer") && loc.includes("paid=1"), loc);
  // The Done value is one the surface URL parser reads, and it round-trips to the same layer, key and flow.
  const sv = new URL(loc).searchParams.get("surface")!;
  ok(sv === `offer:done:${encodeURIComponent(key)}:evt` && sv === doneSurfaceFor("event", key), "surface " + sv);
  const pd = parseDescriptor(sv); const pp = pd && pd.type === "custom" ? offerProps(pd as never) : null;
  ok(pp?.layer === "done" && pp.key === key && pp.ctx?.flow === "evt", "parser read " + JSON.stringify(pp));
  // The page's own returnTo surface is kept as it is; a stale payment=cancelled is dropped.
  const own = `offer:done:${encodeURIComponent("thread:zz9")}:svc`;
  const kept = await finishContentCheckout(new Request(`https://pottery.arts-collective.com/api/content/checkout/return?order=${oid}&k=service&key=thread%3Azz9&to=${encodeURIComponent(origin + "/offer?surface=" + encodeURIComponent(own) + "&payment=cancelled")}`, { headers: { host: "pottery.arts-collective.com" } }), { payments, origin, host });
  const kl = new URL(kept.headers.get("location")!);
  ok(kl.searchParams.get("surface") === own && !kl.searchParams.has("payment") && kl.searchParams.get("paid") === "1", kept.headers.get("location")!);
  // A hostile or missing key writes no surface at all.
  const nokey = await finishContentCheckout(new Request(`https://pottery.arts-collective.com/api/content/checkout/return?order=${oid}&k=service&key=%3Cscript%3E&to=${encodeURIComponent(origin + "/offer?surface=junk")}`, { headers: { host: "pottery.arts-collective.com" } }), { payments, origin, host });
  ok(!new URL(nokey.headers.get("location")!).searchParams.has("surface"), nokey.headers.get("location")!);
  ok(syncCalls.includes(oid), "synced");
  const bad = await finishContentCheckout(new Request(`https://pottery.arts-collective.com/api/content/checkout/return?order=${oid}&to=${encodeURIComponent("https://evil.example/")}`, { headers: { host: "pottery.arts-collective.com" } }), { payments, origin, host });
  ok(!bad.headers.get("location")!.includes("evil"), bad.headers.get("location")!);
});

// ── route-level: A (forged host), B (CSRF), C (limiter) ────────────────────
const post = (hdrs: Record<string, string>, body: unknown = { key: "thread:NOPE", returnTo: origin + "/", email: "a@b.co" }) =>
  new Request("https://pottery.arts-collective.com/api/content/checkout", { method: "POST", headers: hdrs, body: typeof body === "string" ? body : JSON.stringify(body) });
const routes = contentCheckoutRoutes({ ...host, viewer: async () => null }, payments, async () => true);
const J = { "content-type": "application/json", host: "pottery.arts-collective.com" };
await t("A: forged Host / X-Forwarded-Host (not ours) -> 400 on checkout and return; no Stripe", async () => {
  const before = stripeCalls.length;
  for (const h of [{ ...J, host: "evil.example" }, { ...J, "x-forwarded-host": "evil.example" }, { ...J, "x-forwarded-host": "pottery.arts-collective.com.evil.example" }]) {
    const res = await routes.checkout(post(h));
    ok(res.status === 400, "checkout status " + res.status);
  }
  const ret = await routes.checkoutReturn(new Request("https://x/api/content/checkout/return?order=22222222-2222-2222-2222-222222222222&to=" + encodeURIComponent("https://evil.example/"), { headers: { "x-forwarded-host": "evil.example" } }));
  ok(ret.status === 400, "return status " + ret.status);
  ok(stripeCalls.length === before, "stripe untouched");
});
await t("B: non-JSON content-type -> 403; foreign Origin -> 403; our Origin passes the gate", async () => {
  ok((await routes.checkout(post({ ...J, "content-type": "application/x-www-form-urlencoded" }))).status === 403, "form post");
  ok((await routes.checkout(post({ ...J, "content-type": "text/plain" }))).status === 403, "text/plain");
  ok((await routes.checkout(post({ ...J, origin: "https://evil.example" }))).status === 403, "foreign origin");
  ok((await routes.checkout(post({ ...J, origin: "null" }))).status === 403, "null origin");
  const good = await routes.checkout(post({ ...J, origin: "https://pottery.arts-collective.com" }));
  ok(good.status !== 403 && good.status !== 400 || (await good.clone().json()).error !== undefined, "own origin reached startContentCheckout: " + good.status);
  ok((await routes.checkout(new Request("https://pottery.arts-collective.com/api/content/checkout", { method: "GET", headers: J }))).status === 405, "GET refused");
});
await t("C: limiter refuses past the limit (per IP and per email); redis limiter INCR+EXPIRE and fails open", async () => {
  const lim = memoryRateLimiter;
  const key = "test:" + Math.random();
  const got: boolean[] = [];
  for (let i = 0; i < 12; i++) got.push(await lim(key, 10, 600));
  ok(got.slice(0, 10).every(Boolean) && !got[10] && !got[11], JSON.stringify(got));
  // the adapter itself, per IP and per email
  const hits: string[] = [];
  const counting = async (k: string, limit: number) => { hits.push(k); return !k.startsWith("e:") || hits.filter((x) => x === k).length <= limit; };
  let last: unknown;
  for (let i = 0; i < 7; i++) last = await startContentCheckout(null, { key: "thread:NOPE", returnTo: origin + "/", email: "same@example.test" }, { ...ctx(), limiter: counting }, "9.9.9.9");
  ok((last as { error: string }).error.startsWith("Too many"), JSON.stringify(last));
  ok(hits.includes("ip:9.9.9.9") && hits.includes("e:same@example.test"), JSON.stringify(hits.slice(0, 3)));
  const calls: string[] = [];
  const fake = { incr: async (k: string) => { calls.push("incr " + k); return calls.length; }, expire: async (k: string, s: number) => { calls.push(`expire ${k} ${s}`); } };
  ok((await redisRateLimiter(fake)("k", 1, 600)) === true && calls[1]?.startsWith("expire rl:content-checkout:k 600"), JSON.stringify(calls));
  const down = redisRateLimiter({ incr: async () => { throw new Error("down"); }, expire: async () => {} });
  ok((await down("k", 1, 60)) === true, "fail open");
  ok(clientIpOf(new Request("https://x", { headers: { "x-forwarded-for": "6.6.6.6, 7.7.7.7" } })) === "7.7.7.7", "last XFF entry");
});

const [multi] = await db<Array<{ id: string }>>`
  SELECT a.id FROM artwork a JOIN artwork_variant v ON v.artwork_id = a.id AND v.inventory_qty > 0
  JOIN store s ON s.id = a.store_id AND s.status = 'active'
  WHERE a.status = 'available' GROUP BY a.id HAVING COUNT(*) > 1 LIMIT 1`;
console.log("sample multi-variant artwork:", multi?.id ?? "none");
if (multi) {
  await t("D: artwork with several sellable variants -> hand-off to the market page, no order made", async () => {
    let made = 0;
    const r = await startContentCheckout(null, { key: `artwork:${multi.id}`, returnTo: origin + "/", email: "a@b.co" }, ctx({
      createOrder: async () => { made++; return { id: "x" }; }, loadVariantItem: async () => { made++; return {}; },
    }), "2.2.2.2");
    ok(r.ok && (r as { handoff?: boolean }).handoff === true && r.url.endsWith(`/artworks/${multi.id}`) && made === 0, JSON.stringify(r));
  });
}

// ── the REAL rights check (no `resolve` stub): a service, an event and an artwork reach Stripe's stub ──────────
type Pick = { key: string; type: string };
const pickThread = async (type: string, priced = true): Promise<Pick | undefined> => (await db<Pick[]>`
  SELECT ci.key, ci.type FROM content_index ci
  WHERE ci.store = 'thread' AND ci.type = ${type} AND ci.status = 'published' AND ci.visibility = 'PUBLIC' AND NOT ci.hidden
    AND (NOT ${priced} OR COALESCE(ci.price_minor, 0) > 0)
    AND NOT EXISTS (SELECT 1 FROM booking_offers b WHERE b.thread_id = ci.id AND b.status = 'open')
  ORDER BY ci.key LIMIT 1`)[0];
const pickService = await pickThread("service");
const pickEvent = (await pickThread("event", false)) ?? (await pickThread("workshop", false)) ?? (await pickThread("meeting", false));
const [pickArt] = await db<Array<{ id: string }>>`
  SELECT a.id FROM artwork a JOIN store s ON s.id = a.store_id AND s.status = 'active'
  JOIN content_index ci ON ci.key = 'artwork:' || a.id::text AND ci.status = 'published' AND ci.visibility = 'PUBLIC' AND NOT ci.hidden AND COALESCE(ci.sale_state, 'for_sale') = 'for_sale'
  WHERE a.status = 'available' AND (SELECT count(*) FROM artwork_variant v WHERE v.artwork_id = a.id AND v.inventory_qty > 0) = 1
  ORDER BY a.id LIMIT 1`;
console.log("real-rights samples:", pickService?.key ?? "no service", pickEvent?.key ?? "no event", pickArt ? "artwork:" + pickArt.id : "no artwork");

const realCtx = (orders = {}) => ({ host, payments, origin, orders, limiter: async () => true }); // NO resolve: the real rights check
const fakeOrders = {
  createThreadOrder: async () => ({ id: "33333333-3333-3333-3333-333333333333" }),
  createOrder: async () => ({ id: "44444444-4444-4444-4444-444444444444" }),
  recordNetworkBooking: async () => ({ ok: true, bookingId: "b3", token: "t", status: "awaiting_payment", holdExpiresAt: null, existing: false }),
  releaseBooking: async () => {},
  shippingRequired: async () => false,
};
async function realPay(key: string) {
  const before = stripeCalls.length;
  const r = await startContentCheckout(null, { key, returnTo: origin + "/offer?surface=" + encodeURIComponent(`offer:done:${encodeURIComponent(key)}:svc`), email: "buyer@example.test" }, realCtx(fakeOrders) as never, "5.5.5." + Math.floor(Math.random() * 200));
  return { r, called: stripeCalls.length - before };
}
if (pickService) {
  await t("REAL rights: a published public SERVICE resolves with offers, is gone without it, and reaches the Stripe stub", async () => {
    const withOffers = await resolveContentRefs(null, [pickService.key], host, { noDrain: true, offers: true });
    ok(!("gone" in withOffers.results[0]!), "service gone even with offers");
    const without = await resolveContentRefs(null, [pickService.key], host, { noDrain: true });
    ok("gone" in without.results[0]!, "service visible to the ordinary resolve (view not widened)");
    const { r, called } = await realPay(pickService.key);
    ok(r.ok === true && called === 1, JSON.stringify(r));
    const s = stripeCalls.at(-1)!;
    ok(new URL(String(s.cancelUrl)).searchParams.get("surface") === offerSurfaceFor("service", pickService.key), "cancel " + s.cancelUrl);
  });
  await t("REAL rights: the published and all search views still show no service (not widened)", async () => {
    for (const view of ["published", "all"] as const) {
      const res = await searchContent(null, { scope: { kind: "network" }, view, limit: 100 } as never, host, { noDrain: true });
      ok(!res.items.some((i) => i.key === pickService.key), view + " view shows a service");
    }
  });
} else console.log("no priced public service in the index to test against");
const [hiddenSvc] = await db<Array<{ key: string }>>`
  SELECT key FROM content_index WHERE store = 'thread' AND type = 'service' AND (status <> 'published' OR visibility <> 'PUBLIC' OR hidden) LIMIT 1`;
if (hiddenSvc) {
  await t("REAL rights: an unpublished, non-public or hidden service stays unavailable to a stranger even with offers", async () => {
    const res = await resolveContentRefs(null, [hiddenSvc.key], host, { noDrain: true, offers: true });
    ok("gone" in res.results[0]!, "stranger resolved " + hiddenSvc.key);
    const { r, called } = await realPay(hiddenSvc.key);
    ok(r.ok === false && called === 0, JSON.stringify(r));
  });
} else console.log("no non-public service row to test against");
if (pickEvent) {
  await t("REAL rights: a published public EVENT reaches the Stripe stub; cancel returns to evt-offer", async () => {
    const { r, called } = await realPay(pickEvent.key);
    ok(r.ok === true && called === 1, JSON.stringify(r));
    ok(new URL(String(stripeCalls.at(-1)!.cancelUrl)).searchParams.get("surface") === offerSurfaceFor("event", pickEvent.key), "cancel " + stripeCalls.at(-1)!.cancelUrl);
  });
} else console.log("no priced public event in the index to test against");
if (pickArt) {
  await t("REAL rights: a for-sale ARTWORK reaches the Stripe stub (variant loaded for real, order stubbed)", async () => {
    const { r, called } = await realPay(`artwork:${pickArt.id}`);
    ok(r.ok === true && called === 1, JSON.stringify(r));
    ok(new URL(String(stripeCalls.at(-1)!.cancelUrl)).searchParams.get("surface") === offerSurfaceFor("artwork", `artwork:${pickArt.id}`), "cancel " + stripeCalls.at(-1)!.cancelUrl);
  });
} else console.log("no single-variant for-sale artwork to test against");
await t("cancel and done values parse to the offer layer and Done", () => {
  const key = "thread:Ab_9";
  const c = parseDescriptor(offerSurfaceFor("service", key)); const cp = c && c.type === "custom" ? offerProps(c as never) : null;
  ok(cp?.layer === "svc-offer" && cp.key === key, "cancel parsed " + JSON.stringify(cp));
  for (const [k, flow] of [["event", "evt"], ["service", "svc"], ["artwork", "art"]] as const) {
    const d = parseDescriptor(doneSurfaceFor(k, key)); const dp = d && d.type === "custom" ? offerProps(d as never) : null;
    ok(dp?.layer === "done" && dp.ctx?.flow === flow, k + " done parsed " + JSON.stringify(dp));
  }
});

// ── price: what the page shows is what commerce charges ────────────────────
await t("price: chargeOfThreadRow follows commerce (price_member first, CAD default, sliding range, no price = null)", () => {
  const c = chargeOfThreadRow({ price_member: "40", price: "50", currency: null, price_sliding_min: "20" });
  ok(c?.amountMinor === 4000 && c.currency === "CAD" && c.sliding?.minMinor === 2000 && c.sliding.maxMinor === 4000, JSON.stringify(c));
  ok(chargeOfThreadRow({ price_member: null, price: "12.5", currency: "usd", price_sliding_min: null })?.amountMinor === 1250, "threads.price fallback");
  ok(chargeOfThreadRow({ price_member: "0", price: "50", currency: "CAD", price_sliding_min: null }) === null, "member price 0 wins, like commerce");
  ok(chargeOfThreadRow({ price_member: null, price: null, currency: "CAD", price_sliding_min: null }) === null, "no price");
});
await t("price: threadChargeFor agrees with the index for every priced thread sampled", async () => {
  const rows = await db<Array<{ id: string; price_minor: string; currency: string }>>`
    SELECT id, price_minor::text, currency FROM content_index WHERE store = 'thread' AND price_minor > 0 ORDER BY key LIMIT 25`;
  ok(rows.length > 0, "no priced thread in the index");
  for (const r of rows) {
    const c = await threadChargeFor(`thread:${r.id}`);
    ok(c && String(c.amountMinor) === r.price_minor && c.currency === r.currency.toUpperCase(), `${r.id}: ${JSON.stringify(c)} vs index ${r.price_minor} ${r.currency}`);
  }
  ok((await threadChargeFor("thread:NOPE_NOT_THERE")) === null, "unknown thread");
  ok((await threadChargeFor("thread:a b")) === null, "malformed id");
  console.log("      -> checked", rows.length, "priced threads");
});

console.log(`\n${pass} passed, ${failures.length} failed`);
await db.end();
process.exit(failures.length ? 1 : 0);
