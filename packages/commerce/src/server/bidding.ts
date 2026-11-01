import { db } from "@elkdonis/db";
import type { AuctionLot } from "../types";
import { incrementAt, lotLadder, nextMinimumBid } from "../money";
import { num, type Row } from "./map-order";
import { createOrder, loadVariantItem } from "./orders";

// ============================================================================
// Bidding (ORG_STORE_BRIEF R4, R6, R7).
//
//   * The next acceptable bid is the current bid plus the increment the lot's
//     ladder gives at that level, or the lot's flat increment.
//   * Proxy bids: a bidder may leave a maximum. The system bids for them one
//     increment above the next highest maximum, never past their own. Two
//     equal maximums go to the earlier one.
//   * Soft close: a change of leading bid in the last `anti_snipe_minutes`
//     extends the lot by that many minutes.
//   * Card on file: a bidder must be registered in the marketplace before
//     their first bid (`bidder_registration`), unless
//     AUCTION_REQUIRE_CARD=false.
//   * Buy-now: until the first bid, a buyer may take the piece at the lot's
//     buy-now price; that creates the order and closes the lot.
//
// Every bid row is kept: the bidder's own bids, and the automatic ones the
// system places on their behalf (`is_max_bid`), so the history of a lot can
// be read back.
// ============================================================================

export type PlaceBidResult =
  | {
      ok: true;
      lot: Pick<AuctionLot, "currentBidMinor" | "bidCount" | "endAt">;
      bidId: string;
      /** True when a standing maximum beat this bid; `lot` holds the new price. */
      outbid: boolean;
      /** Who leads now. */
      leaderUserId: string;
      message: string;
    }
  | { ok: false; reason: string; needsRegistration?: boolean };

function requireCard(): boolean {
  return (process.env.AUCTION_REQUIRE_CARD ?? "true") !== "false";
}

