/**
 * Canonical TypeScript types for the commerce + auction domain.
 *
 * These mirror the migration 042 schema. Keep field names in lockstep with
 * `packages/db/migrations/042_commerce_and_auction.sql`. All money is BIGINT
 * minor units (cents) — never floats.
 */

export type Currency = "CAD" | "USD" | "EUR" | "GBP";

export interface Money {
  /** Integer minor units (e.g. cents). 1099 = $10.99 */
  amountMinor: number;
  currency: Currency;
}

export type ArtworkKind = "original" | "limited_edition" | "open_edition";

export type ArtworkStatus =
  | "draft"
  | "available"
  | "reserved"
  | "sold"
  | "archived";

export type ArtworkMediaRole =
  | "hero"
  | "detail"
  | "scale"
  | "wall"
  | "video";

/** Store application / membership lifecycle. */
export type StoreStatus = "pending" | "active" | "paused" | "rejected";

/** Who owns a store: a person, or an organization (migration 094). */
export type StoreOwnerKind = "user" | "org";

/**
 * How a store gets paid. Open by design — the real source of truth is the
 * provider registry in `packages/payments`, and the column's CHECK was dropped
 * in migration 094 so adding a provider does not need a schema change.
 */
export type PayoutMethod = "etransfer" | "manual" | "stripe";

export interface StoreLink {
  label: string;
  url: string;
}

/**
 * A store within one org's marketplace. Commerce config only — identity lives
 * on `users` / `organizations` (migrations 084, 094).
 *
 * `orgId` is the marketplace it trades in; `ownerOrgId` is who takes the
 * revenue. They are usually but not always the same org.
 */
export interface Store {
  id: string;
  /** The marketplace this store trades in. */
  orgId: string;

  ownerKind: StoreOwnerKind;
  /** Set when ownerKind === "user". */
  ownerUserId?: string | null;
  /** Set when ownerKind === "org". */
  ownerOrgId?: string | null;

  /**
   * The OWNER's payout email, read from `users` (migration 096) — a front is
   * not paid, its owner is. Null for an org-owned front: an org's money is
   * earmarked inside the host account, never sent.
   */
  payoutEmail?: string | null;
  /** The owner's payout method. See {@link Store.payoutEmail}. */
  payoutMethod: PayoutMethod;
  /** Whether the owner can take a destination charge today (KYC complete). */
  ownerCanReceiveDestinationCharge?: boolean;
  /** @deprecated An org's cut comes from an accepted agreement, not a front. */
  commissionRate: number;
  defaultCurrency: Currency;
  status: StoreStatus;
  bioHtml?: string | null;
  joinedAt: string;
  updatedAt: string;

  /** Display, resolved from users / organizations at read time. */
  displayName?: string | null;
  headline?: string | null;
  city?: string | null;
  photoUrl?: string | null;
  links: StoreLink[];

  /** Application / review audit trail. */
  appliedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;

  /** URL segment: the owner's slug, falling back to an id. */
  slug?: string | null;
}

/** Who may act for a store — distinct from belonging to the owning org. */
export type StoreMemberRole = "owner" | "manager" | "staff";

export interface StoreMember {
  storeId: string;
  userId: string;
  role: StoreMemberRole;
  addedAt: string;
  addedBy?: string | null;
  /** Resolved from users. */
  displayName?: string | null;
  email?: string | null;
}

// ─── Deprecated aliases ─────────────────────────────────────────────────────
// `marketplace_artists` became `store` in migration 094 when a store stopped
// being necessarily a person's. Kept so art-auction's pages compile unchanged;
// prefer the Store names in anything new.

/** @deprecated Use {@link Store}. */
export type MarketplaceArtist = Store;
/** @deprecated Use {@link StoreStatus}. */
export type MarketplaceArtistStatus = StoreStatus;
/** @deprecated Use {@link StoreLink}. */
export type MarketplaceArtistLink = StoreLink;

/** Input for a person applying for (or updating) their own store. */
export interface ArtistApplicationInput {
  userId: string;
  orgId?: string;
  displayName: string;
  headline?: string | null;
  city?: string | null;
  photoUrl?: string | null;
  bioHtml?: string | null;
  payoutEmail: string;
  payoutMethod?: PayoutMethod;
  defaultCurrency?: Currency;
  links?: StoreLink[];
}

/**
 * Input for opening a store owned by an organization.
 *
 * `actorUserId` is the member doing it — an org store may only be opened by
 * someone holding the 'owner' role in that org, which is also what stops an
 * unclaimed associated-business listing from selling (decided 2026-09-05).
 */
export interface OrgStoreInput {
  ownerOrgId: string;
  actorUserId: string;
  /** Marketplace to trade in. Defaults to the owning org itself. */
  orgId?: string;
  /** @deprecated A front is not paid; an org's money is earmarked, not sent. */
  payoutEmail?: string | null;
  payoutMethod?: PayoutMethod;
  defaultCurrency?: Currency;
  bioHtml?: string | null;
  links?: StoreLink[];
}

