/**
 * Order lifecycle — one place for every purchase of a store's artwork.
 *
 *   create   from a cart (buy-now) or for an auction winner
 *   pay      by eTransfer (instructions, seller confirms) or by card
 *            (Stripe hosted checkout, webhook confirms) — the rail can be
 *            switched on an unpaid order, so an eTransfer order can still be
 *            paid by card from its own page
 *   confirm  marks paid, sells the pieces, and writes the ledger
 *   cancel   releases the reservation; expiry does it automatically
 *   fulfil   the seller records that it shipped
 *
 * Money follows ./settlement.ts: the maker is the payee, the store is a front,
 * the org's cut exists only under an accepted agreement. Where the money
 * physically went is recorded per rail on confirm (see `confirmOrderPaid`).
 *
 * Server-only, like ./index.ts.
 */

import { db } from "@elkdonis/db";
import { splitCommission } from "../money";
import { buildEtransferInstructions, generateOrderNumber } from "../etransfer";
import type { Order } from "../types";
import { jsonb, mapOrder, num, type Row } from "./map-order";
import { HOST_PAYOUT_EMAIL, resolveSettlement, type LineSettlement } from "./settlement";
import { writeEntry } from "./ledger";

/** The two ways a buyer can pay. `manual` exists for admin-recorded sales. */
export type OrderRail = "etransfer" | "stripe";

/** Statuses from which an order can still be paid. */
export const UNPAID_ORDER_STATUSES = [
  "pending_payment",
  "awaiting_etransfer",
  "payment_received",
] as const;

/** Minutes past a Stripe session's expiry before the reservation is released. */
export const STRIPE_GRACE_MINUTES = 15;

export interface SellableItem {
  variantId: string;
  artworkId: string;
  title: string;
  /** The artwork's own org (denormalised from the store). */
  artOrgId: string;
  storeId: string;
  /**
   * The org that may claim a cut: the PRESENTING front's owner when the buyer
   * came through another store's window, else the selling store's owner,
   * else the marketplace.
   */
  counterpartyOrgId: string;
  /** The window the buyer came through, when not the selling store. */
  presentedStoreId: string | null;
  makerUserId: string | null;
  unitMinor: number;
  qty: number;
  currency: string;
  imageUrl?: string | null;
}

export interface OrderCustomer {
  customerEmail: string;
  customerName?: string | null;
  customerId?: string | null;
  shippingAddress?: Order["shippingAddress"];
  billingAddress?: Order["billingAddress"];
  notes?: string | null;
}

export interface CreateOrderInput extends OrderCustomer {
  items: SellableItem[];
  paymentMethod: OrderRail;
  /** How long the buyer has. eTransfer defaults to 72h; card to 75 minutes. */
  dueHours?: number;
  /** Free-form, e.g. `{ kind: 'auction', lotId }`. */
  metadata?: Record<string, unknown>;
  /** Shown in the invoice email for card orders, which have no instructions. */
  payUrl?: string | null;
  /** The cart to convert, when there is one. Reservations are keyed by it. */
  cartId?: string | null;
}

const ITEM_SELECT = db`
  av.id AS variant_id, av.price_minor, av.currency, av.inventory_qty,
  a.id AS art_id, a.title AS art_title, a.artist_user_id AS art_artist_user_id,
  a.org_id AS art_org_id, a.status AS art_status,
  st.id AS store_id, st.status AS store_status,
  COALESCE(st.owner_org_id, st.org_id) AS counterparty_org_id,
  pm.url AS primary_image_url
`;

/** The presenting store's counterparty, when a cart line came through one. */
const VIA_SELECT = db`
  vs.id AS via_store_id,
  COALESCE(vs.owner_org_id, vs.org_id) AS via_counterparty_org_id
`;

const ITEM_JOIN = db`
  JOIN artwork a ON a.id = av.artwork_id
  JOIN store st ON st.id = a.store_id
  LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
`;

function rowToItem(r: Row, unitMinor: number, qty: number): SellableItem {
  const via = (r.via_store_id as string | null) ?? null;
  return {
    variantId: r.variant_id as string,
    artworkId: r.art_id as string,
    title: r.art_title as string,
    artOrgId: r.art_org_id as string,
    storeId: r.store_id as string,
    counterpartyOrgId: (via ? (r.via_counterparty_org_id as string | null) : null) ?? (r.counterparty_org_id as string),
    presentedStoreId: via,
    makerUserId: (r.art_artist_user_id as string | null) ?? null,
    unitMinor,
    qty,
    currency: r.currency as string,
    imageUrl: (r.primary_image_url as string | null) ?? null,
  };
}

