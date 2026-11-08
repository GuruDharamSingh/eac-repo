/**
 * Shipping paid AFTER the sale: the STRIPE half (2026-11-07, migration 251).
 *
 * A paid order's buyer pays for shipping in a second, small hosted Checkout
 * linked to the order. Two kinds, told apart by `metadata.kind`:
 *
 *   "shipping_payment"  QUOTE-ONLY (the model in use). The buyer pays the
 *                       carrier quote they chose; the maker buys the label
 *                       herself, so the money is HERS: a destination charge
 *                       to her connected account (application fee 0, no
 *                       commission) when she can receive one, otherwise a
 *                       platform charge and the ledger records it as owed to
 *                       her (commerce recordShippingPaymentPaid).
 *   "shipping_label"    the first design, parked: the collective bought the
 *                       label on its own Easyship account, so it was always a
 *                       platform charge with no ledger entry. Still recorded
 *                       exactly as before if one ever arrives.
 *
 * Every session carries metadata.shipmentId (the order_shipment row) and
 * metadata.orderId (the already-paid order, for the Dashboard). The
 * shipping_payment kind also carries the chosen quote (courier service id,
 * courier, service, estimated days, amount, currency, quoted-at, insurance,
 * parcel, ship-to country) and its routing (route, payTo, destination), so
 * Stripe, the webhook and the app all see the same choice.
 *
 * handleStripeWebhook routes both kinds here BEFORE its order branches, so a
 * shipping session never confirms or cancels an order. Nothing here buys a
 * label. Framework-neutral and additive: no existing session changes.
 */

import {
  buildCheckoutSessionParams,
  getStripeProvider,
  type CreateCheckoutSessionInput,
} from "@elkdonis/payments";
import {
  getPayoutIdentity,
  recordShippingLabelPaid,
  recordShippingLabelSessionExpired,
  recordShippingPaymentPaid,
  type ShippingPaymentLedger,
} from "@elkdonis/commerce/server";
import { getOrderLines } from "@elkdonis/commerce/queries";
import type { PayoutIdentity } from "@elkdonis/commerce/types";

/** The quote-only kind (current). */
export const SHIPPING_PAYMENT_KIND = "shipping_payment";
/** The parked label-buying kind; still accepted. */
export const SHIPPING_LABEL_KIND = "shipping_label";
const SHIPPING_KINDS = new Set([SHIPPING_PAYMENT_KIND, SHIPPING_LABEL_KIND]);

export interface ShippingLabelCheckoutInput {
  shipmentId: string;
  orderId: string;
  orderNumber: string;
  customerEmail: string | null;
  /** One line, e.g. "Shipping: Canpar Ground, 1 to 2 days". */
  lineName: string;
  amountMinor: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  /** 30 to 1440; default 60. */
  expiresInMinutes?: number;
}

function sessionInput(input: ShippingLabelCheckoutInput): CreateCheckoutSessionInput {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error("Nothing to charge for shipping.");
  return {
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    customerEmail: input.customerEmail?.trim() ?? "",
    lines: [{ name: input.lineName.slice(0, 250), amountMinor: input.amountMinor, currency: input.currency, quantity: 1, imageUrl: null }],
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    // Platform charge: the label is the platform's cost.
    destinationAccountId: null,
    applicationFeeMinor: 0,
    expiresInMinutes: input.expiresInMinutes ?? 60,
    metadata: { kind: SHIPPING_LABEL_KIND, shipmentId: input.shipmentId },
  };
}

/** (Parked label flow) the exact params a label session would send to Stripe. Pure. */
export function buildShippingLabelSessionParams(input: ShippingLabelCheckoutInput, nowSeconds?: number) {
  return buildCheckoutSessionParams(sessionInput(input), nowSeconds);
}

/** (Parked label flow) open the label-payment session. Creates a real Stripe object. */
export async function startShippingLabelCheckout(input: ShippingLabelCheckoutInput): Promise<{ url: string; sessionId: string; expiresAt: string }> {
  const stripe = getStripeProvider();
  if (!stripe) throw new Error("Card payments are not available right now.");
  const s = await stripe.createCheckoutSession(sessionInput(input));
  return { url: s.url, sessionId: s.id, expiresAt: s.expiresAt };
}