/** Subset a store's owner may edit themselves. */
export interface ArtistProfileUpdateInput {
  displayName?: string;
  headline?: string | null;
  city?: string | null;
  photoUrl?: string | null;
  bioHtml?: string | null;
  payoutEmail?: string;
  payoutMethod?: PayoutMethod;
  defaultCurrency?: Currency;
  links?: StoreLink[];
}

/**
 * A person's payout identity — where their money goes, however many fronts
 * present their work (migration 096). Clearing the Stripe account is not a
 * failure state: it puts them back on manual settlement through the core NFP
 * account, the mandatory fallback for anyone who never finishes KYC.
 *
 * Organizations have no equivalent. An org's share is earmarked inside the
 * host account, so it never holds a connected account (decided 2026-09-05).
 */
export interface PayoutIdentityInput {
  payoutEmail?: string | null;
  payoutMethod?: PayoutMethod;
  stripeAccountId?: string | null;
  /** Set once Stripe reports the account payouts-enabled. */
  stripeOnboardedAt?: string | null;
}

/** A person's payout identity as stored. */
export interface PayoutIdentity {
  userId: string;
  payoutEmail: string | null;
  payoutMethod: PayoutMethod;
  stripeAccountId: string | null;
  stripeOnboardedAt: string | null;
  /** Derived: whether a sale to this person can take a destination charge. */
  canReceiveDestinationCharge: boolean;
}

/** A single image attached to an artwork (ordered; first = primary). */
export interface ArtworkMediaInput {
  url: string;
  nextcloudFileId?: string | null;
  nextcloudPath?: string | null;
  alt?: string | null;
  role?: ArtworkMediaRole;
}

/** Input for creating a new artwork (with images + a single default price). */
export interface CreateArtworkInput {
  /**
   * The store that will sell it. Preferred; required when there is no
   * `artistUserId` (an org store selling unattributed work).
   */
  storeId?: string;
  /** Who made it. Resolves the store when `storeId` is omitted. */
  artistUserId?: string | null;
  title: string;
  descriptionHtml?: string | null;
  kind?: ArtworkKind;
  yearCreated?: number | null;
  medium?: string | null;
  style?: string | null;
  subject?: string | null;
  heightCm?: number | null;
  widthCm?: number | null;
  depthCm?: number | null;
  weightKg?: number | null;
  certificateOfAuthenticity?: boolean;
  provenanceNotes?: string | null;
  /** Single default-variant price in minor units. */
  priceMinor: number;
  currency?: Currency;
  inventoryQty?: number;
  images?: ArtworkMediaInput[];
}

/** Editable fields on an existing artwork (excludes media + pricing). */
export interface UpdateArtworkInput {
  title?: string;
  descriptionHtml?: string | null;
  kind?: ArtworkKind;
  yearCreated?: number | null;
  medium?: string | null;
  style?: string | null;
  subject?: string | null;
  heightCm?: number | null;
  widthCm?: number | null;
  depthCm?: number | null;
  weightKg?: number | null;
  certificateOfAuthenticity?: boolean;
  provenanceNotes?: string | null;
  /** When provided, updates the default variant's price. */
  priceMinor?: number;
  currency?: Currency;
  inventoryQty?: number;
}

export interface Artwork {
  id: string;
  orgId: string;
  /** The store selling this piece — the payee for any order line on it. */
  storeId: string;
  /**
   * Who made it. Null since migration 095 for work an org store sells with no
   * individual attribution. For who gets paid, read {@link Artwork.storeId}.
   */
  artistUserId?: string | null;
  slug: string;
  title: string;
  descriptionHtml?: string | null;
  yearCreated?: number | null;
  medium?: string | null;
  style?: string | null;
  subject?: string | null;
  heightCm?: number | null;
  widthCm?: number | null;
  depthCm?: number | null;
  weightKg?: number | null;
  kind: ArtworkKind;
  certificateOfAuthenticity: boolean;
  provenanceNotes?: string | null;
  status: ArtworkStatus;
  primaryImageId?: string | null;
  metadata: Record<string, unknown>;
  /** Denormalised detail-page view counter (migration 057). */
  viewCount: number;
  createdAt: string;
  updatedAt: string;

  /** Joined data — populated by query helpers when convenient */
  artistName?: string | null;
  artistSlug?: string | null;
  primaryImageUrl?: string | null;
  primaryImageAlt?: string | null;
  variants?: ArtworkVariant[];
  media?: ArtworkMedia[];
  /** Active auction lot if this artwork is being auctioned */
  lot?: AuctionLot | null;
  /**
   * Set when the piece appears in a front that does not sell it (migration
   * 112): the presenting store's id. Undefined on the piece's own store.
   */
  presentedByStoreId?: string | null;
}

export interface ArtworkVariant {
  id: string;
  artworkId: string;
  orgId: string;
  sku?: string | null;
  label?: string | null;
  priceMinor: number;
  currency: Currency;
  editionNumber?: number | null;
  editionTotal?: number | null;
  inventoryQty: number;
  position: number;
  createdAt: string;
}

