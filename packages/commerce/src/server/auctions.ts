/**
 * Auction lots — putting a piece up, and settling it when time runs out.
 *
 * A lot is a timed sale of one artwork variant. Bidding is in ./index.ts
 * (`placeBid`); this module covers the two ends of a lot's life that had no
 * code at all: nothing could create one, and nothing closed one — a lot whose
 * `end_at` had passed simply sat `live` forever.
 *
 * Settlement turns a winning bid into an ordinary order for the winner, on the
 * same rails and with the same settlement rules as a buy-now purchase, so an
 * auction is a way of arriving at a price rather than a second commerce
 * system. It runs lazily from the pages that list lots — no scheduler needed
 * to be correct, only to be prompt.
 *
 * While a lot is open the piece is not buy-now purchasable (addToCart refuses
 * it); the lot is the only path to owning it.
 */

import { db } from "@elkdonis/db";
import type { AuctionLot } from "../types";
import { num, type Row } from "./map-order";
import { requireArtworkAccess } from "./access";
import { createOrder, loadVariantItem } from "./orders";

export interface CreateLotInput {
  artworkId: string;
  actorUserId: string;
  /** Defaults to now. */
  startAt?: string | Date | null;
  endAt: string | Date;
  startingBidMinor: number;
  reserveMinor?: number | null;
  bidIncrementMinor?: number;
  antiSnipeMinutes?: number;
}

const MIN_DURATION_MS = 60 * 60_000;
const MAX_DURATION_MS = 60 * 24 * 3600_000;