// ─── Quote-only: the shipping payment ────────────────────────────────────────

/** Where the shipping money goes. */
export interface ShippingPaymentRoute {
  /** The order's single maker (the money is theirs), or null. */
  payToUserId: string | null;
  /** Their connected account when they can receive a destination charge, else null (platform charge + ledger). */
  destinationAccountId: string | null;
}

/** Pure: the route for a maker and their payout identity (the same test resolveDestination uses). */
export function shippingRouteFor(
  makerUserId: string | null,
  identity: Pick<PayoutIdentity, "stripeAccountId" | "canReceiveDestinationCharge"> | null
): ShippingPaymentRoute {
  if (!makerUserId) return { payToUserId: null, destinationAccountId: null };
  const dest = identity?.canReceiveDestinationCharge && identity.stripeAccountId ? identity.stripeAccountId : null;
  return { payToUserId: makerUserId, destinationAccountId: dest };
}

/**
 * The route for an order's shipping payment: the single maker of its lines;
 * a destination charge only when they have finished Express onboarding
 * (`canReceiveDestinationCharge`), otherwise a platform charge. Reads only.
 */
export async function resolveShippingPaymentRoute(orderId: string): Promise<ShippingPaymentRoute> {
  const lines = await getOrderLines(orderId);
  const makers = new Set(lines.map((l) => l.artistUserId ?? null).filter((x): x is string => Boolean(x)));
  const maker = makers.size === 1 ? [...makers][0]! : null;
  return shippingRouteFor(maker, maker ? await getPayoutIdentity(maker) : null);
}

/** The chosen quote, as it travels to Stripe (all strings; Stripe metadata values ≤ 500 chars). */
export interface ShippingQuoteFacts {
  /** Easyship courier service id (what identifies the rate). */
  courierServiceId: string;
  courier: string;
  service: string;
  /** "2-4" business days, or "" when not given. */
  estDays: string;
  quotedAt: string;
  insured: boolean;
  /** "30x30x30cm 2.1kg" (one per parcel, "; " between). */
  parcel: string;
  shipToCountry: string;
}

export interface ShippingPaymentCheckoutInput extends ShippingLabelCheckoutInput {
  /** Shown under the line on Stripe's page. */
  lineDescription?: string | null;
  route: ShippingPaymentRoute;
  quote: ShippingQuoteFacts;
}

function paymentSessionInput(input: ShippingPaymentCheckoutInput): CreateCheckoutSessionInput {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error("Nothing to charge for shipping.");
  const q = input.quote;
  const cut = (s: string | null | undefined, n = 500) => (s ?? "").slice(0, n);
  return {
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    customerEmail: input.customerEmail?.trim() ?? "",
    lines: [
      {
        name: input.lineName.slice(0, 250),
        description: input.lineDescription ? input.lineDescription.slice(0, 500) : null,
        amountMinor: input.amountMinor,
        currency: input.currency,
        quantity: 1,
        imageUrl: null,
      },
    ],
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    // The maker's money: to her connected account when she can take it,
    // with NO application fee (no commission on shipping); else a platform
    // charge, recorded in the ledger as owed to her.
    destinationAccountId: input.route.destinationAccountId,
    applicationFeeMinor: 0,
    expiresInMinutes: input.expiresInMinutes ?? 60,
    metadata: {
      kind: SHIPPING_PAYMENT_KIND,
      shipmentId: input.shipmentId,
      route: input.route.destinationAccountId ? "destination" : "platform",
      payTo: input.route.payToUserId ?? "",
      destination: input.route.destinationAccountId ?? "",
      courierServiceId: cut(q.courierServiceId),
      courier: cut(q.courier),
      service: cut(q.service),
      estDays: cut(q.estDays),
      amountMinor: String(input.amountMinor),
      currency: input.currency.toUpperCase(),
      quotedAt: cut(q.quotedAt),
      insured: q.insured ? "yes" : "no",
      parcel: cut(q.parcel),
      shipToCountry: cut(q.shipToCountry, 2),
      quoteSource: "easyship",
    },
  };
}

/** The exact params a quote-only shipping session would send to Stripe. Pure: nothing is created. */
export function buildShippingPaymentSessionParams(input: ShippingPaymentCheckoutInput, nowSeconds?: number) {
  return buildCheckoutSessionParams(paymentSessionInput(input), nowSeconds);
}

