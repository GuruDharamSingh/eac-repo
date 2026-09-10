/**
 * End-to-end exercise of the marketplace order/auction/store lifecycle against
 * a LIVE database, through the real server functions. Creates its own
 * fixtures and removes every row it made, so it can run against dev.
 *
 * Deliberately not a unit test: several "complete" features here have had
 * zero rows for months, and the bugs that bit were all at the seams (joins
 * on nullable owners, indentation-mangled edits that tsc was happy with).
 *
 * Run from the repo root inside a container that can reach postgres:
 *
 *   docker compose exec -T -e SENDGRID_API_KEY= -e E2E_MARKETPLACE=1 \
 *     -e STRIPE_SECRET_KEY=sk_test_dummy -e STRIPE_WEBHOOK_SECRET=whsec_dummy art-auction sh -c \
 *     "cd /app/packages/commerce && \
 *      node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/e2e-marketplace.ts"
 *
 * The dummy Stripe keys let the webhook leg run: events are signed locally
 * with the same secret, and nothing here calls the Stripe API.
 *
 * Emails are fired non-blocking by order creation; blank SENDGRID_API_KEY so
 * they are skipped. Uses the existing org `saw` (owner: steph) for the org
 * store, as the migration-095 verification did.
 */

import { randomUUID } from "node:crypto";
import { db } from "@elkdonis/db";
import {
  addStoreMember,
  addToCart,
  applyForStore,
  approveStore,
  cancelLot,
  cancelOrder,
  confirmOrderPaid,
  createArtwork,
  createLot,
  createOrderFromCart,
  getBalance,
  getOrCreateCart,
  openOrgStore,
  placeBid,
  presentArtwork,
  unpresentArtwork,
  isPresentedBy,
  publishArtwork,
  refundOrder,
  releaseExpiredOrders,
  settleExpiredLots,
  updateStore,
} from "../src/server";
import { canActForOrder } from "../src/server/access";
import { handleStripeWebhook } from "../../checkout/src/server/stripe";
import { getStripeProvider } from "../../payments/src";
import {
  getArtworkForEdit,
  getOrderById,
  getStore,
  listOrdersForStore,
  listStoresForUser,
  listStoreFrontArtworks,
  getOrderLines,
} from "../src/queries";

if (process.env.E2E_MARKETPLACE !== "1") {
  console.error("Refusing to run without E2E_MARKETPLACE=1 (it writes to the database).");
  process.exit(2);
}

type Row = Record<string, unknown>;
const ORG_STORE_OWNER_ORG = "saw";
const MARKET = "market";
const tag = randomUUID().slice(0, 8);

let passed = 0;
function check(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  passed++;
  console.log(`  ok  ${msg}`);
}
async function expectThrow(fn: () => Promise<unknown>, re: RegExp, msg: string) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof Error && re.test(e.message)) return check(true, msg);
    throw new Error(`FAIL: ${msg} — threw the wrong thing: ${(e as Error).message}`);
  }
  throw new Error(`FAIL: ${msg} — did not throw`);
}

const made = {
  users: [] as string[],
  userOrgs: [] as Array<[string, string]>,
  stores: [] as string[],
  artworks: [] as string[],
  carts: [] as string[],
  orders: [] as string[],
  lots: [] as string[],
};

async function makeUser(name: string, opts: { payoutEmail?: string | null } = {}) {
  const id = randomUUID();
  await db`
    INSERT INTO users (id, auth_user_id, email, display_name, slug, entity_type, payout_email)
    VALUES (${id}, ${id}, ${`e2e-${name}-${tag}@example.invalid`}, ${`E2E ${name} ${tag}`},
            ${`e2e-${name}-${tag}`}, 'person', ${opts.payoutEmail ?? null})
  `;
  made.users.push(id);
  return id;
}

async function baseline() {
  const [r] = (await db`
    SELECT
      (SELECT COUNT(*) FROM store)::int AS store,
      (SELECT COUNT(*) FROM artwork)::int AS artwork,
      (SELECT COUNT(*) FROM cart)::int AS cart,
      (SELECT COUNT(*) FROM commerce_order)::int AS orders,
      (SELECT COUNT(*) FROM payout)::int AS payout,
      (SELECT COUNT(*) FROM payout_ledger)::int AS ledger,
      (SELECT COUNT(*) FROM auction_lot)::int AS lots,
      (SELECT COUNT(*) FROM bid)::int AS bids
  `) as unknown as Row[];
  return r!;
}

