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
  ProvenanceInput,
  Cart,
  CartLine,
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
import { releaseOnPayoutAccountReady } from "./ledger";
import { requireArtworkAccess, seriesDeskClause } from "./access";
import { artworkStock, lockArtworks, variantStock } from "./stock";
import { jsonb } from "./map-order";

type Row = Record<string, unknown>;
const num = (v: unknown): number => (v == null ? 0 : Number(v));

// Service (thread-kind) orders — the no-cart "book now" rail.
export { createThreadOrder, createServiceOrder, PURCHASABLE_THREAD_KINDS } from "./service-orders";
export { resolveSettlement, HOST_PAYOUT_EMAIL } from "./settlement";

// Scheduling a booked one-to-one service (migration 174).
export {
  MAX_PROPOSED_TIMES,
  parseProposedTimes,
  createServiceBooking,
  markServiceBookingPaid,
  listSellerBookings,
  getSellerBooking,
  getBookingByToken,
  sellerConfirmTime,
  sellerProposeTimes,
  sellerCancelBooking,
  buyerConfirmTime,
  buyerProposeTimes,
  bookingIcs,
  formatTime as formatBookingTime,
  sellerBookingsUrl,
  buyerBookingUrl,
} from "./service-bookings";
export type { ServiceBooking, BuyerServiceBooking, ServiceBookingStatus, CreateServiceBookingInput } from "./service-bookings";

// Tours: stops, departures, bookings with a party size (migration 208).
export {
  HOLD_MINUTES as TOUR_HOLD_MINUTES,
  MAX_PARTY_SIZE,
  listTourStops,
  saveTourStops,
  setTourStopStill,
  listStopsNeedingStill,
  listTourDepartures,
  listOrgDepartures,
  getDeparture,
  createDeparture,
  updateDeparture,
  cancelDeparture,
  parsePartySize,
  checkDepartureAvailability,
  createTourBooking,
  markTourBookingPaid,
  getTourBookingByToken,
  getTourBookingTokenForOrder,
  listBuyerTourBookings,
  listDepartureBookings,
  listOrgTourBookings,
  cancelTourBooking,
  tourBookingIcs,
  buyerBookingUrl as buyerTourBookingUrl,
  formatParis as formatTourTime,
} from "./tours";
export type {
  TourStop,
  TourStopInput,
  TourDeparture,
  DepartureStatus,
  DepartureInput,
  TourBooking,
  BuyerTourBooking,
  TourBookingStatus,
  CreateTourBookingInput,
} from "./tours";

// Artwork orders — create on either rail, confirm, cancel, expire, fulfil.
export {
  createOrder,
  createOrderFromCart,
  createEtransferOrder,
  switchOrderToEtransfer,
  recordStripeCheckout,
  recordCheckoutCustomer,
  confirmOrderPaid,
  confirmEtransferReceived,
  cancelOrder,
  releaseExpiredOrders,
  markOrderFulfilled,
  refundOrder,
  loadCartItems,
  loadVariantItem,
  UNPAID_ORDER_STATUSES,
  STRIPE_GRACE_MINUTES,
} from "./orders";
export type {
  OrderRail,
  SellableItem,
  OrderCustomer,
  CreateOrderInput,
  ConfirmOrderPaidInput,
} from "./orders";

// Auction lots — create, withdraw, settle.
export { createLot, cancelLot, settleExpiredLots, marketplaceLadder } from "./auctions";
export type { CreateLotInput, SettleResult } from "./auctions";
// Bidding — ladder, proxy bids, soft close, buy-now, registration (2026-10-18).
export { placeBid, buyNowLot, registerBidder } from "./bidding";
export type { PlaceBidResult } from "./bidding";
// Auction series (migration 190 + 209): create, edit, lots, team.
export {
  canEditSeries, canCreateSeries, createSeries, updateSeries, setSeriesStatus, setWeekFocus,
  addLotToSeries, removeLotFromSeries, renumberSeriesLots, setSeriesMember, removeSeriesMember,
  canParticipateInSeries, attachPublication, detachPublication,
  setSeriesMemberById, searchSeriesPeople, seriesStore, addSeriesLot, getSeriesOverview,
  listWeekBoards, saveWeek, addWeekItem, removeWeekItem, approveWeekItem, setWeekFeatured,
  searchRepostable, submitOwnPiece, listSeriesActivity,
} from "./series";
export type {
  SeriesInput, SeriesPerson, AddSeriesLotInput, SeriesOverview,
  WeekBoard, WeekItem, WeekItemThread, AddWeekItemInput,
} from "./series";
// The auction clock: scheduling, opening, settling, releasing on time.
export { tickAuctionClock, applySeriesSchedule, openScheduledLots } from "./auction-clock";
export type { ClockTick } from "./auction-clock";

