-- 281: Development app versions (2026-11-20). Not applied.
-- Every saved edit of a block in the Development sandbox is a version; nothing is overwritten.
--   kind='version'  a saved edit: parent_id = the version it was made from, branch = its lane
--   kind='draft'    the autosaved working copy: one per (subject, author), overwritten in place;
--                   parent_id = the version the working copy started from
-- `subject` is a plain key ("block:<app>:<blockId>" today) so the same table can later hold versions of
-- real site pages ("page:<org>:<slug>"); see the idea "Versions and branches" in apps/development.
-- Platform-level (no org_id): only network admins reach it, through apps/development's getNetworkAdmin().
-- Additive only.

CREATE TABLE IF NOT EXISTS dev_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject     text NOT NULL,
  kind        text NOT NULL DEFAULT 'version' CHECK (kind IN ('version', 'draft')),
  parent_id   uuid REFERENCES dev_versions(id) ON DELETE RESTRICT,
  branch      text NOT NULL DEFAULT 'Main',
  note        text,
  -- The one-block Puck data (Data), looks included.
  doc         jsonb NOT NULL,
  -- The app theme previewed while editing (themes.json id), or NULL for the block's own look.
  theme       text,
  author_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  -- "Keep this one": the favourite. At most one per subject.
  kept        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (kind = 'version' OR kept = false)
);
CREATE INDEX IF NOT EXISTS idx_dev_versions_subject ON dev_versions (subject, created_at);
CREATE INDEX IF NOT EXISTS idx_dev_versions_parent ON dev_versions (parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dev_versions_draft ON dev_versions (subject, author_id) WHERE kind = 'draft';
CREATE UNIQUE INDEX IF NOT EXISTS uq_dev_versions_kept ON dev_versions (subject) WHERE kept;

-- Row-level security as in 227/265: enabled with no policy for eac_tenant, so the tenant role sees
-- nothing; the postgres connections the apps use are unaffected. Admin-only access is the app gate.
ALTER TABLE dev_versions ENABLE ROW LEVEL SECURITY;