export async function placeBid(input: {
  lotId: string;
  bidderId: string;
  amountMinor: number;
  maxAmountMinor?: number | null;
  clientIp?: string | null;
  userAgent?: string | null;
}): Promise<PlaceBidResult> {
  const amount = Math.round(Number(input.amountMinor));
  const max = input.maxAmountMinor != null ? Math.round(Number(input.maxAmountMinor)) : null;
  if (!(amount > 0)) return { ok: false, reason: "Enter a bid." };
  if (max != null && max < amount) return { ok: false, reason: "Your maximum cannot be below your bid." };
  const myMax = max ?? amount;

  const outcome = await db.begin(async (tx) => {
    const lotRows = (await tx`
      SELECT * FROM auction_lot WHERE id = ${input.lotId} FOR UPDATE
    `) as unknown as Row[];
    if (!lotRows[0]) return { ok: false as const, reason: "Lot not found." };
    const lot = lotRows[0];

    if (lot.status !== "live" && lot.status !== "scheduled") {
      return { ok: false as const, reason: "This auction is closed." };
    }
    const now = Date.now();
    if (new Date(lot.start_at as string).getTime() > now) {
      return { ok: false as const, reason: "Bidding has not opened yet." };
    }
    if (new Date(lot.end_at as string).getTime() <= now) {
      return { ok: false as const, reason: "This auction has ended." };
    }

    if (requireCard()) {
      const [reg] = (await tx`
        SELECT 1 FROM bidder_registration
        WHERE user_id = ${input.bidderId} AND org_id = ${lot.org_id as string}
          AND stripe_payment_method_id IS NOT NULL
        LIMIT 1
      `) as unknown as Row[];
      if (!reg) {
        return {
          ok: false as const,
          reason: "Register to bid first: a phone number and a card on file.",
          needsRegistration: true,
        };
      }
    }

    const ladder = lotLadder(lot.metadata as Record<string, unknown>);
    const flat = num(lot.bid_increment_minor);
    const current = lot.current_bid_minor == null ? null : num(lot.current_bid_minor);
    const starting = num(lot.starting_bid_minor);
    const minNext = nextMinimumBid({ startingBidMinor: starting, currentBidMinor: current, bidIncrementMinor: flat, ladder });
    const incAt = (level: number) => (ladder ? incrementAt(level, ladder) : flat);

    if (amount < minNext) {
      return { ok: false as const, reason: `The bid must be at least ${(minNext / 100).toFixed(2)}.` };
    }

    // The standing leader and their maximum.
    const leadRows = (await tx`
      SELECT id, bidder_id, amount_minor, COALESCE(max_amount_minor, amount_minor) AS max_minor, placed_at
      FROM bid WHERE lot_id = ${input.lotId} AND status = 'winning'
      ORDER BY placed_at DESC LIMIT 1
    `) as unknown as Row[];
    const lead = leadRows[0] ?? null;
    const leadUser = lead ? (lead.bidder_id as string) : null;
    const leadMax = lead ? num(lead.max_minor) : 0;

    const insertBid = async (
      bidder: string,
      amt: number,
      mx: number | null,
      status: "winning" | "outbid",
      auto: boolean
    ): Promise<string> => {
      const rows = (await tx`
        INSERT INTO bid (lot_id, bidder_id, amount_minor, max_amount_minor, is_max_bid, status, client_ip, user_agent)
        VALUES (
          ${input.lotId}, ${bidder}, ${amt}, ${mx},
          ${auto || (mx != null && mx > amt)}, ${status},
          ${auto ? null : (input.clientIp ?? null)}::inet, ${auto ? "system proxy bid" : (input.userAgent ?? null)}
        )
        RETURNING id
      `) as unknown as Row[];
      return rows[0]!.id as string;
    };

    let newCurrent: number;
    let winnerId: string;
    let winningBidId: string;
    let outbid = false;
    let message: string;
    let myBidId: string;

    if (lead && leadUser === input.bidderId) {
      // Raising or lowering one's own maximum; the price does not move.
      const newMax = Math.max(myMax, num(lead.amount_minor));
      await tx`UPDATE bid SET max_amount_minor = ${newMax}, is_max_bid = ${newMax > num(lead.amount_minor)} WHERE id = ${lead.id as string}`;
      myBidId = lead.id as string;
      newCurrent = num(lead.amount_minor);
      winnerId = input.bidderId;
      winningBidId = myBidId;
      message = newMax > num(lead.amount_minor) ? "Your maximum is updated; you still lead." : "You already lead this lot.";
    } else if (!lead || myMax > leadMax) {
      // The newcomer leads. Price: one increment over the old maximum, but at
      // least what they typed and never above their own maximum.
      const over = lead ? leadMax + incAt(leadMax) : starting;
      newCurrent = Math.min(myMax, Math.max(amount, over, minNext));
      if (lead) {
        await tx`UPDATE bid SET status = 'outbid' WHERE lot_id = ${input.lotId} AND status = 'winning'`;
      }
      myBidId = await insertBid(input.bidderId, newCurrent, myMax > newCurrent ? myMax : null, "winning", false);
      winnerId = input.bidderId;
      winningBidId = myBidId;
      message = "You lead this lot.";
    } else {
      // A standing maximum beats the newcomer (ties go to the earlier bid).
      // Record their bid as outbid and move the leader up to one increment
      // over it, capped at the leader's maximum.
      myBidId = await insertBid(input.bidderId, myMax, null, "outbid", false);
      newCurrent = Math.min(leadMax, myMax + incAt(myMax));
      if (myMax === leadMax) newCurrent = leadMax;
      await tx`UPDATE bid SET status = 'outbid' WHERE id = ${lead!.id as string}`;
      winningBidId = await insertBid(leadUser!, newCurrent, leadMax > newCurrent ? leadMax : null, "winning", true);
      winnerId = leadUser!;
      outbid = true;
      message = `Another bidder's maximum beat yours; the bid now stands at ${(newCurrent / 100).toFixed(2)}.`;
    }

    // Soft close: the leading price moved inside the window.
    const antiSnipeMs = num(lot.anti_snipe_minutes) * 60_000;
    const untilEnd = new Date(lot.end_at as string).getTime() - now;
    let endAt = lot.end_at as string;
    if (antiSnipeMs > 0 && untilEnd < antiSnipeMs && newCurrent !== (current ?? -1)) {
      endAt = new Date(now + antiSnipeMs).toISOString();
    }

    const bidsAdded = outbid ? 2 : lead && leadUser === input.bidderId ? 0 : 1;
    const updated = (await tx`
      UPDATE auction_lot
      SET current_bid_minor = ${newCurrent},
          current_bid_id = ${winningBidId},
          bid_count = bid_count + ${bidsAdded},
          end_at = ${endAt},
          status = 'live',
          winner_user_id = ${winnerId}
      WHERE id = ${input.lotId}
      RETURNING current_bid_minor, bid_count, end_at
    `) as unknown as Row[];
    const u = updated[0]!;

    const previousLeader = lead && leadUser !== input.bidderId && !outbid ? leadUser : null;
    return {
      ok: true as const,
      lot: { currentBidMinor: num(u.current_bid_minor), bidCount: num(u.bid_count), endAt: u.end_at as string },
      bidId: myBidId,
      outbid,
      leaderUserId: winnerId,
      message,
      previousLeader,
      currency: lot.currency as string,
      variantId: lot.artwork_variant_id as string,
    };
  });

  if (outcome.ok && outcome.previousLeader) {
    void notifyOutbid(outcome.previousLeader, input.lotId, outcome.lot.currentBidMinor, outcome.currency, outcome.variantId);
  }
  if (!outcome.ok) return outcome;
  const { previousLeader: _p, currency: _c, variantId: _v, ...rest } = outcome;
  return rest;
}

