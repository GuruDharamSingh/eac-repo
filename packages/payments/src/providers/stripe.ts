/**
 * Stripe provider.
 *
 * Hosted Checkout, not Elements: the buyer is redirected to Stripe, pays, and
 * comes back. That keeps card data off every app in the network and means an
 * org site can take card payments with a redirect and a webhook, nothing more.
 *
 * Money routing follows the model settled 2026-09-05 (see
 * `packages/commerce/src/server/settlement.ts`):
 *
 *   * The maker is the payee. Where they have finished Express onboarding,
 *     the charge is a DESTINATION charge to their connected account and the
 *     org's agreed cut is taken as `application_fee_amount` — so it stays in
 *     the host (platform) account, earmarked to the org in the ledger.
 *   * Where they have not, the charge lands on the platform account and the
 *     ledger records what is owed; the NFP settles manually. That fallback is
 *     mandatory, not a compromise: Express onboarding is KYC and some payees
 *     never finish it.
 *   * Orgs never hold connected accounts. An org's share is only ever a
 *     ledger balance inside the host account.
 *
 * Who decides destination vs platform is NOT this file — commerce works out
 * the settlement, checkout's glue passes `destinationAccountId` in. This file
 * only talks to Stripe.
 *
 * Configuration comes from the environment (`getStripeConfigFromEnv`). With no
 * `STRIPE_SECRET_KEY` the provider is simply unavailable and every consumer
 * falls back to eTransfer, so a fresh checkout of the repo still sells.
 */

import Stripe from "stripe";
import type {
  ConfirmInput,
  ConfirmResult,
  InitiateInput,
  InitiateResult,
  PaymentProvider,
  RefundInput,
  RefundResult,
} from "../types";

export interface StripeProviderOptions {
  secretKey: string;
  publishableKey?: string | null;
  webhookSecret?: string | null;
  /**
   * The CONNECT endpoint's signing secret. Stripe signs a connected account's
   * events (account.updated and friends) with the secret of a `connect: true`
   * endpoint, which is a different endpoint — and so a different secret —
   * from the one that signs the platform's own events. One secret cannot
   * verify both, which is why seller onboarding never stamped: the events
   * were delivered to an endpoint that could not exist for them.
   */
  connectWebhookSecret?: string | null;
  /** ISO country for new Express accounts. Defaults to CA — the NFP is Canadian. */
  defaultAccountCountry?: string;
}

/** Read the Stripe keys from the environment; null when card payments are off. */
export function getStripeConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): StripeProviderOptions | null {
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) return null;
  return {
    secretKey,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY?.trim() || env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || null,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET?.trim() || null,
    connectWebhookSecret: env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim() || null,
    defaultAccountCountry: env.STRIPE_ACCOUNT_COUNTRY?.trim() || "CA",
  };
}

/** Whether a secret key is present. Cheap enough to call per request. */
export function isStripeConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.STRIPE_SECRET_KEY?.trim());
}

// ─── Checkout sessions ───────────────────────────────────────────────────────

export interface StripeCheckoutLine {
  name: string;
  description?: string | null;
  /** Integer minor units. */
  amountMinor: number;
  currency: string;
  quantity: number;
  imageUrl?: string | null;
}

/**
 * What Stripe's hosted page should ask the buyer for, on top of the card.
 * Optional and additive (2026-11-07, katie-the-potter's "Buy now"): a caller
 * that passes nothing gets exactly the session it always got.
 *
 *   email            let the buyer type their email on Stripe's page instead
 *                    of prefilling `customerEmail` (Stripe always asks when no
 *                    email is passed, so an empty `customerEmail` implies it)
 *   shippingAddress  ask for a shipping address in one of these countries
 *   phone            ask for a phone number (carriers often want one)
 *
 * What the buyer entered comes back as `collected` on the session status and
 * through {@link collectedFromSession} in the webhook.
 */
export interface StripeCollectOptions {
  email?: boolean;
  shippingAddress?: { allowedCountries: string[] } | null;
  phone?: boolean;
}

