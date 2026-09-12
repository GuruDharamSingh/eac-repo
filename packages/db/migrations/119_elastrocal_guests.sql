-- ============================================================================
-- 119: Elastrocal — charts kept by guests
--
-- No account is needed to save a chart. A signed-out browser gets a signed
-- cookie carrying a random guest id (apps/elastrocal/src/lib/guest.ts) and its
-- charts are keyed on that id. Signing in later claims them: owner_id is set
-- and guest_id cleared, so the chart follows the account across devices.
--
-- Unlike pigeonshoot (077), no sentinel user: astro_charts is this app's own
-- table, so owner_id can simply be nullable, with a CHECK that every chart
-- has exactly one kind of keeper. Guests deliberately get no `users` row —
-- see the header of apps/pigeonshoot/src/lib/guest.ts for why that never
-- works.
-- ============================================================================

BEGIN;

ALTER TABLE astro_charts
  ALTER COLUMN owner_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS guest_id VARCHAR(64);

ALTER TABLE astro_charts
  ADD CONSTRAINT astro_charts_one_keeper
  CHECK ((owner_id IS NULL) <> (guest_id IS NULL));

CREATE INDEX IF NOT EXISTS idx_astro_charts_guest
  ON astro_charts (guest_id, is_favorite DESC, created_at DESC)
  WHERE guest_id IS NOT NULL;

COMMENT ON COLUMN astro_charts.guest_id IS
  'Signed-cookie guest id for charts saved without an account; cleared when the guest signs in and the chart is claimed.';

COMMIT;