/** The lines of a cart as sellable items, priced as the cart recorded them. */
export async function loadCartItems(
  cartToken: string
): Promise<{ cartId: string; items: SellableItem[] }> {
  const cartRows = (await db`
    SELECT id FROM cart WHERE token = ${cartToken} LIMIT 1
  `) as unknown as Row[];
  if (!cartRows[0]) throw new Error("Cart not found");
  const cartId = cartRows[0].id as string;

  const rows = (await db`
    SELECT cl.quantity AS line_qty, cl.unit_price_minor AS line_unit, ${ITEM_SELECT}, ${VIA_SELECT}
    FROM cart_line cl
    JOIN artwork_variant av ON av.id = cl.artwork_variant_id
    ${ITEM_JOIN}
    LEFT JOIN store vs ON vs.id = cl.via_store_id AND vs.status = 'active'
    WHERE cl.cart_id = ${cartId}
    ORDER BY cl.created_at ASC
  `) as unknown as Row[];
  if (rows.length === 0) throw new Error("Cart is empty");

  return {
    cartId,
    items: rows.map((r) => rowToItem(r, num(r.line_unit), num(r.line_qty))),
  };
}

/** One variant as a sellable item, at its list price or an override (hammer). */
export async function loadVariantItem(
  variantId: string,
  opts: { unitMinor?: number; qty?: number } = {}
): Promise<SellableItem> {
  const rows = (await db`
    SELECT ${ITEM_SELECT}
    FROM artwork_variant av
    ${ITEM_JOIN}
    WHERE av.id = ${variantId}
    LIMIT 1
  `) as unknown as Row[];
  if (!rows[0]) throw new Error("Variant not found");
  return rowToItem(rows[0], opts.unitMinor ?? num(rows[0].price_minor), opts.qty ?? 1);
}

