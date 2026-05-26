-- ============================================================================
-- Migration 042: Commerce + Auction (Art-Auction app foundation)
-- ============================================================================
-- Adds the e-commerce + timed auction schema used by apps/art-auction and
-- shared packages @elkdonis/commerce, @elkdonis/payments, @elkdonis/checkout.
--
-- Tenancy model: AGGREGATE across orgs.
--   - Any org's users can list artwork for sale by inserting a marketplace_artists
--     row (opt-in registry).
--   - Every artwork row is org-scoped (org_id stamped, joinable to organizations).
--   - The Art-Auction storefront queries artwork JOIN marketplace_artists
--     (status='active') instead of WHERE org_id=...
--
-- Money: BIGINT minor units (cents) + ISO 4217 currency CHAR(3) on every row
--        carrying an amount. Snapshot prices on order_line — never join through.
--
-- Auction format: timed-only with reserve + buy-now + anti-snipe extension.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- MARKETPLACE_ARTISTS — opt-in federation registry across orgs
-- One row per user who sells through Art-Auction; their home org_id is stored
-- so payouts and order routing know which org the work originates from.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_artists (
  user_id          UUID         PRIMARY KEY REFERENCES users(id)         ON DELETE CASCADE,
  org_id           VARCHAR(50)  NOT NULL    REFERENCES organizations(id) ON DELETE CASCADE,
  payout_email     TEXT         NOT NULL,
  payout_method    TEXT         NOT NULL DEFAULT 'etransfer'
                     CHECK (payout_method IN ('etransfer', 'manual')),
  commission_rate  NUMERIC(5,2) NOT NULL DEFAULT 30.00,
  default_currency CHAR(3)      NOT NULL DEFAULT 'CAD',
  status           TEXT         NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'paused')),
  bio_html         TEXT,
  joined_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_marketplace_artists_org    ON marketplace_artists(org_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_artists_status ON marketplace_artists(status);

-- ────────────────────────────────────────────────────────────────────────────
-- ARTWORK — the merchandising row (one per piece)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artwork (
  id                            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                        VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  artist_user_id                UUID         NOT NULL REFERENCES users(id),
  slug                          TEXT         NOT NULL,
  title                         TEXT         NOT NULL,
  description_html              TEXT,
  year_created                  INT,
  medium                        TEXT,
  style                         TEXT,
  subject                       TEXT,
  height_cm                     NUMERIC(8,2),
  width_cm                      NUMERIC(8,2),
  depth_cm                      NUMERIC(8,2),
  weight_kg                     NUMERIC(8,2),
  kind                          TEXT         NOT NULL DEFAULT 'original'
                                  CHECK (kind IN ('original', 'limited_edition', 'open_edition')),
  certificate_of_authenticity   BOOLEAN      NOT NULL DEFAULT true,
  provenance_notes              TEXT,
  status                        TEXT         NOT NULL DEFAULT 'draft'
                                  CHECK (status IN ('draft', 'available', 'reserved', 'sold', 'archived')),
  primary_image_id              UUID,
  metadata                      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at                    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_artwork_org      ON artwork(org_id);
CREATE INDEX IF NOT EXISTS idx_artwork_artist   ON artwork(artist_user_id);
CREATE INDEX IF NOT EXISTS idx_artwork_status   ON artwork(status) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_artwork_kind     ON artwork(kind);
CREATE INDEX IF NOT EXISTS idx_artwork_created  ON artwork(created_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- ARTWORK_VARIANT — sellable SKU. Originals: 1 row, qty=1.
-- Limited/open editions: N rows (one per size). Money on the variant.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artwork_variant (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id      UUID         NOT NULL REFERENCES artwork(id) ON DELETE CASCADE,
  org_id          VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sku             TEXT,
  label           TEXT,
  price_minor     BIGINT       NOT NULL CHECK (price_minor >= 0),
  currency        CHAR(3)      NOT NULL DEFAULT 'CAD',
  edition_number  INT,
  edition_total   INT,
  inventory_qty   INT          NOT NULL DEFAULT 1 CHECK (inventory_qty >= 0),
  position        INT          NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_artwork_variant_artwork ON artwork_variant(artwork_id);
CREATE INDEX IF NOT EXISTS idx_artwork_variant_org     ON artwork_variant(org_id);

-- ────────────────────────────────────────────────────────────────────────────
-- ARTWORK_MEDIA — Nextcloud-backed images / video.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artwork_media (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id         UUID         NOT NULL REFERENCES artwork(id) ON DELETE CASCADE,
  org_id             VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url                TEXT         NOT NULL,
  nextcloud_file_id  VARCHAR(255),
  nextcloud_path     VARCHAR(500),
  alt                TEXT,
  role               TEXT         NOT NULL DEFAULT 'detail'
                       CHECK (role IN ('hero', 'detail', 'scale', 'wall', 'video')),
  position           INT          NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_artwork_media_artwork ON artwork_media(artwork_id);

ALTER TABLE artwork
  ADD CONSTRAINT artwork_primary_image_fk
  FOREIGN KEY (primary_image_id) REFERENCES artwork_media(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- AUCTION_LOT — when an artwork variant goes to auction.
-- One lot per variant (UNIQUE). Reserve & buy-now optional. Anti-snipe extends.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auction_lot (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_variant_id  UUID         NOT NULL UNIQUE REFERENCES artwork_variant(id) ON DELETE CASCADE,
  org_id              VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  start_at            TIMESTAMPTZ  NOT NULL,
  end_at              TIMESTAMPTZ  NOT NULL,
  starting_bid_minor  BIGINT       NOT NULL CHECK (starting_bid_minor >= 0),
  reserve_minor       BIGINT       CHECK (reserve_minor IS NULL OR reserve_minor >= 0),
  buy_now_minor       BIGINT       CHECK (buy_now_minor IS NULL OR buy_now_minor >= 0),
  bid_increment_minor BIGINT       NOT NULL DEFAULT 1000 CHECK (bid_increment_minor > 0),
  anti_snipe_minutes  INT          NOT NULL DEFAULT 5 CHECK (anti_snipe_minutes >= 0),
  current_bid_minor   BIGINT,
  current_bid_id      UUID,
  bid_count           INT          NOT NULL DEFAULT 0,
  currency            CHAR(3)      NOT NULL DEFAULT 'CAD',
  status              TEXT         NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled', 'sold', 'passed')),
  winner_user_id      UUID         REFERENCES users(id),
  metadata            JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auction_lot_org    ON auction_lot(org_id);
CREATE INDEX IF NOT EXISTS idx_auction_lot_status ON auction_lot(status);
CREATE INDEX IF NOT EXISTS idx_auction_lot_end    ON auction_lot(end_at) WHERE status IN ('scheduled', 'live');

-- ────────────────────────────────────────────────────────────────────────────
-- BID — one row per bid (history + current). FK loop closed below.
-- max_amount_minor lets bidders set proxy max; system auto-bids up to it.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bid (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id            UUID         NOT NULL REFERENCES auction_lot(id) ON DELETE CASCADE,
  bidder_id         UUID         NOT NULL REFERENCES users(id),
  amount_minor      BIGINT       NOT NULL CHECK (amount_minor > 0),
  max_amount_minor  BIGINT       CHECK (max_amount_minor IS NULL OR max_amount_minor >= amount_minor),
  is_max_bid        BOOLEAN      NOT NULL DEFAULT false,
  status            TEXT         NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'outbid', 'winning', 'retracted')),
  client_ip         INET,
  user_agent        TEXT,
  placed_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bid_lot     ON bid(lot_id, placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_bid_bidder  ON bid(bidder_id);
CREATE INDEX IF NOT EXISTS idx_bid_status  ON bid(lot_id, status);

ALTER TABLE auction_lot
  ADD CONSTRAINT auction_lot_current_bid_fk
  FOREIGN KEY (current_bid_id) REFERENCES bid(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- CART — anonymous-OK. Token in cookie is the credential (Shopify pattern).
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT         NOT NULL UNIQUE,
  user_id     UUID         REFERENCES users(id) ON DELETE SET NULL,
  currency    CHAR(3)      NOT NULL DEFAULT 'CAD',
  expires_at  TIMESTAMPTZ,
  metadata    JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cart_user    ON cart(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cart_expires ON cart(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS cart_line (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id             UUID         NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
  artwork_variant_id  UUID         NOT NULL REFERENCES artwork_variant(id),
  quantity            INT          NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_minor    BIGINT       NOT NULL,
  currency            CHAR(3)      NOT NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cart_line_cart ON cart_line(cart_id);

-- ────────────────────────────────────────────────────────────────────────────
-- RESERVATION — short hold on a one-of-one piece during checkout.
-- Background job releases expired reservations.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservation (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_variant_id  UUID         NOT NULL REFERENCES artwork_variant(id) ON DELETE CASCADE,
  cart_id             UUID         REFERENCES cart(id) ON DELETE SET NULL,
  expires_at          TIMESTAMPTZ  NOT NULL,
  status              TEXT         NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'released', 'converted')),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reservation_active
  ON reservation(artwork_variant_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_reservation_expires
  ON reservation(expires_at) WHERE status = 'active';

-- ────────────────────────────────────────────────────────────────────────────
-- COMMERCE_ORDER + ORDER_LINE — eTransfer-aware status machine.
-- Address fields stored as JSONB snapshot (don't join customer's address book).
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commerce_order (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  number                TEXT         NOT NULL UNIQUE,
  customer_id           UUID         REFERENCES users(id),
  customer_email        TEXT         NOT NULL,
  customer_name         TEXT,
  status                TEXT         NOT NULL DEFAULT 'pending_payment'
                          CHECK (status IN (
                            'draft','pending_payment','awaiting_etransfer',
                            'payment_received','paid','fulfilled','completed',
                            'cancelled','refunded'
                          )),
  payment_method        TEXT         NOT NULL DEFAULT 'etransfer'
                          CHECK (payment_method IN ('etransfer','stripe','manual')),
  payment_reference     TEXT,
  payment_instructions  TEXT,
  payment_due_at        TIMESTAMPTZ,
  payment_confirmed_at  TIMESTAMPTZ,
  payment_confirmed_by  UUID         REFERENCES users(id),
  payment_metadata      JSONB        NOT NULL DEFAULT '{}'::jsonb,

  subtotal_minor        BIGINT       NOT NULL DEFAULT 0,
  shipping_minor        BIGINT       NOT NULL DEFAULT 0,
  tax_minor             BIGINT       NOT NULL DEFAULT 0,
  total_minor           BIGINT       NOT NULL DEFAULT 0,
  currency              CHAR(3)      NOT NULL DEFAULT 'CAD',

  shipping_address      JSONB,
  billing_address       JSONB,

  notes                 TEXT,
  metadata              JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  paid_at               TIMESTAMPTZ,
  fulfilled_at          TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_order_status   ON commerce_order(status);
CREATE INDEX IF NOT EXISTS idx_order_customer ON commerce_order(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_email    ON commerce_order(customer_email);
CREATE INDEX IF NOT EXISTS idx_order_created  ON commerce_order(created_at DESC);

CREATE TABLE IF NOT EXISTS commerce_order_line (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID         NOT NULL REFERENCES commerce_order(id) ON DELETE CASCADE,
  artwork_variant_id  UUID         REFERENCES artwork_variant(id),
  artwork_id          UUID         REFERENCES artwork(id),
  artist_user_id      UUID         REFERENCES users(id),
  org_id              VARCHAR(50)  REFERENCES organizations(id),
  description         TEXT         NOT NULL,
  quantity            INT          NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_minor    BIGINT       NOT NULL,
  artist_share_minor  BIGINT,
  gallery_share_minor BIGINT,
  currency            CHAR(3)      NOT NULL,
  metadata            JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_line_order  ON commerce_order_line(order_id);
CREATE INDEX IF NOT EXISTS idx_order_line_artist ON commerce_order_line(artist_user_id);
CREATE INDEX IF NOT EXISTS idx_order_line_org    ON commerce_order_line(org_id);

-- ────────────────────────────────────────────────────────────────────────────
-- INQUIRY — make-an-offer / reserve-request / questions on artwork
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inquiry (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id          UUID         NOT NULL REFERENCES artwork(id) ON DELETE CASCADE,
  org_id              VARCHAR(50)  NOT NULL REFERENCES organizations(id),
  customer_email      TEXT         NOT NULL,
  customer_name       TEXT,
  customer_user_id    UUID         REFERENCES users(id),
  kind                TEXT         NOT NULL DEFAULT 'question'
                        CHECK (kind IN ('question','reserve_request','make_offer')),
  offer_amount_minor  BIGINT,
  currency            CHAR(3),
  message             TEXT         NOT NULL,
  status              TEXT         NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','accepted','declined','expired')),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  responded_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_inquiry_artwork ON inquiry(artwork_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_status  ON inquiry(status);

-- ────────────────────────────────────────────────────────────────────────────
-- PAYOUT — record of funds owed to / paid to artist
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payout (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_user_id  UUID         NOT NULL REFERENCES users(id),
  order_id        UUID         REFERENCES commerce_order(id) ON DELETE SET NULL,
  amount_minor    BIGINT       NOT NULL,
  currency        CHAR(3)      NOT NULL,
  method          TEXT         NOT NULL DEFAULT 'etransfer',
  reference       TEXT,
  status          TEXT         NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','sent','received','failed')),
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_payout_artist ON payout(artist_user_id);
CREATE INDEX IF NOT EXISTS idx_payout_status ON payout(status);

-- ────────────────────────────────────────────────────────────────────────────
-- Touch updated_at triggers
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION commerce_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marketplace_artists_touch ON marketplace_artists;
CREATE TRIGGER trg_marketplace_artists_touch BEFORE UPDATE ON marketplace_artists
  FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();

DROP TRIGGER IF EXISTS trg_artwork_touch ON artwork;
CREATE TRIGGER trg_artwork_touch BEFORE UPDATE ON artwork
  FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();

DROP TRIGGER IF EXISTS trg_auction_lot_touch ON auction_lot;
CREATE TRIGGER trg_auction_lot_touch BEFORE UPDATE ON auction_lot
  FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();

DROP TRIGGER IF EXISTS trg_cart_touch ON cart;
CREATE TRIGGER trg_cart_touch BEFORE UPDATE ON cart
  FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();

DROP TRIGGER IF EXISTS trg_commerce_order_touch ON commerce_order;
CREATE TRIGGER trg_commerce_order_touch BEFORE UPDATE ON commerce_order
  FOR EACH ROW EXECUTE FUNCTION commerce_touch_updated_at();

COMMIT;
