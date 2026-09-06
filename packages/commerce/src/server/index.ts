/**
 * Server-only commerce mutations.
 *
 * These run inside Next.js server actions or API routes. They write to
 * postgres directly via @elkdonis/db. Never import this from client code —
 * it's meant for `"use server"` action files in consuming apps.
 */

import { db } from "@elkdonis/db";
import { nanoid } from "nanoid";
import { sanitizeRichText } from "@elkdonis/utils";
import type {
  Cart,
  CartLine,
  Order,
  AuctionLot,
  ArtistApplicationInput,
  ArtistProfileUpdateInput,
  CreateArtworkInput,
  UpdateArtworkInput,
  ArtworkMediaInput,
  OrgStoreInput,
  PayoutIdentity,
  PayoutIdentityInput,
  Store,
  StoreMemberRole,
  Currency,
} from "../types";
import { splitCommission } from "../money";
import {
  buildEtransferInstructions,
  generateOrderNumber,
} from "../etransfer";
import { mapOrder } from "./map-order";
import {
  HOST_PAYOUT_EMAIL,
  resolveSettlement,
  type LineSettlement,
} from "./settlement";
import { writeEntry, releaseOnPayoutAccountReady } from "./ledger";

type Row = Record<string, unknown>;
const num = (v: unknown): number => (v == null ? 0 : Number(v));

// Service (thread-kind) orders — the no-cart "book now" rail.
export { createThreadOrder, createServiceOrder, PURCHASABLE_THREAD_KINDS } from "./service-orders";
export { resolveSettlement, HOST_PAYOUT_EMAIL } from "./settlement";
export {
  writeEntry,
  getBalance,
  listEntries,
  listHeld,
  releaseHold,
  releaseOnPayoutAccountReady,
} from "./ledger";
export type { LedgerEntry, Balance, Party, PartyKind, HoldReason } from "./ledger";
export type { LineSettlement, SettlementInput } from "./settlement";
export type {
  CreateThreadOrderInput,
  CreateServiceOrderInput,
  PurchasableThreadKind,
} from "./service-orders";

/**
 * Get-or-create a cart given an optional token (from cookie). Returns the
 * cart row + the token to set as a cookie.
 */
export async function getOrCreateCart(input: {
  token?: string | null;
  userId?: string | null;
  currency?: Cart["currency"];
}): Promise<{ cart: Cart; token: string }> {
  if (input.token) {
    const rows = (await db`
      SELECT * FROM cart WHERE token = ${input.token} LIMIT 1
    `) as unknown as Row[];
    if (rows[0]) {
      return { cart: mapCart(rows[0]), token: input.token };
    }
  }

  const newToken = nanoid(32);
  const rows = (await db`
    INSERT INTO cart (token, user_id, currency)
    VALUES (${newToken}, ${input.userId ?? null}, ${input.currency ?? "CAD"})
    RETURNING *
  `) as unknown as Row[];
  return { cart: mapCart(rows[0]!), token: newToken };
}

export async function addToCart(input: {
  cartToken: string;
  artworkVariantId: string;
  quantity?: number;
  notes?: string | null;
}): Promise<CartLine> {
  const cartRows = (await db`
    SELECT * FROM cart WHERE token = ${input.cartToken} LIMIT 1
  `) as unknown as Row[];
  if (!cartRows[0]) throw new Error("Cart not found");
  const cartId = cartRows[0].id as string;

  const variantRows = (await db`
    SELECT av.id, av.price_minor, av.currency, av.inventory_qty,
           a.store_id, s.status AS store_status
    FROM artwork_variant av
    JOIN artwork a ON a.id = av.artwork_id
    JOIN store s ON s.id = a.store_id
    WHERE av.id = ${input.artworkVariantId} LIMIT 1
  `) as unknown as Row[];
  if (!variantRows[0]) throw new Error("Variant not found");
  const variant = variantRows[0];
  if (num(variant.inventory_qty) <= 0) throw new Error("This piece is no longer available");
  if (variant.store_status !== "active") {
    throw new Error("This store is not currently selling.");
  }

  // One cart per store (decided 2026-09-05). An order has to map to exactly
  // one payee for a destination charge to be possible, so the basket is where
  // that gets enforced — not at checkout, which is where the old runtime guard
  // caught it, after the buyer had already built something unsellable.
  const cartStoreId = cartRows[0].store_id as string | null;
  const lineStoreId = variant.store_id as string;
  if (cartStoreId && cartStoreId !== lineStoreId) {
    throw new Error(
      "Your basket is with another seller. Check out first, or empty the basket, before adding this."
    );
  }
  if (!cartStoreId) {
    await db`UPDATE cart SET store_id = ${lineStoreId} WHERE id = ${cartId}`;
  }

  const lineRows = (await db`
    INSERT INTO cart_line (cart_id, artwork_variant_id, quantity, unit_price_minor, currency, notes)
    VALUES (
      ${cartId}, ${input.artworkVariantId}, ${input.quantity ?? 1},
      ${num(variant.price_minor)}, ${variant.currency as string}, ${input.notes ?? null}
    )
    RETURNING *
  `) as unknown as Row[];

  const lr = lineRows[0]!;
  return {
    id: lr.id as string,
    cartId: lr.cart_id as string,
    artworkVariantId: lr.artwork_variant_id as string,
    quantity: num(lr.quantity),
    unitPriceMinor: num(lr.unit_price_minor),
    currency: lr.currency as CartLine["currency"],
    notes: (lr.notes as string | null) ?? null,
    createdAt: lr.created_at as string,
  };
}

export async function removeCartLine(input: { lineId: string }): Promise<void> {
  const rows = (await db`
    DELETE FROM cart_line WHERE id = ${input.lineId} RETURNING cart_id
  `) as unknown as Row[];
  const cartId = rows[0]?.cart_id as string | undefined;
  if (!cartId) return;
  // Releasing the pin once the basket empties matters: otherwise removing the
  // last line leaves the buyer locked to a seller they have nothing from.
  await db`
    UPDATE cart SET store_id = NULL
    WHERE id = ${cartId}
      AND NOT EXISTS (SELECT 1 FROM cart_line WHERE cart_id = ${cartId})
  `;
}

/**
 * Favourite / un-favourite an artwork for a user. Idempotent. Returns the new
 * favourited state so the caller can update the UI.
 */