async function main() {
  const before = await baseline();
  console.log("baseline", before);

  // ── fixtures ──────────────────────────────────────────────────────────────
  const maker = await makeUser("maker", { payoutEmail: `pay-${tag}@example.invalid` });
  const cardOnly = await makeUser("cardonly"); // stripe account, no eTransfer address
  const buyer = await makeUser("buyer");
  const bidder2 = await makeUser("bidder2");
  for (const u of [maker, cardOnly]) {
    await db`INSERT INTO user_organizations (user_id, org_id, role) VALUES (${u}, ${ORG_STORE_OWNER_ORG}, 'member')`;
    made.userOrgs.push([u, ORG_STORE_OWNER_ORG]);
  }
  await db`UPDATE users SET stripe_account_id = ${"acct_e2e_" + tag}, stripe_onboarded_at = NOW() WHERE id = ${cardOnly}`;
  const [steph] = (await db`
    SELECT uo.user_id FROM user_organizations uo JOIN users u ON u.id = uo.user_id
    WHERE uo.org_id = ${ORG_STORE_OWNER_ORG} AND uo.role = 'owner' AND COALESCE(u.entity_type,'person')='person' LIMIT 1
  `) as unknown as Row[];
  check(steph, `org ${ORG_STORE_OWNER_ORG} has a person owner to open its store`);
  const stephId = steph!.user_id as string;

  // ── 1. a person's store: apply → approve ──────────────────────────────────
  console.log("\n1. person's store");
  const app = await applyForStore({ userId: maker, orgId: MARKET, displayName: `E2E maker ${tag}`, payoutEmail: `pay-${tag}@example.invalid` });
  check(app.ok && app.store?.status === "pending", "applyForStore lands pending");
  made.stores.push(app.store!.id);
  await approveStore(app.store!.id, stephId);
  const store = (await getStore(app.store!.id))!;
  check(store.status === "active", "approveStore → active");
  check(store.payoutEmail === `pay-${tag}@example.invalid`, "store.payoutEmail is the OWNER's (users row)");

  // identity edits go to users, not the store row
  await updateStore(store.id, { displayName: `E2E Renamed ${tag}`, headline: "Painter" }, maker);
  const [u] = (await db`SELECT display_name, headline FROM users WHERE id = ${maker}`) as unknown as Row[];
  check(u!.display_name === `E2E Renamed ${tag}` && u!.headline === "Painter", "updateStore writes identity to users");
  check((await getStore(store.id))!.displayName === `E2E Renamed ${tag}`, "store reads its name from the owner");
  const [srow] = (await db`SELECT display_name FROM store WHERE id = ${store.id}`) as unknown as Row[];
  check(srow!.display_name == null, "deprecated store.display_name stays untouched");

  async function piece(storeId: string, artistUserId: string | null, title: string, priceMinor = 10000) {
    const { id } = await createArtwork({ storeId, artistUserId, title, priceMinor, images: [{ url: "/e2e.jpg" }] });
    made.artworks.push(id);
    await publishArtwork(id, artistUserId ?? maker);
    const [v] = (await db`SELECT id FROM artwork_variant WHERE artwork_id = ${id} ORDER BY position LIMIT 1`) as unknown as Row[];
    return { id, variantId: v!.id as string };
  }
  async function cartWith(variantId: string, userId: string | null) {
    const { cart, token } = await getOrCreateCart({ userId });
    made.carts.push(cart.id);
    await addToCart({ cartToken: token, artworkVariantId: variantId });
    return token;
  }
  async function artStatus(id: string) {
    const [r] = (await db`SELECT status FROM artwork WHERE id = ${id}`) as unknown as Row[];
    return r!.status as string;
  }

  // ── 2. eTransfer sale, confirmed by the seller ────────────────────────────
  console.log("\n2. eTransfer sale");
  const a1 = await piece(store.id, maker, `E2E piece one ${tag}`);
  const t1 = await cartWith(a1.variantId, buyer);
  const o1 = await createOrderFromCart({ cartToken: t1, paymentMethod: "etransfer", customerEmail: `e2e-buyer-${tag}@example.invalid`, customerId: buyer, shippingAddress: { line1: "1 E2E St", city: "Toronto", postalCode: "M5V 1A1", country: "CA" } });
  made.orders.push(o1.id);
  check(o1.storeId === store.id, "order records the store it was placed through");
  check(typeof o1.shippingAddress === "object" && o1.shippingAddress?.city === "Toronto", "shipping address round-trips as an object (jsonb, not double-encoded)");
  check(typeof o1.paymentMetadata === "object" && o1.paymentMetadata.payeeName != null, "payment_metadata round-trips as an object");
  check(o1.status === "awaiting_etransfer" && o1.paymentInstructions?.includes(`pay-${tag}@example.invalid`), "eTransfer order names the maker's payout email");
  check((await artStatus(a1.id)) === "reserved", "piece reserved while unpaid");
  const o1paid = await confirmOrderPaid({ orderId: o1.id, confirmedByUserId: maker, method: "etransfer" });
  check(o1paid.status === "paid", "confirmOrderPaid → paid");
  check((await artStatus(a1.id)) === "sold", "piece sold");
  const bal1 = await getBalance({ kind: "user", userId: maker });
  check(bal1.totalMinor === 0, "eTransfer: accrual + payout net to zero (paid directly)");
  const [p1] = (await db`SELECT method, status FROM payout WHERE order_id = ${o1.id}`) as unknown as Row[];
  check(p1?.method === "etransfer" && p1.status === "received", "payout row: etransfer / received");
  await expectThrow(() => confirmOrderPaid({ orderId: o1.id, confirmedByUserId: maker }), /not in a state/, "confirming twice is refused");
  const sales = await listOrdersForStore(store.id);
  check(sales.some((o) => o.id === o1.id), "listOrdersForStore shows the sale");

  // ── 3. card rail without Stripe keys: order shape, then platform-held confirm ─
  console.log("\n3. card rail (no keys, simulated confirmation)");
  const a2 = await piece(store.id, maker, `E2E piece two ${tag}`, 25000);
  const t2 = await cartWith(a2.variantId, buyer);
  const o2 = await createOrderFromCart({ cartToken: t2, paymentMethod: "stripe", customerEmail: `e2e-buyer-${tag}@example.invalid`, customerId: buyer });
  made.orders.push(o2.id);
  check(o2.status === "pending_payment" && o2.paymentMethod === "stripe" && !o2.paymentInstructions, "card order: pending_payment, no instructions");
  const dueMs = new Date(o2.paymentDueAt!).getTime() - Date.now();
  check(dueMs > 60 * 60_000 && dueMs < 90 * 60_000, "card order due ≈ session expiry + grace");
  // The real webhook path, with a locally signed event (dummy secret).
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  check(whSecret && process.env.STRIPE_SECRET_KEY, "dummy Stripe env present for the webhook leg");
  async function webhook(type: string, object: Record<string, unknown>, opts: { badSig?: boolean } = {}) {
    const payload = JSON.stringify({ id: `evt_${randomUUID().slice(0, 8)}`, object: "event", type, data: { object }, created: Math.floor(Date.now() / 1000), api_version: "2025-08-27.basil", livemode: false, pending_webhooks: 0, request: null });
    const sig = opts.badSig ? "t=1,v1=deadbeef" : getStripeProvider()!.client.webhooks.generateTestHeaderString({ payload, secret: whSecret! });
    return handleStripeWebhook(new Request("http://e2e.invalid/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": sig }, body: payload }));
  }
  const bad = await webhook("checkout.session.completed", { id: "cs_bad", payment_status: "paid", metadata: { orderId: o2.id } }, { badSig: true });
  check(bad.status === 400, "webhook with a bad signature is rejected");
  check((await getOrderById(o2.id))!.status === "pending_payment", "…and changes nothing");
  const good = await webhook("checkout.session.completed", { id: "cs_e2e", object: "checkout.session", payment_status: "paid", payment_intent: "pi_e2e", metadata: { orderId: o2.id } });
  check(good.status === 200, "signed checkout.session.completed accepted");
  const o2paid = (await getOrderById(o2.id))!;
  check(o2paid.status === "paid" && o2paid.paymentReference === "pi_e2e", "webhook confirmed the card order (no actor)");
  const dup = await webhook("checkout.session.completed", { id: "cs_e2e", object: "checkout.session", payment_status: "paid", payment_intent: "pi_e2e", metadata: { orderId: o2.id } });
  check(dup.status === 200 && (await getOrderById(o2.id))!.status === "paid", "duplicate delivery is a 200 no-op");
  const bal2 = await getBalance({ kind: "user", userId: maker });
  check(bal2.totalMinor === 25000 && bal2.payableMinor === 25000 && bal2.heldMinor === 0, "platform-charge card sale: maker accrual PAYABLE, settled by the NFP");
  const [p2] = (await db`SELECT 1 FROM payout WHERE order_id = ${o2.id}`) as unknown as Row[];
  check(!p2, "no payout row until the NFP actually pays");

  // Refund reverses every share and frees the piece.
  const o2r = await refundOrder({ orderId: o2.id, actorUserId: null, reason: "e2e" });
  check(o2r.status === "refunded" && (await artStatus(a2.id)) === "available", "refund → refunded, piece back on sale");
  const bal2r = await getBalance({ kind: "user", userId: maker });
  check(bal2r.totalMinor === 0, "refund entry nets the maker's accrual to zero");
  await expectThrow(() => refundOrder({ orderId: o2.id, actorUserId: null }), /Only a paid order/, "refunding twice is refused");

  // Role gate: staff may see a sale, not settle it.
  check(await canActForOrder(maker, o2.id), "owner can act for their store's order");
  check(await canActForOrder(maker, o2.id, { minRole: "manager" }), "…including money actions");
  check(!(await canActForOrder(buyer, o2.id)), "a stranger cannot");

  // account.updated with payouts_enabled stamps the seller and releases holds.
  const a2b = await piece(store.id, maker, `E2E held piece ${tag}`, 3000);
  await db`UPDATE users SET payout_email = NULL, stripe_account_id = ${"acct_mid_" + tag}, stripe_onboarded_at = NULL WHERE id = ${maker}`;
  const t2b = await cartWith(a2b.variantId, buyer);
  const o2b = await createOrderFromCart({ cartToken: t2b, paymentMethod: "stripe", customerEmail: `e2e-buyer-${tag}@example.invalid` });
  made.orders.push(o2b.id);
  await confirmOrderPaid({ orderId: o2b.id, confirmedByUserId: null, method: "stripe", paymentReference: "pi_e2e_2" });
  const held = await getBalance({ kind: "user", userId: maker });
  check(held.heldByReason["no_payout_account"] === 3000, "mid-onboarding maker: card sale held for want of a payout account");
  const acct = await webhook("account.updated", { id: "acct_mid_" + tag, object: "account", payouts_enabled: true });
  check(acct.status === 200, "signed account.updated accepted");
  const [mk] = (await db`SELECT stripe_onboarded_at, payout_method FROM users WHERE id = ${maker}`) as unknown as Row[];
  check(mk!.stripe_onboarded_at != null && mk!.payout_method === "stripe", "seller stamped onboarded");
  const freed = await getBalance({ kind: "user", userId: maker });
  check(freed.heldMinor === 0 && freed.payableMinor === 3000, "…and the held sale released");
  await db`UPDATE users SET payout_email = ${`pay-${tag}@example.invalid`}, stripe_account_id = NULL, stripe_onboarded_at = NULL WHERE id = ${maker}`;

  // card-only maker (Stripe onboarded, no eTransfer address)
  const app2 = await applyForStore({ userId: cardOnly, orgId: MARKET, displayName: `E2E cardonly ${tag}`, payoutEmail: "" });
  check(app2.ok, "card-only maker can hold a store");
  made.stores.push(app2.store!.id);
  await approveStore(app2.store!.id, stephId);
  await db`UPDATE users SET payout_email = NULL WHERE id = ${cardOnly}`;
  const a3 = await piece(app2.store!.id, cardOnly, `E2E card-only piece ${tag}`);
  const t3 = await cartWith(a3.variantId, buyer);
  await expectThrow(
    () => createOrderFromCart({ cartToken: t3, paymentMethod: "etransfer", customerEmail: "x@example.invalid" }),
    /card payments only/,
    "eTransfer refused for a card-only maker (no invented address)"
  );
  check((await artStatus(a3.id)) === "available", "refused order leaves the piece available");

  // ── 4. auction: create → bid → settle into an order → cancel releases ─────
  console.log("\n4. auction");
  const a4 = await piece(store.id, maker, `E2E lot piece ${tag}`, 40000);
  const lot = await createLot({ artworkId: a4.id, actorUserId: maker, endAt: new Date(Date.now() + 2 * 3600_000), startingBidMinor: 10000, reserveMinor: 20000, bidIncrementMinor: 1000 });
  made.lots.push(lot.id);
  check(lot.status === "live", "createLot with no start → live");
  await expectThrow(() => createLot({ artworkId: a4.id, actorUserId: maker, endAt: new Date(Date.now() + 3600_000 * 3), startingBidMinor: 1 }), /already at auction/, "second lot on the same piece refused");
  await expectThrow(() => createLot({ artworkId: a4.id, actorUserId: buyer, endAt: new Date(Date.now() + 3600_000 * 3), startingBidMinor: 1 }), /not found/i, "a stranger cannot put the piece up");
  const { token: tk } = await getOrCreateCart({ userId: buyer }); made.carts.push((await db`SELECT id FROM cart WHERE token = ${tk}`)[0]!.id as string);
  await expectThrow(() => addToCart({ cartToken: tk, artworkVariantId: a4.variantId }), /at auction/, "buy-now refused while at auction");
  const b1 = await placeBid({ lotId: lot.id, bidderId: buyer, amountMinor: 10000 });
  check(b1.ok, "first bid accepted");
  const b2 = await placeBid({ lotId: lot.id, bidderId: bidder2, amountMinor: 15000 });
  check(b2.ok, "second bid (below reserve) accepted");
  await db`UPDATE auction_lot SET end_at = NOW() - interval '1 minute' WHERE id = ${lot.id}`;
  const s1 = await settleExpiredLots({ payUrlBase: "http://e2e.invalid" });
  check(s1.passed === 1 && s1.sold === 0, "reserve not met → passed, no order");
  check((await artStatus(a4.id)) === "available", "passed lot leaves the piece available");

  const lot2 = await createLot({ artworkId: a4.id, actorUserId: maker, endAt: new Date(Date.now() + 2 * 3600_000), startingBidMinor: 10000, reserveMinor: null });
  made.lots.push(lot2.id);
  check((await placeBid({ lotId: lot2.id, bidderId: bidder2, amountMinor: 12000 })).ok, "bid on the relisted lot");
  await db`UPDATE auction_lot SET end_at = NOW() - interval '1 minute' WHERE id = ${lot2.id}`;
  const s2 = await settleExpiredLots({ payUrlBase: "http://e2e.invalid" });
  check(s2.sold === 1 && s2.orderIds.length === 1, "winning bid → lot sold, one order created");
  made.orders.push(...s2.orderIds);
  const won = (await getOrderById(s2.orderIds[0]!))!;
  console.log("     winner order:", { customerId: won.customerId === bidder2, total: won.totalMinor, status: won.status, metadata: won.metadata, storeId: won.storeId });
  check(won.customerId === bidder2, "winner's order belongs to the winner");
  check(won.totalMinor === 12000, "winner's order is at the hammer price");
  check(won.status === "awaiting_etransfer", "winner's order on the eTransfer rail (maker has an address)");
  check(won.metadata.kind === "auction" && won.metadata.lotId === lot2.id, "winner's order records the lot");
  check(won.paymentDueAt != null && new Date(won.paymentDueAt).getTime() - Date.now() > 70 * 3600_000, "winner has 72h to pay");
  check((await artStatus(a4.id)) === "reserved", "won piece reserved for the winner");
  const s3 = await settleExpiredLots();
  check(s3.sold === 0 && s3.passed === 0, "settling again is a no-op");
  await cancelOrder({ orderId: won.id, reason: "e2e: winner never paid" });
  const [lotAfter] = (await db`SELECT status FROM auction_lot WHERE id = ${lot2.id}`) as unknown as Row[];
  check(lotAfter!.status === "passed" && (await artStatus(a4.id)) === "available", "cancelling the winner's order → lot passed, piece back on sale");

  const lot3 = await createLot({ artworkId: a4.id, actorUserId: maker, endAt: new Date(Date.now() + 2 * 3600_000), startingBidMinor: 5000 });
  made.lots.push(lot3.id);
  await cancelLot({ lotId: lot3.id, actorUserId: maker });
  check(true, "withdrawing a lot with no bids");

  // ── 5. expiry sweep ───────────────────────────────────────────────────────
  console.log("\n5. expiry");
  const t5 = await cartWith(a4.variantId, buyer);
  const o5 = await createOrderFromCart({ cartToken: t5, paymentMethod: "etransfer", customerEmail: `e2e-buyer-${tag}@example.invalid` });
  made.orders.push(o5.id);
  await db`UPDATE commerce_order SET payment_due_at = NOW() - interval '1 hour' WHERE id = ${o5.id}`;
  const released = await releaseExpiredOrders();
  check(released >= 1 && (await getOrderById(o5.id))!.status === "cancelled", "releaseExpiredOrders cancels the lapsed order");
  check((await artStatus(a4.id)) === "available", "lapsed order frees the piece");

  // ── 6. org store, member roll, org-owned work, org earmark ────────────────
  console.log("\n6. org store");
  const org = await openOrgStore({ ownerOrgId: ORG_STORE_OWNER_ORG, actorUserId: stephId, orgId: MARKET });
  check(org.ok && org.store?.status === "active" && org.store.ownerKind === "org", "org owner opens an active org store in the marketplace");
  made.stores.push(org.store!.id);
  const stephStores = await listStoresForUser(stephId);
  check(stephStores.some((s) => s.id === org.store!.id && s.myRole === "owner"), "listStoresForUser: owner sees the org store as owner");
  check(!(await listStoresForUser(maker)).some((s) => s.id === org.store!.id), "org membership alone does not put the maker on the store");
  await addStoreMember(org.store!.id, maker, "staff", stephId);
  check((await listStoresForUser(maker)).some((s) => s.id === org.store!.id && s.myRole === "staff"), "added as staff → can act for the org store");
  // 6b. presentation: the org front shows the maker's piece; a sale through it
  // is logged through the front and the org is the split counterparty.
  const a7 = await piece(store.id, maker, `E2E presented piece ${tag}`, 20000);
  await expectThrow(() => presentArtwork({ storeId: org.store!.id, artworkId: a7.id, actorUserId: maker }), /owner or manager/, "staff cannot change what a front presents");
  await presentArtwork({ storeId: org.store!.id, artworkId: a7.id, actorUserId: stephId });
  check(await isPresentedBy(org.store!.id, a7.id), "org owner presents the maker's piece");
  const front = await listStoreFrontArtworks(org.store!.id);
  check(front.some((x) => x.id === a7.id && x.presentedByStoreId === org.store!.id), "front lists the presented piece, flagged");
  check(!(await listStoreFrontArtworks(store.id)).some((x) => x.presentedByStoreId), "the maker's own front shows it as its own");
  const { cart: c7, token: t7 } = await getOrCreateCart({ userId: buyer }); made.carts.push(c7.id);
  await addToCart({ cartToken: t7, artworkVariantId: a7.variantId, viaStoreId: org.store!.id });
  const o7 = await createOrderFromCart({ cartToken: t7, paymentMethod: "etransfer", customerEmail: `e2e-buyer-${tag}@example.invalid` });
  made.orders.push(o7.id);
  const l7 = (await getOrderLines(o7.id))[0]!;
  const [l7row] = (await db`SELECT presented_store_id, org_id FROM commerce_order_line WHERE id = ${l7.id}`) as unknown as Row[];
  check(l7row!.presented_store_id === org.store!.id, "order line logs the presenting front");
  check(o7.storeId === store.id, "…while the order's store (payee side) is still the maker's");
  check(o7.paymentInstructions?.includes(`pay-${tag}@example.invalid`), "…and the buyer pays the maker");
  await cancelOrder({ orderId: o7.id, reason: "e2e" });
  // a via that does not present the piece is ignored, not trusted
  const { cart: c8, token: t8 } = await getOrCreateCart({ userId: buyer }); made.carts.push(c8.id);
  await unpresentArtwork({ storeId: org.store!.id, artworkId: a7.id, actorUserId: stephId });
  await addToCart({ cartToken: t8, artworkVariantId: a7.variantId, viaStoreId: org.store!.id });
  const [cl8] = (await db`SELECT via_store_id FROM cart_line WHERE cart_id = ${c8.id}`) as unknown as Row[];
  check(cl8!.via_store_id == null, "a via store that no longer presents the piece is dropped");
  // price on request
  const a9 = await piece(store.id, maker, `E2E priced on request ${tag}`, 0);
  check((await artStatus(a9.id)) === "available", "a zero-priced piece publishes (price on request)");
  await expectThrow(() => addToCart({ cartToken: t8, artworkVariantId: a9.variantId }), /priced on request/, "…but cannot be added to a cart");

  const a6 = await piece(org.store!.id, null, `E2E org tote ${tag}`, 5000);
  check((await getArtworkForEdit(a6.id, maker)) != null, "staff member can open org-owned work for edit");
  check((await getArtworkForEdit(a6.id, buyer)) == null, "a stranger cannot");
  const t6 = await cartWith(a6.variantId, buyer);
  const o6 = await createOrderFromCart({ cartToken: t6, paymentMethod: "etransfer", customerEmail: `e2e-buyer-${tag}@example.invalid` });
  made.orders.push(o6.id);
  check(o6.paymentInstructions?.includes("info@") || o6.paymentInstructions?.includes(process.env.ART_AUCTION_GALLERY_PAYOUT_EMAIL ?? "info@"), "maker-less work: buyer pays the host account");
  check(await canActForOrder(maker, o6.id), "staff can see the org store's sale");
  check(!(await canActForOrder(maker, o6.id, { minRole: "manager" })), "staff cannot settle it");
  check(await canActForOrder(stephId, o6.id, { minRole: "manager" }), "the org store's owner can");
  await confirmOrderPaid({ orderId: o6.id, confirmedByUserId: stephId, method: "etransfer" });
  const orgBal = await getBalance({ kind: "org", orgId: ORG_STORE_OWNER_ORG });
  check(orgBal.totalMinor >= 5000 && orgBal.heldByReason["dispute_window"] >= 5000, "org share earmarked in the ledger, held for the dispute window");

  console.log(`\nall ${passed} checks passed`);
}

