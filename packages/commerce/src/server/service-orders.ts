/**
 * Thread orders — the no-cart "book now" rail.
 *
 * A purchasable thread (a service, a workshop, an event, later a product) with
 * its workshop_pages sidecar holding pricing. Booking one creates a commerce_order with a single
 * order line referencing the thread (commerce_order_line.thread_id), then
 * hands the buyer eTransfer instructions. No cart, no reservation, no
 * inventory — capacity is a future concern, and confirmEtransferReceived
 * is already safe for these lines (its artwork UPDATEs match nothing when
 * artwork_variant_id IS NULL; the payout row uses artist_user_id, which we
 * set to the service author).
 *
 * Org-agnostic on purpose: the caller supplies orgId and the thread; who gets
 * paid is resolved from the service author's own payout identity and their
 * agreements with that org (./settlement.ts), NOT from the selling app's
 * config. Server-only, like ./index.ts.
 */

import { db } from "@elkdonis/db";
import type { Currency, Order } from "../types";
import { buildEtransferInstructions, generateOrderNumber } from "../etransfer";
import { mapOrder, type Row } from "./map-order";
import { resolveSettlement } from "./settlement";

/**
 * The thread kinds that can be bought.
 *
 * Kept here rather than in the database: migration 097 dropped the
 * `threads_kind_check` enum, and which kinds are *purchasable* is a commerce
 * decision, not a schema one. Adding `product` means adding it to this list.
 */
export const PURCHASABLE_THREAD_KINDS = [
  "service",
  "workshop",
  "event",
  "product",
] as const;
export type PurchasableThreadKind = (typeof PURCHASABLE_THREAD_KINDS)[number];

export interface CreateThreadOrderInput {
  orgId: string;
  threadId: string;
  /** Restrict to particular kinds. Defaults to everything purchasable. */
  kinds?: readonly PurchasableThreadKind[];
  /** What the buyer is told they are reserving — "booking", "place", … */
  itemNoun?: string;
  customerEmail: string;
  customerName?: string | null;
  customerId?: string | null;
  notes?: string | null;
  /**
   * Sliding scale: the buyer's chosen amount in MINOR units. Only honoured
   * when the service offers a sliding scale (workshop_pages.price_sliding_min
   * set); must fall within [floor, list price]. Omit to pay list price.
   */
  amountMinor?: number;
  /** The seam for card payments — 'stripe' throws until keys land. */
  paymentMethod?: "etransfer" | "stripe";
  /**
   * @deprecated Ignored since 2026-09-05. The payee is the service's author,
   * resolved from their own payout identity — see resolveSettlement. Kept so
   * existing callers compile; passing it changes nothing.
   */
  payeeName?: string;
  /** @deprecated See {@link CreateServiceOrderInput.payeeName}. */
  payoutEmail?: string;
  etransferDueHours?: number;
}