/** An address as Stripe collected it, in commerce's `Address` shape. */
export interface StripeCollectedAddress {
  recipientName: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
  phone: string | null;
}

/** What the buyer gave Stripe's page: email, name, phone, shipping address. */
export interface StripeCollectedCustomer {
  email: string | null;
  name: string | null;
  phone: string | null;
  shippingAddress: StripeCollectedAddress | null;
}

export interface CreateCheckoutSessionInput {
  orderId: string;
  orderNumber: string;
  /** Prefilled on Stripe's page. Empty = Stripe asks the buyer for it. */
  customerEmail: string;
  lines: StripeCheckoutLine[];
  successUrl: string;
  cancelUrl: string;
  /**
   * A connected account to route the payment to. Omit for a platform charge.
   * Only ever a PERSON's account — see the header.
   */
  destinationAccountId?: string | null;
  /** Kept by the platform out of a destination charge. Ignored without one. */
  applicationFeeMinor?: number;
  /** Stripe enforces 30 minutes to 24 hours. Defaults to 60. */
  expiresInMinutes?: number;
  metadata?: Record<string, string>;
  /** Optional: what else Stripe's page asks for. Omitted = as before. */
  collect?: StripeCollectOptions | null;
}

export interface StripeCheckoutSession {
  id: string;
  url: string;
  /** ISO timestamp the session stops accepting payment. */
  expiresAt: string;
}

export interface StripeCheckoutSessionStatus {
  id: string;
  /** Stripe's own: 'paid' | 'unpaid' | 'no_payment_required'. */
  paymentStatus: string;
  /** 'open' | 'complete' | 'expired'. */
  status: string | null;
  paymentIntentId: string | null;
  orderId: string | null;
  amountTotalMinor: number | null;
  currency: string | null;
  /** What the buyer entered on Stripe's page (null before they did). */
  collected?: StripeCollectedCustomer | null;
}

export interface StripeAccountStatus {
  accountId: string;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
}

/** The provider, plus the Stripe-specific surface the checkout glue drives. */
export interface StripeProvider extends PaymentProvider {
  readonly client: Stripe;
  readonly publishableKey: string | null;
  readonly canVerifyWebhooks: boolean;

  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<StripeCheckoutSession>;
  retrieveCheckoutSession(sessionId: string): Promise<StripeCheckoutSessionStatus>;
  /**
   * A hosted session that saves a card (and collects a phone number) without
   * charging it: bidder registration (ORG_STORE_BRIEF R6).
   */
  createSetupSession(input: {
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }): Promise<StripeCheckoutSession>;
  retrieveSetupSession(sessionId: string): Promise<{
    id: string;
    status: string | null;
    customerId: string | null;
    paymentMethodId: string | null;
    phone: string | null;
    metadata: Record<string, string>;
  }>;
  /** Verify and parse a webhook body. Throws when the signature is bad. */
  parseWebhook(rawBody: string, signature: string): Stripe.Event;

  createExpressAccount(input: { email: string; country?: string }): Promise<{ accountId: string }>;
  createAccountOnboardingLink(input: {
    accountId: string;
    refreshUrl: string;
    returnUrl: string;
  }): Promise<{ url: string; expiresAt: string }>;
  retrieveAccountStatus(accountId: string): Promise<StripeAccountStatus>;
}

const MIN_EXPIRY_MINUTES = 30;
const MAX_EXPIRY_MINUTES = 24 * 60;

function toIso(unixSeconds: number | null | undefined): string {
  return new Date((unixSeconds ?? Math.floor(Date.now() / 1000)) * 1000).toISOString();
}

/**
 * The exact params `createCheckoutSession` sends to Stripe. Pure (no network),
 * exported so a caller can inspect what WOULD be sent without creating a
 * session (katie-the-potter's checks run against live keys).
 *
 * Payment methods: no `payment_method_types` is set, on purpose. Checkout then
 * uses the methods switched on in the Dashboard (dynamic payment methods), and
 * with card on, Apple Pay and Google Pay appear by themselves on a device and
 * browser that support them. Stripe's hosted page needs no domain
 * registration for the wallets.
 */