async function cleanup() {
  console.log("\ncleanup");
  const orderIds = made.orders;
  const lotIds = made.lots;
  const artIds = made.artworks;
  const storeIds = made.stores;
  const userIds = made.users;
  await db`DELETE FROM payout_ledger WHERE order_id = ANY(${orderIds}) OR party_user_id = ANY(${userIds})`;
  await db`DELETE FROM payout WHERE order_id = ANY(${orderIds}) OR artist_user_id = ANY(${userIds})`;
  await db`DELETE FROM commerce_order_line WHERE order_id = ANY(${orderIds})`;
  await db`DELETE FROM commerce_order WHERE id = ANY(${orderIds})`;
  await db`DELETE FROM bid WHERE lot_id = ANY(${lotIds})`;
  await db`DELETE FROM auction_lot WHERE id = ANY(${lotIds})`;
  await db`DELETE FROM reservation WHERE artwork_variant_id IN (SELECT id FROM artwork_variant WHERE artwork_id = ANY(${artIds}))`;
  await db`DELETE FROM cart_line WHERE artwork_variant_id IN (SELECT id FROM artwork_variant WHERE artwork_id = ANY(${artIds}))`;
  await db`DELETE FROM cart WHERE id = ANY(${made.carts}) OR user_id = ANY(${userIds})`;
  await db`UPDATE artwork SET primary_image_id = NULL WHERE id = ANY(${artIds})`;
  await db`DELETE FROM artwork_media WHERE artwork_id = ANY(${artIds})`;
  await db`DELETE FROM artwork_variant WHERE artwork_id = ANY(${artIds})`;
  await db`DELETE FROM artwork WHERE id = ANY(${artIds})`;
  await db`DELETE FROM store_member WHERE store_id = ANY(${storeIds})`;
  await db`DELETE FROM store WHERE id = ANY(${storeIds})`;
  for (const [u, o] of made.userOrgs) await db`DELETE FROM user_organizations WHERE user_id = ${u} AND org_id = ${o}`;
  await db`DELETE FROM users WHERE id = ANY(${userIds})`;
  console.log("after", await baseline());
}

main()
  .then(async () => { await cleanup(); process.exit(0); })
  .catch(async (e) => { console.error(e); try { await cleanup(); } catch (c) { console.error("cleanup failed", c); } process.exit(1); });
