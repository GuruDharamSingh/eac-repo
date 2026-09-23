/**
 * Stripe glue — turns an order into a hosted Checkout session, a webhook (or
 * a return visit) back into a paid order, and a seller into a payable one.
 *
 * Lives here rather than in commerce or payments because it is the one place
 * that needs both: commerce owns orders, settlement and the ledger; payments
 * owns the Stripe client. Any app in the network gets card payments by:
 *
 *   1. `startStripeCheckout({ orderId, successUrl, cancelUrl })` → redirect
 *   2. a route that calls `handleStripeWebhook(request)`
 *   3. optionally `syncStripeOrder(orderId)` on the success page, so the buyer
 *      sees "paid" even when the webhook is late (or, in dev, not wired)
 *
 * Every function here is a no-op-with-a-clear-error when Stripe is not
 * configured; check `isCardPaymentAvailable()` before offering the option.
 *
 * Framework-neutral: takes and returns Fetch `Request`/`Response`.
 */

import {
  getStripeProvider,
  isStripeConfigured,
  type StripeCheckoutLine,
} from "@elkdonis/payments";
import {
  confirmOrderPaid,
  cancelOrder,
  recordStripeCheckout,
  getPayoutIdentity,
  setPayoutIdentity,
  markStripeAccountOnboarded,
  refundOrder,
  UNPAID_ORDER_STATUSES,
} from "@elkdonis/commerce/server";
import { getOrderById, getOrderLines } from "@elkdonis/commerce/queries";
import { normaliseCountry } from "@elkdonis/commerce/payout-rails";
import type { Order, PayoutIdentity } from "@elkdonis/commerce/types";

/** Whether the card option should be offered at all. */
export function isCardPaymentAvailable(): boolean {
  return isStripeConfigured();
}

function requireStripe() {
  const stripe = getStripeProvider();
  if (!stripe) {
    throw new Error("Card payments are not available right now. Please pay by eTransfer.");
  }
  return stripe;
}

/**
 * Where a destination charge would go, if anywhere.
 *
 * One order maps to one payee only when every line has the same maker and
 * that maker has finished Express onboarding. Otherwise the charge lands on
 * the platform account and the ledger records what is owed to whom — the
 * mandatory fallback. The application fee is the org's earmarked cut across
 * the lines, which stays in the host account exactly as the ledger expects.
 */
async function resolveDestination(orderId: string): Promise<{
  destinationAccountId: string | null;
  applicationFeeMinor: number;
}> {
  const lines = await getOrderLines(orderId);
  const makers = new Set(lines.map((l) => l.artistUserId ?? null));
  const orgCut = lines.reduce((s, l) => s + (l.galleryShareMinor ?? 0), 0);
  if (makers.size !== 1) return { destinationAccountId: null, applicationFeeMinor: 0 };
  const makerId = [...makers][0];
  if (!makerId) return { destinationAccountId: null, applicationFeeMinor: 0 };

  const identity = await getPayoutIdentity(makerId);
  if (!identity?.canReceiveDestinationCharge || !identity.stripeAccountId) {
    return { destinationAccountId: null, applicationFeeMinor: 0 };
  }
  return { destinationAccountId: identity.stripeAccountId, applicationFeeMinor: orgCut };
}

/**
 * Open a Checkout session for an unpaid order and return the URL to send the
 * buyer to. Works for an order created on either rail — a buyer who was given
 * eTransfer instructions can still pay by card from the order page.
 */
/**
 * The most Stripe will put on one card charge, in minor units ($999,999.99 in
 * CAD/USD/EUR). Above it no payment method qualifies, and Stripe says so in
 * the least helpful way available: "No valid payment method types for this
 * Checkout Session", which points at dashboard settings that are fine. A
 * $123-billion test price produced exactly that on 2026-09-21.
 *
 * Deliberately NOT enforced when a work is listed: a fine-art sale above it is
 * legitimate and simply goes by e-Transfer, which has no ceiling.
 */