export function buildCheckoutSessionParams(
  input: CreateCheckoutSessionInput,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Stripe.Checkout.SessionCreateParams {
  if (input.lines.length === 0) throw new Error("Nothing to charge for.");
  const minutes = Math.min(
    MAX_EXPIRY_MINUTES,
    Math.max(MIN_EXPIRY_MINUTES, input.expiresInMinutes ?? 60)
  );
  const expiresAt = nowSeconds + minutes * 60;

  const useDestination = Boolean(input.destinationAccountId);
  const fee = useDestination ? Math.max(0, Math.round(input.applicationFeeMinor ?? 0)) : 0;

  const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData = {
    metadata: { orderId: input.orderId, orderNumber: input.orderNumber },
  };
  if (useDestination) {
    paymentIntentData.transfer_data = { destination: input.destinationAccountId! };
    if (fee > 0) paymentIntentData.application_fee_amount = fee;
  }

  // Prefill the email unless the caller asked Stripe to collect it, or has
  // none yet (an empty customer_email is refused by Stripe; omitting it makes
  // the hosted page ask).
  const collect = input.collect ?? null;
  const email = input.customerEmail?.trim() ?? "";
  const prefillEmail = email.length > 0 && !collect?.email;
  const countries = (collect?.shippingAddress?.allowedCountries ?? [])
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));

  return {
    mode: "payment",
    ...(prefillEmail ? { customer_email: email } : {}),
    client_reference_id: input.orderId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    expires_at: expiresAt,
    metadata: { orderId: input.orderId, orderNumber: input.orderNumber, ...(input.metadata ?? {}) },
    payment_intent_data: paymentIntentData,
    ...(countries.length > 0
      ? {
          shipping_address_collection: {
            allowed_countries:
              countries as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[],
          },
        }
      : {}),
    ...(collect?.phone ? { phone_number_collection: { enabled: true } } : {}),
    line_items: input.lines.map((l) => ({
      quantity: Math.max(1, Math.round(l.quantity)),
      price_data: {
        currency: l.currency.toLowerCase(),
        unit_amount: Math.max(0, Math.round(l.amountMinor)),
        product_data: {
          name: l.name,
          ...(l.description ? { description: l.description.slice(0, 500) } : {}),
          ...(l.imageUrl && /^https?:\/\//.test(l.imageUrl) ? { images: [l.imageUrl] } : {}),
        },
      },
    })),
  };
}

const blank = (v: string | null | undefined): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * What the buyer gave Stripe's page, from a Checkout Session object (a
 * retrieved one, or a webhook's `event.data.object`). Null when nothing
 * useful was entered. The shipping details are read from
 * `collected_information` (API 2025-03-31 and later) and, for a webhook
 * endpoint pinned to an older API version, from the legacy top-level
 * `shipping_details`. `customer_details.address` is the BILLING address and
 * is never taken for shipping.
 */
export function collectedFromSession(s: Stripe.Checkout.Session): StripeCollectedCustomer | null {
  const cd = s.customer_details ?? null;
  const legacy = (s as unknown as { shipping_details?: { name?: string | null; address?: Stripe.Address | null } | null })
    .shipping_details;
  const ship = s.collected_information?.shipping_details ?? legacy ?? null;
  const a = ship?.address ?? null;
  const shippingAddress: StripeCollectedAddress | null =
    a && blank(a.line1) && blank(a.country)
      ? {
          recipientName: blank(ship?.name),
          line1: blank(a.line1)!,
          line2: blank(a.line2),
          city: blank(a.city) ?? "",
          region: blank(a.state),
          postalCode: blank(a.postal_code) ?? "",
          country: blank(a.country)!.toUpperCase(),
          phone: blank(cd?.phone),
        }
      : null;
  const out: StripeCollectedCustomer = {
    email: blank(cd?.email),
    name: blank(cd?.name) ?? blank(ship?.name),
    phone: blank(cd?.phone),
    shippingAddress,
  };
  return out.email || out.name || out.phone || out.shippingAddress ? out : null;
}