export async function setArtworkFavorite(input: {
  userId: string;
  artworkId: string;
  favorited: boolean;
}): Promise<{ favorited: boolean }> {
  if (input.favorited) {
    await db`
      INSERT INTO artwork_favorite (user_id, artwork_id)
      VALUES (${input.userId}, ${input.artworkId})
      ON CONFLICT (user_id, artwork_id) DO NOTHING
    `;
  } else {
    await db`
      DELETE FROM artwork_favorite
      WHERE user_id = ${input.userId} AND artwork_id = ${input.artworkId}
    `;
  }
  return { favorited: input.favorited };
}

/**
 * Create an active reservation on a variant for a cart. 15-min default hold.
 */
export async function createReservation(input: {
  artworkVariantId: string;
  cartId: string;
  minutes?: number;
}): Promise<{ id: string; expiresAt: string }> {
  const minutes = input.minutes ?? 15;
  const rows = (await db`
    INSERT INTO reservation (artwork_variant_id, cart_id, expires_at, status)
    VALUES (${input.artworkVariantId}, ${input.cartId}, NOW() + (${minutes} || ' minutes')::interval, 'active')
    RETURNING id, expires_at
  `) as unknown as Row[];
  return { id: rows[0]!.id as string, expiresAt: rows[0]!.expires_at as string };
}

/**
 * Convert a cart into an eTransfer order. Locks the artwork, snapshots prices,
 * computes per-line artist/gallery splits, and returns the new order with
 * payment instructions ready to display.
 */
export async function createEtransferOrder(input: {
  cartToken: string;
  customerEmail: string;
  customerName?: string | null;
  customerId?: string | null;
  shippingAddress?: Order["shippingAddress"];
  billingAddress?: Order["billingAddress"];
  notes?: string | null;
  etransferDueHours?: number;
}): Promise<Order> {
  const cartRows = (await db`
    SELECT * FROM cart WHERE token = ${input.cartToken} LIMIT 1
  `) as unknown as Row[];
  if (!cartRows[0]) throw new Error("Cart not found");
  const cart = cartRows[0];
  const cartId = cart.id as string;

  const lineRows = (await db`
    SELECT
      cl.*,
      a.id AS art_id, a.title AS art_title, a.artist_user_id AS art_artist_user_id, a.org_id AS art_org_id,
      st.id AS store_id,
      -- The org that may claim a cut: the front's owner when an org owns it,
      -- otherwise the marketplace the front trades in. Whether it actually
      -- gets one is decided by the maker's agreements, not by this row.
      COALESCE(st.owner_org_id, st.org_id) AS counterparty_org_id,
      -- Payout identity belongs to the maker (migration 096), not the front.
      maker.payout_email AS maker_payout_email,
      COALESCE(maker.display_name, maker.email) AS maker_name,
      COALESCE(o.name, owner.display_name, owner.email) AS front_name
    FROM cart_line cl
    JOIN artwork_variant av ON av.id = cl.artwork_variant_id
    JOIN artwork a ON a.id = av.artwork_id
    JOIN store st ON st.id = a.store_id
    LEFT JOIN users maker ON maker.id = a.artist_user_id
    LEFT JOIN users owner ON owner.id = st.owner_user_id
    LEFT JOIN organizations o ON o.id = st.owner_org_id
    WHERE cl.cart_id = ${cartId}
  `) as unknown as Row[];

  if (lineRows.length === 0) throw new Error("Cart is empty");

  // One payee per order. addToCart pins the basket to a store, so this is now
  // a belt-and-braces check on data that should already be impossible rather
  // than the place a buyer first learns their basket cannot be sold to them.
  const storeIds = new Set(lineRows.map((l) => l.store_id as string));
  if (storeIds.size > 1) {
    throw new Error(
      "This basket spans several sellers. Please check out one seller at a time."
    );
  }
  const firstLine = lineRows[0]!;
  const storeId = firstLine.store_id as string;

  // Who is actually paid, resolved by the shared settlement rules rather than
  // by this rail's own idea of a payee — see ./settlement.ts for why all three
  // purchase rails now go through one answer.
  const settlements = new Map<string, LineSettlement>();
  for (const l of lineRows) {
    const maker = (l.art_artist_user_id as string | null) ?? null;
    const orgId = l.counterparty_org_id as string;
    const key = `${maker ?? "-"}:${orgId}`;
    if (settlements.has(key)) continue;
    settlements.set(
      key,
      await resolveSettlement({
        makerUserId: maker,
        orgId,
        // The percentage is what an agreement fixes, so the amount passed here
        // only has to be representative; each line splits at its own total.
        amountMinor: num(l.unit_price_minor) * num(l.quantity),
      })
    );
  }

  const makerUserId = (firstLine.art_artist_user_id as string | null) ?? null;
  const headline = settlements.get(
    `${makerUserId ?? "-"}:${firstLine.counterparty_org_id as string}`
  )!;
  const artistName = headline.payeeName;
  const payoutEmail = headline.payoutEmail;

  const lineSplits = lineRows.map((l) => {
    const unit = num(l.unit_price_minor);
    const qty = num(l.quantity);
    const total = unit * qty;
    const maker = (l.art_artist_user_id as string | null) ?? null;
    const orgId = l.counterparty_org_id as string;
    const r = settlements.get(`${maker ?? "-"}:${orgId}`)!;
    // Split at this line's own total so rounding lands per line, rather than
    // apportioning a basket-level figure back across them.
    const split = splitCommission(total, r.orgSharePercent);
    return {
      row: l,
      unit,
      qty,
      makerUserId: maker,
      orgId,
      orgSharePercent: r.orgSharePercent,
      agreementId: r.agreementId,
      // splitCommission names these artist/gallery; here they are maker and
      // the org's earmarked cut. Same arithmetic, honest names.
      makerShareMinor: split.artistShareMinor,
      orgShareMinor: split.galleryShareMinor,
    };
  });

  const subtotalMinor = lineRows.reduce(
    (s, l) => s + num(l.unit_price_minor) * num(l.quantity),
    0
  );
  const currency = firstLine.currency as Order["currency"];
  const totalMinor = subtotalMinor; // shipping + tax computed separately later

  const orderNumber = generateOrderNumber();
  const dueHours = input.etransferDueHours ?? 72;
  const instructions = buildEtransferInstructions({
    orderNumber,
    totalMinor,
    currency,
    artistName,
    payoutEmail,
    paymentDueAt: new Date(Date.now() + dueHours * 3600_000).toISOString(),
  });

  // Insert order + lines + reservations in one transaction
  const order = await db.begin(async (tx) => {
    const orderRows = (await tx`
      INSERT INTO commerce_order (
        number, store_id, customer_id, customer_email, customer_name, status,
        payment_method, payment_reference, payment_instructions,
        payment_due_at, subtotal_minor, total_minor, currency,
        shipping_address, billing_address, notes
      ) VALUES (
        ${orderNumber}, ${storeId}, ${input.customerId ?? null}, ${input.customerEmail},
        ${input.customerName ?? null}, 'awaiting_etransfer',
        'etransfer', ${instructions.paymentReference}, ${instructions.buyerInstructions},
        NOW() + (${dueHours} || ' hours')::interval,
        ${subtotalMinor}, ${totalMinor}, ${currency},
        ${input.shippingAddress ? JSON.stringify(input.shippingAddress) : null}::jsonb,
        ${input.billingAddress ? JSON.stringify(input.billingAddress) : null}::jsonb,
        ${input.notes ?? null}
      )
      RETURNING *
    `) as unknown as Row[];
    const orderRow = orderRows[0]!;
    const orderId = orderRow.id as string;

    for (const sp of lineSplits) {
      const l = sp.row;

      // The line records what it was, who made it, which front showed it, and
      // which agreement authorised the org's cut — so the settlement can be
      // re-derived years later without trusting rows that have been edited
      // since. A NULL agreement_id is meaningful: nothing authorised a split.
      await tx`
        INSERT INTO commerce_order_line (
          order_id, artwork_variant_id, artwork_id, artist_user_id, org_id,
          description, quantity, unit_price_minor,
          artist_share_minor, gallery_share_minor, currency,
          agreement_id, org_share_percent, payee_org_id, presented_store_id
        ) VALUES (
          ${orderId}, ${l.artwork_variant_id as string}, ${l.art_id as string},
          ${sp.makerUserId}, ${l.art_org_id as string},
          ${l.art_title as string}, ${sp.qty}, ${sp.unit},
          ${sp.makerShareMinor}, ${sp.orgShareMinor}, ${l.currency as string},
          ${sp.agreementId}, ${sp.orgSharePercent},
          ${sp.orgShareMinor > 0 ? sp.orgId : null}, ${l.store_id as string}
        )
      `;

      // Reserve the variant for the eTransfer window
      await tx`
        INSERT INTO reservation (artwork_variant_id, cart_id, expires_at, status)
        VALUES (
          ${l.artwork_variant_id as string}, ${cartId},
          NOW() + (${dueHours} || ' hours')::interval, 'active'
        )
      `;
      // Mark the artwork as reserved
      await tx`UPDATE artwork SET status = 'reserved' WHERE id = ${l.art_id as string}`;
    }

    return orderRow;
  });

  // Reuses the splits written to the order lines rather than recomputing them,
  // so an invoice can never disagree with what was actually recorded.
  const emailItems = lineSplits.map((sp) => ({
    description: sp.row.art_title as string,
    quantity: sp.qty,
    unitPriceMinor: sp.unit,
    artistShareMinor: sp.makerShareMinor,
    galleryShareMinor: sp.orgShareMinor,
    currency: sp.row.currency as string,
  }));

  // Fire emails non-blocking — order is already committed
  const paymentDueAt = (order.payment_due_at as string | null) ?? null;
  void (async () => {
    try {
      const { sendOrderInvoice, sendOrderNotification } = await import('@elkdonis/email');
      const galleryEmail = HOST_PAYOUT_EMAIL;

      await Promise.all([
        sendOrderInvoice(input.customerEmail, {
          orderNumber,
          customerName: input.customerName ?? null,
          items: emailItems,
          totalMinor,
          currency,
          paymentInstructions: instructions.buyerInstructions,
          artistName,
          artistPayoutEmail: payoutEmail,
          paymentDueAt,
        }),
        sendOrderNotification(payoutEmail, {
          role: 'artist',
          orderNumber,
          customerName: input.customerName ?? null,
          customerEmail: input.customerEmail,
          artistName,
          items: emailItems,
          totalMinor,
          currency,
          paymentDueAt,
        }),
        sendOrderNotification(galleryEmail, {
          role: 'platform',
          orderNumber,
          customerName: input.customerName ?? null,
          customerEmail: input.customerEmail,
          artistName,
          items: emailItems,
          totalMinor,
          currency,
          paymentDueAt,
        }),
      ]);
    } catch (emailErr) {
      console.error('[commerce] order email failed:', emailErr);
    }
  })();

  return mapOrder(order);
}