/**
 * Create an order for a set of items from ONE store. Locks the artwork,
 * snapshots prices, records per-line splits, and — for eTransfer — builds the
 * instructions. Card orders get no instructions: the session is created when
 * the buyer is sent to Stripe (see @elkdonis/checkout/stripe).
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const { items } = input;
  if (items.length === 0) throw new Error("Nothing to order.");

  // One payee per order. addToCart pins the basket to a store, so this is a
  // belt-and-braces check rather than the place a buyer first learns their
  // basket cannot be sold to them.
  const storeIds = new Set(items.map((i) => i.storeId));
  if (storeIds.size > 1) {
    throw new Error("This basket spans several sellers. Please check out one seller at a time.");
  }
  const storeId = items[0]!.storeId;
  const currency = items[0]!.currency as Order["currency"];

  // Who is actually paid, by the shared settlement rules.
  const settlements = new Map<string, LineSettlement>();
  for (const it of items) {
    const key = `${it.makerUserId ?? "-"}:${it.counterpartyOrgId}`;
    if (settlements.has(key)) continue;
    settlements.set(
      key,
      await resolveSettlement({
        makerUserId: it.makerUserId,
        orgId: it.counterpartyOrgId,
        amountMinor: it.unitMinor * it.qty,
      })
    );
  }
  const headline = settlements.get(
    `${items[0]!.makerUserId ?? "-"}:${items[0]!.counterpartyOrgId}`
  )!;

  const rail = input.paymentMethod;
  if (rail === "etransfer" && !headline.payoutEmail) {
    throw new Error(
      "This seller takes card payments only. Please pay by card instead."
    );
  }

  const lineSplits = items.map((it) => {
    const total = it.unitMinor * it.qty;
    const r = settlements.get(`${it.makerUserId ?? "-"}:${it.counterpartyOrgId}`)!;
    // Split at this line's own total so rounding lands per line.
    const split = splitCommission(total, r.orgSharePercent);
    return {
      item: it,
      orgSharePercent: r.orgSharePercent,
      agreementId: r.agreementId,
      makerShareMinor: split.artistShareMinor,
      orgShareMinor: split.galleryShareMinor,
    };
  });

  const subtotalMinor = items.reduce((s, it) => s + it.unitMinor * it.qty, 0);
  const totalMinor = subtotalMinor; // shipping + tax are arranged per piece
  const orderNumber = generateOrderNumber();

  const dueHours =
    input.dueHours ?? (rail === "etransfer" ? 72 : (60 + STRIPE_GRACE_MINUTES) / 60);
  const dueAt = new Date(Date.now() + dueHours * 3600_000);

  const instructions =
    rail === "etransfer"
      ? buildEtransferInstructions({
          orderNumber,
          totalMinor,
          currency,
          artistName: headline.payeeName,
          payoutEmail: headline.payoutEmail!,
          paymentDueAt: dueAt.toISOString(),
        })
      : null;

  const status = rail === "etransfer" ? "awaiting_etransfer" : "pending_payment";

  const order = await db.begin(async (tx) => {
    const orderRows = (await tx`
      INSERT INTO commerce_order (
        number, store_id, customer_id, customer_email, customer_name, status,
        payment_method, payment_reference, payment_instructions,
        payment_due_at, subtotal_minor, total_minor, currency,
        shipping_address, billing_address, notes, metadata, payment_metadata
      ) VALUES (
        ${orderNumber}, ${storeId}, ${input.customerId ?? null}, ${input.customerEmail},
        ${input.customerName ?? null}, ${status},
        ${rail}, ${instructions?.paymentReference ?? null}, ${instructions?.buyerInstructions ?? null},
        ${dueAt.toISOString()},
        ${subtotalMinor}, ${totalMinor}, ${currency},
        ${input.shippingAddress ? jsonb(input.shippingAddress) : null},
        ${input.billingAddress ? jsonb(input.billingAddress) : null},
        ${input.notes ?? null},
        ${jsonb(input.metadata ?? {})},
        -- Where the buyer was told to pay, and who they were told they pay,
        -- so a confirmation screen reads it off the order rather than a
        -- constant. payUrl is where a card order gets paid.
        ${jsonb({
          payeeName: headline.payeeName,
          payoutEmail: headline.payoutEmail,
          payUrl: input.payUrl ?? null,
        })}
      )
      RETURNING *
    `) as unknown as Row[];
    const orderRow = orderRows[0]!;
    const orderId = orderRow.id as string;

    for (const sp of lineSplits) {
      const it = sp.item;
      // The line records what it was, who made it, which front showed it, and
      // which agreement authorised the org's cut — so the settlement can be
      // re-derived years later. A NULL agreement_id is meaningful: nothing
      // authorised a split.
      await tx`
        INSERT INTO commerce_order_line (
          order_id, artwork_variant_id, artwork_id, artist_user_id, org_id,
          description, quantity, unit_price_minor,
          artist_share_minor, gallery_share_minor, currency,
          agreement_id, org_share_percent, payee_org_id, presented_store_id
        ) VALUES (
          ${orderId}, ${it.variantId}, ${it.artworkId},
          ${it.makerUserId}, ${it.artOrgId},
          ${it.title}, ${it.qty}, ${it.unitMinor},
          ${sp.makerShareMinor}, ${sp.orgShareMinor}, ${it.currency},
          ${sp.agreementId}, ${sp.orgSharePercent},
          ${sp.orgShareMinor > 0 ? it.counterpartyOrgId : null}, ${it.presentedStoreId ?? it.storeId}
        )
      `;

      // Hold the piece for the payment window.
      await tx`
        INSERT INTO reservation (artwork_variant_id, cart_id, expires_at, status)
        VALUES (${it.variantId}, ${input.cartId ?? null}, ${dueAt.toISOString()}, 'active')
      `;
      await tx`UPDATE artwork SET status = 'reserved' WHERE id = ${it.artworkId}`;
    }

    return orderRow;
  });

  // Emails, non-blocking — the order is already committed. Card orders are
  // notified on confirmation instead: an invoice with no way to pay from it
  // is noise, and Stripe sends its own receipt.
  if (rail === "etransfer" && instructions) {
    const emailItems = lineSplits.map((sp) => ({
      description: sp.item.title,
      quantity: sp.item.qty,
      unitPriceMinor: sp.item.unitMinor,
      artistShareMinor: sp.makerShareMinor,
      galleryShareMinor: sp.orgShareMinor,
      currency: sp.item.currency,
    }));
    const paymentDueAt = (order.payment_due_at as string | null) ?? null;
    void (async () => {
      try {
        const { sendOrderInvoice, sendOrderNotification } = await import("@elkdonis/email");
        await Promise.all([
          sendOrderInvoice(input.customerEmail, {
            orderNumber,
            customerName: input.customerName ?? null,
            items: emailItems,
            totalMinor,
            currency,
            paymentInstructions: instructions.buyerInstructions,
            artistName: headline.payeeName,
            artistPayoutEmail: headline.payoutEmail!,
            paymentDueAt,
          }),
          sendOrderNotification(headline.payoutEmail!, {
            role: "artist",
            orderNumber,
            customerName: input.customerName ?? null,
            customerEmail: input.customerEmail,
            artistName: headline.payeeName,
            items: emailItems,
            totalMinor,
            currency,
            paymentDueAt,
          }),
          sendOrderNotification(HOST_PAYOUT_EMAIL, {
            role: "platform",
            orderNumber,
            customerName: input.customerName ?? null,
            customerEmail: input.customerEmail,
            artistName: headline.payeeName,
            items: emailItems,
            totalMinor,
            currency,
            paymentDueAt,
          }),
        ]);
      } catch (emailErr) {
        console.error("[commerce] order email failed:", emailErr);
      }
    })();
  }

  return mapOrder(order);
}

/** Convert the current cart into an order on the chosen rail. */
export async function createOrderFromCart(
  input: OrderCustomer & {
    cartToken: string;
    paymentMethod: OrderRail;
    etransferDueHours?: number;
    payUrl?: string | null;
  }
): Promise<Order> {
  const { cartId, items } = await loadCartItems(input.cartToken);
  return createOrder({
    ...input,
    items,
    cartId,
    dueHours: input.paymentMethod === "etransfer" ? input.etransferDueHours : undefined,
  });
}

