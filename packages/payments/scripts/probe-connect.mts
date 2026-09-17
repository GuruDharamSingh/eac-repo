/**
 * Live probe of the Stripe Connect Express path against the REAL Stripe API.
 *
 * The marketplace e2e (packages/commerce/scripts/e2e-marketplace.ts) runs on
 * dummy keys and never calls Stripe — it proves our order/ledger/webhook logic,
 * not that the Connect calls in providers/stripe.ts are shaped correctly. This
 * script closes that gap: every call here goes over the wire.
 *
 * TEST KEYS ONLY. It refuses to run against a live key, because it creates a
 * connected account and (unless --keep) deletes it again.
 *
 *   cd packages/payments && node --experimental-strip-types scripts/probe-connect.mts
 *   # or: pnpm tsx scripts/probe-connect.mts
 *
 * Flags:
 *   --keep   leave the connected account behind (so you can finish onboarding
 *            in the browser and re-run with --account=acct_xxx)
 *   --account=acct_xxx   probe an existing account instead of making one
 */

import {
  getStripeConfigFromEnv,
  createStripeProvider,
  type StripeProvider,
} from "../src/providers/stripe";

const argv = process.argv.slice(2);
const KEEP = argv.includes("--keep");
const EXISTING = argv.find((a) => a.startsWith("--account="))?.split("=")[1] ?? null;

let pass = 0;
let fail = 0;
function ok(label: string, detail = "") {
  pass++;
  console.log(`  \x1b[32m✓\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`);
}
function bad(label: string, err: unknown) {
  fail++;
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`  \x1b[31m✗\x1b[0m ${label}\n      ${msg}`);
}
function note(msg: string) {
  console.log(`  \x1b[2m·\x1b[0m \x1b[2m${msg}\x1b[0m`);
}
function head(msg: string) {
  console.log(`\n\x1b[1m${msg}\x1b[0m`);
}

const cfg = getStripeConfigFromEnv();
if (!cfg) {
  console.error("STRIPE_SECRET_KEY is not set. Nothing to probe.");
  process.exit(2);
}
if (!cfg.secretKey.startsWith("sk_test_") && !cfg.secretKey.startsWith("rk_test_")) {
  console.error("Refusing to run: this is not a test key. This script creates and deletes accounts.");
  process.exit(2);
}

const stripe: StripeProvider = createStripeProvider(cfg);

head("Configuration");
ok("secret key loaded", "test mode");
cfg.publishableKey
  ? ok("publishable key loaded", cfg.publishableKey.slice(0, 12) + "…")
  : note("no STRIPE_PUBLISHABLE_KEY (only needed for Elements, not hosted Checkout)");
cfg.webhookSecret
  ? ok("webhook secret loaded")
  : note("no STRIPE_WEBHOOK_SECRET — handleStripeWebhook will reject every event");
ok("default account country", cfg.defaultAccountCountry ?? "CA");

head("Platform account");
const platform = await stripe.client.accounts.retrieve();
ok("platform reachable", `${platform.id} · ${platform.country} · ${platform.default_currency?.toUpperCase()}`);
if (!platform.charges_enabled) {
  note("charges_enabled=false on the platform — normal for a fresh sandbox, but a LIVE account in this state cannot take money");
}

head("Express onboarding (providers/stripe.ts)");
let accountId: string | null = EXISTING;
let created = false;

if (!accountId) {
  try {
    const r = await stripe.createExpressAccount({
      email: `probe-${Date.now()}@example.invalid`,
    });
    accountId = r.accountId;
    created = true;
    ok("createExpressAccount()", accountId);
  } catch (err) {
    bad("createExpressAccount()", err);
  }
} else {
  ok("using existing account", accountId);
}