export async function createThreadOrder(input: CreateThreadOrderInput): Promise<Order> {
  const method = input.paymentMethod ?? "etransfer";
  if (method === "stripe") {
    throw new Error("Card payments are not yet available. Please pay by eTransfer.");
  }

  const rows = (await db`
    SELECT t.id, t.title, t.author_id, t.status, t.price, t.currency, t.kind,
           wp.price_member, wp.price_sliding_min, wp.registration_status
    FROM threads t
    LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
    WHERE t.id = ${input.threadId}
      AND t.org_id = ${input.orgId}
      AND t.kind = ANY(${(input.kinds ?? PURCHASABLE_THREAD_KINDS) as unknown as string[]})
    LIMIT 1
  `) as unknown as Row[];
  const svc = rows[0];
  if (!svc) throw new Error("That item is not available to buy here.");
  if (svc.status !== "published") throw new Error("This is not open for booking.");
  const registration = (svc.registration_status as string | null) ?? "open";
  if (registration !== "open") throw new Error("This is not open for booking.");

  // threads.price / workshop_pages prices are MAJOR units — this is the
  // major→minor conversion point for the commerce ledger.
  const listMajor = svc.price_member != null ? Number(svc.price_member) : Number(svc.price ?? 0);
  const listMinor = Math.round(listMajor * 100);
  if (!(listMinor > 0)) throw new Error("This has no price set.");

  const floorMinor =
    svc.price_sliding_min != null ? Math.round(Number(svc.price_sliding_min) * 100) : null;

  let amountMinor = listMinor;
  if (input.amountMinor != null && input.amountMinor !== listMinor) {
    if (floorMinor == null) {
      throw new Error("This does not offer sliding-scale pricing.");
    }
    if (input.amountMinor < floorMinor || input.amountMinor > listMinor) {
      throw new Error("Chosen amount is outside the sliding-scale range.");
    }
    amountMinor = Math.round(input.amountMinor);
  }

  const currency = ((svc.currency as string | null) ?? "CAD") as Currency;
  const title = svc.title as string;
  const authorId = (svc.author_id as string | null) ?? null;

  // The payee is the person who authored the service, on the same rules as
  // every other sale. Previously this used the SELLING APP'S configured email,
  // so a practitioner's booking fee went to the site's inbox and the org took
  // a hardcoded zero regardless of what had been agreed.
  const settlement = await resolveSettlement({
    makerUserId: authorId,
    orgId: input.orgId,
    amountMinor,
  });

  const orderNumber = generateOrderNumber();
  const dueHours = input.etransferDueHours ?? 72;
  const instructions = buildEtransferInstructions({
    orderNumber,
    totalMinor: amountMinor,
    currency,
    artistName: settlement.payeeName,
    payoutEmail: settlement.payoutEmail,
    paymentDueAt: new Date(Date.now() + dueHours * 3600_000).toISOString(),
    itemNoun: input.itemNoun ?? "booking",
  });

  const order = await db.begin(async (tx) => {
    const orderRows = (await tx`
      INSERT INTO commerce_order (
        number, customer_id, customer_email, customer_name, status,
        payment_method, payment_reference, payment_instructions,
        payment_due_at, subtotal_minor, total_minor, currency,
        notes, metadata, payment_metadata
      ) VALUES (
        ${orderNumber}, ${input.customerId ?? null}, ${input.customerEmail},
        ${input.customerName ?? null}, 'awaiting_etransfer',
        'etransfer', ${instructions.paymentReference}, ${instructions.buyerInstructions},
        NOW() + (${dueHours} || ' hours')::interval,
        ${amountMinor}, ${amountMinor}, ${currency},
        ${input.notes ?? null},
        ${tx.json({ kind: svc.kind as string, threadId: input.threadId, orgId: input.orgId })},
        -- Record where the buyer was actually told to send money, so a caller
        -- rendering its own confirmation screen reads it off the order instead
        -- of holding a constant that may not be who was named.
        ${tx.json({
          payoutEmail: settlement.payoutEmail,
          payeeName: settlement.payeeName,
          agreementId: settlement.agreementId,
          orgSharePercent: settlement.orgSharePercent,
        })}
      )
      RETURNING *
    `) as unknown as Row[];
    const orderRow = orderRows[0]!;

    // The split is whatever the author's accepted agreement with this org
    // says, which is usually nothing — an own-site sale by the practitioner
    // themselves. The difference from before is that it is now a fact the
    // records can show, rather than a hardcoded zero.
    await tx`
      INSERT INTO commerce_order_line (
        order_id, thread_id, artist_user_id, org_id,
        description, quantity, unit_price_minor,
        artist_share_minor, gallery_share_minor, currency,
        agreement_id, org_share_percent, payee_org_id
      ) VALUES (
        ${orderRow.id as string}, ${input.threadId}, ${authorId}, ${input.orgId},
        ${title}, 1, ${amountMinor},
        ${settlement.makerShareMinor}, ${settlement.orgShareMinor}, ${currency},
        ${settlement.agreementId}, ${settlement.orgSharePercent}, ${settlement.payeeOrgId}
      )
    `;

    return orderRow;
  });

  // Fire emails non-blocking — order is already committed.
  const paymentDueAt = (order.payment_due_at as string | null) ?? null;
  const emailItems = [
    {
      description: title,
      quantity: 1,
      unitPriceMinor: amountMinor,
      artistShareMinor: settlement.makerShareMinor,
      galleryShareMinor: settlement.orgShareMinor,
      currency,
    },
  ];
  void (async () => {
    try {
      const { sendOrderInvoice, sendOrderNotification } = await import("@elkdonis/email");
      await Promise.all([
        sendOrderInvoice(input.customerEmail, {
          orderNumber,
          customerName: input.customerName ?? null,
          items: emailItems,
          totalMinor: amountMinor,
          currency,
          paymentInstructions: instructions.buyerInstructions,
          artistName: settlement.payeeName,
          artistPayoutEmail: settlement.payoutEmail,
          paymentDueAt,
        }),
        sendOrderNotification(settlement.payoutEmail, {
          role: "artist",
          orderNumber,
          customerName: input.customerName ?? null,
          customerEmail: input.customerEmail,
          artistName: settlement.payeeName,
          items: emailItems,
          totalMinor: amountMinor,
          currency,
          paymentDueAt,
        }),
      ]);
    } catch (emailErr) {
      console.error("[commerce] service order email failed:", emailErr);
    }
  })();

  return mapOrder(order);
}

/** @deprecated Use {@link createThreadOrder}. */
export const createServiceOrder = createThreadOrder;

/** @deprecated Use {@link CreateThreadOrderInput}. */
export type CreateServiceOrderInput = CreateThreadOrderInput;