/**
 * Convert a cart into an eTransfer order. Kept for existing callers; new code
 * should call {@link createOrderFromCart} with the rail the buyer chose.
 */
export async function createEtransferOrder(
  input: OrderCustomer & { cartToken: string; etransferDueHours?: number }
): Promise<Order> {
  return createOrderFromCart({ ...input, paymentMethod: "etransfer" });
}

/**
 * Switch an unpaid order onto the eTransfer rail — a buyer who backed out of
 * Stripe, or an auction winner whose order was created card-first. Builds the
 * instructions and gives them the full eTransfer window from now.
 */
export async function switchOrderToEtransfer(input: {
  orderId: string;
  dueHours?: number;
}): Promise<Order> {
  const rows = (await db`
    SELECT o.*, l.artist_user_id AS maker_user_id,
           COALESCE(l.payee_org_id, l.org_id) AS counterparty_org_id
    FROM commerce_order o
    JOIN commerce_order_line l ON l.order_id = o.id
    WHERE o.id = ${input.orderId}
    ORDER BY l.created_at ASC
    LIMIT 1
  `) as unknown as Row[];
  const o = rows[0];
  if (!o) throw new Error("Order not found.");
  if (!(UNPAID_ORDER_STATUSES as readonly string[]).includes(o.status as string)) {
    throw new Error("This order can no longer be paid.");
  }

  const settlement = await resolveSettlement({
    makerUserId: (o.maker_user_id as string | null) ?? null,
    orgId: o.counterparty_org_id as string,
    amountMinor: num(o.total_minor),
  });
  if (!settlement.payoutEmail) {
    throw new Error("This seller takes card payments only.");
  }

  const dueHours = input.dueHours ?? 72;
  const dueAt = new Date(Date.now() + dueHours * 3600_000);
  const instructions = buildEtransferInstructions({
    orderNumber: o.number as string,
    totalMinor: num(o.total_minor),
    currency: o.currency as Order["currency"],
    artistName: settlement.payeeName,
    payoutEmail: settlement.payoutEmail,
    paymentDueAt: dueAt.toISOString(),
  });

  const updated = await db.begin(async (tx) => {
    const r = (await tx`
      UPDATE commerce_order SET
        status = 'awaiting_etransfer',
        payment_method = 'etransfer',
        payment_reference = ${instructions.paymentReference},
        payment_instructions = ${instructions.buyerInstructions},
        payment_due_at = GREATEST(COALESCE(payment_due_at, NOW()), ${dueAt.toISOString()}::timestamptz),
        payment_metadata = payment_metadata || ${tx.json({
          payeeName: settlement.payeeName,
          payoutEmail: settlement.payoutEmail,
        })}
      WHERE id = ${input.orderId}
      RETURNING *
    `) as unknown as Row[];
    // Keep the piece held for the new window.
    await tx`
      UPDATE reservation r SET expires_at = GREATEST(r.expires_at, ${dueAt.toISOString()}::timestamptz)
      FROM commerce_order_line l
      WHERE l.order_id = ${input.orderId}
        AND r.artwork_variant_id = l.artwork_variant_id
        AND r.status = 'active'
    `;
    return r[0]!;
  });
  return mapOrder(updated);
}