/** Open the shipping-payment session. Creates a real Stripe object: callers check the shipment's mode first. */
export async function startShippingPaymentCheckout(input: ShippingPaymentCheckoutInput): Promise<{ url: string; sessionId: string; expiresAt: string }> {
  const stripe = getStripeProvider();
  if (!stripe) throw new Error("Card payments are not available right now.");
  const s = await stripe.createCheckoutSession(paymentSessionInput(input));
  return { url: s.url, sessionId: s.id, expiresAt: s.expiresAt };
}

// ─── Recording a session (return hop, webhook, and checks) ───────────────────

export interface ShippingLabelSessionState {
  status: "paid" | "open" | "expired" | "unknown";
  paymentIntentId: string | null;
  amountTotalMinor: number | null;
  currency: string | null;
  /** This call moved the shipment to 'paid'. */
  recorded: boolean;
  /** Quote-only payments: what the ledger got (when this call recorded it). */
  ledger?: ShippingPaymentLedger | null;
}

/** The parts of a Checkout Session object these functions read (a Stripe object, or a test double). */
export interface ShippingSessionLike {
  id: string;
  metadata?: Record<string, string> | null;
  payment_status?: string | null;
  status?: string | null;
  payment_intent?: string | { id: string } | null;
  amount_total?: number | null;
  currency?: string | null;
  client_reference_id?: string | null;
}

/** Whether a Checkout Session object is a shipping payment (either kind). */
export function isShippingPaymentSession(s: { metadata?: Record<string, string> | null } | null | undefined): boolean {
  return SHIPPING_KINDS.has(s?.metadata?.kind ?? "");
}
/** Old name, same test (both kinds). */
export const isShippingLabelSession = isShippingPaymentSession;

/**
 * Record what a shipping session says, for ONE shipment: paid → the
 * shipment is paid (and, for the quote-only kind, the ledger written in the
 * same transaction); expired → back to choosing. The single path the return
 * hop, the webhook and the scripted checks all use. A session for another
 * shipment, or of another kind, changes nothing.
 *
 * `paid` is decided by the caller from what it has: the return hop from the
 * retrieved session's payment_status, the webhook from the event type too.
 */
export async function applyShippingPaymentSession(
  s: ShippingSessionLike,
  opts: { shipmentId: string; source: string; paid: boolean; expired: boolean }
): Promise<ShippingLabelSessionState> {
  const none: ShippingLabelSessionState = { status: "unknown", paymentIntentId: null, amountTotalMinor: null, currency: null, recorded: false };
  const md = s.metadata ?? {};
  if (!SHIPPING_KINDS.has(md.kind ?? "") || md.shipmentId !== opts.shipmentId) return none;
  const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;
  const amount = s.amount_total ?? null;
  const currency = s.currency ? s.currency.toUpperCase() : null;

  if (opts.paid) {
    if (md.kind === SHIPPING_PAYMENT_KIND) {
      const ledger = await recordShippingPaymentPaid({
        shipmentId: opts.shipmentId,
        sessionId: s.id,
        paymentIntentId: pi,
        amountMinor: amount,
        currency,
        source: opts.source,
        destinationAccountId: md.route === "destination" && md.destination ? md.destination : null,
        service: md.service || null,
      });
      return { status: "paid", paymentIntentId: pi, amountTotalMinor: amount, currency, recorded: Boolean(ledger), ledger };
    }
    const recorded = await recordShippingLabelPaid({ shipmentId: opts.shipmentId, sessionId: s.id, paymentIntentId: pi, amountMinor: amount, currency, source: opts.source });
    return { status: "paid", paymentIntentId: pi, amountTotalMinor: amount, currency, recorded };
  }
  if (opts.expired) {
    await recordShippingLabelSessionExpired({ shipmentId: opts.shipmentId, sessionId: s.id, source: opts.source });
    return { status: "expired", paymentIntentId: null, amountTotalMinor: null, currency, recorded: false };
  }
  return { status: "open", paymentIntentId: null, amountTotalMinor: null, currency, recorded: false };
}

