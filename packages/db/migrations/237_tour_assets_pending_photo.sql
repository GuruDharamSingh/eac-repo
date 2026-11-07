-- ============================================================================
-- 237: tour_assets — a photo may wait for its pin (2026-11-02).
--
-- Custom locations (elktours): an editor uploads a photo to create a place.
-- When the photo has no GPS geotag, it is stored privately and kept as an
-- asset with no owner yet (source = 'photo_pending') until the editor drops
-- a pin; lib/custom-place-actions.ts then attaches it to the new place.
-- The owner CHECK from 235 is widened for exactly that case.
--
-- Spec: docs/open/ELKTOURS_EXPERIENCES_SPEC_2026-11-02.md, "Custom locations".
-- ============================================================================

ALTER TABLE tour_assets DROP CONSTRAINT IF EXISTS tour_assets_owner;
ALTER TABLE tour_assets ADD CONSTRAINT tour_assets_owner
  CHECK (thread_id IS NOT NULL OR place_id IS NOT NULL OR source = 'photo_pending');

CREATE INDEX IF NOT EXISTS idx_tour_assets_pending ON tour_assets (org_id, created_at)
  WHERE source = 'photo_pending';