/**
 * Record that a Stripe Checkout session was opened for this order: the session
 * id (so a return visit can be reconciled without the webhook), where the
 * money will land, and the platform's cut. The due date is pushed to at least
 * the session's expiry plus a grace period, never pulled earlier.
 */
export async function recordStripeCheckout(input: {
  orderId: string;
  sessionId: string;
  sessionExpiresAt: string;
  destinationAccountId: string | null;
  applicationFeeMinor: number;
}): Promise<void> {
  const graceUntil = new Date(
    new Date(input.sessionExpiresAt).getTime() + STRIPE_GRACE_MINUTES * 60_000
  ).toISOString();
  await db.begin(async (tx) => {
    await tx`
      UPDATE commerce_order SET
        payment_metadata = payment_metadata || ${tx.json({
          stripe: {
            sessionId: input.sessionId,
            sessionExpiresAt: input.sessionExpiresAt,
            destinationAccountId: input.destinationAccountId,
            applicationFeeMinor: input.applicationFeeMinor,
          },
        })},
        payment_due_at = GREATEST(COALESCE(payment_due_at, NOW()), ${graceUntil}::timestamptz)
      WHERE id = ${input.orderId}
    `;
    await tx`
      UPDATE reservation r SET expires_at = GREATEST(r.expires_at, ${graceUntil}::timestamptz)
      FROM commerce_order_line l
      WHERE l.order_id = ${input.orderId}
        AND r.artwork_variant_id = l.artwork_variant_id
        AND r.status = 'active'
    `;
  });
}

export interface ConfirmOrderPaidInput {
  orderId: string;
  /** Null when a webhook confirms; the reference then says who. */
  confirmedByUserId: string | null;
  /** The rail the money actually arrived on. Defaults to the order's. */
  method?: "etransfer" | "stripe" | "manual";
  /** eTransfer ref, or the Stripe payment intent id. */
  paymentReference?: string;
  notes?: string;
}

/**
 * Mark an order paid: sell the pieces, convert reservations, and write the
 * ledger. Refuses to confirm twice (status guard) and the ledger's own
 * one-accrual-per-line index backs that up.
 *
 * Where the maker's money went depends on the rail:
 *
 *   etransfer  the buyer paid the maker directly — accrual + payout net to
 *              zero, both halves on record
 *   stripe     destination charge → Stripe transferred it; accrual + payout,
 *              with the transfer as the payout record.
 *              platform charge → the collective holds it; accrual only,
 *              payable (the NFP settles by hand), or held for want of a
 *              payout account if the maker has a Stripe account that has not
 *              finished onboarding — that hold releases itself when KYC lands
 *   manual     an admin recorded an off-platform payment; accrual only
 *
 * The org's share is the same on every rail: an accrual held for the dispute
 * window, which IS the earmark inside the host account.
 */