/**
 * The "shared sync path": read the session back from Stripe (read-only) and
 * record it. Safe on every return visit; the webhook does the same.
 */
export async function syncShippingPayment(input: { shipmentId: string; sessionId: string }): Promise<ShippingLabelSessionState> {
  const stripe = getStripeProvider();
  if (!stripe) return { status: "unknown", paymentIntentId: null, amountTotalMinor: null, currency: null, recorded: false };
  const raw = await stripe.client.checkout.sessions.retrieve(input.sessionId);
  const s: ShippingSessionLike = {
    id: raw.id,
    metadata: (raw.metadata ?? null) as Record<string, string> | null,
    payment_status: raw.payment_status,
    status: raw.status ?? null,
    payment_intent: raw.payment_intent as ShippingSessionLike["payment_intent"],
    amount_total: raw.amount_total ?? null,
    currency: raw.currency ?? null,
    client_reference_id: raw.client_reference_id ?? null,
  };
  return applyShippingPaymentSession(s, {
    shipmentId: input.shipmentId,
    source: "return",
    paid: s.payment_status === "paid",
    expired: s.status === "expired",
  });
}
/** Old name. */
export const syncShippingLabelPayment = syncShippingPayment;

/** Close an open shipping session (the buyer chose again). No-op when it is not open. */
export async function expireShippingLabelSession(sessionId: string): Promise<void> {
  const stripe = getStripeProvider();
  if (!stripe) return;
  const raw = await stripe.client.checkout.sessions.retrieve(sessionId);
  if (raw.status === "open") await stripe.client.checkout.sessions.expire(sessionId);
}

/**
 * (Parked label flow) refund a label payment in full (the label could not be
 * bought). Goes through the same provider refund every card order uses.
 */
export async function refundShippingLabelPayment(input: {
  shipmentId: string;
  paymentIntentId: string;
  amountMinor: number;
  currency: string;
  reason?: string;
}): Promise<{ refundReference: string | null }> {
  const stripe = getStripeProvider();
  if (!stripe?.refund) throw new Error("Card refunds are not available right now.");
  const r = await stripe.refund({
    order: { id: input.shipmentId, currency: input.currency, paymentReference: input.paymentIntentId },
    amountMinor: input.amountMinor,
    notes: input.reason,
  } as Parameters<NonNullable<typeof stripe.refund>>[0]);
  return { refundReference: r.refundReference ?? null };
}

// ─── Webhook routing ─────────────────────────────────────────────────────────

export interface ShippingLabelSessionEvent {
  type: "paid" | "expired";
  kind: string;
  shipmentId: string;
  orderId: string | null;
  sessionId: string;
  paymentIntentId: string | null;
  amountTotalMinor: number | null;
  currency: string | null;
}

type Handler = (e: ShippingLabelSessionEvent) => Promise<void>;
let appHandler: Handler | null = null;

/** For an app that runs the webhook itself and wants to act on a shipping payment at once. */
export function onShippingLabelSession(handler: Handler | null): void {
  appHandler = handler;
}

/**
 * Called by handleStripeWebhook for a shipping session (either kind).
 * Records the payment (or the expiry) on the shipment, then hands off to the
 * app's handler when one is registered. Never buys a label.
 */
export async function handleShippingLabelSessionEvent(eventType: string, s: ShippingSessionLike, eventId: string): Promise<void> {
  const shipmentId = s.metadata?.shipmentId ?? "";
  if (!shipmentId) return;
  const paid =
    (eventType === "checkout.session.completed" || eventType === "checkout.session.async_payment_succeeded") && s.payment_status === "paid";
  const expired = eventType === "checkout.session.expired" || eventType === "checkout.session.async_payment_failed";
  if (!paid && !expired) return;
  const r = await applyShippingPaymentSession(s, { shipmentId, source: `webhook ${eventId}`, paid, expired });
  if (appHandler) {
    await appHandler({
      type: paid ? "paid" : "expired",
      kind: s.metadata?.kind ?? "",
      shipmentId,
      orderId: s.metadata?.orderId ?? s.client_reference_id ?? null,
      sessionId: s.id,
      paymentIntentId: r.paymentIntentId,
      amountTotalMinor: s.amount_total ?? null,
      currency: s.currency ? s.currency.toUpperCase() : null,
    });
  }
}
