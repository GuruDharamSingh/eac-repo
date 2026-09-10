-- ============================================================================
-- Migration 112: a front can present pieces it does not sell
-- ============================================================================
-- The money model (096) says a store is a FRONT — "when something is
-- purchased through a store it is just a log of where it's presented
-- through" — and `commerce_order_line.presented_store_id` records that. But
-- until now a piece could only ever be presented by the one store that sells
-- it (`artwork.store_id`), so the column could never disagree with the seller
-- and an organisation's front could show nothing but its own merchandise.
--
-- This adds the missing relation: a store may PRESENT another store's listed
-- artwork. The maker stays the payee and the selling store stays
-- `artwork.store_id`; the presenting store is the shop window. A sale that
-- comes through that window records it on the cart line, then the order line,
-- and — because the presenting front's owning org is the split counterparty —
-- an org's accepted agreement with the maker applies to exactly the sales it
-- presented, and to no others.
--
-- Nothing is copied. Removing a presentation removes a window, never a piece.
-- ============================================================================

CREATE TABLE store_presentation (
  store_id    uuid        NOT NULL REFERENCES store(id)   ON DELETE CASCADE,
  artwork_id  uuid        NOT NULL REFERENCES artwork(id) ON DELETE CASCADE,
  added_by    uuid        REFERENCES users(id) ON DELETE SET NULL,
  added_at    timestamptz NOT NULL DEFAULT now(),
  position    integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, artwork_id)
);

CREATE INDEX idx_store_presentation_artwork ON store_presentation (artwork_id);

COMMENT ON TABLE store_presentation IS
  'A store showing another store''s artwork in its front. The seller and payee are unchanged; the presenting store is the window a sale is logged through.';

-- Which window the buyer came through. NULL = the piece's own store.
ALTER TABLE cart_line
  ADD COLUMN IF NOT EXISTS via_store_id uuid REFERENCES store(id) ON DELETE SET NULL;

COMMENT ON COLUMN cart_line.via_store_id IS
  'The presenting store the buyer added this line from, when not the selling store. Flows to commerce_order_line.presented_store_id.';