function mapLotRow(r: Row): AuctionLot {
  return {
    id: r.id as string,
    artworkVariantId: r.artwork_variant_id as string,
    orgId: r.org_id as string,
    startAt: r.start_at as string,
    endAt: r.end_at as string,
    startingBidMinor: num(r.starting_bid_minor),
    reserveMinor: r.reserve_minor == null ? null : num(r.reserve_minor),
    buyNowMinor: r.buy_now_minor == null ? null : num(r.buy_now_minor),
    bidIncrementMinor: num(r.bid_increment_minor),
    antiSnipeMinutes: num(r.anti_snipe_minutes),
    currentBidMinor: r.current_bid_minor == null ? null : num(r.current_bid_minor),
    currentBidId: (r.current_bid_id as string | null) ?? null,
    bidCount: num(r.bid_count),
    currency: r.currency as AuctionLot["currency"],
    status: r.status as AuctionLot["status"],
    winnerUserId: (r.winner_user_id as string | null) ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

/**
 * Put a published piece up for auction. The actor must be able to act for the
 * store; the piece must be listed (`available`) and not already at auction.
 */
export async function createLot(input: CreateLotInput): Promise<AuctionLot> {
  const startAt = input.startAt ? new Date(input.startAt) : new Date();
  const endAt = new Date(input.endAt);
  const now = Date.now();
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new Error("Start and end need to be valid dates.");
  }
  if (endAt.getTime() - startAt.getTime() < MIN_DURATION_MS) {
    throw new Error("An auction needs to run for at least an hour.");
  }
  if (endAt.getTime() - startAt.getTime() > MAX_DURATION_MS) {
    throw new Error("An auction can run for at most 60 days.");
  }
  if (endAt.getTime() <= now) throw new Error("The end time is already in the past.");
  const startingBid = Math.round(input.startingBidMinor);
  if (!(startingBid > 0)) throw new Error("Set a starting bid.");
  const reserve = input.reserveMinor == null ? null : Math.round(input.reserveMinor);
  if (reserve != null && reserve < startingBid) {
    throw new Error("A reserve cannot be below the starting bid.");
  }
  const increment = Math.round(input.bidIncrementMinor ?? 1000);
  if (!(increment > 0)) throw new Error("The bid increment must be positive.");
  const antiSnipe = Math.max(0, Math.round(input.antiSnipeMinutes ?? 5));

  const row = await db.begin(async (tx) => {
    const t = tx as unknown as typeof db;
    const { orgId, status } = await requireArtworkAccess(t, input.artworkId, input.actorUserId);
    if (status !== "available") {
      throw new Error("Publish the piece before putting it up for auction.");
    }

    const variants = (await tx`
      SELECT id, currency FROM artwork_variant
      WHERE artwork_id = ${input.artworkId}
      ORDER BY position ASC LIMIT 1
    `) as unknown as Row[];
    const variant = variants[0];
    if (!variant) throw new Error("This piece has no sellable variant.");

    const open = (await tx`
      SELECT 1 FROM auction_lot
      WHERE artwork_variant_id = ${variant.id as string}
        AND status IN ('scheduled', 'live')
      LIMIT 1
    `) as unknown as Row[];
    if (open[0]) throw new Error("This piece is already at auction.");

    const rows = (await tx`
      INSERT INTO auction_lot (
        artwork_variant_id, org_id, start_at, end_at,
        starting_bid_minor, reserve_minor, bid_increment_minor, anti_snipe_minutes,
        currency, status, metadata
      ) VALUES (
        ${variant.id as string}, ${orgId}, ${startAt.toISOString()}, ${endAt.toISOString()},
        ${startingBid}, ${reserve}, ${increment}, ${antiSnipe},
        ${variant.currency as string},
        ${startAt.getTime() <= now ? "live" : "scheduled"},
        ${tx.json({ createdBy: input.actorUserId })}
      )
      RETURNING *
    `) as unknown as Row[];
    return rows[0]!;
  });
  return mapLotRow(row);
}

/** Withdraw a lot that has attracted no bids. */
export async function cancelLot(input: {
  lotId: string;
  actorUserId: string;
}): Promise<void> {
  await db.begin(async (tx) => {
    const t = tx as unknown as typeof db;
    const rows = (await tx`
      SELECT al.id, al.bid_count, al.status, av.artwork_id
      FROM auction_lot al
      JOIN artwork_variant av ON av.id = al.artwork_variant_id
      WHERE al.id = ${input.lotId}
      FOR UPDATE OF al
    `) as unknown as Row[];
    const lot = rows[0];
    if (!lot) throw new Error("Lot not found.");
    await requireArtworkAccess(t, lot.artwork_id as string, input.actorUserId);
    if (lot.status !== "scheduled" && lot.status !== "live") {
      throw new Error("This auction is already closed.");
    }
    if (num(lot.bid_count) > 0) {
      throw new Error("An auction with bids cannot be withdrawn.");
    }
    await tx`UPDATE auction_lot SET status = 'cancelled' WHERE id = ${input.lotId}`;
  });
}

export interface SettleResult {
  sold: number;
  passed: number;
  /** Orders created for winners, so a caller can notify. */
  orderIds: string[];
}

/**
 * Close every lot whose time has run out.
 *
 * A lot with a winning bid at or above its reserve becomes an order for the
 * winner — eTransfer where the maker can be paid that way, otherwise a card
 * order — with 72 hours to pay, exactly as a buy-now purchase would. The lot
 * is `sold`; if the winner never pays, cancelling the order marks it `passed`
 * and the piece goes back on sale. A lot with no qualifying bid is `passed`.
 *
 * Safe to call from any request: each lot is locked and skipped if another
 * caller has it.
 */
export async function settleExpiredLots(
  opts: { limit?: number; payUrlBase?: string | null } = {}
): Promise<SettleResult> {
  const limit = Math.min(opts.limit ?? 25, 200);
  const due = (await db`
    SELECT id FROM auction_lot
    WHERE status IN ('scheduled', 'live') AND end_at <= NOW()
    ORDER BY end_at ASC
    LIMIT ${limit}
  `) as unknown as Row[];

  const result: SettleResult = { sold: 0, passed: 0, orderIds: [] };

  for (const d of due) {
    const lotId = d.id as string;
    try {
      const outcome = await db.begin(async (tx) => {
        const rows = (await tx`
          SELECT al.*, av.artwork_id, a.status AS art_status
          FROM auction_lot al
          JOIN artwork_variant av ON av.id = al.artwork_variant_id
          JOIN artwork a ON a.id = av.artwork_id
          WHERE al.id = ${lotId}
            AND al.status IN ('scheduled', 'live')
            AND al.end_at <= NOW()
          FOR UPDATE OF al SKIP LOCKED
        `) as unknown as Row[];
        const lot = rows[0];
        if (!lot) return null; // someone else got it

        const hammer = lot.current_bid_minor == null ? null : num(lot.current_bid_minor);
        const reserve = lot.reserve_minor == null ? null : num(lot.reserve_minor);
        const winner = (lot.winner_user_id as string | null) ?? null;
        const reserveMet = hammer != null && (reserve == null || hammer >= reserve);
        const pieceFree = lot.art_status === "available";

        if (!winner || !reserveMet || !pieceFree) {
          await tx`UPDATE auction_lot SET status = 'passed' WHERE id = ${lotId}`;
          return { kind: "passed" as const };
        }

        // Mark sold first so a concurrent settle cannot double-order; the
        // order itself is created outside this transaction (it has its own),
        // and a failure there flips the lot back to passed below.
        await tx`UPDATE auction_lot SET status = 'sold' WHERE id = ${lotId}`;
        return {
          kind: "sold" as const,
          variantId: lot.artwork_variant_id as string,
          hammer: hammer!,
          winner,
          number: lot.id as string,
        };
      });

      if (!outcome) continue;
      if (outcome.kind === "passed") {
        result.passed++;
        continue;
      }

      const [buyer] = (await db`
        SELECT email, display_name, payout_email FROM users WHERE id = ${outcome.winner} LIMIT 1
      `) as unknown as Row[];
      if (!buyer?.email) {
        await db`UPDATE auction_lot SET status = 'passed' WHERE id = ${lotId}`;
        result.passed++;
        continue;
      }

      try {
        const item = await loadVariantItem(outcome.variantId, { unitMinor: outcome.hammer, qty: 1 });
        // Prefer eTransfer (works with no configuration); fall back to a card
        // order when the maker can only be paid through Stripe.
        let order;
        const payUrl = opts.payUrlBase ? `${opts.payUrlBase.replace(/\/$/, "")}/orders/` : null;
        const base = {
          items: [item],
          customerEmail: buyer.email as string,
          customerName: (buyer.display_name as string | null) ?? null,
          customerId: outcome.winner,
          dueHours: 72,
          metadata: { kind: "auction", lotId },
          notes: `Won at auction (lot ${lotId})`,
        };
        try {
          order = await createOrder({ ...base, paymentMethod: "etransfer" });
        } catch (e) {
          if (e instanceof Error && /card payments only/i.test(e.message)) {
            order = await createOrder({ ...base, paymentMethod: "stripe", payUrl });
          } else {
            throw e;
          }
        }
        await db`
          UPDATE auction_lot SET metadata = metadata || ${db.json({ orderId: order.id })}
          WHERE id = ${lotId}
        `;
        result.sold++;
        result.orderIds.push(order.id);
      } catch (err) {
        console.error(`[commerce] settleExpiredLots: order for lot ${lotId} failed:`, err);
        await db`UPDATE auction_lot SET status = 'passed' WHERE id = ${lotId}`;
        result.passed++;
      }
    } catch (err) {
      console.error(`[commerce] settleExpiredLots(${lotId}):`, err);
    }
  }

  return result;
}