export function createStripeProvider(opts: StripeProviderOptions): StripeProvider {
  const client = new Stripe(opts.secretKey, {
    // Let the SDK's pinned API version apply; the types are generated for it.
    appInfo: { name: "Elkdonis Arts Collective", url: "https://elkdonis-arts.org" },
  });

  async function createCheckoutSession(
    input: CreateCheckoutSessionInput
  ): Promise<StripeCheckoutSession> {
    const session = await client.checkout.sessions.create(buildCheckoutSessionParams(input));

    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return { id: session.id, url: session.url, expiresAt: toIso(session.expires_at) };
  }

  async function retrieveCheckoutSession(sessionId: string): Promise<StripeCheckoutSessionStatus> {
    const s = await client.checkout.sessions.retrieve(sessionId);
    const pi = s.payment_intent;
    return {
      id: s.id,
      paymentStatus: s.payment_status,
      status: s.status ?? null,
      paymentIntentId: typeof pi === "string" ? pi : pi?.id ?? null,
      orderId: s.metadata?.orderId ?? s.client_reference_id ?? null,
      amountTotalMinor: s.amount_total ?? null,
      currency: s.currency ? s.currency.toUpperCase() : null,
      collected: collectedFromSession(s),
    };
  }

  async function createSetupSession(input: {
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }): Promise<StripeCheckoutSession> {
    const session = await client.checkout.sessions.create({
      mode: "setup",
      customer_creation: "always",
      customer_email: input.customerEmail,
      phone_number_collection: { enabled: true },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: input.metadata ?? {},
    });
    if (!session.url) throw new Error("Stripe did not return a setup URL.");
    return { id: session.id, url: session.url, expiresAt: toIso(session.expires_at) };
  }

  async function retrieveSetupSession(sessionId: string) {
    const s = await client.checkout.sessions.retrieve(sessionId, { expand: ["setup_intent"] });
    const si = s.setup_intent;
    const pm = typeof si === "object" && si ? si.payment_method : null;
    return {
      id: s.id,
      status: s.status ?? null,
      customerId: typeof s.customer === "string" ? s.customer : s.customer?.id ?? null,
      paymentMethodId: typeof pm === "string" ? pm : pm?.id ?? null,
      phone: s.customer_details?.phone ?? null,
      metadata: (s.metadata ?? {}) as Record<string, string>,
    };
  }

  function parseWebhook(rawBody: string, signature: string): Stripe.Event {
    // Both endpoints post to the same route, so the only way to tell whose
    // event this is, is to try each secret. Order is cheapest-first: platform
    // traffic (orders) far outweighs connected-account traffic (onboarding).
    const secrets = [opts.webhookSecret, opts.connectWebhookSecret].filter(
      (s): s is string => Boolean(s)
    );
    if (secrets.length === 0) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not set; refusing to trust an unsigned webhook.");
    }
    let lastError: unknown;
    for (const secret of secrets) {
      try {
        return client.webhooks.constructEvent(rawBody, signature, secret);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  }

  async function createExpressAccount(input: { email: string; country?: string }) {
    const account = await client.accounts.create({
      type: "express",
      email: input.email,
      country: input.country ?? opts.defaultAccountCountry ?? "CA",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
    });
    return { accountId: account.id };
  }

  async function createAccountOnboardingLink(input: {
    accountId: string;
    refreshUrl: string;
    returnUrl: string;
  }) {
    const link = await client.accountLinks.create({
      account: input.accountId,
      refresh_url: input.refreshUrl,
      return_url: input.returnUrl,
      type: "account_onboarding",
    });
    return { url: link.url, expiresAt: toIso(link.expires_at) };
  }

  async function retrieveAccountStatus(accountId: string): Promise<StripeAccountStatus> {
    const a = await client.accounts.retrieve(accountId);
    return {
      accountId: a.id,
      payoutsEnabled: Boolean(a.payouts_enabled),
      chargesEnabled: Boolean(a.charges_enabled),
      detailsSubmitted: Boolean(a.details_submitted),
    };
  }

  return {
    id: "stripe",
    displayName: "Credit / debit card",
    description: "Pay securely by card through Stripe. The artwork is yours as soon as the payment clears.",
    client,
    publishableKey: opts.publishableKey ?? null,
    canVerifyWebhooks: Boolean(opts.webhookSecret || opts.connectWebhookSecret),

    createCheckoutSession,
    retrieveCheckoutSession,
    createSetupSession,
    retrieveSetupSession,
    parseWebhook,
    createExpressAccount,
    createAccountOnboardingLink,
    retrieveAccountStatus,

    /**
     * The generic seam. A caller that only knows the PaymentProvider interface
     * gets a redirect back; one that needs more drives the methods above.
     */
    async initiate(input: InitiateInput): Promise<InitiateResult> {
      if (!input.successUrl || !input.cancelUrl) {
        throw new Error("Stripe checkout needs successUrl and cancelUrl.");
      }
      const lines: StripeCheckoutLine[] =
        input.lines && input.lines.length > 0
          ? input.lines
          : [
              {
                name: `Order ${input.orderNumber}`,
                amountMinor: input.totalMinor,
                currency: input.currency,
                quantity: 1,
              },
            ];
      const session = await createCheckoutSession({
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        customerEmail: input.customerEmail,
        lines,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        destinationAccountId: input.destinationAccountId ?? null,
        applicationFeeMinor: input.applicationFeeMinor,
      });
      return {
        display: { kind: "redirect", url: session.url, expiresAt: session.expiresAt },
        providerReference: session.id,
        metadata: { stripeSessionId: session.id, expiresAt: session.expiresAt },
      };
    },

    async confirm(input: ConfirmInput): Promise<ConfirmResult> {
      // Confirmation comes from Stripe (webhook or a session lookup); the
      // caller has already verified it. Nothing to do here but echo the ref.
      return {
        ok: true,
        paymentReference:
          (input.evidence?.paymentIntentId as string | undefined) ??
          input.order.paymentReference ??
          undefined,
      };
    },

    async refund(input: RefundInput): Promise<RefundResult> {
      const paymentIntent = input.order.paymentReference;
      if (!paymentIntent || !paymentIntent.startsWith("pi_")) {
        throw new Error("This order has no Stripe payment to refund.");
      }
      const r = await client.refunds.create({
        payment_intent: paymentIntent,
        amount: Math.max(1, Math.round(input.amountMinor)),
        // A destination charge is refunded from the platform balance unless
        // told to claw it back from the connected account, which is the
        // honest default: the maker was paid for a sale that did not stand.
        reverse_transfer: true,
        refund_application_fee: true,
      });
      return { ok: true, refundReference: r.id };
    },

    async webhookHandler(): Promise<Response> {
      // The real handler lives in @elkdonis/checkout/server/stripe, which
      // knows about orders. This provider only verifies signatures.
      return new Response("Use handleStripeWebhook from @elkdonis/checkout/stripe", {
        status: 501,
      });
    },
  };
}

let cached: { key: string; provider: StripeProvider } | null = null;

/**
 * The environment-configured provider, or null when Stripe is off. Cached per
 * secret key so a hot-reloading dev server does not build a client per call.
 */
export function getStripeProvider(env: NodeJS.ProcessEnv = process.env): StripeProvider | null {
  const cfg = getStripeConfigFromEnv(env);
  if (!cfg) return null;
  if (cached && cached.key === cfg.secretKey) return cached.provider;
  const provider = createStripeProvider(cfg);
  cached = { key: cfg.secretKey, provider };
  return provider;
}
