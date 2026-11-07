import { db } from "@elkdonis/db";

// Read-only queries for the /manage overview and lists. Server only.
// Every one is scoped to a store id the caller already authorised.

export interface PieceCounts {
  forSale: number;
  drafts: number;
  sold: number;
  reserved: number;
  /** archived/draft pieces kept on the site as pictures (metadata.site = portfolio). */
  portfolio: number;
  hidden: number;
  samples: number;
}

export async function pieceCounts(storeId: string): Promise<PieceCounts> {
  const [r] = await db<Array<Record<string, number>>>`
    SELECT
      count(*) FILTER (WHERE status = 'available')::int AS for_sale,
      count(*) FILTER (WHERE status = 'draft' AND COALESCE(metadata->>'site', '') <> 'portfolio')::int AS drafts,
      count(*) FILTER (WHERE status = 'sold')::int AS sold,
      count(*) FILTER (WHERE status = 'reserved')::int AS reserved,
      count(*) FILTER (WHERE status IN ('draft', 'archived') AND metadata->>'site' = 'portfolio')::int AS portfolio,
      count(*) FILTER (WHERE status = 'archived' AND COALESCE(metadata->>'site', '') <> 'portfolio')::int AS hidden,
      count(*) FILTER (WHERE metadata->>'sample' = 'true' AND status IN ('draft', 'available'))::int AS samples
    FROM artwork WHERE store_id = ${storeId}
  `;
  return {
    forSale: r?.for_sale ?? 0,
    drafts: r?.drafts ?? 0,
    sold: r?.sold ?? 0,
    reserved: r?.reserved ?? 0,
    portfolio: r?.portfolio ?? 0,
    hidden: r?.hidden ?? 0,
    samples: r?.samples ?? 0,
  };
}

export interface OrderCounts {
  awaitingEtransfer: number;
  paidToShip: number;
  open: number;
}

export async function orderCounts(storeId: string): Promise<OrderCounts> {
  const [r] = await db<Array<Record<string, number>>>`
    SELECT
      count(*) FILTER (WHERE status IN ('awaiting_etransfer', 'payment_received'))::int AS awaiting,
      count(*) FILTER (WHERE status = 'paid')::int AS paid,
      count(*) FILTER (WHERE status IN ('pending_payment', 'awaiting_etransfer', 'payment_received', 'paid'))::int AS open
    FROM commerce_order WHERE store_id = ${storeId}
  `;
  return { awaitingEtransfer: r?.awaiting ?? 0, paidToShip: r?.paid ?? 0, open: r?.open ?? 0 };
}

/** The first line's description for each order, with a "+N more" tail: what the order list shows as "Pieces". */
export async function orderPieceLabels(orderIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (orderIds.length === 0) return out;
  const rows = await db<Array<{ order_id: string; description: string }>>`
    SELECT order_id, description FROM commerce_order_line
    WHERE order_id = ANY(${orderIds}::uuid[]) ORDER BY created_at ASC
  `;
  const by = new Map<string, string[]>();
  for (const r of rows) by.set(r.order_id, [...(by.get(r.order_id) ?? []), r.description]);
  for (const [id, list] of by) out.set(id, list.length > 1 ? `${list[0]} +${list.length - 1} more` : (list[0] ?? ""));
  return out;
}
