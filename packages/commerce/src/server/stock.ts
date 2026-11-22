/**
 * Stock for artwork variants (2026-11-08).
 *
 * `artwork_variant.inventory_qty` is what is still on hand: it drops when an
 * order is PAID (confirmOrderPaid) and comes back on a refund.
 *
 * 2026-11-17: nothing is reserved while someone is paying. A cart, a started
 * checkout and an unpaid order do not hold a copy and do not set 'reserved'
 * (see HOLDING_ORDER_STATUSES); a piece is 'sold' only when payment is
 * confirmed. 'reserved' is now only what a seller sets by hand
 * (setArtworkAvailability). What a new buyer can take is
 *
 *   sellable = inventory_qty - held
 *
 * with `held` counting only orders whose money has arrived but are not yet
 * confirmed. Protection against two buyers paying for the last copy is in
 * confirmOrderPaid (it refuses the second, OrderOversoldError).
 *
 * Every write that changes stock locks the artwork row first
 * ({@link lockArtworks}), so all copies of a piece — across its variants —
 * are decided one buyer at a time and two buyers cannot both take the last.
 *
 * Server-only.
 */

import type { db } from "@elkdonis/db";
import { num, type Row } from "./map-order";

type Tx = typeof db;

/**
 * Order statuses that hold stock. Changed 2026-11-17 (developer's decision): a
 * cart, a started checkout and an unpaid order (card or eTransfer) no longer
 * hold a piece or mark it 'reserved'; only an order whose money has arrived
 * (`payment_received`, before the seller's confirmation) does. The piece is
 * marked 'sold' when `confirmOrderPaid` runs. Two buyers can therefore both
 * start paying for the last copy: `confirmOrderPaid` refuses the second
 * ({@link OrderOversoldError}) and the card path refunds it.
 */
export const HOLDING_ORDER_STATUSES = ["payment_received"] as const;

/**
 * Thrown by `confirmOrderPaid` when a paid order asks for more copies than are
 * on hand (another buyer's payment took them first). The order stays unpaid
 * (the transaction rolls back). Match on `code`, not `instanceof`: the error
 * crosses package boundaries.
 */
export class OrderOversoldError extends Error {
  readonly code = "ORDER_OVERSOLD";
  constructor(public readonly titles: string[]) {
    super(
      `${titles.map((t) => `“${t}”`).join(", ")} ${titles.length === 1 ? "has" : "have"} already sold to another buyer.`
    );
    this.name = "OrderOversoldError";
  }
}

export function isOrderOversold(err: unknown): err is OrderOversoldError {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "ORDER_OVERSOLD";
}

/**
 * Lock these artworks for the rest of the transaction, in id order (one
 * statement, sorted) so two transactions that touch the same pieces cannot
 * deadlock. Nulls and duplicates are dropped.
 */
export async function lockArtworks(tx: Tx, artworkIds: Array<string | null | undefined>): Promise<void> {
  const ids = [...new Set(artworkIds.filter((x): x is string => typeof x === "string" && x.length > 0))].sort();
  if (ids.length === 0) return;
  await tx`SELECT id FROM artwork WHERE id = ANY(${ids}::uuid[]) ORDER BY id FOR UPDATE`;
}

export interface VariantStock {
  variantId: string;
  artworkId: string;
  onHand: number;
  held: number;
  sellable: number;
}

/** On-hand, held and sellable copies per variant. */
export async function variantStock(tx: Tx, variantIds: string[]): Promise<Map<string, VariantStock>> {
  const ids = [...new Set(variantIds)];
  const out = new Map<string, VariantStock>();
  if (ids.length === 0) return out;
  const rows = (await tx`
    SELECT av.id, av.artwork_id, av.inventory_qty,
           COALESCE((
             SELECT SUM(l.quantity)
             FROM commerce_order_line l
             JOIN commerce_order o ON o.id = l.order_id
             WHERE l.artwork_variant_id = av.id
               AND o.status IN ${tx(HOLDING_ORDER_STATUSES as unknown as string[])}
           ), 0)::int AS held
    FROM artwork_variant av
    WHERE av.id = ANY(${ids}::uuid[])
  `) as unknown as Row[];
  for (const r of rows) {
    const onHand = num(r.inventory_qty);
    const held = num(r.held);
    out.set(r.id as string, {
      variantId: r.id as string,
      artworkId: r.artwork_id as string,
      onHand,
      held,
      sellable: Math.max(onHand - held, 0),
    });
  }
  return out;
}

