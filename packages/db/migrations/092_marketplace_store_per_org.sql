-- ============================================================================
-- Migration 092: a store per (person, org), not one per person
-- ============================================================================
-- marketplace_artists carried PRIMARY KEY (user_id) while org_id was NOT NULL
-- — the exact contradiction artist_profiles had before migration 084. It says
-- a store belongs to an org, then allows exactly one per person across the
-- whole network. A member selling through IFAC could not also have a store on
-- the marketplace.
--
-- Fixed while the table is empty (0 rows), so unlike the profile migration
-- there is nothing to reconcile and no live seller to disturb.
--
-- The identity columns (display_name, headline, city, photo_url, links,
-- bio_html) are deliberately NOT dropped here. Migration 084 already made
-- `users` the home for those, and the query layer's ARTIST_FALLBACK_SELECT is
-- built to fall back when they are empty — so they are dead weight rather than
-- a live fork, and ~90 call sites read them. Repointing the fallback at
-- `users` (this migration's companion change in packages/commerce) is what
-- actually centralises identity; dropping the columns is cleanup that can
-- follow once nothing selects them.
-- ============================================================================

ALTER TABLE marketplace_artists DROP CONSTRAINT IF EXISTS marketplace_artists_pkey;
ALTER TABLE marketplace_artists
  ADD CONSTRAINT marketplace_artists_pkey PRIMARY KEY (user_id, org_id);

-- Listing a marketplace means scanning by org, and the old PK no longer serves
-- that as a prefix.
CREATE INDEX IF NOT EXISTS idx_marketplace_artists_org
  ON marketplace_artists (org_id, status);

-- The review queue: everything waiting on an admin, oldest first.
CREATE INDEX IF NOT EXISTS idx_marketplace_artists_pending
  ON marketplace_artists (applied_at)
  WHERE status = 'pending';

COMMENT ON TABLE marketplace_artists IS
  'A person''s store within one org. Commerce config only — payout, commission, currency, status. Identity lives on users (migration 084).';
COMMENT ON COLUMN marketplace_artists.display_name IS
  'DEPRECATED — read users.display_name. Retained until call sites migrate.';