export interface ArtworkMedia {
  id: string;
  artworkId: string;
  orgId: string;
  url: string;
  nextcloudFileId?: string | null;
  nextcloudPath?: string | null;
  alt?: string | null;
  role: ArtworkMediaRole;
  position: number;
  createdAt: string;
}

export type AuctionStatus =
  | "scheduled"
  | "live"
  | "ended"
  | "cancelled"
  | "sold"
  | "passed";

export interface AuctionLot {
  id: string;
  artworkVariantId: string;
  orgId: string;
  startAt: string;
  endAt: string;
  startingBidMinor: number;
  reserveMinor?: number | null;
  buyNowMinor?: number | null;
  bidIncrementMinor: number;
  antiSnipeMinutes: number;
  currentBidMinor?: number | null;
  currentBidId?: string | null;
  bidCount: number;
  currency: Currency;
  status: AuctionStatus;
  winnerUserId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  /** Joined: the artwork being auctioned */
  artwork?: Artwork;
}

export type BidStatus = "active" | "outbid" | "winning" | "retracted";

export interface Bid {
  id: string;
  lotId: string;
  bidderId: string;
  amountMinor: number;
  maxAmountMinor?: number | null;
  isMaxBid: boolean;
  status: BidStatus;
  placedAt: string;
  /** Joined display name (anonymized when shown publicly) */
  bidderName?: string | null;
}

export interface Cart {
  id: string;
  token: string;
  userId?: string | null;
  currency: Currency;
  expiresAt?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lines?: CartLine[];
  subtotalMinor?: number;
}

export interface CartLine {
  id: string;
  cartId: string;
  artworkVariantId: string;
  quantity: number;
  unitPriceMinor: number;
  currency: Currency;
  notes?: string | null;
  /** The presenting store the buyer came through, when not the seller (112). */
  viaStoreId?: string | null;
  createdAt: string;
  /** Joined artwork data for cart display */
  artwork?: Artwork;
  variant?: ArtworkVariant;
}

export type ReservationStatus = "active" | "released" | "converted";

export interface Reservation {
  id: string;
  artworkVariantId: string;
  cartId?: string | null;
  expiresAt: string;
  status: ReservationStatus;
  createdAt: string;
}

export type OrderStatus =
  | "draft"
  | "pending_payment"
  | "awaiting_etransfer"
  | "payment_received"
  | "paid"
  | "fulfilled"
  | "completed"
  | "cancelled"
  | "refunded";

export type PaymentMethod = "etransfer" | "stripe" | "manual";

export interface Address {
  recipientName?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
}

export interface Order {
  id: string;
  number: string;
  /** The front the order was placed through (migration 095). Null for thread orders. */
  storeId?: string | null;
  customerId?: string | null;
  customerEmail: string;
  customerName?: string | null;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentReference?: string | null;
  paymentInstructions?: string | null;
  paymentDueAt?: string | null;
  paymentConfirmedAt?: string | null;
  paymentConfirmedBy?: string | null;
  paymentMetadata: Record<string, unknown>;

  subtotalMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  currency: Currency;

  shippingAddress?: Address | null;
  billingAddress?: Address | null;

  notes?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
  fulfilledAt?: string | null;
  cancelledAt?: string | null;

  lines?: OrderLine[];
}

export interface OrderLine {
  id: string;
  orderId: string;
  artworkVariantId?: string | null;
  artworkId?: string | null;
  /** Set when this line sells a thread (kind='service') instead of an artwork variant. */
  threadId?: string | null;
  artistUserId?: string | null;
  orgId?: string | null;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  artistShareMinor?: number | null;
  galleryShareMinor?: number | null;
  currency: Currency;
  metadata: Record<string, unknown>;
  createdAt: string;
  /** Joined: the artwork's primary image, when the line sells one. */
  imageUrl?: string | null;
}

export type InquiryKind = "question" | "reserve_request" | "make_offer";
export type InquiryStatus = "open" | "accepted" | "declined" | "expired";

export interface Inquiry {
  id: string;
  artworkId: string;
  orgId: string;
  customerEmail: string;
  customerName?: string | null;
  customerUserId?: string | null;
  kind: InquiryKind;
  offerAmountMinor?: number | null;
  currency?: Currency | null;
  message: string;
  status: InquiryStatus;
  createdAt: string;
  respondedAt?: string | null;
}

export type PayoutStatus = "pending" | "sent" | "received" | "failed";

export interface Payout {
  id: string;
  /** Null for an org party (migration 098). */
  artistUserId: string | null;
  partyOrgId?: string | null;
  orderId?: string | null;
  amountMinor: number;
  currency: Currency;
  /** `stripe` = a destination-charge transfer to the maker's connected account. */
  method: "etransfer" | "manual" | "stripe";
  reference?: string | null;
  status: PayoutStatus;
  notes?: string | null;
  createdAt: string;
  sentAt?: string | null;
}
