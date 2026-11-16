-- 276: profile_avatar_versions — every avatar a person has had, per org or network (2026-11-16).
--
-- Per-org avatars with fallback: the CURRENT org avatar already has a home
-- (org_profiles.photo_override, migration 084, "falls back to users.avatar_url");
-- the network one is users.avatar_url. What was missing is history. Justin: "allow
-- versioning". One row per upload; org_id NULL means the network profile.
-- Written by packages/services/src/uploads.ts (storeUpload, kind avatar, scope org),
-- which tolerates this table being absent (it then only loses the history).
--
-- Not applied by the author. Idempotent.
-- Rollback: DROP TABLE profile_avatar_versions;

CREATE TABLE IF NOT EXISTS profile_avatar_versions (
  id          VARCHAR(21) PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id      VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
  url         TEXT        NOT NULL,
  path        TEXT,
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  is_current  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_avatar_versions_person
  ON profile_avatar_versions (user_id, org_id, created_at DESC);

-- At most one current version per person per org (and one for the network).
CREATE UNIQUE INDEX IF NOT EXISTS uq_profile_avatar_versions_current
  ON profile_avatar_versions (user_id, COALESCE(org_id, '')) WHERE is_current;

COMMENT ON TABLE profile_avatar_versions IS
  'History of a person''s avatar uploads. org_id NULL = network profile (users.avatar_url); else that org (org_profiles.photo_override). Readers resolve org first, then network.';
