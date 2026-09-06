-- ============================================================================
-- Migration 095: address commerce by store, not by (artist, org)
-- ============================================================================
-- Migration 094 gave an organization a store it can own, be approved for and
-- attach a payout account to — and then it can do nothing, because every piece
-- of commerce downstream is addressed by `artist_user_id`. An org has no
-- artist_user_id, so an org store cannot hold a single listing.
--
-- This repoints artwork, carts and orders at `store.id`:
--
--   artwork.store_id          who SELLS the piece
--   artwork.artist_user_id    who MADE it — now nullable, and no longer the
--                             seller's identity doing double duty
--   cart.store_id             one cart per store (decided 2026-09-05), which
--                             is what makes an order map to exactly one payee
--   commerce_order.store_id   the payee for the whole order
--
-- Splitting maker from seller is the point, not a side effect. An org selling
-- a member's work has both, and they are different people; a collective print
-- with no individual attribution has only a seller. The old schema could not
-- say either.
-- ============================================================================

-- ─── 1. Artwork belongs to a store ──────────────────────────────────────────

ALTER TABLE artwork ADD COLUMN store_id uuid REFERENCES store(id) ON DELETE CASCADE;

-- Existing artwork was addressed by (artist_user_id, org_id), which is exactly
-- the natural key of a person's store — so every row has one and only one
-- match. Written as an UPDATE rather than assumed empty: the table held rows
-- when this ran, and a fresh database replays it against whatever 094 left.
UPDATE artwork a
SET store_id = s.id
FROM store s
WHERE s.owner_user_id = a.artist_user_id
  AND s.org_id = a.org_id
  AND a.store_id IS NULL;

-- If anything failed to match, stop rather than silently orphan it — an
-- artwork with no store is an artwork nobody can be paid for.
DO $$
DECLARE orphans int;
BEGIN
  SELECT COUNT(*) INTO orphans FROM artwork WHERE store_id IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION 'migration 095: % artwork row(s) have no matching store', orphans;
  END IF;
END $$;

ALTER TABLE artwork ALTER COLUMN store_id SET NOT NULL;

-- The maker is now optional. The seller was doing double duty as the artist,
-- which is what made org ownership impossible to express.
ALTER TABLE artwork ALTER COLUMN artist_user_id DROP NOT NULL;

CREATE INDEX idx_artwork_store ON artwork (store_id);

-- artwork.org_id is denormalised from the store and the two must not drift —
-- artwork_org_id_slug_key scopes slugs by it, and the query layer joins on it.
-- A composite FK makes disagreement impossible rather than merely unlikely.
ALTER TABLE store ADD CONSTRAINT store_id_org_key UNIQUE (id, org_id);
ALTER TABLE artwork ADD CONSTRAINT artwork_store_org_fkey
  FOREIGN KEY (store_id, org_id) REFERENCES store (id, org_id) ON DELETE CASCADE;

COMMENT ON COLUMN artwork.store_id IS
  'The store selling this piece. The payee for any order line referencing it.';
COMMENT ON COLUMN artwork.artist_user_id IS
  'Who made the piece. Nullable since migration 095 — an org store may sell work with no individual attribution. For who gets PAID, see store_id.';

-- ─── 2. One cart per store ──────────────────────────────────────────────────
--
-- Decided 2026-09-05. A cart spanning sellers means an order with several
-- payees, which destination charges cannot express — Stripe settles a charge
-- to one connected account. Pinning the cart to a store also replaces the
-- runtime guard in createEtransferOrder, which discovered the problem only at
-- checkout, after the buyer had built a basket it could not sell them.
--
-- Nullable: a cart exists before its first line, and only then learns which
-- store it is for.

ALTER TABLE cart ADD COLUMN store_id uuid REFERENCES store(id) ON DELETE CASCADE;
CREATE INDEX idx_cart_store ON cart (store_id) WHERE store_id IS NOT NULL;

COMMENT ON COLUMN cart.store_id IS
  'The single store this cart buys from. NULL only while the cart is empty. Set from the first line added; adding a line from another store is refused in app code.';

-- ─── 3. An order has one payee ──────────────────────────────────────────────
--
-- Nullable because service orders (the no-cart "book now" rail in
-- packages/commerce/src/server/service-orders.ts) are not sold by a store at
-- all — they are a thread plus the selling org's configured payout email.
-- Giving services a store is a later step; until then NULL means "settle via
-- the org's own configuration", not "unknown".

ALTER TABLE commerce_order ADD COLUMN store_id uuid REFERENCES store(id) ON DELETE SET NULL;
CREATE INDEX idx_order_store ON commerce_order (store_id) WHERE store_id IS NOT NULL;

COMMENT ON COLUMN commerce_order.store_id IS
  'The store being paid for this order — one payee per order since migration 095. NULL for service orders, which settle through the selling org''s configured payout email rather than a store.';

-- Backfill the existing order(s) through their lines' (artist, org) pair.
UPDATE commerce_order o
SET store_id = s.id
FROM commerce_order_line ol
JOIN store s
  ON s.owner_user_id = ol.artist_user_id AND s.org_id = ol.org_id
WHERE ol.order_id = o.id AND o.store_id IS NULL;
