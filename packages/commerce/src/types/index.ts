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

/** Marketplace artist application / membership lifecycle. */
export type MarketplaceArtistStatus =
  | "pending"
  | "active"
  | "paused"
  | "rejected";

export interface MarketplaceArtistLink {
  label: string;
  url: string;
}

export interface MarketplaceArtist {
  userId: string;
  orgId: string;
  payoutEmail: string;
  payoutMethod: "etransfer" | "manual";
  commissionRate: number; // gallery's percentage (0-100)
  defaultCurrency: Currency;
  status: MarketplaceArtistStatus;
  bioHtml?: string | null;
  joinedAt: string;
  updatedAt: string;

  /** Self-contained marketplace profile fields (migration 054). */
  displayName?: string | null;
  headline?: string | null;
  city?: string | null;
  photoUrl?: string | null;
  links: MarketplaceArtistLink[];

  /** Application / review audit trail. */
  appliedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;

  /** Joined fallback from users + artist_profiles when self fields are null. */
  slug?: string | null;
}

/** Input for an artist applying to (or updating) their marketplace profile. */
export interface ArtistApplicationInput {
  userId: string;
  orgId?: string;
  displayName: string;
  headline?: string | null;
  city?: string | null;
  photoUrl?: string | null;
  bioHtml?: string | null;
  payoutEmail: string;
  payoutMethod?: "etransfer" | "manual";
  defaultCurrency?: Currency;
  links?: MarketplaceArtistLink[];
}

/** Subset an approved artist may edit on their own profile. */
export interface ArtistProfileUpdateInput {
  displayName?: string;
  headline?: string | null;
  city?: string | null;
  photoUrl?: string | null;
  bioHtml?: string | null;
  payoutEmail?: string;
  payoutMethod?: "etransfer" | "manual";
  defaultCurrency?: Currency;
  links?: MarketplaceArtistLink[];
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
  artistUserId: string;
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
  artistUserId: string;
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
  artistUserId: string;
  orderId?: string | null;
  amountMinor: number;
  currency: Currency;
  method: "etransfer" | "manual";
  reference?: string | null;
  status: PayoutStatus;
  notes?: string | null;
  createdAt: string;
  sentAt?: string | null;
}
