-- ============================================================================
-- Migration 111: a piece can be auctioned again
-- ============================================================================
-- `auction_lot.artwork_variant_id` carried a plain UNIQUE (migration 042), so
-- a variant could be put up for auction exactly once in its life. A lot that
-- passed (reserve not met), was withdrawn, or whose winner never paid left the
-- piece permanently un-auctionable — surfaced the moment auction settlement
-- was actually exercised end-to-end (2026-09-08); no lot had ever been created
-- before, so the constraint had never been hit.
--
-- What the rule should be: at most one OPEN lot per variant. Closed lots are
-- history and may accumulate. A partial unique index says exactly that, and
-- `createLot` checks the same condition before inserting so the error a
-- seller sees is "already at auction" rather than a constraint name.
-- ============================================================================

ALTER TABLE auction_lot DROP CONSTRAINT IF EXISTS auction_lot_artwork_variant_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS auction_lot_one_open_per_variant
  ON auction_lot (artwork_variant_id)
  WHERE status IN ('scheduled', 'live');

COMMENT ON INDEX auction_lot_one_open_per_variant IS
  'At most one scheduled/live lot per variant; closed lots (sold, passed, cancelled, ended) may repeat.';