export async function confirmOrderPaid(input: ConfirmOrderPaidInput): Promise<Order> {
  const result = await db.begin(async (tx) => {
    const orderRows = (await tx`
      UPDATE commerce_order
      SET status = 'paid',
          paid_at = NOW(),
          payment_confirmed_at = NOW(),
          payment_confirmed_by = ${input.confirmedByUserId},
          payment_method = COALESCE(${input.method ?? null}, payment_method),
          payment_reference = COALESCE(${input.paymentReference ?? null}, payment_reference),
          notes = COALESCE(notes || E'\n', '') || ${input.notes ? `[confirmed] ${input.notes}` : "[confirmed]"}
      WHERE id = ${input.orderId} AND status IN ('awaiting_etransfer', 'payment_received', 'pending_payment')
      RETURNING *
    `) as unknown as Row[];
    if (!orderRows[0]) throw new Error("Order is not in a state where it can be marked paid.");
    const order = orderRows[0];
    const rail = order.payment_method as string;
    const stripeMeta = ((order.payment_metadata as Record<string, unknown>)?.stripe ?? {}) as {
      destinationAccountId?: string | null;
    };
    const destination = rail === "stripe" ? stripeMeta.destinationAccountId ?? null : null;

    const lineRows = (await tx`
      SELECT * FROM commerce_order_line WHERE order_id = ${input.orderId}
    `) as unknown as Row[];

    for (const l of lineRows) {
      // Inventory and reservations only exist for artwork lines; a service or
      // workshop line has no variant, and these match nothing.
      await tx`
        UPDATE artwork_variant
        SET inventory_qty = GREATEST(inventory_qty - ${num(l.quantity)}, 0)
        WHERE id = ${l.artwork_variant_id as string}
      `;
      await tx`UPDATE artwork SET status = 'sold' WHERE id = ${l.artwork_id as string}`;
      await tx`
        UPDATE reservation SET status = 'converted'
        WHERE artwork_variant_id = ${l.artwork_variant_id as string}
          AND status = 'active'
      `;

      const currency = l.currency as string;
      const lineId = l.id as string;
      const makerUserId = (l.artist_user_id as string | null) ?? null;
      const makerShare = num(l.artist_share_minor);
      const orgShare = num(l.gallery_share_minor);
      const payeeOrgId = (l.payee_org_id as string | null) ?? null;

      if (makerUserId && makerShare > 0) {
        const party = { kind: "user" as const, userId: makerUserId };

        // Was the maker paid in the same motion?
        let paidVia: { method: string; note: string; reference: string | null } | null = null;
        if (rail === "etransfer") {
          paidVia = {
            method: "etransfer",
            note: "Buyer sent eTransfer directly to the maker",
            reference: (order.payment_reference as string | null) ?? null,
          };
        } else if (rail === "stripe" && destination) {
          paidVia = {
            method: "stripe",
            note: "Stripe destination charge to the maker's connected account",
            reference: (order.payment_reference as string | null) ?? null,
          };
        }

        if (paidVia) {
          const payout = (await tx`
            INSERT INTO payout (
              artist_user_id, order_id, amount_minor, currency,
              method, reference, status, sent_at, notes
            ) VALUES (
              ${makerUserId}, ${input.orderId}, ${makerShare}, ${currency},
              ${paidVia.method}, ${paidVia.reference},
              ${paidVia.method === "etransfer" ? "received" : "sent"}, NOW(), ${paidVia.note}
            )
            RETURNING id
          `) as unknown as Row[];
          await writeEntry(
            {
              party,
              entryType: "accrual",
              amountMinor: makerShare,
              currency,
              orderId: input.orderId,
              orderLineId: lineId,
              note: "Sale proceeds",
              createdBy: input.confirmedByUserId,
            },
            tx as unknown as typeof db
          );
          await writeEntry(
            {
              party,
              entryType: "payout",
              amountMinor: -makerShare,
              currency,
              orderId: input.orderId,
              orderLineId: lineId,
              payoutId: payout[0]!.id as string,
              note: paidVia.note,
              createdBy: input.confirmedByUserId,
            },
            tx as unknown as typeof db
          );
        } else {
          // The collective holds the money. Payable unless the maker is
          // mid-onboarding — then the hold releases itself when KYC lands.
          const [maker] = (await tx`
            SELECT payout_email, stripe_account_id, stripe_onboarded_at
            FROM users WHERE id = ${makerUserId} LIMIT 1
          `) as unknown as Row[];
          const midOnboarding =
            Boolean(maker?.stripe_account_id) && !maker?.stripe_onboarded_at && !maker?.payout_email;
          await writeEntry(
            {
              party,
              entryType: "accrual",
              amountMinor: makerShare,
              currency,
              orderId: input.orderId,
              orderLineId: lineId,
              holdReason: midOnboarding ? "no_payout_account" : null,
              note:
                rail === "stripe"
                  ? "Card payment to the platform account; settle to the maker"
                  : "Recorded manually; settle to the maker",
              createdBy: input.confirmedByUserId,
            },
            tx as unknown as typeof db
          );
        }
      }

      // The org's share. It has no connected account and receives no transfer
      // — this accrual IS the earmark inside the host account.
      if (payeeOrgId && orgShare > 0) {
        await writeEntry(
          {
            party: { kind: "org", orgId: payeeOrgId },
            entryType: "accrual",
            amountMinor: orgShare,
            currency,
            orderId: input.orderId,
            orderLineId: lineId,
            agreementId: (l.agreement_id as string | null) ?? null,
            holdReason: "dispute_window",
            note: makerUserId
              ? "Org share under an accepted agreement"
              : "Org-owned work, no maker",
            createdBy: input.confirmedByUserId,
          },
          tx as unknown as typeof db
        );
      }
    }
    return { order, lineRows };
  });

  // Card orders were not announced at creation; tell the seller now.
  if ((result.order.payment_method as string) === "stripe") {
    void notifySellerOfCardSale(result.order, result.lineRows);
  }

  return mapOrder(result.order);
}