export const CARD_CHARGE_CEILING_MINOR = 99_999_999;

/**
 * Card checkout could not start, for a reason the buyer can act on. Callers
 * catch this and send the buyer to their order page — which already offers
 * e-Transfer and a retry — instead of letting it surface as an error page.
 * The order itself is untouched and still payable.
 */
export class CardCheckoutRefused extends Error {
  constructor(
    public readonly reason: "over_ceiling" | "stripe_refused",
    message: string
  ) {
    super(message);
    this.name = "CardCheckoutRefused";
  }
}

export async function startStripeCheckout(input: {
  orderId: string;
  successUrl: string;
  cancelUrl: string;
  /** Absolute image URLs only; Stripe ignores anything else. */
  imageBase?: string | null;
}): Promise<{ url: string; sessionId: string }> {
  const stripe = requireStripe();
  const order = await getOrderById(input.orderId);
  if (!order) throw new Error("Order not found.");
  if (!(UNPAID_ORDER_STATUSES as readonly string[]).includes(order.status)) {
    throw new Error("This order can no longer be paid.");
  }

  const lineRows = await getOrderLines(input.orderId);

  const lines: StripeCheckoutLine[] = lineRows.map((l) => {
    const img = l.imageUrl ?? null;
    const abs =
      img && /^https?:\/\//.test(img)
        ? img
        : img && input.imageBase && /^https?:\/\//.test(input.imageBase)
          ? `${input.imageBase.replace(/\/$/, "")}${img.startsWith("/") ? "" : "/"}${img}`
          : null;
    return {
      name: l.description,
      amountMinor: l.unitPriceMinor,
      currency: l.currency,
      quantity: l.quantity,
      imageUrl: abs,
    };
  });

  if (order.totalMinor > CARD_CHARGE_CEILING_MINOR) {
    throw new CardCheckoutRefused(
      "over_ceiling",
      `Order ${order.number} is more than a card can carry in one payment.`
    );
  }

  const { destinationAccountId, applicationFeeMinor } = await resolveDestination(order.id);

  let session: Awaited<ReturnType<typeof stripe.createCheckoutSession>>;
  try {
    session = await stripe.createCheckoutSession({
      orderId: order.id,
      orderNumber: order.number,
      customerEmail: order.customerEmail,
      lines,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      destinationAccountId,
      applicationFeeMinor,
      expiresInMinutes: 60,
    });
  } catch (err) {
    // Stripe declining the SESSION (as opposed to the card, which happens on
    // Stripe's own page) is something about this order the buyer can route
    // around. Anything else — no network, a bad key — is ours and stays loud.
    if ((err as { type?: string })?.type === "StripeInvalidRequestError") {
      console.error(`[checkout] Stripe refused a session for ${order.number}:`, err);
      throw new CardCheckoutRefused("stripe_refused", (err as Error).message);
    }
    throw err;
  }

  await recordStripeCheckout({
    orderId: order.id,
    sessionId: session.id,
    sessionExpiresAt: session.expiresAt,
    destinationAccountId,
    applicationFeeMinor,
  });

  return { url: session.url, sessionId: session.id };
}

/**
 * Reconcile an order against its last Checkout session. Confirms the order if
 * Stripe says it is paid and we have not recorded that yet. Idempotent; safe to
 * call on every visit to the order page.
 */
export async function syncStripeOrder(orderId: string): Promise<Order | null> {
  const order = await getOrderById(orderId);
  if (!order) return null;
  const stripe = getStripeProvider();
  if (!stripe) return order;
  const sessionId = (order.paymentMetadata?.stripe as { sessionId?: string } | undefined)?.sessionId;
  if (!sessionId) return order;
  if (!(UNPAID_ORDER_STATUSES as readonly string[]).includes(order.status)) return order;

  try {
    const s = await stripe.retrieveCheckoutSession(sessionId);
    if (s.paymentStatus === "paid") {
      return await confirmOrderPaid({
        orderId,
        confirmedByUserId: null,
        method: "stripe",
        paymentReference: s.paymentIntentId ?? sessionId,
        notes: `Stripe session ${sessionId} reconciled on return`,
      });
    }
  } catch (err) {
    console.error(`[checkout] syncStripeOrder(${orderId}):`, err);
  }
  return order;
}

