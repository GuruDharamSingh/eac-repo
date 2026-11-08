// ============================================================================
// Shipping-label payments: the DATABASE half (2026-11-07, migration 251).
//
// katie-the-potter sells first and ships after: once an order is paid the
// buyer picks a carrier on /orders/<id>/shipping and pays for the label in a
// second, small Stripe Checkout (metadata.kind = "shipping_label",
// metadata.shipmentId = an `order_shipment` row). The label itself is bought
// by the app that owns the shipment (it holds the Easyship account and its
// tokens), and only after this payment is on record.
//
// These two functions are what the network's Stripe webhook (art-auction,
// @elkdonis/checkout/stripe handleStripeWebhook) and katie's own return hop
// both call. Both are idempotent and guarded by the stored session id, so a
// webhook and a return visit racing each other record the payment once, and a
// stale or foreign session can never mark a shipment paid. Neither touches
// the order itself, its ledger or its status: a label payment is a platform
// charge that pays a platform cost.
//
// 2026-11-07, later: QUOTE-ONLY shipping (metadata.kind = "shipping_payment").
// The platform no longer buys labels: the buyer pays the quoted shipping in
// the second Checkout and the MAKER buys the label herself, so the money is
// hers. `recordShippingPaymentPaid` records the payment on the shipment AND
// what is owed in the ledger, in one transaction (see `accrueShippingPayment`):
// routed like sale money in confirmOrderPaid, with no commission. The old
// kind ("shipping_label") is still recorded exactly as before, with no ledger.
// ============================================================================

import { db } from "@elkdonis/db";
import { num, type Row } from "./map-order";
import { writeEntry } from "./ledger";
import { estimateProcessorFeeMinor } from "./settlement";