async function notifySellerOfCardSale(order: Row, lines: Row[]): Promise<void> {
  try {
    const meta = (order.payment_metadata as Record<string, unknown>) ?? {};
    const makerId = (lines[0]?.artist_user_id as string | null) ?? null;
    let sellerEmail: string | null = null;
    if (makerId) {
      const [u] = (await db`SELECT email FROM users WHERE id = ${makerId} LIMIT 1`) as unknown as Row[];
      sellerEmail = (u?.email as string | null) ?? null;
    }
    const items = lines.map((l) => ({
      description: l.description as string,
      quantity: num(l.quantity),
      unitPriceMinor: num(l.unit_price_minor),
      artistShareMinor: num(l.artist_share_minor),
      galleryShareMinor: num(l.gallery_share_minor),
      currency: l.currency as string,
    }));
    const { sendOrderNotification } = await import("@elkdonis/email");
    const common = {
      orderNumber: order.number as string,
      customerName: (order.customer_name as string | null) ?? null,
      customerEmail: order.customer_email as string,
      artistName: (meta.payeeName as string | undefined) ?? "the seller",
      items,
      totalMinor: num(order.total_minor),
      currency: order.currency as Order["currency"],
      paymentDueAt: null,
    };
    await Promise.all([
      sellerEmail ? sendOrderNotification(sellerEmail, { role: "artist", ...common }) : null,
      sendOrderNotification(HOST_PAYOUT_EMAIL, { role: "platform", ...common }),
    ]);
  } catch (err) {
    console.error("[commerce] card sale notification failed:", err);
  }
}

/**
 * Admin/artist action: mark an eTransfer order as paid. Kept for existing
 * callers; {@link confirmOrderPaid} is the general form.
 */
export async function confirmEtransferReceived(input: {
  orderId: string;
  confirmedByUserId: string;
  paymentReference?: string;
  notes?: string;
}): Promise<Order> {
  return confirmOrderPaid({ ...input, method: "etransfer" });
}

/**
 * Cancel an unpaid order and put the pieces back on sale. A lot the order came
 * from is marked `passed`: the sale did not stand.
 */
export async function cancelOrder(input: {
  orderId: string;
  actorUserId?: string | null;
  reason?: string;
}): Promise<Order> {
  const updated = await db.begin(async (tx) => {
    const rows = (await tx`
      UPDATE commerce_order
      SET status = 'cancelled',
          cancelled_at = NOW(),
          notes = COALESCE(notes || E'\n', '') || ${`[cancelled] ${input.reason ?? "by seller"}`}
      WHERE id = ${input.orderId}
        AND status IN ('draft', 'pending_payment', 'awaiting_etransfer', 'payment_received')
      RETURNING *
    `) as unknown as Row[];
    if (!rows[0]) throw new Error("Order is not in a state where it can be cancelled.");
    const order = rows[0];

    const lines = (await tx`
      SELECT artwork_variant_id, artwork_id FROM commerce_order_line
      WHERE order_id = ${input.orderId} AND artwork_variant_id IS NOT NULL
    `) as unknown as Row[];
    for (const l of lines) {
      await tx`
        UPDATE reservation SET status = 'released'
        WHERE artwork_variant_id = ${l.artwork_variant_id as string} AND status = 'active'
      `;
      await tx`
        UPDATE artwork SET status = 'available'
        WHERE id = ${l.artwork_id as string} AND status = 'reserved'
      `;
    }

    const lotId = ((order.metadata as Record<string, unknown>)?.lotId as string | undefined) ?? null;
    if (lotId) {
      await tx`UPDATE auction_lot SET status = 'passed' WHERE id = ${lotId} AND status = 'sold'`;
    }
    return order;
  });
  return mapOrder(updated);
}

/**
 * Cancel every unpaid order whose payment window has closed, releasing the
 * pieces. Lazily invoked from seller and admin screens rather than a
 * scheduler — the reservation table already knew when it expired; nothing
 * acted on it before.
 */
export async function releaseExpiredOrders(
  opts: { limit?: number } = {}
): Promise<number> {
  const limit = Math.min(opts.limit ?? 50, 500);
  const rows = (await db`
    SELECT id FROM commerce_order
    WHERE status IN ('pending_payment', 'awaiting_etransfer')
      AND payment_due_at IS NOT NULL
      AND payment_due_at < NOW()
    ORDER BY payment_due_at ASC
    LIMIT ${limit}
  `) as unknown as Row[];
  let n = 0;
  for (const r of rows) {
    try {
      await cancelOrder({ orderId: r.id as string, reason: "payment window expired" });
      n++;
    } catch (err) {
      console.error(`[commerce] releaseExpiredOrders(${r.id}):`, err);
    }
  }
  return n;
}