if (accountId) {
  try {
    const link = await stripe.createAccountOnboardingLink({
      accountId,
      refreshUrl: "http://localhost:3009/studio?stripe=refresh",
      returnUrl: "http://localhost:3009/studio?stripe=return",
    });
    ok("createAccountOnboardingLink()", `expires ${link.expiresAt}`);
    console.log(`\n      \x1b[36m${link.url}\x1b[0m\n`);
    note("open that URL to complete KYC as a test seller (use 000-000-0000 / any test data)");
  } catch (err) {
    bad("createAccountOnboardingLink()", err);
  }

  try {
    const st = await stripe.retrieveAccountStatus(accountId);
    ok(
      "retrieveAccountStatus()",
      `charges=${st.chargesEnabled} payouts=${st.payoutsEnabled} submitted=${st.detailsSubmitted}`
    );
    if (!st.payoutsEnabled) {
      note("payouts disabled until onboarding completes — this is what gates the destination charge below");
    }
  } catch (err) {
    bad("retrieveAccountStatus()", err);
  }
}

head("Checkout — platform charge (the mandatory fallback)");
try {
  const s = await stripe.createCheckoutSession({
    orderId: "probe-platform",
    orderNumber: "PROBE-1",
    customerEmail: "probe-buyer@example.invalid",
    lines: [{ name: "Probe piece", amountMinor: 5000, currency: "CAD", quantity: 1 }],
    successUrl: "http://localhost:3009/orders/probe?ok=1",
    cancelUrl: "http://localhost:3009/orders/probe?cancelled=1",
  });
  ok("createCheckoutSession() platform charge", s.id);
  try {
    const back = await stripe.retrieveCheckoutSession(s.id);
    ok("retrieveCheckoutSession()", `status=${back.status} payment=${back.paymentStatus} order=${back.orderId}`);
  } catch (err) {
    bad("retrieveCheckoutSession()", err);
  }
  await stripe.client.checkout.sessions.expire(s.id).catch(() => {});
} catch (err) {
  bad("createCheckoutSession() platform charge", err);
}

head("Checkout — destination charge to the maker (Express)");
if (accountId) {
  try {
    const s = await stripe.createCheckoutSession({
      orderId: "probe-destination",
      orderNumber: "PROBE-2",
      customerEmail: "probe-buyer@example.invalid",
      lines: [{ name: "Probe piece", amountMinor: 5000, currency: "CAD", quantity: 1 }],
      successUrl: "http://localhost:3009/orders/probe?ok=1",
      cancelUrl: "http://localhost:3009/orders/probe?cancelled=1",
      destinationAccountId: accountId,
      applicationFeeMinor: 1000, // the org's 20% cut, kept in the platform account
    });
    ok("createCheckoutSession() destination charge + application fee", s.id);
    note("the maker's account is payable, so destination charges work end to end");
    await stripe.client.checkout.sessions.expire(s.id).catch(() => {});
  } catch (err) {
    bad("createCheckoutSession() destination charge", err);
    note("EXPECTED before KYC: a connected account needs the `transfers` capability active.");
    note("This is exactly why resolveDestination() falls back to a platform charge — see");
    note("packages/checkout/src/server/stripe.ts. Finish onboarding, then re-run with --account=" + accountId);
  }
} else {
  note("skipped — no connected account");
}

head("Webhook verification");
if (cfg.webhookSecret) {
  try {
    const payload = JSON.stringify({ id: "evt_probe", object: "event", type: "ping", data: { object: {} } });
    const sig = stripe.client.webhooks.generateTestHeaderString({
      payload,
      secret: cfg.webhookSecret,
    });
    stripe.parseWebhook(payload, sig);
    ok("parseWebhook() accepts a correctly signed event");
    try {
      stripe.parseWebhook(payload, "t=1,v1=deadbeef");
      bad("parseWebhook() rejects a bad signature", new Error("it did NOT reject a forged signature"));
    } catch {
      ok("parseWebhook() rejects a forged signature");
    }
  } catch (err) {
    bad("parseWebhook()", err);
  }
} else {
  note("skipped — set STRIPE_WEBHOOK_SECRET to probe signature verification");
}

head("Cleanup");
if (created && accountId && !KEEP) {
  try {
    await stripe.client.accounts.del(accountId);
    ok("deleted the probe connected account", accountId);
  } catch (err) {
    bad("could not delete " + accountId, err);
  }
} else if (accountId) {
  note(`kept ${accountId}`);
}

console.log(
  `\n\x1b[1m${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} passed, ${fail} failed\x1b[0m\n`
);
process.exit(fail === 0 ? 0 : 1);
