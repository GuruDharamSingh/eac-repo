// What "Buy now" WOULD send to Stripe, without sending it (live keys: no
// session, no Stripe object is created). Usage:
//   docker compose run --rm --no-deps -T -e STRIPE_SECRET_KEY= -w /app/apps/katie-the-potter admin \
//     node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/buy-now-params.ts
// Reads one available piece of Katie's store (read-only), builds the lines the
// way startStripeCheckout does, and prints buildCheckoutSessionParams for
//   A. an existing caller (email known, no `collect`): must be unchanged
//   B. Buy now, signed out (no email, collect email + shipping address)
// then reads two fake completed sessions (current and legacy shapes) through
// collectedFromSession. Exits 1 on any failed expectation.
import { db } from "@elkdonis/db";
import { loadVariantItem } from "@elkdonis/commerce/server";
import { buildCheckoutSessionParams, collectedFromSession } from "../../../packages/payments/src/providers/stripe";
import { siteConfig } from "../src/config/site";

let failed = 0;
const expect = (ok: boolean, what: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) failed++;
};

async function main() {
  const [store] = await db`SELECT value FROM site_config WHERE org_id = 'katie-the-potter' AND key = 'shop:store'`;
  const storeId = (store?.value as { storeId?: string } | undefined)?.storeId;
  const [v] = await db`
    SELECT av.id AS variant_id, a.title FROM artwork a JOIN artwork_variant av ON av.artwork_id = a.id
    WHERE a.store_id = ${storeId ?? null} AND a.status = 'available' AND av.price_minor > 0
    ORDER BY a.created_at DESC LIMIT 1`;
  if (!v) throw new Error("no available priced piece in Katie's store");
  const item = await loadVariantItem(v.variant_id as string);
  const origin = siteConfig.url;
  const img = item.imageUrl ?? null;
  const lines = [
    {
      name: item.title,
      amountMinor: item.unitMinor,
      currency: item.currency,
      quantity: item.qty,
      imageUrl: img && /^https?:\/\//.test(img) ? img : img ? `${origin}${img.startsWith("/") ? "" : "/"}${img}` : null,
    },
  ];
  const orderId = "00000000-0000-4000-8000-000000000000";
  const base = {
    orderId,
    orderNumber: "TEST-PARAMS",
    lines,
    successUrl: `${origin}/api/checkout/return?order=${orderId}`,
    cancelUrl: `${origin}/orders/${orderId}?cancelled=1`,
    destinationAccountId: null,
    applicationFeeMinor: 0,
    expiresInMinutes: 60,
  };
  const now = 1_800_000_000;

  const a = buildCheckoutSessionParams({ ...base, customerEmail: "buyer@example.com" }, now);
  console.log("\nA. existing caller:\n" + JSON.stringify(a, null, 2));
  expect(a.customer_email === "buyer@example.com", "A prefills the email");
  expect(!("shipping_address_collection" in a), "A asks for no shipping address");
  expect(!("phone_number_collection" in a), "A asks for no phone");
  expect(!("payment_method_types" in a), "A sets no payment_method_types (dashboard methods: card + wallets)");
  expect(
    JSON.stringify(Object.keys(a)) ===
      JSON.stringify(["mode", "customer_email", "client_reference_id", "success_url", "cancel_url", "expires_at", "metadata", "payment_intent_data", "line_items"]),
    "A has exactly the keys it had before the change"
  );

  const b = buildCheckoutSessionParams(
    { ...base, customerEmail: "", collect: { email: true, shippingAddress: { allowedCountries: [...siteConfig.shipToCountries] } } },
    now
  );
  console.log("\nB. Buy now (signed out):\n" + JSON.stringify(b, null, 2));
  expect(!("customer_email" in b), "B leaves the email to Stripe's page");
  expect(JSON.stringify(b.shipping_address_collection?.allowed_countries) === JSON.stringify(["CA", "US"]), "B collects a CA/US shipping address");
  expect(b.mode === "payment" && b.client_reference_id === orderId && b.metadata?.orderId === orderId, "B carries the order id (webhook + return hop)");
  expect(b.line_items?.length === 1 && b.line_items[0]!.price_data?.unit_amount === item.unitMinor, `B charges one line: ${item.title} ${item.unitMinor} ${item.currency}`);
  expect(!("payment_method_types" in b), "B sets no payment_method_types");

  const c = buildCheckoutSessionParams({ ...base, customerEmail: "known@example.com", collect: { shippingAddress: { allowedCountries: ["ca", "US", "bad!"] } } }, now);
  expect(c.customer_email === "known@example.com", "C (signed in) prefills the known email");
  expect(JSON.stringify(c.shipping_address_collection?.allowed_countries) === JSON.stringify(["CA", "US"]), "C normalises/filters countries");

  const address = { line1: "12 Elm St", line2: "Apt 3", city: "Toronto", state: "ON", postal_code: "M5V 1A1", country: "CA" };
  const current = {
    customer_details: { email: "ana@example.com", name: "Ana Ruiz", phone: null, address: { ...address, line1: "BILLING 1" } },
    collected_information: { shipping_details: { name: "Ana Ruiz", address } },
  };
  const legacy = { customer_details: { email: "bo@example.com", name: "Bo", phone: "+1 416 555 0100", address: null }, shipping_details: { name: "Bo Lee", address } };
  const cc = collectedFromSession(current as never);
  const cl = collectedFromSession(legacy as never);
  console.log("\ncollected (current):", JSON.stringify(cc));
  console.log("collected (legacy):", JSON.stringify(cl));
  expect(cc?.email === "ana@example.com" && cc?.shippingAddress?.line1 === "12 Elm St" && cc?.shippingAddress?.region === "ON", "current shape: email + SHIPPING (not billing) address");
  expect(cl?.shippingAddress?.recipientName === "Bo Lee" && cl?.phone === "+1 416 555 0100", "legacy shape read too");
  expect(collectedFromSession({ customer_details: null } as never) === null, "nothing entered -> null");

  console.log(failed ? `\n${failed} FAILED` : "\nall passed");
}
main()
  .then(() => process.exit(failed ? 1 : 0))
  .catch((e) => {
    console.error(String(e));
    process.exit(1);
  });