/** The seller records that a paid order shipped. */
export async function markOrderFulfilled(input: {
  orderId: string;
  actorUserId: string;
  note?: string;
}): Promise<Order> {
  const rows = (await db`
    UPDATE commerce_order
    SET status = 'fulfilled',
        fulfilled_at = NOW(),
        notes = COALESCE(notes || E'\n', '') || ${`[fulfilled] ${input.note ?? ""}`.trimEnd()}
    WHERE id = ${input.orderId} AND status = 'paid'
    RETURNING *
  `) as unknown as Row[];
  if (!rows[0]) throw new Error("Only a paid order can be marked fulfilled.");
  return mapOrder(rows[0]);
}

/**
 * Refund a paid order in full and put the pieces back on sale.
 *
 * The money movement itself happens elsewhere — Stripe for a card order (see
 * `refundStripeOrder` in @elkdonis/checkout/stripe), the seller sending an
 * eTransfer back for the rest — so this records the reversal: a negative
 * `refund` entry per share. A maker who was already paid (eTransfer, or a
 * Stripe transfer) ends up with a negative balance, which is exactly right:
 * they owe it back until an adjustment records that they returned it. An
 * org's share is reversed under the same hold it was accrued under, so the
 * held and payable figures both come out at zero rather than one of each.
 */
export async function refundOrder(input: {
  orderId: string;
  actorUserId: string | null;
  reason?: string;
  /** e.g. the Stripe refund id. */
  refundReference?: string | null;
}): Promise<Order> {
  const updated = await db.begin(async (tx) => {
    const rows = (await tx`
      UPDATE commerce_order
      SET status = 'refunded',
          notes = COALESCE(notes || E'\n', '') || ${`[refunded] ${input.reason ?? ""}`.trimEnd()},
          payment_metadata = payment_metadata || ${tx.json({
            refund: { reference: input.refundReference ?? null, at: new Date().toISOString(), by: input.actorUserId },
          })}
      WHERE id = ${input.orderId} AND status IN ('paid', 'fulfilled', 'completed')
      RETURNING *
    `) as unknown as Row[];
    if (!rows[0]) throw new Error("Only a paid order can be refunded.");
    const order = rows[0];

    const lines = (await tx`
      SELECT * FROM commerce_order_line WHERE order_id = ${input.orderId}
    `) as unknown as Row[];
    for (const l of lines) {
      if (l.artwork_variant_id) {
        await tx`
          UPDATE artwork_variant SET inventory_qty = inventory_qty + ${num(l.quantity)}
          WHERE id = ${l.artwork_variant_id as string}
        `;
        await tx`
          UPDATE artwork SET status = 'available'
          WHERE id = ${l.artwork_id as string} AND status = 'sold'
        `;
      }

      const lineId = l.id as string;
      const currency = l.currency as string;
      const parties: Array<{ party: { kind: "user"; userId: string } | { kind: "org"; orgId: string }; amount: number }> = [];
      if (l.artist_user_id && num(l.artist_share_minor) > 0) {
        parties.push({ party: { kind: "user", userId: l.artist_user_id as string }, amount: num(l.artist_share_minor) });
      }
      if (l.payee_org_id && num(l.gallery_share_minor) > 0) {
        parties.push({ party: { kind: "org", orgId: l.payee_org_id as string }, amount: num(l.gallery_share_minor) });
      }
      for (const p of parties) {
        // Reverse under the same hold the accrual still sits under, if any.
        const [acc] = (await tx`
          SELECT pl.hold_reason,
                 EXISTS (SELECT 1 FROM payout_ledger r WHERE r.releases_entry_id = pl.id AND r.entry_type = 'release') AS released
          FROM payout_ledger pl
          WHERE pl.order_line_id = ${lineId} AND pl.entry_type = 'accrual'
            AND ${p.party.kind === "user" ? tx`pl.party_user_id = ${p.party.userId}` : tx`pl.party_org_id = ${p.party.orgId}`}
          LIMIT 1
        `) as unknown as Row[];
        const stillHeld = acc?.hold_reason && !acc.released;
        await writeEntry(
          {
            party: p.party,
            entryType: "refund",
            amountMinor: -p.amount,
            currency,
            orderId: input.orderId,
            orderLineId: lineId,
            holdReason: stillHeld ? (acc!.hold_reason as never) : null,
            note: input.reason ? `Refund: ${input.reason}` : "Refund",
            createdBy: input.actorUserId,
          },
          tx as unknown as typeof db
        );
      }
    }
    return order;
  });
  return mapOrder(updated);
}