/** Sellable and held copies across every variant of one artwork. */
export async function artworkStock(tx: Tx, artworkId: string): Promise<{ sellable: number; held: number }> {
  const [r] = (await tx`
    SELECT COALESCE(SUM(GREATEST(v.inventory_qty - v.held, 0)), 0)::int AS sellable,
           COALESCE(SUM(v.held), 0)::int AS held
    FROM (
      SELECT av.inventory_qty,
             COALESCE((
               SELECT SUM(l.quantity)
               FROM commerce_order_line l
               JOIN commerce_order o ON o.id = l.order_id
               WHERE l.artwork_variant_id = av.id
                 AND o.status IN ${tx(HOLDING_ORDER_STATUSES as unknown as string[])}
             ), 0) AS held
      FROM artwork_variant av
      WHERE av.artwork_id = ${artworkId}
    ) v
  `) as unknown as Row[];
  return { sellable: num(r?.sellable), held: num(r?.held) };
}

/**
 * Bring an artwork's status into line with its stock after an order event.
 * Call with the artwork already locked.
 *
 *   order         (2026-11-17) nothing: creating an order does not reserve.
 *   paid          no sellable copy left → 'sold' (written whatever the status
 *                 was, as the one-of-a-kind path always did). Copies left → a
 *                 'reserved' piece goes back to 'available'; anything else is
 *                 left alone.
 *   cancelled     (cancel / expiry) a 'reserved' piece → 'available', unless
 *                 a payment already received still holds every remaining copy.
 *                 Only 'reserved' is touched. This also releases pieces that
 *                 an order marked 'reserved' before 2026-11-17.
 *   refunded      the copies are back on hand: a 'sold' or 'reserved' piece
 *                 with a copy to sell → 'available'.
 */
export async function syncArtworkStatus(
  tx: Tx,
  artworkId: string,
  event: "order" | "paid" | "cancelled" | "refunded"
): Promise<string | null> {
  // An unpaid order never reserves a piece (2026-11-17). Left in the signature
  // so call sites and the event list stay as they were.
  if (event === "order") return null;
  const { sellable, held } = await artworkStock(tx, artworkId);
  let rows: Row[];
  if (event === "cancelled") {
    const target = sellable === 0 && held > 0 ? "reserved" : "available";
    rows = (await tx`
      UPDATE artwork SET status = ${target}
      WHERE id = ${artworkId} AND status = 'reserved' AND status <> ${target}
      RETURNING status
    `) as unknown as Row[];
  } else if (event === "refunded") {
    if (sellable === 0) return null;
    rows = (await tx`
      UPDATE artwork SET status = 'available'
      WHERE id = ${artworkId} AND status IN ('sold', 'reserved')
      RETURNING status
    `) as unknown as Row[];
  } else if (sellable === 0) {
    // Paid and no copy left: sold, even if another payment is awaiting
    // confirmation (confirmOrderPaid refuses that one).
    rows = (await tx`
      UPDATE artwork SET status = 'sold' WHERE id = ${artworkId} AND status <> 'sold'
      RETURNING status
    `) as unknown as Row[];
  } else {
    rows = (await tx`
      UPDATE artwork SET status = 'available' WHERE id = ${artworkId} AND status = 'reserved'
      RETURNING status
    `) as unknown as Row[];
  }
  return (rows[0]?.status as string | undefined) ?? null;
}
