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
  OrderStatus,
  AuctionLot,
  ArtistApplicationInput,
  ArtistProfileUpdateInput,
  CreateArtworkInput,
  UpdateArtworkInput,
  ArtworkMediaInput,
  MarketplaceArtist,
  Currency,
} from "../types";
import { splitCommission } from "../money";
import {
  buildEtransferInstructions,
  generateOrderNumber,
} from "../etransfer";

type Row = Record<string, unknown>;
const num = (v: unknown): number => (v == null ? 0 : Number(v));

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
    SELECT id, price_minor, currency, inventory_qty
    FROM artwork_variant WHERE id = ${input.artworkVariantId} LIMIT 1
  `) as unknown as Row[];
  if (!variantRows[0]) throw new Error("Variant not found");
  const variant = variantRows[0];
  if (num(variant.inventory_qty) <= 0) throw new Error("This piece is no longer available");

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
  await db`DELETE FROM cart_line WHERE id = ${input.lineId}`;
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
      ma.commission_rate, ma.payout_email,
      COALESCE(ap.display_name, u.display_name, u.email) AS artist_name
    FROM cart_line cl
    JOIN artwork_variant av ON av.id = cl.artwork_variant_id
    JOIN artwork a ON a.id = av.artwork_id
    LEFT JOIN marketplace_artists ma ON ma.user_id = a.artist_user_id
    LEFT JOIN users u ON u.id = a.artist_user_id
    LEFT JOIN artist_profiles ap ON ap.user_id = a.artist_user_id
    WHERE cl.cart_id = ${cartId}
  `) as unknown as Row[];

  if (lineRows.length === 0) throw new Error("Cart is empty");

  // For v1: enforce single-artist orders (eTransfer goes to one artist).
  const distinctArtists = new Set(lineRows.map((l) => l.art_artist_user_id as string));
  if (distinctArtists.size > 1) {
    throw new Error("Cart contains pieces from multiple artists. eTransfer payment supports one artist per order; please check out one artist at a time.");
  }
  const firstLine = lineRows[0]!;
  const artistName = (firstLine.artist_name as string) ?? "the artist";
  const payoutEmail = (firstLine.payout_email as string | null) ?? null;
  if (!payoutEmail) throw new Error("Artist is not set up for eTransfer payouts.");

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
        number, customer_id, customer_email, customer_name, status,
        payment_method, payment_reference, payment_instructions,
        payment_due_at, subtotal_minor, total_minor, currency,
        shipping_address, billing_address, notes
      ) VALUES (
        ${orderNumber}, ${input.customerId ?? null}, ${input.customerEmail},
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

    for (const l of lineRows) {
      const unit = num(l.unit_price_minor);
      const qty = num(l.quantity);
      const total = unit * qty;
      const commissionRate = l.commission_rate != null ? Number(l.commission_rate) : 30;
      const split = splitCommission(total, commissionRate);

      await tx`
        INSERT INTO commerce_order_line (
          order_id, artwork_variant_id, artwork_id, artist_user_id, org_id,
          description, quantity, unit_price_minor,
          artist_share_minor, gallery_share_minor, currency
        ) VALUES (
          ${orderId}, ${l.artwork_variant_id as string}, ${l.art_id as string},
          ${l.art_artist_user_id as string}, ${l.art_org_id as string},
          ${l.art_title as string}, ${qty}, ${unit},
          ${split.artistShareMinor}, ${split.galleryShareMinor}, ${l.currency as string}
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

  // Build email items from lineRows (same split logic as order_lines insert)
  const emailItems = lineRows.map((l) => {
    const unit = num(l.unit_price_minor);
    const qty = num(l.quantity);
    const total = unit * qty;
    const commissionRate = l.commission_rate != null ? Number(l.commission_rate) : 30;
    const split = splitCommission(total, commissionRate);
    return {
      description: l.art_title as string,
      quantity: qty,
      unitPriceMinor: unit,
      artistShareMinor: split.artistShareMinor,
      galleryShareMinor: split.galleryShareMinor,
      currency: l.currency as string,
    };
  });

  // Fire emails non-blocking — order is already committed
  const paymentDueAt = (order.payment_due_at as string | null) ?? null;
  void (async () => {
    try {
      const { sendOrderInvoice, sendOrderNotification } = await import('@elkdonis/email');
      const galleryEmail =
        process.env.ART_AUCTION_GALLERY_PAYOUT_EMAIL ?? 'info@elkdonis-arts.org';

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
      // Decrement inventory + flip artwork to sold
      await tx`
        UPDATE artwork_variant
        SET inventory_qty = GREATEST(inventory_qty - ${num(l.quantity)}, 0)
        WHERE id = ${l.artwork_variant_id as string}
      `;
      await tx`UPDATE artwork SET status = 'sold' WHERE id = ${l.artwork_id as string}`;
      // Convert reservation
      await tx`
        UPDATE reservation SET status = 'converted'
        WHERE artwork_variant_id = ${l.artwork_variant_id as string}
          AND status = 'active'
      `;
      // Create payout record (artist already received the eTransfer directly)
      await tx`
        INSERT INTO payout (artist_user_id, order_id, amount_minor, currency, method, reference, status, sent_at, notes)
        VALUES (
          ${l.artist_user_id as string}, ${input.orderId},
          ${num(l.artist_share_minor)}, ${l.currency as string},
          'etransfer', ${order.payment_reference as string}, 'received', NOW(),
          'Buyer sent eTransfer directly to artist'
        )
      `;
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

function mapOrder(r: Row): Order {
  return {
    id: r.id as string,
    number: r.number as string,
    customerId: (r.customer_id as string | null) ?? null,
    customerEmail: r.customer_email as string,
    customerName: (r.customer_name as string | null) ?? null,
    status: r.status as OrderStatus,
    paymentMethod: r.payment_method as Order["paymentMethod"],
    paymentReference: (r.payment_reference as string | null) ?? null,
    paymentInstructions: (r.payment_instructions as string | null) ?? null,
    paymentDueAt: (r.payment_due_at as string | null) ?? null,
    paymentConfirmedAt: (r.payment_confirmed_at as string | null) ?? null,
    paymentConfirmedBy: (r.payment_confirmed_by as string | null) ?? null,
    paymentMetadata: (r.payment_metadata as Record<string, unknown>) ?? {},
    subtotalMinor: num(r.subtotal_minor),
    shippingMinor: num(r.shipping_minor),
    taxMinor: num(r.tax_minor),
    totalMinor: num(r.total_minor),
    currency: r.currency as Order["currency"],
    shippingAddress: (r.shipping_address as Order["shippingAddress"]) ?? null,
    billingAddress: (r.billing_address as Order["billingAddress"]) ?? null,
    notes: (r.notes as string | null) ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    paidAt: (r.paid_at as string | null) ?? null,
    fulfilledAt: (r.fulfilled_at as string | null) ?? null,
    cancelledAt: (r.cancelled_at as string | null) ?? null,
  };
}

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
 * Artist applies to the marketplace (or resubmits). Creates a `pending` row;
 * a previously `rejected` applicant is reset to `pending`. Bio is sanitized.
 */
export async function applyAsArtist(
  input: ArtistApplicationInput
): Promise<MarketplaceArtist> {
  const bioHtml = input.bioHtml ? sanitizeRichText(input.bioHtml) : null;
  const rows = (await db`
    INSERT INTO marketplace_artists (
      user_id, org_id, payout_email, payout_method, default_currency,
      status, bio_html, display_name, headline, city, photo_url, links,
      applied_at
    ) VALUES (
      ${input.userId}, ${input.orgId ?? DEFAULT_MARKETPLACE_ORG},
      ${input.payoutEmail}, ${input.payoutMethod ?? "etransfer"},
      ${input.defaultCurrency ?? "CAD"}, 'pending', ${bioHtml},
      ${input.displayName}, ${input.headline ?? null}, ${input.city ?? null},
      ${input.photoUrl ?? null}, ${serializeLinks(input.links)}::jsonb, NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      payout_email = EXCLUDED.payout_email,
      payout_method = EXCLUDED.payout_method,
      default_currency = EXCLUDED.default_currency,
      bio_html = EXCLUDED.bio_html,
      display_name = EXCLUDED.display_name,
      headline = EXCLUDED.headline,
      city = EXCLUDED.city,
      photo_url = EXCLUDED.photo_url,
      links = EXCLUDED.links,
      status = CASE
        WHEN marketplace_artists.status = 'rejected' THEN 'pending'
        ELSE marketplace_artists.status
      END,
      rejection_reason = CASE
        WHEN marketplace_artists.status = 'rejected' THEN NULL
        ELSE marketplace_artists.rejection_reason
      END,
      applied_at = CASE
        WHEN marketplace_artists.status = 'rejected' THEN NOW()
        ELSE marketplace_artists.applied_at
      END
    RETURNING user_id
  `) as unknown as Row[];
  void rows;
  const created = await getArtistRow(input.userId);
  if (!created) throw new Error("Failed to create artist application.");
  return created;
}

/** Approved artist edits their own profile. Cannot change status here. */
export async function updateArtistProfile(
  userId: string,
  input: ArtistProfileUpdateInput
): Promise<void> {
  const bioHtml =
    input.bioHtml !== undefined
      ? input.bioHtml
        ? sanitizeRichText(input.bioHtml)
        : null
      : undefined;

  await db`
    UPDATE marketplace_artists SET
      display_name = COALESCE(${input.displayName ?? null}, display_name),
      headline = ${input.headline !== undefined ? input.headline : db`headline`},
      city = ${input.city !== undefined ? input.city : db`city`},
      photo_url = ${input.photoUrl !== undefined ? input.photoUrl : db`photo_url`},
      bio_html = ${bioHtml !== undefined ? bioHtml : db`bio_html`},
      payout_email = COALESCE(${input.payoutEmail ?? null}, payout_email),
      payout_method = COALESCE(${input.payoutMethod ?? null}, payout_method),
      default_currency = COALESCE(${input.defaultCurrency ?? null}, default_currency),
      links = ${input.links !== undefined ? db`${serializeLinks(input.links)}::jsonb` : db`links`}
    WHERE user_id = ${userId}
  `;
}

/** Admin approves a pending artist application. */
export async function approveArtist(
  userId: string,
  reviewerId: string
): Promise<void> {
  const rows = (await db`
    UPDATE marketplace_artists SET
      status = 'active',
      reviewed_at = NOW(),
      reviewed_by = ${reviewerId},
      rejection_reason = NULL,
      joined_at = COALESCE(joined_at, NOW())
    WHERE user_id = ${userId} AND status IN ('pending', 'rejected', 'paused')
    RETURNING user_id
  `) as unknown as Row[];
  if (!rows[0]) throw new Error("Application not found or not reviewable.");
}

/** Admin rejects a pending artist application with a reason. */
export async function rejectArtist(
  userId: string,
  reviewerId: string,
  reason: string
): Promise<void> {
  const rows = (await db`
    UPDATE marketplace_artists SET
      status = 'rejected',
      reviewed_at = NOW(),
      reviewed_by = ${reviewerId},
      rejection_reason = ${reason}
    WHERE user_id = ${userId} AND status = 'pending'
    RETURNING user_id
  `) as unknown as Row[];
  if (!rows[0]) throw new Error("Application not found or not pending.");
}

async function getArtistRow(userId: string): Promise<MarketplaceArtist | null> {
  const { getMarketplaceArtist } = await import("../queries");
  return getMarketplaceArtist(userId);
}

// ─── Artworks: create / update / media / publish ──────────────────────────

async function requireActiveArtist(
  tx: typeof db,
  artistUserId: string
): Promise<{ orgId: string; defaultCurrency: string }> {
  const rows = (await tx`
    SELECT org_id, default_currency, status
    FROM marketplace_artists WHERE user_id = ${artistUserId} LIMIT 1
  `) as unknown as Row[];
  if (!rows[0]) throw new Error("You are not registered as a marketplace artist.");
  if (rows[0].status !== "active") {
    throw new Error("Your artist account is not approved yet.");
  }
  return {
    orgId: rows[0].org_id as string,
    defaultCurrency: rows[0].default_currency as string,
  };
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
    const { orgId, defaultCurrency } = await requireActiveArtist(
      tx as unknown as typeof db,
      input.artistUserId
    );
    const currency = (input.currency ?? defaultCurrency) as Currency;
    const slug = await uniqueSlug(tx as unknown as typeof db, orgId, input.title);

    const artRows = (await tx`
      INSERT INTO artwork (
        org_id, artist_user_id, slug, title, description_html, year_created,
        medium, style, subject, height_cm, width_cm, depth_cm, weight_kg,
        kind, certificate_of_authenticity, provenance_notes, status
      ) VALUES (
        ${orgId}, ${input.artistUserId}, ${slug}, ${input.title},
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
    const owned = (await tx`
      SELECT id, org_id FROM artwork
      WHERE id = ${artworkId} AND artist_user_id = ${artistUserId} LIMIT 1
    `) as unknown as Row[];
    if (!owned[0]) throw new Error("Artwork not found or not yours to edit.");

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
    const owned = (await tx`
      SELECT org_id FROM artwork
      WHERE id = ${artworkId} AND artist_user_id = ${artistUserId} LIMIT 1
    `) as unknown as Row[];
    if (!owned[0]) throw new Error("Artwork not found or not yours to edit.");
    await writeArtworkMedia(
      tx as unknown as typeof db,
      artworkId,
      owned[0].org_id as string,
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
    const owned = (await tx`
      SELECT id FROM artwork
      WHERE id = ${artworkId} AND artist_user_id = ${artistUserId} LIMIT 1
    `) as unknown as Row[];
    if (!owned[0]) throw new Error("Artwork not found or not yours to publish.");

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
  const rows = (await db`
    UPDATE artwork SET status = 'archived'
    WHERE id = ${artworkId} AND artist_user_id = ${artistUserId}
      AND status NOT IN ('sold')
    RETURNING id
  `) as unknown as Row[];
  if (!rows[0]) throw new Error("Artwork not found or cannot be archived.");
}
