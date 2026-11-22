-- DRAFT (not applied, not numbered): place_favourites.
-- A guide stars a catalogue place; starred places feature on Discover and on that guide's profile.
-- Screens 01, 09, 12, 38. Read by apps/elktours/src/lib/places-public.ts (already tolerant of the table missing).
CREATE TABLE IF NOT EXISTS place_favourites (
  org_id      varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  place_id    uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  featured    boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (place_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_place_favourites_org ON place_favourites (org_id, featured, created_at);
CREATE INDEX IF NOT EXISTS idx_place_favourites_user ON place_favourites (user_id);

ALTER TABLE place_favourites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON place_favourites;
CREATE POLICY tenant_isolation ON place_favourites FOR ALL TO eac_tenant
  USING (org_id::text = app_org_id()) WITH CHECK (org_id::text = app_org_id());
