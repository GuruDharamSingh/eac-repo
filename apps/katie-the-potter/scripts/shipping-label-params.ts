// What the label payment WOULD send to Stripe, without sending it (live keys:
// no session, no Stripe object). Usage (STRIPE_SECRET_KEY blanked on purpose):
//   docker compose run --rm --no-deps -T -e STRIPE_SECRET_KEY= -w /app/apps/katie-the-potter admin \
//     node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/shipping-label-params.ts
// Checks: a platform charge (no destination, no application fee), one line,
// metadata.kind/shipmentId, return URLs on this site; and that Buy now's
// Stripe page now asks for a phone while an existing caller is unchanged.
import { buildShippingLabelSessionParams } from "../../../packages/checkout/src/server/shipping-label";
import { buildCheckoutSessionParams } from "../../../packages/payments/src/providers/stripe";
import { siteConfig } from "../src/config/site";

let failed = 0;
const expect = (ok: boolean, what: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) failed++;
};

const origin = siteConfig.url;
const shipmentId = "11111111-1111-4111-8111-111111111111";
const orderId = "00000000-0000-4000-8000-000000000000";
const now = 1_800_000_000;
const p = buildShippingLabelSessionParams(
  {
    shipmentId,
    orderId,
    orderNumber: "ART-TEST-PARAMS",
    customerEmail: "buyer@example.com",
    lineName: "Shipping: Canpar - Ground, 1 business day (insured)",
    amountMinor: 3868,
    currency: "CAD",
    successUrl: `${origin}/api/shipping/return?shipment=${shipmentId}`,
    cancelUrl: `${origin}/orders/${orderId}/shipping?cancelled=1`,
  },
  now
);
console.log(JSON.stringify(p, null, 2));
expect(p.mode === "payment", "mode payment");
expect(p.metadata?.kind === "shipping_label", "metadata.kind = shipping_label");
expect(p.metadata?.shipmentId === shipmentId, "metadata.shipmentId");
expect(p.metadata?.orderId === orderId, "metadata.orderId (the paid order, for the Dashboard)");
expect(!p.payment_intent_data?.transfer_data, "no destination transfer (platform charge)");
expect(!("application_fee_amount" in (p.payment_intent_data ?? {})), "no application fee");
expect(p.line_items?.length === 1, "one line");
expect(p.line_items?.[0]?.price_data?.unit_amount === 3868 && p.line_items?.[0]?.price_data?.currency === "cad", "line is 38.68 CAD");
expect(p.line_items?.[0]?.price_data?.product_data?.name === "Shipping: Canpar - Ground, 1 business day (insured)", "line name");
expect(p.customer_email === "buyer@example.com", "buyer email prefilled");
expect(!("shipping_address_collection" in p) && !("phone_number_collection" in p), "asks for nothing else");
expect(p.success_url === `${origin}/api/shipping/return?shipment=${shipmentId}`, "success URL is this site's return hop");
expect(p.expires_at === now + 3600, "expires in 60 minutes");
let threw = false;
try {
  buildShippingLabelSessionParams({ shipmentId, orderId, orderNumber: "X", customerEmail: null, lineName: "x", amountMinor: 0, currency: "CAD", successUrl: "a", cancelUrl: "b" });
} catch {
  threw = true;
}
expect(threw, "refuses a zero amount");

// Buy now / Pay now (stripeCollects in src/lib/shop-actions.ts): phone on.
const line = [{ name: "Tenmoku tea bowl", amountMinor: 9500, currency: "CAD", quantity: 1 }];
const base = { orderId, orderNumber: "T", lines: line, successUrl: "s", cancelUrl: "c", destinationAccountId: null, applicationFeeMinor: 0 };
const buyNow = buildCheckoutSessionParams({ ...base, customerEmail: "", collect: { email: true, shippingAddress: { allowedCountries: ["CA", "US"] }, phone: true } }, now);
expect(buyNow.phone_number_collection?.enabled === true, "Buy now asks for a phone");
expect(JSON.stringify(buyNow.shipping_address_collection?.allowed_countries) === '["CA","US"]', "Buy now still asks for a CA/US address");
const existing = buildCheckoutSessionParams({ ...base, customerEmail: "a@example.com" }, now);
expect(!("phone_number_collection" in existing) && !("shipping_address_collection" in existing), "an existing caller's session is unchanged");

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
