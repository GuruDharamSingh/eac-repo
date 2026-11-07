-- ============================================================================
-- 240: places — public flag + short excerpt; place_links — sticky rejections (2026-11-02).
--
--   places.is_public   the public places read (lib/places.ts listPublicPlaces) shows only
--                      these. New places default to public ("everything public for now",
--                      Justin). Backfill: true for the places that are not archived and
--                      appear in a published tour (75), false for the rest.
--   places.excerpt     one short line for cards. Backfill: first sentence of the existing
--                      copy (HTML stripped, <= 200 chars) where there is copy.
--   place_links.rejected_at
--                      an editor removed this link; the enrichment script never re-adds
--                      the same URL for that place.
-- ============================================================================

ALTER TABLE places ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
ALTER TABLE places ADD COLUMN IF NOT EXISTS excerpt text;
ALTER TABLE place_links ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

-- Public flag backfill (only rows not yet touched by an editor: updated before this migration).
UPDATE places p SET is_public = EXISTS (
  SELECT 1 FROM tour_stops s JOIN threads t ON t.id = s.thread_id
  WHERE s.place_id = p.id AND t.status = 'published'
) AND p.archived_at IS NULL;

-- Excerpt backfill: first sentence of the copy.
UPDATE places SET excerpt = left(
  COALESCE(
    substring(trim(regexp_replace(regexp_replace(body, '<[^>]+>', ' ', 'g'), '\s+', ' ', 'g')) FROM '^(.*?[.!?])(\s|$)'),
    trim(regexp_replace(regexp_replace(body, '<[^>]+>', ' ', 'g'), '\s+', ' ', 'g'))
  ), 200)
WHERE excerpt IS NULL AND body IS NOT NULL
  AND trim(regexp_replace(body, '<[^>]+>', '', 'g')) <> '';

CREATE INDEX IF NOT EXISTS idx_places_public ON places (org_id, slug) WHERE is_public AND archived_at IS NULL;
