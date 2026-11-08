/**
 * Stock for artwork variants (2026-11-08).
 *
 * `artwork_variant.inventory_qty` is what is still on hand: it drops when an
 * order is PAID (confirmOrderPaid) and comes back on a refund. A copy is HELD
 * while an unpaid order has it — the order line itself is the hold, so a
 * cancelled or expired order releases it the moment its status leaves the
 * unpaid set, with nothing else to tidy. What a new buyer can take is
 *
 *   sellable = inventory_qty - held
 *
 * and the artwork as a whole is 'reserved' or 'sold' only when no variant has
 * a sellable copy left. A one-of-a-kind piece (one variant, qty 1) therefore
 * behaves exactly as before: the first order holds the only copy (reserved),
 * payment takes it (sold), a cancel gives it back (available).
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

/** Order statuses that hold stock: unpaid, not yet cancelled. */
export const HOLDING_ORDER_STATUSES = [
  "draft",
  "pending_payment",
  "awaiting_etransfer",
  "payment_received",
] as const;

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
 *   order / paid  no sellable copy left → 'reserved' while some copy is held,
 *                 else 'sold' — written whatever the status was, as the
 *                 one-of-a-kind path always did. Copies left → a 'reserved'
 *                 piece goes back to 'available' (the seller raised stock
 *                 while it was held); anything else is left alone.
 *   cancelled     (cancel / expiry) a 'reserved' piece → 'available', unless
 *                 other orders still hold every remaining copy. Only
 *                 'reserved' is touched, as before.
 *   refunded      the copies are back on hand: a 'sold' or 'reserved' piece
 *                 with a copy to sell → 'available'.
 */
export async function syncArtworkStatus(
  tx: Tx,
  artworkId: string,
  event: "order" | "paid" | "cancelled" | "refunded"
): Promise<string | null> {
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
    const target = held > 0 ? "reserved" : "sold";
    rows = (await tx`
      UPDATE artwork SET status = ${target} WHERE id = ${artworkId} AND status <> ${target}
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
