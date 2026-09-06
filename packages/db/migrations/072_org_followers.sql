-- ============================================================================
-- Migration 072: Org followers
-- ============================================================================
-- A lighter-weight relationship than user_organizations: "notify/show me
-- updates from this org" without membership, a role, or admin/edit access.
-- Deliberately a separate table rather than a new user_organizations.role
-- value — followers aren't part of the owner/guide/member/viewer permission
-- ladder at all, they carry no access, and mixing them into that CHECK
-- constraint would make every role-scoped query need to remember to exclude
-- them.
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_followers (
  user_id      UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id       VARCHAR(50)   NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  followed_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_org_followers_org ON org_followers(org_id);

COMMENT ON TABLE org_followers IS
  'Lightweight "follow this org" relationship — no role, no access, just a subscribe/notify signal. Distinct from user_organizations (membership + role).';
