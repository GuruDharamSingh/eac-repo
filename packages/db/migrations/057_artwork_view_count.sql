-- ============================================================================
-- Migration 057: Artwork view counts
-- ============================================================================
-- Adds a lightweight per-artwork view counter, incremented when a visitor
-- opens an artwork detail page. Surfaced in the artist studio hub and the
-- admin overview so sellers/operators can see which pieces draw attention.
--
-- Intentionally a simple denormalised counter (not a per-event log): cheap to
-- read on grids/dashboards and good enough for "how many views" without the
-- weight of an analytics table. A future migration can add a detailed
-- artwork_view event table if per-day / per-source breakdowns are needed.
-- ============================================================================

BEGIN;

ALTER TABLE artwork
  ADD COLUMN IF NOT EXISTS view_count BIGINT NOT NULL DEFAULT 0;

-- Helps "most viewed" sorts on the studio + admin dashboards.
CREATE INDEX IF NOT EXISTS idx_artwork_view_count
  ON artwork(view_count DESC);

COMMIT;
