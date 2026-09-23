-- ============================================================================
-- 149: being shown on an org's site — members by default, requests to return.
--
-- User's calls (2026-09-18, Brief A):
--   * A MEMBER is shown on the org's site by default. Sign-ups are viewers
--     (followers) and are never on a roster; the moment someone becomes a
--     member, guide or owner their org_profiles row goes public.
--   * A person may hide themselves from an org at any time (Where you show);
--     to be shown again they ASK, and an owner or guide approves.
--
-- Pieces:
--   org_profiles.self_hidden   the person hid themselves. The trigger below
--                              never overrides it, so a re-promotion does not
--                              undo someone's own choice.
--   org_listing_requests       one row per ask; at most one pending per
--                              (org, person). Approving publishes the row.
--   trg_user_org_show_members  on INSERT, or on a role change INTO
--                              member/guide/owner from something else.
--
-- Forward only: existing hidden members are left as they are (several are
-- test/junk accounts that must not be published by a backfill).
-- ============================================================================

ALTER TABLE org_profiles
  ADD COLUMN IF NOT EXISTS self_hidden BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS org_listing_requests (
  id          VARCHAR(21) PRIMARY KEY,
  org_id      VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      VARCHAR(12) NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'approved', 'declined', 'withdrawn')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at  TIMESTAMPTZ,
  decided_by  UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS org_listing_requests_one_pending
  ON org_listing_requests (org_id, user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_org_listing_requests_org
  ON org_listing_requests (org_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION org_profiles_show_new_members() RETURNS trigger AS $$
BEGIN
  IF NEW.role IN ('member', 'guide', 'owner')
     AND (TG_OP = 'INSERT' OR OLD.role IS NULL OR OLD.role NOT IN ('member', 'guide', 'owner')) THEN
    INSERT INTO org_profiles (org_id, user_id, is_public)
    VALUES (NEW.org_id, NEW.user_id, TRUE)
    ON CONFLICT (org_id, user_id) DO UPDATE
      SET is_public = TRUE
      WHERE NOT org_profiles.self_hidden;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_org_show_members ON user_organizations;
CREATE TRIGGER trg_user_org_show_members
  AFTER INSERT OR UPDATE OF role ON user_organizations
  FOR EACH ROW EXECUTE FUNCTION org_profiles_show_new_members();
