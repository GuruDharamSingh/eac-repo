-- DRAFT (not applied, not numbered): artist_availability.
-- The artist's 7 x 3 "when I am free" grid (screens 30, 35, 36) and the notice they need.
-- weekday: 0 = Monday ... 6 = Sunday. part: morning (before 12:00), afternoon (before 17:00), evening.
-- A cell present = free. Kept out of shared org_profiles on purpose.
CREATE TABLE IF NOT EXISTS artist_availability (
  org_id      varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekday     smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  part        text NOT NULL CHECK (part IN ('morning','afternoon','evening')),
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id, weekday, part)
);
CREATE INDEX IF NOT EXISTS idx_artist_availability_user ON artist_availability (user_id);

CREATE TABLE IF NOT EXISTS artist_availability_notice (
  org_id       varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notice_days  smallint NOT NULL DEFAULT 2 CHECK (notice_days IN (1, 2, 7)),
  updated_at   timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['artist_availability','artist_availability_notice'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I FOR ALL TO eac_tenant
      USING (org_id::text = app_org_id()) WITH CHECK (org_id::text = app_org_id())', t);
  END LOOP;
END $$;
