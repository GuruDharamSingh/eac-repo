-- 230: an installation may belong to an organisation instead of a store (2026-11-01).
-- The Collect Art landing loft is an installation owned by the marketplace org
-- (`market`), which has no store of its own; it hangs works from any store in the
-- marketplace. `site_config` (org market, key home_loft) points at it.
-- Store installations are unchanged: store_id set, org_id NULL.

ALTER TABLE art_installation ALTER COLUMN store_id DROP NOT NULL;

ALTER TABLE art_installation
  ADD COLUMN IF NOT EXISTS org_id VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE art_installation DROP CONSTRAINT IF EXISTS art_installation_owner_check;
ALTER TABLE art_installation
  ADD CONSTRAINT art_installation_owner_check CHECK (store_id IS NOT NULL OR org_id IS NOT NULL);
