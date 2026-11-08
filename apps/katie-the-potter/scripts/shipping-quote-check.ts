// Quote-only shipping, checked WITHOUT Stripe (live keys: no session, no
// Stripe object) and without any Easyship call except what the order's
// sandbox quote already did. Usage (STRIPE_SECRET_KEY and the production
// Easyship token blanked on purpose):
//   docker compose run --rm --no-deps -T -e STRIPE_SECRET_KEY= -e EASYSHIP_PRODUCTION_TOKEN= \
//     -e MODE=<mode> -e ORDER=<order uuid> -w /app/apps/katie-the-potter admin \
//     node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/shipping-quote-check.ts
// MODE
//   params    the order's TEST quote row (chosen, or the first featured option
//             is chosen through chooseRate exactly as the buyer's action does):
//             the parallel Checkout's params for BOTH routes, built not sent:
//             Katie onboarded (a stand-in identity) -> destination charge to
//             her account, no application fee; Katie as she is -> platform
//             charge
//   pay       the payment, simulated through the return hop's own path with a
//             FAKE session object (not from Stripe): markAwaitingPayment with a
//             fake id, then applyShippingPaymentSession (what
//             syncShippingPayment calls after retrieving), then advance (what
//             the return route calls). First the destination route inside a
//             transaction that is rolled back; then the platform route for real
//             (committed, for the UI). Checks the shipment, the ledger, the
//             once-only guard, a foreign session, and Katie's email (logged:
//             test-mode rows never send).
//   emails    print Katie's "Ship this" email and the buyer's tracking email
//             as composed (text only; nothing is sent)
//   snapshot  ledger / payout / shipment fingerprints (for before/after)
//   cleanup   delete what `pay` wrote for this TEST order (ledger entries and
//             payout rows named in the shipment's events, then the order's
//             test shipment rows)
// Refuses: a production Easyship token or a Stripe key in the environment, a
// live-mode shipment, an order that is not a rehearsal (unpaid) order.
import { db } from "@elkdonis/db";
import { getOrderById } from "@elkdonis/commerce/queries";
import { recordShippingPaymentPaid } from "@elkdonis/commerce/server";
import {
  applyShippingPaymentSession,
  buildShippingPaymentSessionParams,
  resolveShippingPaymentRoute,
  shippingRouteFor,
} from "../../../packages/checkout/src/server/shipping-label";
import { siteConfig } from "../src/config/site";
import { advance, chooseRate, currentShipment, getShipment, markAwaitingPayment, shippingPaymentInput, type ShipmentRow } from "../src/lib/shipping/shipments";
import { priceFor } from "../src/lib/shipping/rates";
import { composeShipThis, composeTracking } from "../src/lib/shipping/notices";

const MODE = process.env.MODE ?? "snapshot";
const ORDER = process.env.ORDER ?? "";
if (process.env.EASYSHIP_PRODUCTION_TOKEN || process.env.STRIPE_SECRET_KEY) {
  console.error("Refusing: blank STRIPE_SECRET_KEY and EASYSHIP_PRODUCTION_TOKEN (-e X=).");
  process.exit(1);
}

let failed = 0;
const expect = (ok: boolean, what: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) failed++;
};
const text = (html: string) =>
  html
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<\/(p|li|h1|div)>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

async function testOrder() {
  if (!/^[0-9a-f-]{36}$/i.test(ORDER)) throw new Error("ORDER=<uuid> is required");
  const order = await getOrderById(ORDER);
  if (!order) throw new Error("no such order");
  if (!["awaiting_etransfer", "pending_payment", "payment_received"].includes(order.status)) throw new Error(`order is ${order.status}: only an unpaid rehearsal order`);
  return order;
}

async function quoteRow(): Promise<ShipmentRow> {
  const order = await testOrder();
  let row = await currentShipment(order.id, "test");
  if (!row) throw new Error("no test shipment: open Choose shipping in Test mode first");
  if (row.mode !== "test") throw new Error("refusing a live shipment");
  if (row.status === "rated" && !row.chosenRate) {
    const opt = row.rates?.featured[0];
    if (!opt) throw new Error("no options on the row");
    const r = await chooseRate({ row, order, courierServiceId: opt.courierServiceId, insured: true, acceptMinor: priceFor(opt, true), flow: "quote" });
    if (r.ok === false) throw new Error(`chooseRate: ${r.message}`);
    row = r.row;
    console.log(`chose ${opt.service} at ${row.amountMinor} ${row.currency} (insured) through chooseRate, flow quote`);
  }
  return row;
}

