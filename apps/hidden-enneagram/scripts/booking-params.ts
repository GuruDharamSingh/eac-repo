// What a booking of a service WOULD send to Stripe, without sending it (live
// keys: no order row, no session, no Stripe object). katie's buy-now-params.ts
// pattern, for the booking path (services/[slug]/book -> startServiceCheckout
// -> startThreadCheckout -> createThreadOrder + startStripeCheckout). Usage:
//   docker compose run --rm --no-deps -T -e STRIPE_SECRET_KEY= -e SLUG=one-on-one-enneagram-reading \
//     -w /app/apps/hidden-enneagram admin \
//     node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/booking-params.ts
// Read-only: it repeats createThreadOrder's price and settlement reads
// (resolveSettlement and getPayoutIdentity only SELECT) and the destination
// rule of startStripeCheckout's resolveDestination, then prints
// buildCheckoutSessionParams. Exits 1 on any failed expectation.
import { db } from "@elkdonis/db";
import { getPayoutIdentity, resolveSettlement } from "@elkdonis/commerce/server";
import { buildCheckoutSessionParams } from "../../../packages/payments/src/providers/stripe";

let failed = 0;
const expect = (ok: boolean, what: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) failed++;
};

const ORG = "hidden-enneagram";

async function main() {
  const slug = process.env.SLUG ?? "one-on-one-enneagram-reading";
  const [svc] = await db`
    SELECT t.id, t.title, t.author_id, t.status, t.price, t.currency, t.kind,
           wp.price_member, wp.price_sliding_min, wp.registration_status
      FROM threads t LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
     WHERE t.org_id = ${ORG} AND t.slug = ${slug} AND t.kind = 'service' LIMIT 1`;
  if (!svc) throw new Error(`no service ${slug}`);
  console.log(`service: ${svc.title} · status ${svc.status} · registration ${svc.registration_status ?? "open"}`);

  // createThreadOrder's price rule (list price; no sliding amount chosen)
  const listMinor = Math.round(Number(svc.price_member ?? svc.price ?? 0) * 100);
  const currency = (svc.currency as string | null) ?? "CAD";
  const settlement = await resolveSettlement({ makerUserId: (svc.author_id as string | null) ?? null, orgId: ORG, amountMinor: listMinor });
  console.log(`settlement: maker share ${settlement.makerShareMinor}, org share ${settlement.orgShareMinor} (${settlement.orgSharePercent}%), payee "${settlement.payeeName}"`);

  // resolveDestination: one maker with a positive share AND a Stripe account that can take destination charges
  let destinationAccountId: string | null = null;
  let applicationFeeMinor = 0;
  if (settlement.makerUserId && settlement.makerShareMinor > 0) {
    const identity = await getPayoutIdentity(settlement.makerUserId);
    if (identity?.canReceiveDestinationCharge && identity.stripeAccountId) {
      destinationAccountId = identity.stripeAccountId;
      applicationFeeMinor = listMinor - settlement.makerShareMinor;
    }
  }

  // startThreadCheckout's URLs, for the live host and for the preview
  const orderId = "00000000-0000-4000-8000-000000000000";
  const path = `/services/${slug}`;
  for (const base of ["https://hiddenenneagram.com", "http://localhost:3024"]) {
    const params = buildCheckoutSessionParams(
      {
        orderId,
        orderNumber: "TEST-PARAMS",
        customerEmail: "buyer@example.com",
        lines: [{ name: svc.title as string, amountMinor: listMinor, currency, quantity: 1, imageUrl: null }],
        successUrl: `${base}/api/checkout/return?order=${encodeURIComponent(orderId)}&to=${encodeURIComponent(path)}`,
        cancelUrl: `${base}${path}/book?payment=cancelled`,
        destinationAccountId,
        applicationFeeMinor,
        expiresInMinutes: 60,
      },
      1_800_000_000,
    ) as Record<string, unknown>;
    console.log(`\nbase ${base}:\n` + JSON.stringify(params, null, 2).replace(/acct_[A-Za-z0-9]+/g, "acct_…"));
    expect(typeof params.success_url === "string" && (params.success_url as string).startsWith(`${base}/api/checkout/return?order=`), "success_url goes through this site's return hop");
    expect(params.cancel_url === `${base}${path}/book?payment=cancelled`, "cancel_url returns to the booking form");
  }
  expect(listMinor > 0, `price ${listMinor} minor > 0`);
  console.log(`\nSUMMARY amount ${listMinor} ${currency} · ${destinationAccountId ? `destination charge to the maker's account, application fee ${applicationFeeMinor}` : "platform charge (no destination account)"}`);
  console.log(failed ? `${failed} FAILED` : "all expectations passed");
}
main().then(() => process.exit(failed ? 1 : 0)).catch((e) => { console.error(String(e)); process.exit(1); });