/**
 * Admin/artist action: mark an eTransfer order as paid.
 * Decrements inventory, marks artwork sold, creates a payout record.
 */
export async function confirmEtransferReceived(input: {
  orderId: string;
  confirmedByUserId: string;
  paymentReference?: string;
  notes?: string;
}): Promise<Order> {
  const result = await db.begin(async (tx) => {
    const orderRows = (await tx`
      UPDATE commerce_order
      SET status = 'paid',
          paid_at = NOW(),
          payment_confirmed_at = NOW(),
          payment_confirmed_by = ${input.confirmedByUserId},
          payment_reference = COALESCE(${input.paymentReference ?? null}, payment_reference),
          notes = COALESCE(notes || E'\n', '') || ${input.notes ? `[confirmed] ${input.notes}` : "[confirmed]"}
      WHERE id = ${input.orderId} AND status IN ('awaiting_etransfer', 'payment_received', 'pending_payment')
      RETURNING *
    `) as unknown as Row[];
    if (!orderRows[0]) throw new Error("Order is not in a state where it can be marked paid.");
    const order = orderRows[0];

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

      // The maker's share. With eTransfer the buyer paid them directly, so
      // this accrues and is settled in the same breath — the ledger still
      // records both halves, because "it was owed and then it was paid" is the
      // history an audit needs, not a net of zero appearing from nowhere.
      if (makerUserId && makerShare > 0) {
        const payout = (await tx`
          INSERT INTO payout (
            artist_user_id, order_id, amount_minor, currency,
            method, reference, status, sent_at, notes
          ) VALUES (
            ${makerUserId}, ${input.orderId},
            ${makerShare}, ${currency},
            'etransfer', ${order.payment_reference as string}, 'received', NOW(),
            'Buyer sent eTransfer directly to the maker'
          )
          RETURNING id
        `) as unknown as Row[];

        await writeEntry(
          {
            party: { kind: "user", userId: makerUserId },
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
            party: { kind: "user", userId: makerUserId },
            entryType: "payout",
            amountMinor: -makerShare,
            currency,
            orderId: input.orderId,
            orderLineId: lineId,
            payoutId: payout[0]!.id as string,
            note: "Paid directly by the buyer via eTransfer",
            createdBy: input.confirmedByUserId,
          },
          tx as unknown as typeof db
        );
      }

      // The org's share. It has no connected account and receives no transfer
      // — this accrual IS the earmark inside the host account, and until now
      // it was computed onto the line and then simply lost.
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
            // Held from birth: the money is with the collective, and drawing
            // it down is a deliberate act, not an automatic one.
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
    return order;
  });

  return mapOrder(result);
}