async function params() {
  const order = await testOrder();
  const row = await quoteRow();
  const origin = siteConfig.url.replace(/\/$/, "");
  const now = 1_800_000_000;
  const real = await resolveShippingPaymentRoute(order.id);
  console.log(`route as Katie is now: payTo=${real.payToUserId} destination=${real.destinationAccountId ?? "none"}`);

  // A: Katie has finished Express onboarding (stand-in identity; her real row is untouched).
  const onboarded = shippingRouteFor(real.payToUserId, { stripeAccountId: "acct_TEST_ONBOARDED", canReceiveDestinationCharge: true });
  const a = buildShippingPaymentSessionParams(shippingPaymentInput(row, order, origin, onboarded), now);
  console.log("\n── A. onboarded: destination charge ──\n" + JSON.stringify(a, null, 2));
  expect(a.payment_intent_data?.transfer_data?.destination === "acct_TEST_ONBOARDED", "A: destination = her connected account");
  expect(!("application_fee_amount" in (a.payment_intent_data ?? {})), "A: no application_fee_amount (fee 0: no commission on shipping)");
  expect(a.metadata?.route === "destination" && a.metadata?.destination === "acct_TEST_ONBOARDED", "A: metadata route/destination");

  // B: as she is today (eTransfer payout email, no Stripe account).
  const b = buildShippingPaymentSessionParams(shippingPaymentInput(row, order, origin, real), now);
  console.log("\n── B. not onboarded: platform charge ──\n" + JSON.stringify(b, null, 2));
  expect(!b.payment_intent_data?.transfer_data, "B: no transfer (platform charge)");
  expect(!("application_fee_amount" in (b.payment_intent_data ?? {})), "B: no application fee");
  expect(b.metadata?.route === "platform" && b.metadata?.destination === "", "B: metadata route platform");

  for (const [k, p] of [["A", a], ["B", b]] as const) {
    const md = p.metadata ?? {};
    expect(md.kind === "shipping_payment", `${k}: metadata.kind = shipping_payment`);
    expect(md.shipmentId === row.id && md.orderId === order.id, `${k}: metadata shipmentId + orderId`);
    expect(md.payTo === real.payToUserId && Boolean(md.payTo), `${k}: metadata.payTo = the order's maker`);
    expect(md.courierServiceId === row.chosenRate!.courierServiceId && md.service === row.chosenRate!.service && md.courier === row.chosenRate!.courier, `${k}: quote: courier service id, courier, service`);
    expect(md.amountMinor === String(row.amountMinor) && md.currency === row.currency && md.quotedAt === (row.chosenRate!.quotedAt ?? ""), `${k}: quote: amount, currency, quoted-at`);
    expect(Boolean(md.parcel) && md.shipToCountry === (row.shipTo.country ?? "").toUpperCase() && md.insured === (row.insured ? "yes" : "no"), `${k}: quote: parcel, ship-to country, insurance`);
    expect(p.line_items?.length === 1 && p.line_items[0]!.price_data?.unit_amount === row.amountMinor, `${k}: one line, the quoted amount`);
    expect((p.line_items?.[0]?.price_data?.product_data?.name ?? "").startsWith("Shipping: "), `${k}: line name "${p.line_items?.[0]?.price_data?.product_data?.name}"`);
    expect(/Katie packs and ships it/.test(p.line_items?.[0]?.price_data?.product_data?.description ?? ""), `${k}: line description carries the quote and parcel`);
    expect(p.success_url === `${origin}/api/shipping/return?shipment=${row.id}` && p.cancel_url === `${origin}/orders/${order.id}/shipping?cancelled=1`, `${k}: return URLs on this site`);
    expect(p.mode === "payment" && p.expires_at === now + 3600, `${k}: payment, 60 minutes`);
  }
}

async function ledgerFor(orderId: string, t: typeof db = db) {
  return (await t`SELECT id, party_kind, party_user_id, entry_type, amount_minor, currency, hold_reason, payout_id, order_line_id, note FROM payout_ledger WHERE order_id = ${orderId} ORDER BY created_at, entry_type`) as unknown as Array<Record<string, unknown>>;
}