// Authority.
export { requireArtworkAccess, canActForOrder, isOrderCustomer } from "./access";
export { canManageStoreTeam, addStoreMemberByEmail } from "./store-team";

// Marketplace settings (migration 209).
export { getMarketplaceSettings, updateMarketplaceSettings } from "./settings";
export type { MarketplaceSettings, IncrementStep } from "./settings";
export { resolveCommissionPercent, estimateProcessorFeeMinor } from "./settlement";
export type { SupportSplit } from "./orders";

// Payees and per-org beneficiary lists (migration 209).
export {
  listOrgBeneficiaries,
  listActivePayees,
  listSuggestedPayees,
  addCharityPayee,
  addOrgBeneficiary,
  removeOrgBeneficiary,
  suggestPayee,
  approvePayee,
  sendPaidProceedsStatements,
} from "./payees";

// Presentation — a front showing pieces another store sells (migration 112).
export { presentArtwork, unpresentArtwork, isPresentedBy } from "./presentation";
// Journeys — where a person stands on the auction errand, and its one-click step.
export { loadAuctionJourney, publishStoreForAuction, AUCTION_COMMISSION_PERCENT } from "./journeys";
export type { AuctionJourney } from "./journeys";
export {
  writeEntry,
  getBalance,
  listEntries,
  listHeld,
  releaseHold,
  releaseOnPayoutAccountReady,
  recordPayout,
  getEarningsStatement,
  listPayable,
} from "./ledger";
export type {
  LedgerEntry,
  Balance,
  Party,
  PartyKind,
  HoldReason,
  EarningsLine,
  RecordPayoutInput,
  PayableParty,
} from "./ledger";
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
  /**
   * The presenting store the buyer came through, when it is not the piece's
   * own (migration 112). Recorded on the line so the order logs the window,
   * and so that front's owning org is the split counterparty.
   */
  viaStoreId?: string | null;
}): Promise<CartLine> {
  const cartRows = (await db`
    SELECT * FROM cart WHERE token = ${input.cartToken} LIMIT 1
  `) as unknown as Row[];
  if (!cartRows[0]) throw new Error("Cart not found");
  const cartId = cartRows[0].id as string;

  const variantRows = (await db`
    SELECT av.id, av.price_minor, av.currency, av.inventory_qty,
           a.store_id, a.status AS artwork_status, s.status AS store_status
    FROM artwork_variant av
    JOIN artwork a ON a.id = av.artwork_id
    JOIN store s ON s.id = a.store_id
    WHERE av.id = ${input.artworkVariantId} LIMIT 1
  `) as unknown as Row[];
  if (!variantRows[0]) throw new Error("Variant not found");
  const variant = variantRows[0];
  // The piece's own status was the one thing this never checked. Inventory
  // and price survive a draft or an archive, so without this a seller's
  // unpublished work — or a piece taken down after selling elsewhere — could
  // be added to a cart and paid for by anyone holding its URL.
  if (variant.artwork_status !== "available") {
    throw new Error(
      variant.artwork_status === "sold"
        ? "This piece has sold."
        : variant.artwork_status === "reserved"
          ? "This piece is reserved pending payment."
          : "This piece is not listed for sale."
    );
  }
  if (num(variant.inventory_qty) <= 0) throw new Error("This piece is no longer available");
  // An edition: copies held by unpaid orders are not for sale (./stock.ts).
  // createOrder re-checks under a lock; this is the early, friendly answer.
  {
    const want = input.quantity ?? 1;
    const s = (await variantStock(db, [input.artworkVariantId])).get(input.artworkVariantId);
    if (s && s.sellable < want) {
      throw new Error(
        s.sellable === 0
          ? "Every copy is reserved pending payment."
          : `Only ${s.sellable} ${s.sellable === 1 ? "copy is" : "copies are"} left.`
      );
    }
  }
  if (variant.store_status !== "active") {
    throw new Error("This store is not currently selling.");
  }
  // A blank price is "price on request": the piece is listed, not buyable.
  if (num(variant.price_minor) <= 0) {
    throw new Error("This piece is priced on request — message the artist to arrange a sale.");
  }
  // A window is only a window if the store actually presents the piece.
  let viaStoreId: string | null = null;
  if (input.viaStoreId && input.viaStoreId !== (variant.store_id as string)) {
    const [pres] = (await db`
      SELECT 1 FROM store_presentation sp
      JOIN store s ON s.id = sp.store_id AND s.status = 'active'
      WHERE sp.store_id = ${input.viaStoreId} AND sp.artwork_id = (
        SELECT artwork_id FROM artwork_variant WHERE id = ${input.artworkVariantId}
      )
      LIMIT 1
    `) as unknown as Row[];
    if (pres) viaStoreId = input.viaStoreId;
  }
  // While a lot is open the lot is the only way to own the piece; letting a
  // buy-now through would sell a piece somebody may already be winning.
  const openLot = (await db`
    SELECT 1 FROM auction_lot
    WHERE artwork_variant_id = ${input.artworkVariantId}
      AND status IN ('scheduled', 'live')
    LIMIT 1
  `) as unknown as Row[];
  if (openLot[0]) {
    throw new Error("This piece is at auction — place a bid on it instead.");
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
    INSERT INTO cart_line (cart_id, artwork_variant_id, quantity, unit_price_minor, currency, notes, via_store_id)
    VALUES (
      ${cartId}, ${input.artworkVariantId}, ${input.quantity ?? 1},
      ${num(variant.price_minor)}, ${variant.currency as string}, ${input.notes ?? null}, ${viaStoreId}
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
    viaStoreId: (lr.via_store_id as string | null) ?? null,
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

/**
 * Clean a links list for storage. Pass the result through `jsonb()` — a JSON
 * string cast with `::jsonb` gets JSON-encoded a second time by the driver
 * (see map-order.ts), which is why `parseArtistLinks` had to learn to read a
 * string.
 */
function serializeLinks(
  links: { label: string; url: string }[] | undefined
): Array<{ label: string; url: string }> {
  if (!links) return [];
  return links
    .filter((l) => l && typeof l.url === "string" && l.url.trim().length > 0)
    .map((l) => ({ label: String(l.label ?? l.url).trim(), url: l.url.trim() }));
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
      SELECT 1 FROM user_organizations
      WHERE user_id = ${userId}
        -- Excludes 'viewer', which the ungated self-join route hands out:
        -- claiming a store is a commitment to the collective, not something
        -- you should be able to grant yourself by POSTing an org slug.
        AND role <> 'viewer'
      LIMIT 1
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
        AND (s.owner_user_id = ${userId} OR sm.user_id IS NOT NULL OR ${seriesDeskClause(db, userId)})
      LIMIT 1
    `;
    return Boolean(row);
  } catch (err) {
    console.error(`[commerce] canActForStore(${userId}, ${storeId}):`, err);
    return false;
  }
}

/**
 * `users.bio` is read as plain text by several apps (ArtDirect, IFAC), so the
 * marketplace writes it as plain text: tags dropped, trimmed, empty → null.
 */
function plainProfileBio(bio: string | null | undefined): string | null {
  if (bio == null) return null;
  const text = bio.replace(/<[^>]*>/g, "").trim();
  return text || null;
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
      bio          = COALESCE(NULLIF(${plainProfileBio(input.profileBio)}, ''), bio),
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
      ${jsonb(serializeLinks(input.links))}, NOW()
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

  // Owner or guide (shown as "Admin") may open it — decided 2026-10-18
  // (ORG_STORE_BRIEF D2). Members may not: opening a store is a commercial
  // commitment the org's leadership makes.
  const [actorRow] = await db`
    SELECT 1 FROM user_organizations
    WHERE user_id = ${input.actorUserId}
      AND org_id = ${input.ownerOrgId}
      AND role IN ('owner', 'guide')
    LIMIT 1
  `;
  if (!actorRow) {
    return { ok: false, error: "Only an owner or admin of this organisation can open its store." };
  }

  const bioHtml = input.bioHtml ? sanitizeRichText(input.bioHtml) : null;
  // An org sells in its own marketplace unless told otherwise — the common
  // case, and the only one that needs no extra permission story.
  const orgId = input.orgId ?? input.ownerOrgId;

  const storeId = await db.begin(async (tx) => {
    const rows = (await tx`
      INSERT INTO store (
        owner_org_id, org_id, payout_email, payout_method, default_currency,
        status, bio_html, links, applied_at, reviewed_at, reviewed_by, commission_rate
      ) VALUES (
        ${input.ownerOrgId}, ${orgId},
        ${input.payoutEmail ?? null}, ${input.payoutMethod ?? "etransfer"},
        ${input.defaultCurrency ?? "CAD"}, 'active', ${bioHtml},
        ${jsonb(serializeLinks(input.links))}, NOW(), NOW(), ${input.actorUserId},
        0
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

    // Seat the org's leadership on the roll at opening: owners as store
    // owners, guides as managers. The roll stays hand-kept afterwards
    // (ORG_STORE_BRIEF D2); people who join the org later are added from the
    // Store team panel, not automatically.
    await tx`
      INSERT INTO store_member (store_id, user_id, role, added_by)
      SELECT ${id}, uo.user_id,
             CASE WHEN uo.role = 'owner' THEN 'owner' ELSE 'manager' END,
             ${input.actorUserId}
      FROM user_organizations uo
      WHERE uo.org_id = ${input.ownerOrgId} AND uo.role IN ('owner', 'guide')
      ON CONFLICT (store_id, user_id) DO UPDATE SET role = EXCLUDED.role
    `;
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
      -- Where they are is part of being payable, not profile decoration: it
      -- decides whether an e-Transfer can reach them at all.
      country       = ${input.country !== undefined ? input.country : db`country`},
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

/**
 * Stamp every person holding this connected account as onboarded. Called when
 * Stripe reports `payouts_enabled`; routes through `setPayoutIdentity` so the
 * held-funds release fires from the one place it lives.
 */
export async function markStripeAccountOnboarded(accountId: string): Promise<number> {
  const rows = (await db`
    SELECT id FROM users WHERE stripe_account_id = ${accountId} AND stripe_onboarded_at IS NULL
  `) as unknown as Row[];
  for (const r of rows) {
    await setPayoutIdentity(r.id as string, {
      stripeOnboardedAt: new Date().toISOString(),
      payoutMethod: "stripe",
    });
  }
  return rows.length;
}

/** A person's payout identity, or null if they have no user row. */
export async function getPayoutIdentity(
  userId: string
): Promise<PayoutIdentity | null> {
  const rows = (await db`
    SELECT id, payout_email, payout_method, stripe_account_id, stripe_onboarded_at, country
    FROM users WHERE id = ${userId} LIMIT 1
  `) as unknown as Row[];
  const r = rows[0];
  if (!r) return null;
  return {
    userId: r.id as string,
    payoutEmail: (r.payout_email as string | null) ?? null,
    payoutMethod: (r.payout_method as PayoutIdentity["payoutMethod"]) ?? "etransfer",
    country: (r.country as string | null) ?? null,
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
 * Identity (name, headline, city, photo) is written to the OWNER — `users`
 * for a person's store — the home migration 084 gave it, not to the store
 * row. The store's own identity columns are deprecated (092) and are no longer
 * written: two copies of a name is how a seller's name here drifted from
 * their name everywhere else. An org store's identity is the organisation's
 * and is edited on the org hub, so only the store-local fields apply there.
 *
 * Payout fields are likewise the owner's (096) and route to
 * `setPayoutIdentity`.
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
  if (ownerUserId) {
    await db`
      UPDATE users SET
        display_name = COALESCE(NULLIF(${input.displayName ?? null}, ''), display_name),
        headline   = ${input.headline !== undefined ? input.headline : db`headline`},
        city       = ${input.city !== undefined ? input.city : db`city`},
        avatar_url = ${input.photoUrl !== undefined ? (input.photoUrl || null) : db`avatar_url`},
        bio        = ${input.profileBio !== undefined ? plainProfileBio(input.profileBio) : db`bio`}
      WHERE id = ${ownerUserId}
    `;
  }
  const bioHtml =
    input.bioHtml !== undefined
      ? input.bioHtml
        ? sanitizeRichText(input.bioHtml)
        : null
      : undefined;

  await db`
    UPDATE store SET
      bio_html = ${bioHtml !== undefined ? bioHtml : db`bio_html`},
      default_currency = COALESCE(${input.defaultCurrency ?? null}, default_currency),
      links = ${input.links !== undefined ? db`${jsonb(serializeLinks(input.links))}` : db`links`}
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

/**
 * Admin pauses an active store: its work drops out of browse and cannot be
 * added to a cart, but nothing is deleted. `approveStore` reopens it.
 */
export async function pauseStore(storeId: string, reviewerId: string): Promise<void> {
  const rows = (await db`
    UPDATE store SET status = 'paused', reviewed_at = NOW(), reviewed_by = ${reviewerId}
    WHERE id = ${storeId} AND status = 'active'
    RETURNING id
  `) as unknown as Row[];
  if (!rows[0]) throw new Error("Only an active store can be paused.");
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
    // The function used to trust whatever store id it was handed; a caller
    // that names the actor gets the check here, where the store is known.
    if (input.actorUserId && !(await canActForStore(input.actorUserId, storeId))) {
      throw new Error("You cannot list work in this store.");
    }
    const currency = (input.currency ?? defaultCurrency) as Currency;
    const slug = await uniqueSlug(tx as unknown as typeof db, orgId, input.title);
    const estimate = normaliseEstimate(input.estimateLowMinor, input.estimateHighMinor);

    const artRows = (await tx`
      INSERT INTO artwork (
        org_id, store_id, artist_user_id, credited_artist_user_id, slug, title,
        description_html, year_created,
        medium, style, subject, height_cm, width_cm, depth_cm, weight_kg,
        kind, certificate_of_authenticity, provenance_notes, status,
        estimate_low_minor, estimate_high_minor
      ) VALUES (
        ${orgId}, ${storeId}, ${input.artistUserId ?? null},
        ${input.creditedArtistUserId ?? null}, ${slug}, ${input.title},
        ${descriptionHtml}, ${input.yearCreated ?? null}, ${input.medium ?? null},
        ${input.style ?? null}, ${input.subject ?? null}, ${input.heightCm ?? null},
        ${input.widthCm ?? null}, ${input.depthCm ?? null}, ${input.weightKg ?? null},
        ${input.kind ?? "original"}, ${input.certificateOfAuthenticity ?? false},
        ${input.provenanceNotes ?? null}, 'draft',
        ${estimate.low}, ${estimate.high}
      )
      RETURNING id
    `) as unknown as Row[];
    const artworkId = artRows[0]!.id as string;

    // Single default variant. A limited edition records its size: the
    // number given, else the copies listed (2026-11-08).
    const inventoryQty = input.inventoryQty ?? 1;
    const editionTotal =
      (input.kind ?? "original") === "limited_edition"
        ? (positiveInt(input.editionTotal) ?? Math.max(inventoryQty, 1))
        : null;
    await tx`
      INSERT INTO artwork_variant (
        artwork_id, org_id, label, price_minor, currency, inventory_qty, edition_total, position,
        beneficiary_payee_id, beneficiary_scope
      ) VALUES (
        ${artworkId}, ${orgId}, 'Default', ${Math.max(0, Math.round(input.priceMinor))},
        ${currency}, ${inventoryQty}, ${editionTotal}, 0,
        ${input.beneficiaryPayeeId ?? null},
        ${input.beneficiaryPayeeId ? (input.beneficiaryScope ?? "all_proceeds") : null}
      )
    `;

    await writeProvenance(
      tx as unknown as typeof db, artworkId, orgId, input.provenance, input.actorUserId ?? null
    );

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

  const estimate = normaliseEstimate(input.estimateLowMinor, input.estimateHighMinor);

  await db.begin(async (tx) => {
    const { orgId } = await requireArtworkAccess(tx as unknown as typeof db, artworkId, artistUserId);

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
        provenance_notes = ${input.provenanceNotes !== undefined ? input.provenanceNotes : db`provenance_notes`},
        credited_artist_user_id = ${input.creditedArtistUserId !== undefined ? input.creditedArtistUserId : db`credited_artist_user_id`},
        credit_status = CASE
          WHEN ${input.creditedArtistUserId !== undefined ? 1 : 0} = 1
           AND credited_artist_user_id IS DISTINCT FROM ${input.creditedArtistUserId ?? null}
          THEN 'credited' ELSE credit_status END,
        estimate_low_minor = ${input.estimateLowMinor !== undefined ? estimate.low : db`estimate_low_minor`},
        estimate_high_minor = ${input.estimateHighMinor !== undefined ? estimate.high : db`estimate_high_minor`}
      WHERE id = ${artworkId}
    `;

    const touchesVariant =
      input.priceMinor !== undefined || input.inventoryQty !== undefined ||
      input.currency !== undefined || input.beneficiaryPayeeId !== undefined ||
      input.kind !== undefined || input.editionTotal !== undefined;
    if (touchesVariant) {
      // edition_total follows the piece's kind (2026-11-08): a limited edition
      // keeps the size given, else the one it had, else the copies listed;
      // any other kind has none. The kind is read back from the row above.
      const editionTotal = positiveInt(input.editionTotal);
      await tx`
        UPDATE artwork_variant SET
          price_minor = COALESCE(${input.priceMinor !== undefined ? Math.max(0, Math.round(input.priceMinor)) : null}, price_minor),
          inventory_qty = COALESCE(${input.inventoryQty ?? null}, inventory_qty),
          edition_total = CASE
            WHEN (SELECT kind FROM artwork WHERE id = ${artworkId}) = 'limited_edition'
            THEN COALESCE(
              ${editionTotal}::int,
              edition_total,
              GREATEST(COALESCE(${input.inventoryQty ?? null}::int, inventory_qty), 1)
            )
            ELSE NULL
          END,
          currency = COALESCE(${input.currency ?? null}, currency),
          beneficiary_payee_id = ${input.beneficiaryPayeeId !== undefined ? input.beneficiaryPayeeId : db`beneficiary_payee_id`},
          beneficiary_scope = ${
            input.beneficiaryPayeeId !== undefined
              ? (input.beneficiaryPayeeId ? (input.beneficiaryScope ?? "all_proceeds") : null)
              : db`beneficiary_scope`
          }
        WHERE artwork_id = ${artworkId}
          AND id = (
            SELECT id FROM artwork_variant WHERE artwork_id = ${artworkId}
            ORDER BY position ASC LIMIT 1
          )
      `;
    }

    if (input.provenance !== undefined) {
      await tx`DELETE FROM artwork_provenance WHERE artwork_id = ${artworkId}`;
      await writeProvenance(tx as unknown as typeof db, artworkId, orgId, input.provenance, artistUserId);
    }
  });
}

/** A whole number above zero, or null. */
function positiveInt(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r > 0 ? r : null;
}

function normaliseEstimate(
  low?: number | null,
  high?: number | null
): { low: number | null; high: number | null } {
  const l = low != null && low > 0 ? Math.round(low) : null;
  const h = high != null && high > 0 ? Math.round(high) : null;
  if (l != null && h != null && l > h) return { low: h, high: l };
  return { low: l, high: h };
}

/** Internal: record provenance events ("donated by X to Y") for a piece. */
async function writeProvenance(
  tx: typeof db,
  artworkId: string,
  orgId: string,
  events: ProvenanceInput[] | undefined,
  createdBy: string | null
): Promise<void> {
  for (const ev of events ?? []) {
    if (!ev || !ev.kind) continue;
    const fromText = ev.fromText?.trim() || null;
    if (!ev.fromUserId && !fromText && !ev.toOrgId) continue;
    await tx`
      INSERT INTO artwork_provenance (
        artwork_id, org_id, kind, from_user_id, from_text, to_org_id, occurred_on, note, created_by
      ) VALUES (
        ${artworkId}, ${orgId}, ${ev.kind}, ${ev.fromUserId ?? null}, ${fromText},
        ${ev.toOrgId ?? null}, ${ev.occurredOn || null}, ${ev.note?.trim() || null}, ${createdBy}
      )
    `;
  }
}

/**
 * The credited person refuses the credit (ORG_STORE_BRIEF D4): the name comes
 * off the piece, the listing stays. Only the credited person may do it.
 */
export async function rejectArtworkCredit(
  artworkId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const rows = (await db`
    UPDATE artwork SET credit_status = 'rejected'
    WHERE id = ${artworkId} AND credited_artist_user_id = ${userId}
    RETURNING id
  `) as unknown as Row[];
  if (!rows[0]) return { ok: false, error: "You are not credited on this piece." };
  return { ok: true };
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

/**
 * Publish a draft artwork. Requires at least one image. A variant priced at
 * zero is allowed and means "price on request": the piece is shown, cannot be
 * added to a cart, and the buyer is pointed at messaging the artist.
 */
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

    const held = (await tx`
      SELECT 1 FROM artwork
      WHERE id = ${artworkId} AND metadata->'hiddenByAdmin' IS NOT NULL
    `) as unknown as Row[];
    if (held[0]) throw new Error("The marketplace keepers have hidden this piece; ask them to show it again.");

    await tx`
      UPDATE artwork SET status = 'available'
      WHERE id = ${artworkId} AND status IN ('draft', 'archived')
    `;
  });
}

/**
 * Marketplace keepers hide a piece from the public site without deleting it
 * (2026-11-07). Public queries already exclude `archived`, so a hide is
 * `status = 'archived'` plus `metadata.hiddenByAdmin` {from, by, at}. The marker
 * lets `adminShowArtwork` restore the prior status, and `publishArtwork` refuses
 * a marked piece so the artist cannot put it back. A reserved piece (open order)
 * is refused: releasing that order would put it back on sale.
 */
export async function adminHideArtwork(artworkId: string, actorUserId: string, orgId: string): Promise<void> {
  const rows = (await db`
    UPDATE artwork SET
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'hiddenByAdmin',
        jsonb_build_object('from', status, 'by', ${actorUserId}::text, 'at', NOW()::text)
      ),
      status = 'archived'
    WHERE id = ${artworkId} AND org_id = ${orgId}
      AND status IN ('available', 'sold', 'draft')
      AND metadata->'hiddenByAdmin' IS NULL
    RETURNING id
  `) as unknown as Row[];
  if (!rows[0]) {
    throw new Error("Only an available, sold or draft piece that is not already hidden can be hidden.");
  }
}

/** Reverse {@link adminHideArtwork}: restore the status the piece had when it was hidden. */
export async function adminShowArtwork(artworkId: string, orgId: string): Promise<void> {
  const rows = (await db`
    UPDATE artwork SET
      status = COALESCE(metadata->'hiddenByAdmin'->>'from', 'available'),
      metadata = metadata - 'hiddenByAdmin'
    WHERE id = ${artworkId} AND org_id = ${orgId}
      AND status = 'archived'
      AND metadata->'hiddenByAdmin' IS NOT NULL
    RETURNING id
  `) as unknown as Row[];
  if (!rows[0]) throw new Error("That piece is not hidden by the keepers.");
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

export type ArtworkAvailability = "available" | "reserved" | "sold";

/**
 * The seller sets a listed piece's availability by hand (2026-11-08): held for
 * someone off-site, sold elsewhere, or back on sale. Same access as every
 * other seller write here (`requireArtworkAccess`).
 *
 * Only a listed piece (available / reserved / sold) can be set; a draft is
 * published with {@link publishArtwork}, and a piece the keepers hid stays
 * hidden. 'available' needs a copy to sell — raise the quantity first. Stock
 * still drives the status afterwards: an order, payment, cancel or refund on
 * the piece recomputes it (./stock.ts).
 */
export async function setArtworkAvailability(
  artworkId: string,
  actorUserId: string,
  status: ArtworkAvailability
): Promise<{ status: ArtworkAvailability }> {
  if (status !== "available" && status !== "reserved" && status !== "sold") {
    throw new Error("Availability is available, reserved or sold.");
  }
  return db.begin(async (tx) => {
    await requireArtworkAccess(tx as unknown as typeof db, artworkId, actorUserId);
    await lockArtworks(tx as unknown as typeof db, [artworkId]);
    const [a] = (await tx`
      SELECT status, metadata->'hiddenByAdmin' IS NOT NULL AS hidden FROM artwork WHERE id = ${artworkId}
    `) as unknown as Row[];
    if (!a) throw new Error("Artwork not found.");
    if (a.hidden) throw new Error("The marketplace keepers have hidden this piece; ask them to show it again.");
    const current = a.status as string;
    if (current !== "available" && current !== "reserved" && current !== "sold") {
      throw new Error("Only a listed piece can be marked available, reserved or sold. Publish it first.");
    }
    if (current === status) return { status };
    if (status === "available") {
      const { sellable } = await artworkStock(tx as unknown as typeof db, artworkId);
      if (sellable <= 0) {
        throw new Error("No copies are left to sell. Raise the quantity before putting it back on sale.");
      }
    }
    await tx`UPDATE artwork SET status = ${status} WHERE id = ${artworkId}`;
    return { status };
  });
}

// Series workspace: orders, fulfilment, money, artists, visitors (2026-10-28).
export {
  listSeriesOrders, seriesOrderStage, setSeriesOrderHandover, setSeriesOrderReceived,
  canConfirmSeriesPayment, isNetworkAdmin, getSeriesMoney, listSeriesArtists, getSeriesVisitors,
} from "./series-orders";
export type { SeriesOrderRow, HandoverMethod, HandoverInfo, SeriesMoney, SeriesArtist, SeriesVisitors } from "./series-orders";

// Series page social side and the desk's sources (migration 212, 2026-10-28).
export {
  ensureSeriesThread, syncSeriesThread, setSeriesFollow, seriesFollowState, listSeriesFollowers,
  listSeriesDiscussion, postSeriesReply,
  listSeriesOrgs, searchOrgs, runsOrg, listOrgOwners, addSeriesOrg, setSeriesOrgConversation, decideSeriesOrg,
  removeSeriesOrg, listSeriesInvitationsFor,
  listSeriesLibraries, listSeriesLibraryItems, listArtistListings, addListingToSeries, listCollectiveArtists,
  emailSeriesOrgInvitation,
} from "./series-social";
export type { SeriesReply, SeriesOrg, SeriesLibrary, ArtistListing } from "./series-social";

// Shipping-label payments after the sale (katie-the-potter, migration 251).
export { recordShippingLabelPaid, recordShippingLabelSessionExpired, sendCommerceNotice, type ShippingLabelPayment } from "./shipping-label";
// Quote-only shipping (2026-11-07): the shipping payment is the maker's money, ledger in the same transaction.
export { recordShippingPaymentPaid, accrueShippingPayment, type ShippingPaymentRecord, type ShippingPaymentLedger } from "./shipping-label";