/**
 * Place a bid on an auction lot. Validates: lot is live, amount >= next min,
 * bidder is signed in. Updates lot.current_bid + bid_count atomically.
 * Anti-snipe: if bid arrives in the last `anti_snipe_minutes`, extend end_at.
 */
export async function placeBid(input: {
  lotId: string;
  bidderId: string;
  amountMinor: number;
  maxAmountMinor?: number | null;
  clientIp?: string | null;
  userAgent?: string | null;
}): Promise<
  | { ok: true; lot: Pick<AuctionLot, "currentBidMinor" | "bidCount" | "endAt">; bidId: string }
  | { ok: false; reason: string }
> {
  return await db.begin(async (tx) => {
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
      return { ok: false as const, reason: "Auction has not started yet." };
    }
    if (new Date(lot.end_at as string).getTime() <= now) {
      return { ok: false as const, reason: "Auction has ended." };
    }

    const currentBid = num(lot.current_bid_minor);
    const startingBid = num(lot.starting_bid_minor);
    const increment = num(lot.bid_increment_minor);
    const minAcceptable = currentBid > 0 ? currentBid + increment : startingBid;

    if (input.amountMinor < minAcceptable) {
      return { ok: false as const, reason: `Bid must be at least ${minAcceptable / 100}.` };
    }

    const bidRows = (await tx`
      INSERT INTO bid (lot_id, bidder_id, amount_minor, max_amount_minor, is_max_bid, status, client_ip, user_agent)
      VALUES (
        ${input.lotId}, ${input.bidderId}, ${input.amountMinor},
        ${input.maxAmountMinor ?? null},
        ${input.maxAmountMinor != null && input.maxAmountMinor > input.amountMinor},
        'winning',
        ${input.clientIp ?? null}::inet,
        ${input.userAgent ?? null}
      )
      RETURNING id
    `) as unknown as Row[];
    const newBidId = bidRows[0]!.id as string;

    // Mark prior winning bids as outbid
    await tx`
      UPDATE bid SET status = 'outbid'
      WHERE lot_id = ${input.lotId} AND id <> ${newBidId} AND status = 'winning'
    `;

    // Anti-snipe: extend end_at if bid arrived within anti_snipe_minutes
    const antiSnipeMs = num(lot.anti_snipe_minutes) * 60_000;
    const minutesUntilEnd = new Date(lot.end_at as string).getTime() - now;
    let newEndAt = lot.end_at as string;
    if (antiSnipeMs > 0 && minutesUntilEnd < antiSnipeMs) {
      const extended = new Date(now + antiSnipeMs).toISOString();
      newEndAt = extended;
    }

    const updatedRows = (await tx`
      UPDATE auction_lot
      SET current_bid_minor = ${input.amountMinor},
          current_bid_id = ${newBidId},
          bid_count = bid_count + 1,
          end_at = ${newEndAt},
          status = 'live',
          winner_user_id = ${input.bidderId}
      WHERE id = ${input.lotId}
      RETURNING current_bid_minor, bid_count, end_at
    `) as unknown as Row[];
    const ur = updatedRows[0]!;

    return {
      ok: true as const,
      lot: {
        currentBidMinor: num(ur.current_bid_minor),
        bidCount: num(ur.bid_count),
        endAt: ur.end_at as string,
      },
      bidId: newBidId,
    };
  });
}

// ─── Mappers (keep in sync with queries/index.ts) ─────────────────────────