async function pay() {
  const order = await testOrder();
  let row = await quoteRow();
  if (row.status !== "rated" && row.status !== "awaiting_payment") throw new Error(`row is ${row.status}`);
  const route = await resolveShippingPaymentRoute(order.id);
  const before = await ledgerFor(order.id);
  expect(before.length === 0, "no ledger entries for this order before");

  // The session would be opened here (startShippingPayment); instead a fake id.
  const sessionId = `cs_test_FAKE_${Date.now()}`;
  expect(await markAwaitingPayment(row.id, sessionId, route), "awaiting_payment with the (fake) session id");
  row = (await getShipment(row.id))!;
  const built = buildShippingPaymentSessionParams(shippingPaymentInput(row, order, siteConfig.url, route));
  const fake = (destination: string | null) => ({
    id: sessionId,
    metadata: { ...(built.metadata as Record<string, string>), route: destination ? "destination" : "platform", destination: destination ?? "" },
    payment_status: "paid",
    status: "complete",
    payment_intent: "pi_FAKE_check",
    amount_total: row.amountMinor,
    currency: (row.currency ?? "CAD").toLowerCase(),
    client_reference_id: order.id,
  });

  // A (rolled back): the destination route's ledger, recorded through the same recorder.
  const ROLLBACK = new Error("rollback (check only)");
  try {
    await db.begin(async (t) => {
      const tx = t as unknown as typeof db;
      const l = await recordShippingPaymentPaid(
        { shipmentId: row.id, sessionId, paymentIntentId: "pi_FAKE_check", amountMinor: row.amountMinor, currency: row.currency, source: "check A (rolled back)", destinationAccountId: "acct_TEST_ONBOARDED", service: row.chosenRate?.service },
        tx
      );
      const rows = await ledgerFor(order.id, tx);
      const [p] = (await tx`SELECT method, status, amount_minor, reference FROM payout WHERE id = ${l?.payoutId ?? null}`) as unknown as Array<Record<string, unknown>>;
      console.log("A ledger (inside the rolled-back transaction):", JSON.stringify(rows), JSON.stringify(p ?? null));
      expect(l?.route === "destination" && l.makerUserId === route.payToUserId, "A: destination, to the maker");
      expect(rows.length === 2 && rows.some((r) => r.entry_type === "accrual" && Number(r.amount_minor) === row.amountMinor) && rows.some((r) => r.entry_type === "payout" && Number(r.amount_minor) === -row.amountMinor!), "A: accrual + payout netting to zero (full amount, no fee, no commission)");
      expect(p?.method === "stripe" && p?.status === "sent" && Number(p?.amount_minor) === row.amountMinor, "A: payout row = Stripe destination transfer");
      throw ROLLBACK;
    });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
  expect((await ledgerFor(order.id)).length === 0 && (await getShipment(row.id))!.status === "awaiting_payment", "A rolled back: no ledger, still awaiting payment");

  // A foreign session never marks this shipment paid.
  const foreign = await applyShippingPaymentSession({ ...fake(null), metadata: { ...fake(null).metadata, shipmentId: "00000000-0000-4000-8000-000000000000" } }, { shipmentId: row.id, source: "check foreign", paid: true, expired: false });
  expect(foreign.status === "unknown" && !foreign.recorded, "a session for another shipment is ignored");
  const otherKind = await applyShippingPaymentSession({ ...fake(null), metadata: { ...fake(null).metadata, kind: "bidder_registration" } }, { shipmentId: row.id, source: "check kind", paid: true, expired: false });
  expect(otherKind.status === "unknown", "a session of another kind is ignored");

  // B (committed): the platform route, exactly the return hop's path after retrieve.
  const r1 = await applyShippingPaymentSession(fake(route.destinationAccountId), { shipmentId: row.id, source: "check B (fake session, not Stripe)", paid: true, expired: false });
  console.log("B ledger summary:", JSON.stringify(r1.ledger));
  expect(r1.recorded && r1.status === "paid", "B: recorded paid");
  const r2 = await applyShippingPaymentSession(fake(route.destinationAccountId), { shipmentId: row.id, source: "check B again", paid: true, expired: false });
  expect(!r2.recorded, "B: a second delivery (webhook after return) records nothing");
  const after = (await advance((await getShipment(row.id))!)) as ShipmentRow;
  expect(after.status === "paid" && after.paidMinor === row.amountMinor && after.stripePaymentIntent === "pi_FAKE_check", "shipment paid, amount and payment intent stored");
  const rows = await ledgerFor(order.id);
  console.log("B ledger rows:", JSON.stringify(rows));
  const fee = Math.round(row.amountMinor! * 0.029 + 30);
  expect(rows.length === 1, "B: exactly one ledger entry");
  const e = rows[0] ?? {};
  expect(e.party_kind === "user" && e.party_user_id === route.payToUserId, "B: owed to Katie (the order's maker)");
  expect(e.entry_type === "accrual" && Number(e.amount_minor) === row.amountMinor! - fee && e.hold_reason == null && e.order_line_id == null, `B: accrual ${row.amountMinor! - fee} = ${row.amountMinor} less the ${fee} card-fee estimate, payable (no hold), no order line`);
  const kinds = after.events.map((x) => String(x.kind));
  expect(kinds.includes("ledger") && kinds.includes("ship_this_notice"), "events: ledger + ship_this_notice (once)");
  expect(after.events.some((x) => x.kind === "email_skipped_test" && String(x.subject).startsWith("Ship this order:")), "Katie's email composed and logged (test row: not sent)");
  const again = await advance(after);
  expect(again.events.filter((x) => x.kind === "ship_this_notice").length === 1, "advance again: no second notice");
}

async function emails() {
  const order = await testOrder();
  const row = await currentShipment(order.id, "test");
  if (!row) throw new Error("no test shipment");
  const k = await composeShipThis(row);
  console.log(`── to Katie (${k?.to}) · ${k?.subject}\n${k ? text(k.html) : "(none)"}\n`);
  const b = await composeTracking(row);
  console.log(`── to the buyer (${b?.to}) · ${b?.subject}\n${b ? text(b.html) : "(none: no email on the order)"}`);
  console.log("\nlogged, not sent:", JSON.stringify(row.events.filter((x) => x.kind === "email_skipped_test")));
}

async function snapshot() {
  const [l] = (await db`SELECT count(*)::int AS n, coalesce(md5(string_agg(id::text || amount_minor::text, ',' ORDER BY id)), '-') AS h FROM payout_ledger`) as unknown as Array<{ n: number; h: string }>;
  const [p] = (await db`SELECT count(*)::int AS n, coalesce(md5(string_agg(id::text || amount_minor::text, ',' ORDER BY id)), '-') AS h FROM payout`) as unknown as Array<{ n: number; h: string }>;
  const [s] = (await db`SELECT count(*)::int AS n FROM order_shipment`) as unknown as Array<{ n: number }>;
  console.log(`payout_ledger ${l!.n} rows ${l!.h} · payout ${p!.n} rows ${p!.h} · order_shipment ${s!.n} rows`);
}

async function cleanup() {
  const order = await testOrder();
  const rows = (await db`SELECT id, mode, events FROM order_shipment WHERE order_id = ${order.id}`) as unknown as Array<{ id: string; mode: string; events: Array<Record<string, unknown>> }>;
  if (rows.some((r) => r.mode !== "test")) throw new Error("refusing: this order has a live shipment");
  const entryIds = rows.flatMap((r) => r.events.filter((e) => e.kind === "ledger").flatMap((e) => (e.entryIds as string[]) ?? []));
  const payoutIds = rows.flatMap((r) => r.events.filter((e) => e.kind === "ledger" && e.payoutId).map((e) => e.payoutId as string));
  // Only entries this check wrote: named in the shipment's ledger events AND on this order.
  const delL = entryIds.length ? await db`DELETE FROM payout_ledger WHERE id = ANY(${entryIds}::uuid[]) AND order_id = ${order.id} RETURNING id` : [];
  const delP = payoutIds.length ? await db`DELETE FROM payout WHERE id = ANY(${payoutIds}::uuid[]) AND order_id = ${order.id} RETURNING id` : [];
  const delS = await db`DELETE FROM order_shipment WHERE order_id = ${order.id} AND mode = 'test' RETURNING id`;
  console.log(`deleted: ${delL.length} ledger entries, ${delP.length} payout rows, ${delS.length} test shipment rows`);
  expect((await ledgerFor(order.id)).length === 0, "no ledger entries left on the test order");
}

const run = { params, pay, emails, snapshot, cleanup }[MODE as "params"];
if (!run) {
  console.error(`unknown MODE ${MODE}`);
  process.exit(1);
}
run()
  .then(() => {
    console.log(failed ? `\n${failed} FAILED` : "\ndone");
    process.exit(failed ? 1 : 0);
  })
  .catch((e) => {
    console.error(String(e));
    process.exit(1);
  });