export interface ShippingLabelPayment {
  shipmentId: string;
  sessionId: string;
  paymentIntentId: string | null;
  amountMinor: number | null;
  currency: string | null;
  /** Where the confirmation came from, for the row's event log. */
  source: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Record that a shipment's label payment cleared: awaiting_payment -> paid.
 * Returns true when this call moved it (false: already recorded, another
 * session, or no such shipment). Never buys anything.
 */
export async function recordShippingLabelPaid(p: ShippingLabelPayment): Promise<boolean> {
  if (!UUID.test(p.shipmentId) || !p.sessionId) return false;
  const event = {
    at: new Date().toISOString(),
    kind: "paid",
    source: p.source,
    sessionId: p.sessionId,
    paymentIntentId: p.paymentIntentId,
    amountMinor: p.amountMinor,
  };
  const rows = (await db`
    UPDATE order_shipment SET
      status = 'paid',
      stripe_payment_intent = ${p.paymentIntentId},
      paid_minor = ${p.amountMinor},
      paid_at = NOW(),
      events = events || ${db.json([event] as never)},
      updated_at = NOW()
    WHERE id = ${p.shipmentId}
      AND stripe_session_id = ${p.sessionId}
      AND status = 'awaiting_payment'
    RETURNING id
  `) as unknown as Row[];
  return rows.length > 0;
}

/**
 * A label-payment session expired unpaid: back to 'rated' so the buyer can
 * choose again. Only the shipment's CURRENT session counts.
 */
export async function recordShippingLabelSessionExpired(input: { shipmentId: string; sessionId: string; source: string }): Promise<boolean> {
  if (!UUID.test(input.shipmentId)) return false;
  const event = { at: new Date().toISOString(), kind: "session_expired", source: input.source, sessionId: input.sessionId };
  const rows = (await db`
    UPDATE order_shipment SET
      status = 'rated',
      stripe_session_id = NULL,
      events = events || ${db.json([event] as never)},
      updated_at = NOW()
    WHERE id = ${input.shipmentId}
      AND stripe_session_id = ${input.sessionId}
      AND status = 'awaiting_payment'
    RETURNING id
  `) as unknown as Row[];
  return rows.length > 0;
}

// ─── Quote-only: the shipping payment is the maker's money ──────────────────

export interface ShippingPaymentRecord extends ShippingLabelPayment {
  /**
   * The connected account the Checkout routed the charge to (a destination
   * charge, application fee 0), or null for a platform charge. Set by the
   * server that opened the session (session metadata.destination).
   */
  destinationAccountId: string | null;
  /** For the ledger note: "Canada Post Expedited Parcel". */
  service?: string | null;
}

export interface ShippingPaymentLedger {
  /** Who the shipping money is owed to: the order's single maker, else null (the platform holds it). */
  makerUserId: string | null;
  route: "destination" | "platform";
  entryIds: string[];
  payoutId: string | null;
  /** What the maker is owed after the estimated card fee (platform charge only). */
  accruedMinor: number;
  feeMinor: number;
  holdReason: string | null;
}

/**
 * The ledger side of a shipping payment, inside the caller's transaction.
 * Mirrors what confirmOrderPaid writes for sale money, minus any commission:
 *
 *   destination charge  Stripe already moved the money to the maker's
 *                       connected account: accrual + payout (with a `payout`
 *                       row, method stripe), netting to zero
 *   platform charge     the collective holds it: one accrual to the maker,
 *                       payable, less the estimated card fee (R3: the card
 *                       fee is the maker's), or held `no_payout_account` when
 *                       she is mid Stripe onboarding with no eTransfer address
 *   no single maker     a platform accrual (nobody else to owe it to)
 *
 * No order_line_id (shipping is not a line), so the one-accrual-per-line
 * index does not apply; the shipment's status flip is the once-only guard.
 */
export async function accrueShippingPayment(
  tx: typeof db,
  input: {
    orderId: string;
    amountMinor: number;
    currency: string;
    paymentIntentId: string | null;
    destinationAccountId: string | null;
    service?: string | null;
  }
): Promise<ShippingPaymentLedger> {
  const amount = Math.round(input.amountMinor);
  const currency = input.currency.trim().toUpperCase();
  const what = `Shipping paid by the buyer${input.service ? ` (${input.service})` : ""}`;
  const makers = (await tx`
    SELECT DISTINCT artist_user_id FROM commerce_order_line
    WHERE order_id = ${input.orderId} AND artist_user_id IS NOT NULL
  `) as unknown as Row[];
  const makerUserId = makers.length === 1 ? (makers[0]!.artist_user_id as string) : null;
  const base = { currency, orderId: input.orderId, orderLineId: null, createdBy: null };
  const out: ShippingPaymentLedger = {
    makerUserId,
    route: input.destinationAccountId ? "destination" : "platform",
    entryIds: [],
    payoutId: null,
    accruedMinor: 0,
    feeMinor: 0,
    holdReason: null,
  };
  if (!(amount > 0)) return out;

  if (!makerUserId) {
    const e = await writeEntry({ ...base, party: { kind: "platform" }, entryType: "accrual", amountMinor: amount, note: `${what}; no single maker on the order` }, tx);
    out.entryIds.push(e.id);
    out.accruedMinor = amount;
    return out;
  }
  const party = { kind: "user" as const, userId: makerUserId };

  if (input.destinationAccountId) {
    const note = `${what}: Stripe destination charge to the maker's connected account`;
    const payout = (await tx`
      INSERT INTO payout (artist_user_id, order_id, amount_minor, currency, method, reference, status, sent_at, notes)
      VALUES (${makerUserId}, ${input.orderId}, ${amount}, ${currency}, 'stripe', ${input.paymentIntentId}, 'sent', NOW(), ${note})
      RETURNING id
    `) as unknown as Row[];
    const payoutId = payout[0]!.id as string;
    const a = await writeEntry({ ...base, party, entryType: "accrual", amountMinor: amount, note: what }, tx);
    const p = await writeEntry({ ...base, party, entryType: "payout", amountMinor: -amount, payoutId, note }, tx);
    out.entryIds.push(a.id, p.id);
    out.payoutId = payoutId;
    out.accruedMinor = amount;
    return out;
  }

  const fee = Math.min(amount, estimateProcessorFeeMinor(amount));
  const [maker] = (await tx`
    SELECT payout_email, stripe_account_id, stripe_onboarded_at FROM users WHERE id = ${makerUserId} LIMIT 1
  `) as unknown as Row[];
  const midOnboarding = Boolean(maker?.stripe_account_id) && !maker?.stripe_onboarded_at && !maker?.payout_email;
  const accrued = amount - fee;
  if (accrued > 0) {
    const e = await writeEntry(
      {
        ...base,
        party,
        entryType: "accrual",
        amountMinor: accrued,
        holdReason: midOnboarding ? "no_payout_account" : null,
        note: `${what}; card payment to the platform account, settle to the maker (less the ${(fee / 100).toFixed(2)} card fee estimate)`,
      },
      tx
    );
    out.entryIds.push(e.id);
  }
  out.accruedMinor = Math.max(0, accrued);
  out.feeMinor = fee;
  out.holdReason = midOnboarding ? "no_payout_account" : null;
  return out;
}

/**
 * Record a QUOTE-ONLY shipping payment (metadata.kind "shipping_payment"):
 * awaiting_payment -> paid, and the money owed in the ledger, in one
 * transaction. Returns the ledger summary when this call moved the shipment,
 * null otherwise (already recorded, another session, no such shipment). Pass
 * `tx` to join a caller's transaction (a check that rolls back). Never buys
 * anything.
 */
export async function recordShippingPaymentPaid(p: ShippingPaymentRecord, tx?: typeof db): Promise<ShippingPaymentLedger | null> {
  if (!UUID.test(p.shipmentId) || !p.sessionId) return null;
  const run = async (t: typeof db): Promise<ShippingPaymentLedger | null> => {
    const event = {
      at: new Date().toISOString(),
      kind: "paid",
      source: p.source,
      sessionId: p.sessionId,
      paymentIntentId: p.paymentIntentId,
      amountMinor: p.amountMinor,
      route: p.destinationAccountId ? "destination" : "platform",
    };
    const rows = (await t`
      UPDATE order_shipment SET
        status = 'paid',
        stripe_payment_intent = ${p.paymentIntentId},
        paid_minor = ${p.amountMinor},
        paid_at = NOW(),
        events = events || ${t.json([event] as never)},
        updated_at = NOW()
      WHERE id = ${p.shipmentId}
        AND stripe_session_id = ${p.sessionId}
        AND status = 'awaiting_payment'
      RETURNING id, order_id, currency
    `) as unknown as Row[];
    const r = rows[0];
    if (!r) return null;
    const ledger = await accrueShippingPayment(t, {
      orderId: r.order_id as string,
      amountMinor: num(p.amountMinor),
      currency: (p.currency ?? (r.currency as string | null) ?? "CAD").trim(),
      paymentIntentId: p.paymentIntentId,
      destinationAccountId: p.destinationAccountId,
      service: p.service ?? null,
    });
    const note = { at: new Date().toISOString(), kind: "ledger", ...ledger };
    await t`UPDATE order_shipment SET events = events || ${t.json([note] as never)} WHERE id = ${p.shipmentId}`;
    return ledger;
  };
  if (tx) return run(tx);
  return (await db.begin(async (t) => run(t as unknown as typeof db))) as ShippingPaymentLedger | null;
}

/**
 * A plain transactional email from an app that has no direct dependency on
 * @elkdonis/email (katie-the-potter's shipping notices). Throws in
 * production when SendGrid is not configured, like every other send.
 */
export async function sendCommerceNotice(input: {
  to: string;
  subject: string;
  html: string;
  orgId?: string;
  replyTo?: string;
}): Promise<{ ok: boolean }> {
  const { sendEmail } = await import("@elkdonis/email");
  const r = await sendEmail({
    to: input.to,
    subject: input.subject,
    html: input.html,
    orgId: input.orgId,
    kind: "order",
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  });
  return { ok: r.ok };
}