/**
 * The webhook. Verifies the signature, then:
 *
 *   checkout.session.completed  → order paid (idempotent; a late duplicate
 *                                 hits the status guard and is ignored)
 *   checkout.session.expired    → order cancelled, piece released
 *   account.updated             → payouts_enabled → stamp the seller as
 *                                 onboarded, which releases anything held
 *                                 for want of a payout account
 *
 * Always answers 2xx once the signature checks out, so Stripe does not retry
 * an event we deliberately ignored.
 */
export async function handleStripeWebhook(request: Request): Promise<Response> {
  const stripe = getStripeProvider();
  if (!stripe) return new Response("Stripe not configured", { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const raw = await request.text();
  let event;
  try {
    event = stripe.parseWebhook(raw, signature);
  } catch (err) {
    console.error("[checkout] webhook signature failed:", err);
    return new Response("Bad signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const s = event.data.object;
        const orderId = s.metadata?.orderId ?? s.client_reference_id;
        if (orderId && s.payment_status === "paid") {
          const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id;
          try {
            await confirmOrderPaid({
              orderId,
              confirmedByUserId: null,
              method: "stripe",
              paymentReference: pi ?? s.id,
              notes: `Stripe ${event.type} (${event.id})`,
            });
          } catch (err) {
            // Already confirmed by the return-visit sync, or cancelled by the
            // expiry sweep between payment and this event. The former is
            // fine; the latter needs a human, so make it loud.
            console.warn(`[checkout] webhook confirm for ${orderId} skipped:`, err);
          }
        }
        break;
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const s = event.data.object;
        const orderId = s.metadata?.orderId ?? s.client_reference_id;
        if (orderId) {
          const order = await getOrderById(orderId);
          // Only release a card-rail order; an eTransfer order that tried a
          // card session and abandoned it still has its eTransfer window.
          if (order && order.paymentMethod === "stripe" && order.status === "pending_payment") {
            await cancelOrder({ orderId, reason: `Stripe ${event.type}` }).catch((err) =>
              console.warn(`[checkout] webhook cancel for ${orderId} skipped:`, err)
            );
          }
        }
        break;
      }
      case "account.updated": {
        const a = event.data.object;
        if (a.payouts_enabled) {
          await markStripeAccountOnboarded(a.id);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error(`[checkout] webhook ${event.type} handler failed:`, err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

// ─── Seller onboarding (Express) ─────────────────────────────────────────────

/**
 * Send a person to Stripe Express onboarding, creating their connected
 * account first if they have none. Only PEOPLE onboard — an org's share is a
 * ledger balance, never a connected account (decided 2026-09-05).
 */
export async function startStripeOnboarding(input: {
  userId: string;
  email: string;
  refreshUrl: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const stripe = requireStripe();
  let identity = await getPayoutIdentity(input.userId);
  if (!identity) throw new Error("No such user.");

  try {
    if (!identity.stripeAccountId) {
      // The account's country is fixed at creation and never changes after —
      // Stripe's hosted onboarding then requires the individual's own address
      // to match it. Omitting this let every account fall back to the
      // platform's own country (CA), so a US (or any non-Canadian) artist's
      // real address could never match and onboarding failed with "address
      // must match account country" (2026-09-20). `identity.country` is
      // whatever PayoutSetup saved; when it's unset we still have nothing
      // better to offer than the provider's own default.
      const { accountId } = await stripe.createExpressAccount({
        email: input.email,
        country: identity.country ?? undefined,
      });
      await setPayoutIdentity(input.userId, { stripeAccountId: accountId });
      identity = { ...identity, stripeAccountId: accountId };
    }

    const link = await stripe.createAccountOnboardingLink({
      accountId: identity.stripeAccountId!,
      refreshUrl: input.refreshUrl,
      returnUrl: input.returnUrl,
    });
    return { url: link.url };
  } catch (err) {
    // A RESTRICTED key (`rk_…`) can be perfectly able to take payments and
    // still be unable to create a connected account — onboarding needs
    // `connected_account_write` and `account_link_write`, which are separate
    // permissions and off by default. Saying "could not reach Stripe" sends
    // whoever sees it looking for a network fault that isn't there.
    if ((err as { code?: string })?.code === "more_permissions_required") {
      throw new Error(
        "Stripe payouts are not finished being set up on this platform: the API key in use cannot " +
          "create connected accounts. An administrator needs to enable the Connect 'Accounts write' " +
          "and 'Account links write' permissions on it."
      );
    }
    throw err;
  }
}

/**
 * What the Payouts tab says before anyone presses Connect.
 *
 * Network-wide on purpose: every org on this platform shares one Stripe
 * account, one ledger and one set of KYC hurdles, so the explanation is the
 * same wherever the tab is mounted. It lived in innergathering until IFAC
 * needed the identical four paragraphs (2026-09-20). A host that needs its
 * own wording still passes its own `onboarding`; this is the default, not a
 * requirement.
 */
export const PAYOUT_ONBOARDING_COPY: { title: string; paragraphs: string[] } = {
  title: "Elkdonis Onboarding",
  paragraphs: [
    "As a not-for-profit, EAC directs a variety of projects — Art Dealing, Education, Business, and Agency. We hire or contract artists or groups to fulfill the directives of these projects. If you wish to get more involved with the direction of projects, go to arts-collective.com/hub/elkdonis to see where we align.",
    "Know Your Customer rules mean Stripe will request your banking information and perhaps ID verification. We hope you consider these institutional hurdles as part of the formalization of you as your own company. Stripe allows us to pay the international network of Elkdonis instantly, and provides refund security for artist and client.",
    "You can also continue without a Stripe account, and post your offerings until the day someone wishes to make a transaction with you. You can also choose to be paid by Elkdonis through PayPal, though this comes with higher fees. Stripe has a fairly standard rate for card payments of 2.5% + 30¢ per transaction.",
    "Elkdonis and Mutual Aid provide this institutional gateway for the collective and well-being of everyone's interconnected nature.",
  ],
};;

/**
 * The whole "connect me to Stripe" step, as one call a host can make.
 *
 * Every site that mounts the profile surface's Payouts tab needs the same
 * five things: refuse when the platform has no key, demand a country the
 * first time (and save it BEFORE the account exists, because Stripe fixes it
 * at creation and never changes it after), start or resume onboarding, send
 * Stripe somewhere to return to, and pass a real error through instead of
 * "could not reach Stripe". That was written once per app and drifted; this
 * is the one copy. A host supplies only what it alone knows — who is asking
 * and its own origin.
 *
 * `returnPath` is where Stripe sends them back. The host must make that route
 * call `refreshStripeAccountStatus`, otherwise the person returns to a page
 * that isn't listening and stays "not finished" despite Stripe being happy —
 * which is exactly how two fully-payable accounts sat unstamped until
 * 2026-09-20.
 */
export async function startPayoutsFor(input: {
  userId: string;
  email: string;
  /** Absolute origin of the host site, e.g. https://ifac.example. */
  origin: string;
  /** Path Stripe returns to; `?payouts=done|refresh` is appended. */
  returnPath?: string;
  /** ISO-3166 alpha-2 from the surface's picker; required before an account exists. */
  country?: string;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!isStripeConfigured()) {
    return { ok: false, error: "Card payments are not switched on for this platform yet." };
  }

  try {
    const identity = await getPayoutIdentity(input.userId);
    if (!identity?.stripeAccountId && !identity?.country) {
      // No account yet and nothing on file — the one moment Stripe will ever
      // accept a country for it, so a request with none is refused rather
      // than quietly defaulting to the platform's own.
      const normalised = normaliseCountry(input.country);
      if (!normalised) return { ok: false, error: "Choose where you are first." };
      await setPayoutIdentity(input.userId, { country: normalised });
    }
  } catch (err) {
    console.error(`[checkout] startPayoutsFor(${input.userId}) country:`, err);
    return { ok: false, error: "Could not save that." };
  }

  const path = input.returnPath ?? "/account";
  const sep = path.includes("?") ? "&" : "?";
  try {
    const { url } = await startStripeOnboarding({
      userId: input.userId,
      email: input.email,
      // Stripe uses both: refresh when the link has expired, return when done.
      refreshUrl: `${input.origin}${path}${sep}payouts=refresh`,
      returnUrl: `${input.origin}${path}${sep}payouts=done`,
    });
    return { ok: true, url };
  } catch (err) {
    console.error(`[checkout] startPayoutsFor(${input.userId}):`, err);
    // Pass the real reason through. A generic "could not reach Stripe" hid a
    // key-permission problem behind what read as an outage.
    const message =
      err instanceof Error && err.message.startsWith("Stripe payouts are not finished")
        ? err.message
        : "Could not reach Stripe.";
    return { ok: false, error: message };
  }
}

/**
 * Ask Stripe whether a person's account is payable yet, and stamp it if so.
 * Called on return from onboarding — the webhook does the same, but a seller
 * should not have to reload until it arrives.
 */
export async function refreshStripeAccountStatus(
  userId: string
): Promise<PayoutIdentity | null> {
  const identity = await getPayoutIdentity(userId);
  if (!identity?.stripeAccountId) return identity;
  const stripe = getStripeProvider();
  if (!stripe) return identity;
  try {
    const status = await stripe.retrieveAccountStatus(identity.stripeAccountId);
    if (status.payoutsEnabled && !identity.stripeOnboardedAt) {
      await setPayoutIdentity(userId, {
        stripeOnboardedAt: new Date().toISOString(),
        payoutMethod: "stripe",
      });
      return getPayoutIdentity(userId);
    }
  } catch (err) {
    console.error(`[checkout] refreshStripeAccountStatus(${userId}):`, err);
  }
  return identity;
}

/**
 * Disconnect AND forget the country — the only way out of an account Stripe
 * created under the wrong one, since it never lets that change on an existing
 * account. Clearing the country is the half that matters: leave it and the
 * next attempt silently reuses it and rebuilds the same broken account.
 */
export async function disconnectPayoutsFor(
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await disconnectStripeAccount(userId);
    await setPayoutIdentity(userId, { country: null });
    return { ok: true };
  } catch (err) {
    console.error(`[checkout] disconnectPayoutsFor(${userId}):`, err);
    return { ok: false, error: "Could not disconnect that." };
  }
}

/** Disconnect a person's Stripe account; they fall back to manual settlement. */
export async function disconnectStripeAccount(userId: string): Promise<void> {
  await setPayoutIdentity(userId, { stripeAccountId: null, payoutMethod: "etransfer" });
}

/**
 * Refund a card order in full through Stripe, then record the reversal. A
 * destination charge is clawed back from the maker's connected account and
 * the application fee returned, so the platform is not left carrying the
 * org's cut of a sale that did not stand.
 */
export async function refundStripeOrder(input: {
  orderId: string;
  actorUserId: string | null;
  reason?: string;
}): Promise<Order> {
  const stripe = requireStripe();
  const order = await getOrderById(input.orderId);
  if (!order) throw new Error("Order not found.");
  if (order.paymentMethod !== "stripe") {
    throw new Error("This order was not paid by card; record the refund manually.");
  }
  const r = await stripe.refund!({
    order: { id: order.id, currency: order.currency, paymentReference: order.paymentReference ?? null },
    amountMinor: order.totalMinor,
    notes: input.reason,
  });
  return refundOrder({
    orderId: order.id,
    actorUserId: input.actorUserId,
    reason: input.reason,
    refundReference: r.refundReference ?? null,
  });
}
