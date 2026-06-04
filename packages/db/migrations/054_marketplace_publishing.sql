-- ============================================================================
-- Migration 054: Marketplace publishing (artist onboarding + self-contained
--                marketplace artist profiles)
-- ============================================================================
-- Adds the "publication" half of the art-auction marketplace:
--   1. A neutral default marketplace org so new artists/artworks have a home
--      org_id (the storefront stays multi-org via per-row org_id).
--   2. An apply -> approve lifecycle on marketplace_artists (status gains
--      'pending' / 'rejected') plus application/review audit columns.
--   3. Self-contained display fields on marketplace_artists (display_name,
--      headline, city, photo_url, links) so the marketplace no longer depends
--      on arts-collective's artist_profiles table to render an artist page.
--
-- Branding note: kept intentionally neutral (EAC software). Sponsor/operator
-- branding (e.g. IFAC) is layered on later, not baked into the schema.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Neutral default marketplace org
-- Idempotent; ON CONFLICT preserves any admin-edited name/slug/description.
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO organizations (id, name, slug, description, nextcloud_folder_path) VALUES
  ('market', 'The Collective Market', 'market',
   'Neutral marketplace home for independent artists publishing work for sale and auction.',
   'EAC_Network/market')
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Application lifecycle on marketplace_artists
-- Widen the status CHECK to include the pre-approval states. Existing rows are
-- 'active' or 'paused' and remain valid.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE marketplace_artists
  DROP CONSTRAINT IF EXISTS marketplace_artists_status_check;

ALTER TABLE marketplace_artists
  ADD CONSTRAINT marketplace_artists_status_check
  CHECK (status IN ('pending', 'active', 'paused', 'rejected'));

-- New applicants land in 'pending' and wait for admin approval.
ALTER TABLE marketplace_artists
  ALTER COLUMN status SET DEFAULT 'pending';

-- Application / review audit trail.
ALTER TABLE marketplace_artists
  ADD COLUMN IF NOT EXISTS applied_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS reviewed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Self-contained marketplace profile display fields
-- Previously joined from artist_profiles (arts-collective wizard). The
-- marketplace now owns these so it renders independently; queries COALESCE
-- these over the artist_profiles fallback.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE marketplace_artists
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS headline     TEXT,
  ADD COLUMN IF NOT EXISTS city         TEXT,
  ADD COLUMN IF NOT EXISTS photo_url    TEXT,
  ADD COLUMN IF NOT EXISTS links        JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_marketplace_artists_applied_at
  ON marketplace_artists(applied_at);

COMMIT;