async function notifyOutbid(userId: string, lotId: string, currentMinor: number, currency: string, variantId: string) {
  try {
    const [u] = (await db`SELECT email, display_name FROM users WHERE id = ${userId}`) as unknown as Row[];
    const [a] = (await db`
      SELECT a.title FROM artwork_variant av JOIN artwork a ON a.id = av.artwork_id WHERE av.id = ${variantId}
    `) as unknown as Row[];
    if (!u?.email) return;
    const { sendOutbidEmail } = await import("@elkdonis/email");
    await sendOutbidEmail(u.email as string, {
      name: (u.display_name as string | null) ?? null,
      lotId,
      title: (a?.title as string) ?? "the piece",
      currentMinor,
      currency,
      lotUrl: `${(process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "").replace(/\/$/, "")}/lots/${lotId}`,
    });
  } catch (err) {
    console.error("[commerce] notifyOutbid:", err);
  }
}

/**
 * Take the piece at the lot's buy-now price. Allowed while the lot is open
 * and has no bids. Creates the winner's order like a settled lot and closes
 * the lot as `sold`.
 */
export async function buyNowLot(input: {
  lotId: string;
  buyerId: string;
  payUrlBase?: string | null;
}): Promise<{ ok: true; orderId: string } | { ok: false; reason: string }> {
  const claim = await db.begin(async (tx) => {
    const rows = (await tx`
      SELECT al.*, a.status AS art_status
      FROM auction_lot al
      JOIN artwork_variant av ON av.id = al.artwork_variant_id
      JOIN artwork a ON a.id = av.artwork_id
      WHERE al.id = ${input.lotId} FOR UPDATE OF al
    `) as unknown as Row[];
    const lot = rows[0];
    if (!lot) return { ok: false as const, reason: "Lot not found." };
    if (lot.status !== "live" && lot.status !== "scheduled") return { ok: false as const, reason: "This auction is closed." };
    if (lot.buy_now_minor == null) return { ok: false as const, reason: "This lot has no buy-now price." };
    if (num(lot.bid_count) > 0) return { ok: false as const, reason: "Bidding has started; buy-now is no longer available." };
    if (lot.art_status !== "available") return { ok: false as const, reason: "This piece is no longer available." };
    await tx`
      UPDATE auction_lot SET status = 'sold', winner_user_id = ${input.buyerId},
        metadata = metadata || ${tx.json({ buyNow: true } as never)}
      WHERE id = ${input.lotId}
    `;
    return { ok: true as const, variantId: lot.artwork_variant_id as string, price: num(lot.buy_now_minor) };
  });
  if (!claim.ok) return { ok: false, reason: claim.reason };

  const [buyer] = (await db`SELECT email, display_name FROM users WHERE id = ${input.buyerId}`) as unknown as Row[];
  try {
    if (!buyer?.email) throw new Error("Buyer has no email.");
    const item = await loadVariantItem(claim.variantId, { unitMinor: claim.price, qty: 1 });
    const base = {
      items: [item],
      customerEmail: buyer.email as string,
      customerName: (buyer.display_name as string | null) ?? null,
      customerId: input.buyerId,
      dueHours: 72,
      metadata: { kind: "auction", lotId: input.lotId, buyNow: true },
      notes: `Bought now (lot ${input.lotId})`,
    };
    const payUrl = input.payUrlBase ? `${input.payUrlBase.replace(/\/$/, "")}/orders/` : null;
    let order;
    try {
      order = await createOrder({ ...base, paymentMethod: "stripe", payUrl });
    } catch (e) {
      order = await createOrder({ ...base, paymentMethod: "etransfer" });
    }
    await db`UPDATE auction_lot SET metadata = metadata || ${db.json({ orderId: order.id } as never)} WHERE id = ${input.lotId}`;
    return { ok: true, orderId: order.id };
  } catch (err) {
    console.error(`[commerce] buyNowLot(${input.lotId}):`, err);
    await db`UPDATE auction_lot SET status = 'live', winner_user_id = NULL WHERE id = ${input.lotId}`;
    return { ok: false, reason: err instanceof Error ? err.message : "Could not create the order." };
  }
}

/** Record a bidder's phone and card on file (from the Stripe setup session). */
export async function registerBidder(input: {
  userId: string;
  orgId?: string;
  phone?: string | null;
  stripeCustomerId?: string | null;
  stripePaymentMethodId?: string | null;
}): Promise<void> {
  await db`
    INSERT INTO bidder_registration (user_id, org_id, phone, stripe_customer_id, stripe_payment_method_id)
    VALUES (${input.userId}, ${input.orgId ?? "market"}, ${input.phone ?? null},
            ${input.stripeCustomerId ?? null}, ${input.stripePaymentMethodId ?? null})
    ON CONFLICT (user_id, org_id) DO UPDATE SET
      phone = COALESCE(EXCLUDED.phone, bidder_registration.phone),
      stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, bidder_registration.stripe_customer_id),
      stripe_payment_method_id = COALESCE(EXCLUDED.stripe_payment_method_id, bidder_registration.stripe_payment_method_id),
      registered_at = NOW()
  `;
}