function mapCart(r: Row): Cart {
  return {
    id: r.id as string,
    token: r.token as string,
    userId: (r.user_id as string | null) ?? null,
    currency: r.currency as Cart["currency"],
    expiresAt: (r.expires_at as string | null) ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

// mapOrder lives in ./map-order so service-orders.ts can share it.

// ─── Marketplace artists: apply / review / profile ────────────────────────

const DEFAULT_MARKETPLACE_ORG = "market";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function serializeLinks(
  links: { label: string; url: string }[] | undefined
): string {
  if (!links) return "[]";
  const clean = links
    .filter((l) => l && typeof l.url === "string" && l.url.trim().length > 0)
    .map((l) => ({ label: String(l.label ?? l.url).trim(), url: l.url.trim() }));
  return JSON.stringify(clean);
}

/**
 * Flat rather than a discriminated union on purpose: art-auction compiles
 * without `strict`, and TypeScript does not narrow discriminated unions
 * without strictNullChecks — `if (!result.ok)` would leave `result.error`
 * inaccessible. This shape also matches the `{ ok, error? }` convention the
 * surrounding server actions already use.
 */
export type ApplyResult = {
  ok: boolean;
  store?: Store;
  /** @deprecated Same object as `store`; kept while art-auction migrates. */
  artist?: Store;
  error?: string;
};

/**
 * Whether this person may claim a store at all.
 *
 * A store is a commercial relationship with the collective — payouts and a
 * commission rate — so it is gated on actually being in the collective, not
 * merely holding an account. Any org role anywhere qualifies; this asks "are
 * you one of us", not "are you one of THIS org's".
 */
export async function canClaimStore(userId: string): Promise<boolean> {
  try {
    const [row] = await db`
      SELECT 1 FROM user_organizations WHERE user_id = ${userId} LIMIT 1
    `;
    return Boolean(row);
  } catch (err) {
    console.error(`[commerce] canClaimStore(${userId}):`, err);
    return false;
  }
}

/**
 * Whether an organization is allowed to own a store yet.
 *
 * An associated organization starts life as a directory listing an admin typed
 * in — a `users` row with entity_type='organization' and an `organizations`
 * record, with nobody behind it. Letting that sell would mean accepting money
 * on behalf of a business that has not agreed to anything.
 *
 * So the gate is ownership, not a separate "verified" flag (decided
 * 2026-09-05): a real person has to hold the 'owner' role in the org. That
 * gives the record one lifecycle — admin stub → claimed by a member → able to
 * sell — with no second piece of state to keep in sync.
 */
export async function canOrgSell(orgId: string): Promise<boolean> {
  try {
    const [row] = await db`
      SELECT 1
      FROM user_organizations uo
      JOIN users u ON u.id = uo.user_id
      WHERE uo.org_id = ${orgId}
        AND uo.role = 'owner'
        -- The org's own users row (migration 093) must not count as its own
        -- claimant; a listing cannot vouch for itself.
        AND COALESCE(u.entity_type, 'person') = 'person'
      LIMIT 1
    `;
    return Boolean(row);
  } catch (err) {
    console.error(`[commerce] canOrgSell(${orgId}):`, err);
    return false;
  }
}

/**
 * Whether this user may act for this store — list, price, fulfil.
 *
 * For a person's store that is the owner alone. For an org's store it is the
 * `store_member` roll, which is deliberately NOT the org's membership: being
 * a member of IFAC should not let you price its work.
 */
export async function canActForStore(
  userId: string,
  storeId: string
): Promise<boolean> {
  try {
    const [row] = await db`
      SELECT 1 FROM store s
      LEFT JOIN store_member sm
        ON sm.store_id = s.id AND sm.user_id = ${userId}
      WHERE s.id = ${storeId}
        AND (s.owner_user_id = ${userId} OR sm.user_id IS NOT NULL)
      LIMIT 1
    `;
    return Boolean(row);
  } catch (err) {
    console.error(`[commerce] canActForStore(${userId}, ${storeId}):`, err);
    return false;
  }
}

/**
 * A person applies for their own store (or resubmits). Creates a `pending`
 * row; a previously `rejected` applicant is reset to `pending`. Bio is
 * sanitized.
 *
 * Gated on collective membership — previously any signed-in account could
 * apply, which meant a stranger could enter the seller review queue with
 * payout details attached.
 */
export async function applyForStore(
  input: ArtistApplicationInput
): Promise<ApplyResult> {
  if (!(await canClaimStore(input.userId))) {
    return {
      ok: false,
      error:
        "A store is for members of the collective. Join an organisation first, then claim your store.",
    };
  }

  const bioHtml = input.bioHtml ? sanitizeRichText(input.bioHtml) : null;
  const orgId = input.orgId ?? DEFAULT_MARKETPLACE_ORG;

  // Identity goes to `users`, the home migration 084 gave it — not duplicated
  // into the store row, which is what made a seller's name here drift from
  // their name everywhere else. COALESCE so an empty application field never
  // erases something the person set on their profile.
  await db`
    UPDATE users SET
      display_name = COALESCE(NULLIF(${input.displayName ?? null}, ''), display_name),
      headline     = COALESCE(NULLIF(${input.headline ?? null}, ''), headline),
      city         = COALESCE(NULLIF(${input.city ?? null}, ''), city),
      avatar_url   = COALESCE(NULLIF(${input.photoUrl ?? null}, ''), avatar_url),
      -- Payout identity is the person's, not the front's (migration 096) —
      -- an artist selling through three orgs is paid once, in one place.
      payout_email  = COALESCE(NULLIF(${input.payoutEmail ?? null}, ''), payout_email),
      payout_method = COALESCE(${input.payoutMethod ?? null}, payout_method)
    WHERE id = ${input.userId}
  `;

  // The conflict target carries the index predicate because the uniqueness is
  // partial — one store per person per marketplace, with org-owned rows (whose
  // owner_user_id is NULL) excluded rather than colliding with each other.
  await db`
    INSERT INTO store (
      owner_user_id, org_id, payout_email, payout_method, default_currency,
      status, bio_html, links, applied_at
    ) VALUES (
      ${input.userId}, ${orgId},
      ${input.payoutEmail}, ${input.payoutMethod ?? "etransfer"},
      ${input.defaultCurrency ?? "CAD"}, 'pending', ${bioHtml},
      ${serializeLinks(input.links)}::jsonb, NOW()
    )
    ON CONFLICT (org_id, owner_user_id) WHERE owner_user_id IS NOT NULL
    DO UPDATE SET
      payout_email = EXCLUDED.payout_email,
      payout_method = EXCLUDED.payout_method,
      default_currency = EXCLUDED.default_currency,
      bio_html = EXCLUDED.bio_html,
      links = EXCLUDED.links,
      status = CASE
        WHEN store.status = 'rejected' THEN 'pending'
        ELSE store.status
      END,
      rejection_reason = CASE
        WHEN store.status = 'rejected' THEN NULL
        ELSE store.rejection_reason
      END,
      applied_at = CASE
        WHEN store.status = 'rejected' THEN NOW()
        ELSE store.applied_at
      END
  `;

  const created = await getStoreRow(input.userId, orgId);
  if (!created) throw new Error("Failed to create store application.");
  return { ok: true, store: created, artist: created };
}

/** @deprecated Use {@link applyForStore}. */
export const applyAsArtist = applyForStore;

/**
 * Open a store owned by an organization.
 *
 * Unlike a person's application this is not a queue — the actor already holds
 * the 'owner' role in the org, which is the same authority that would approve
 * it — so it lands `active`. The actor is recorded as a store member so the
 * store still has a hand on it if org roles later change.
 */
export async function openOrgStore(
  input: OrgStoreInput
): Promise<ApplyResult> {
  if (!(await canOrgSell(input.ownerOrgId))) {
    return {
      ok: false,
      error:
        "This organisation has no owner yet. Someone has to claim it before it can sell.",
    };
  }

  const [actorRow] = await db`
    SELECT 1 FROM user_organizations
    WHERE user_id = ${input.actorUserId}
      AND org_id = ${input.ownerOrgId}
      AND role = 'owner'
    LIMIT 1
  `;
  if (!actorRow) {
    return { ok: false, error: "Only an owner of this organisation can open its store." };
  }

  const bioHtml = input.bioHtml ? sanitizeRichText(input.bioHtml) : null;
  // An org sells in its own marketplace unless told otherwise — the common
  // case, and the only one that needs no extra permission story.
  const orgId = input.orgId ?? input.ownerOrgId;

  const storeId = await db.begin(async (tx) => {
    const rows = (await tx`
      INSERT INTO store (
        owner_org_id, org_id, payout_email, payout_method, default_currency,
        status, bio_html, links, applied_at, reviewed_at, reviewed_by
      ) VALUES (
        ${input.ownerOrgId}, ${orgId},
        ${input.payoutEmail ?? null}, ${input.payoutMethod ?? "etransfer"},
        ${input.defaultCurrency ?? "CAD"}, 'active', ${bioHtml},
        ${serializeLinks(input.links)}::jsonb, NOW(), NOW(), ${input.actorUserId}
      )
      ON CONFLICT (org_id, owner_org_id) WHERE owner_org_id IS NOT NULL
      DO UPDATE SET
        payout_email = EXCLUDED.payout_email,
        payout_method = EXCLUDED.payout_method,
        default_currency = EXCLUDED.default_currency,
        bio_html = EXCLUDED.bio_html,
        links = EXCLUDED.links
      RETURNING id
    `) as unknown as Row[];
    const id = rows[0]!.id as string;

    await tx`
      INSERT INTO store_member (store_id, user_id, role, added_by)
      VALUES (${id}, ${input.actorUserId}, 'owner', ${input.actorUserId})
      ON CONFLICT (store_id, user_id) DO UPDATE SET role = 'owner'
    `;
    return id;
  });

  const { getStore } = await import("../queries");
  const store = await getStore(storeId);
  if (!store) throw new Error("Failed to open the organisation's store.");
  return { ok: true, store, artist: store };
}

/** Give someone authority over a store. Caller must already be authorised. */
export async function addStoreMember(
  storeId: string,
  userId: string,
  role: StoreMemberRole,
  addedBy: string
): Promise<void> {
  await db`
    INSERT INTO store_member (store_id, user_id, role, added_by)
    VALUES (${storeId}, ${userId}, ${role}, ${addedBy})
    ON CONFLICT (store_id, user_id) DO UPDATE SET role = EXCLUDED.role
  `;
}

/**
 * Remove someone's authority over a store. Refuses to remove the last owner —
 * an org store with no hand on it can still take orders nobody can fulfil.
 */
export async function removeStoreMember(
  storeId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const rows = (await db`
    SELECT COUNT(*)::int AS n FROM store_member
    WHERE store_id = ${storeId} AND role = 'owner' AND user_id <> ${userId}
  `) as unknown as Row[];
  const [target] = (await db`
    SELECT role FROM store_member
    WHERE store_id = ${storeId} AND user_id = ${userId}
  `) as unknown as Row[];
  if (!target) return { ok: true };
  if (target.role === "owner" && Number(rows[0]?.n ?? 0) === 0) {
    return { ok: false, error: "A store needs at least one owner." };
  }
  await db`
    DELETE FROM store_member WHERE store_id = ${storeId} AND user_id = ${userId}
  `;
  return { ok: true };
}

/**
 * Set a person's payout identity — where their money actually goes.
 *
 * On the person, not on a front (migration 096): an artist selling through
 * three orgs onboards once and is paid once. Clearing the Stripe account is
 * not a failure state; it puts them back on manual settlement through the core
 * NFP account, which is the mandatory fallback for anyone who never finishes
 * KYC.
 *
 * There is deliberately no organization equivalent. An org's share is
 * earmarked inside the host account, so an org never holds a connected account
 * and never faces KYC (decided 2026-09-05).
 */
export async function setPayoutIdentity(
  userId: string,
  input: PayoutIdentityInput
): Promise<void> {
  await db`
    UPDATE users SET
      payout_email  = ${input.payoutEmail !== undefined ? input.payoutEmail : db`payout_email`},
      payout_method = COALESCE(${input.payoutMethod ?? null}, payout_method),
      stripe_account_id =
        ${input.stripeAccountId !== undefined ? input.stripeAccountId : db`stripe_account_id`},
      -- Clearing the account clears the KYC stamp with it: a stale
      -- "onboarded" against no account would read as payable.
      stripe_onboarded_at = ${
        input.stripeAccountId === null
          ? null
          : input.stripeOnboardedAt !== undefined
            ? input.stripeOnboardedAt
            : db`stripe_onboarded_at`
      }
    WHERE id = ${userId}
  `;

  // Completing KYC is one of only two things that release held money (the
  // other is an admin acting). Firing it here rather than in a webhook handler
  // means every route to "this person is now payable" passes through one place.
  if (input.stripeOnboardedAt) {
    const released = await releaseOnPayoutAccountReady(userId);
    if (released > 0) {
      console.info(
        `[commerce] released ${released} held entr${released === 1 ? "y" : "ies"} for ${userId} after payout onboarding`
      );
    }
  }
}

/** A person's payout identity, or null if they have no user row. */
export async function getPayoutIdentity(
  userId: string
): Promise<PayoutIdentity | null> {
  const rows = (await db`
    SELECT id, payout_email, payout_method, stripe_account_id, stripe_onboarded_at
    FROM users WHERE id = ${userId} LIMIT 1
  `) as unknown as Row[];
  const r = rows[0];
  if (!r) return null;
  return {
    userId: r.id as string,
    payoutEmail: (r.payout_email as string | null) ?? null,
    payoutMethod: (r.payout_method as PayoutIdentity["payoutMethod"]) ?? "etransfer",
    stripeAccountId: (r.stripe_account_id as string | null) ?? null,
    stripeOnboardedAt: (r.stripe_onboarded_at as string | null) ?? null,
    // An account id exists from the moment onboarding *starts*, so it cannot
    // answer "payable today" on its own — KYC has to have finished.
    canReceiveDestinationCharge:
      Boolean(r.stripe_account_id) && Boolean(r.stripe_onboarded_at),
  };
}

/**
 * A store's owner edits it. Cannot change status here.
 *
 * Payout fields are deliberately NOT written to the store: since migration 096
 * they live on the owner, so `ownerUserId` routes them to `setPayoutIdentity`.
 * Writing them here as well would leave two payout emails disagreeing, with
 * the dead one on the row that used to matter.
 */
export async function updateStore(
  storeId: string,
  input: ArtistProfileUpdateInput,
  ownerUserId?: string
): Promise<void> {
  if (ownerUserId && (input.payoutEmail !== undefined || input.payoutMethod !== undefined)) {
    await setPayoutIdentity(ownerUserId, {
      payoutEmail: input.payoutEmail,
      payoutMethod: input.payoutMethod,
    });
  }
  const bioHtml =
    input.bioHtml !== undefined
      ? input.bioHtml
        ? sanitizeRichText(input.bioHtml)
        : null
      : undefined;

  await db`
    UPDATE store SET
      display_name = COALESCE(${input.displayName ?? null}, display_name),
      headline = ${input.headline !== undefined ? input.headline : db`headline`},
      city = ${input.city !== undefined ? input.city : db`city`},
      photo_url = ${input.photoUrl !== undefined ? input.photoUrl : db`photo_url`},
      bio_html = ${bioHtml !== undefined ? bioHtml : db`bio_html`},
      default_currency = COALESCE(${input.defaultCurrency ?? null}, default_currency),
      links = ${input.links !== undefined ? db`${serializeLinks(input.links)}::jsonb` : db`links`}
    WHERE id = ${storeId}
  `;
}

/** Admin approves a pending store application. */
export async function approveStore(
  storeId: string,
  reviewerId: string
): Promise<void> {
  const rows = (await db`
    UPDATE store SET
      status = 'active',
      reviewed_at = NOW(),
      reviewed_by = ${reviewerId},
      rejection_reason = NULL,
      joined_at = COALESCE(joined_at, NOW())
    WHERE id = ${storeId} AND status IN ('pending', 'rejected', 'paused')
    RETURNING id
  `) as unknown as Row[];
  if (!rows[0]) throw new Error("Application not found or not reviewable.");
}

/** Admin rejects a pending store application with a reason. */
export async function rejectStore(
  storeId: string,
  reviewerId: string,
  reason: string
): Promise<void> {
  const rows = (await db`
    UPDATE store SET
      status = 'rejected',
      reviewed_at = NOW(),
      reviewed_by = ${reviewerId},
      rejection_reason = ${reason}
    WHERE id = ${storeId} AND status = 'pending'
    RETURNING id
  `) as unknown as Row[];
  if (!rows[0]) throw new Error("Application not found or not pending.");
}

async function getStoreRow(
  userId: string,
  orgId?: string
): Promise<Store | null> {
  const { getStoreForUser } = await import("../queries");
  return getStoreForUser(userId, orgId);
}

// ─── Artworks: create / update / media / publish ──────────────────────────

/**
 * Resolve the active store a write belongs to, by store id or by the person
 * who owns it.
 *
 * Addressing by store is the preferred form since migration 095 — an org store
 * has no owner user id, and a person may hold one store per marketplace, so a
 * user id alone no longer names one.
 */
async function requireActiveStore(
  tx: typeof db,
  ref: { storeId?: string; artistUserId?: string | null; orgId?: string }
): Promise<{ storeId: string; orgId: string; defaultCurrency: string }> {
  if (!ref.storeId && !ref.artistUserId) {
    throw new Error("A store id or an artist is required.");
  }
  const rows = (await tx`
    SELECT id, org_id, default_currency, status
    FROM store
    WHERE ${
      ref.storeId
        ? tx`id = ${ref.storeId}`
        : tx`owner_user_id = ${ref.artistUserId!}`
    }
      ${ref.orgId ? tx`AND org_id = ${ref.orgId}` : tx``}
    ORDER BY joined_at ASC
    LIMIT 1
  `) as unknown as Row[];
  if (!rows[0]) throw new Error("You do not have a store here yet.");
  if (rows[0].status !== "active") {
    throw new Error("Your store is not approved yet.");
  }
  return {
    storeId: rows[0].id as string,
    orgId: rows[0].org_id as string,
    defaultCurrency: rows[0].default_currency as string,
  };
}

/**
 * Whether this person may write to this artwork, resolved through the store
 * that sells it rather than through `artist_user_id`.
 *
 * The old check was `WHERE artist_user_id = $actor`, which cannot express an
 * org store at all: its artwork has no maker to compare against, and the
 * people entitled to edit it are its store members.
 */
async function requireArtworkAccess(
  tx: typeof db,
  artworkId: string,
  actorUserId: string
): Promise<{ orgId: string; storeId: string }> {
  const rows = (await tx`
    SELECT a.id, a.org_id, a.store_id
    FROM artwork a
    JOIN store s ON s.id = a.store_id
    LEFT JOIN store_member sm ON sm.store_id = s.id AND sm.user_id = ${actorUserId}
    WHERE a.id = ${artworkId}
      AND (s.owner_user_id = ${actorUserId} OR sm.user_id IS NOT NULL)
    LIMIT 1
  `) as unknown as Row[];
  if (!rows[0]) throw new Error("Artwork not found.");
  return { orgId: rows[0].org_id as string, storeId: rows[0].store_id as string };
}

async function uniqueSlug(
  tx: typeof db,
  orgId: string,
  title: string
): Promise<string> {
  const base = slugify(title) || "artwork";
  const existing = (await tx`
    SELECT slug FROM artwork WHERE org_id = ${orgId} AND slug = ${base} LIMIT 1
  `) as unknown as Row[];
  if (!existing[0]) return base;
  return `${base}-${nanoid(6).toLowerCase()}`;
}

/**
 * Create a draft artwork with one default-priced variant and ordered media.
 * Ownership: the caller must be an active marketplace artist. Returns the new
 * artwork id.
 */
export async function createArtwork(
  input: CreateArtworkInput
): Promise<{ id: string; slug: string }> {
  const descriptionHtml = input.descriptionHtml
    ? sanitizeRichText(input.descriptionHtml)
    : null;

  return db.begin(async (tx) => {
    const { storeId, orgId, defaultCurrency } = await requireActiveStore(
      tx as unknown as typeof db,
      { storeId: input.storeId, artistUserId: input.artistUserId }
    );
    const currency = (input.currency ?? defaultCurrency) as Currency;
    const slug = await uniqueSlug(tx as unknown as typeof db, orgId, input.title);

    const artRows = (await tx`
      INSERT INTO artwork (
        org_id, store_id, artist_user_id, slug, title, description_html, year_created,
        medium, style, subject, height_cm, width_cm, depth_cm, weight_kg,
        kind, certificate_of_authenticity, provenance_notes, status
      ) VALUES (
        ${orgId}, ${storeId}, ${input.artistUserId ?? null}, ${slug}, ${input.title},
        ${descriptionHtml}, ${input.yearCreated ?? null}, ${input.medium ?? null},
        ${input.style ?? null}, ${input.subject ?? null}, ${input.heightCm ?? null},
        ${input.widthCm ?? null}, ${input.depthCm ?? null}, ${input.weightKg ?? null},
        ${input.kind ?? "original"}, ${input.certificateOfAuthenticity ?? false},
        ${input.provenanceNotes ?? null}, 'draft'
      )
      RETURNING id
    `) as unknown as Row[];
    const artworkId = artRows[0]!.id as string;

    // Single default variant.
    await tx`
      INSERT INTO artwork_variant (
        artwork_id, org_id, label, price_minor, currency, inventory_qty, position
      ) VALUES (
        ${artworkId}, ${orgId}, 'Default', ${Math.max(0, Math.round(input.priceMinor))},
        ${currency}, ${input.inventoryQty ?? 1}, 0
      )
    `;

    await writeArtworkMedia(
      tx as unknown as typeof db,
      artworkId,
      orgId,
      input.images ?? []
    );

    return { id: artworkId, slug };
  });
}

/** Update editable fields on an owned artwork (and optionally its price). */
export async function updateArtwork(
  artworkId: string,
  artistUserId: string,
  input: UpdateArtworkInput
): Promise<void> {
  const descriptionHtml =
    input.descriptionHtml !== undefined
      ? input.descriptionHtml
        ? sanitizeRichText(input.descriptionHtml)
        : null
      : undefined;

  await db.begin(async (tx) => {
    await requireArtworkAccess(tx as unknown as typeof db, artworkId, artistUserId);

    await tx`
      UPDATE artwork SET
        title = COALESCE(${input.title ?? null}, title),
        description_html = ${descriptionHtml !== undefined ? descriptionHtml : db`description_html`},
        kind = COALESCE(${input.kind ?? null}, kind),
        year_created = ${input.yearCreated !== undefined ? input.yearCreated : db`year_created`},
        medium = ${input.medium !== undefined ? input.medium : db`medium`},
        style = ${input.style !== undefined ? input.style : db`style`},
        subject = ${input.subject !== undefined ? input.subject : db`subject`},
        height_cm = ${input.heightCm !== undefined ? input.heightCm : db`height_cm`},
        width_cm = ${input.widthCm !== undefined ? input.widthCm : db`width_cm`},
        depth_cm = ${input.depthCm !== undefined ? input.depthCm : db`depth_cm`},
        weight_kg = ${input.weightKg !== undefined ? input.weightKg : db`weight_kg`},
        certificate_of_authenticity = COALESCE(${input.certificateOfAuthenticity ?? null}, certificate_of_authenticity),
        provenance_notes = ${input.provenanceNotes !== undefined ? input.provenanceNotes : db`provenance_notes`}
      WHERE id = ${artworkId}
    `;

    if (input.priceMinor !== undefined || input.inventoryQty !== undefined || input.currency !== undefined) {
      await tx`
        UPDATE artwork_variant SET
          price_minor = COALESCE(${input.priceMinor !== undefined ? Math.max(0, Math.round(input.priceMinor)) : null}, price_minor),
          inventory_qty = COALESCE(${input.inventoryQty ?? null}, inventory_qty),
          currency = COALESCE(${input.currency ?? null}, currency)
        WHERE artwork_id = ${artworkId}
          AND id = (
            SELECT id FROM artwork_variant WHERE artwork_id = ${artworkId}
            ORDER BY position ASC LIMIT 1
          )
      `;
    }
  });
}

/**
 * Replace the media set on an owned artwork with a new ordered list. The first
 * image becomes the primary. Used by the studio editor (the uploader emits the
 * full ordered list).
 */
export async function setArtworkMedia(
  artworkId: string,
  artistUserId: string,
  images: ArtworkMediaInput[]
): Promise<void> {
  await db.begin(async (tx) => {
    const { orgId } = await requireArtworkAccess(
      tx as unknown as typeof db, artworkId, artistUserId
    );
    await writeArtworkMedia(
      tx as unknown as typeof db,
      artworkId,
      orgId,
      images
    );
  });
}

/** Internal: delete + reinsert media in order, then point primary at first. */
async function writeArtworkMedia(
  tx: typeof db,
  artworkId: string,
  orgId: string,
  images: ArtworkMediaInput[]
): Promise<void> {
  // Detach primary first to satisfy the FK before deleting media rows.
  await tx`UPDATE artwork SET primary_image_id = NULL WHERE id = ${artworkId}`;
  await tx`DELETE FROM artwork_media WHERE artwork_id = ${artworkId}`;

  let firstId: string | null = null;
  for (let i = 0; i < images.length; i++) {
    const img = images[i]!;
    const rows = (await tx`
      INSERT INTO artwork_media (
        artwork_id, org_id, url, nextcloud_file_id, nextcloud_path, alt, role, position
      ) VALUES (
        ${artworkId}, ${orgId}, ${img.url}, ${img.nextcloudFileId ?? null},
        ${img.nextcloudPath ?? null}, ${img.alt ?? null},
        ${img.role ?? (i === 0 ? "hero" : "detail")}, ${i}
      )
      RETURNING id
    `) as unknown as Row[];
    if (i === 0) firstId = rows[0]!.id as string;
  }

  if (firstId) {
    await tx`UPDATE artwork SET primary_image_id = ${firstId} WHERE id = ${artworkId}`;
  }
}

/** Publish a draft artwork. Requires at least one image and a priced variant. */
export async function publishArtwork(
  artworkId: string,
  artistUserId: string
): Promise<void> {
  await db.begin(async (tx) => {
    await requireArtworkAccess(tx as unknown as typeof db, artworkId, artistUserId);

    const mediaCount = (await tx`
      SELECT COUNT(*)::int AS n FROM artwork_media WHERE artwork_id = ${artworkId}
    `) as unknown as Row[];
    if (num(mediaCount[0]!.n) === 0) {
      throw new Error("Add at least one image before publishing.");
    }

    const priced = (await tx`
      SELECT 1 FROM artwork_variant
      WHERE artwork_id = ${artworkId} AND price_minor > 0 LIMIT 1
    `) as unknown as Row[];
    if (!priced[0]) throw new Error("Set a price before publishing.");

    await tx`
      UPDATE artwork SET status = 'available'
      WHERE id = ${artworkId} AND status IN ('draft', 'archived')
    `;
  });
}

/** Archive an owned artwork (removes it from the public storefront). */
export async function archiveArtwork(
  artworkId: string,
  artistUserId: string
): Promise<void> {
  await requireArtworkAccess(db, artworkId, artistUserId);
  const rows = (await db`
    UPDATE artwork SET status = 'archived'
    WHERE id = ${artworkId} AND status NOT IN ('sold')
    RETURNING id
  `) as unknown as Row[];
  if (!rows[0]) throw new Error("Artwork not found or cannot be archived.");
}
