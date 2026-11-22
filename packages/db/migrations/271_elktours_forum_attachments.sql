-- DRAFT (not applied, not numbered): forum_attachments.
-- One link card and any number of photos or videos on a topic or a reply (screens 20, 21, 39).
-- Shared shape: any org's forum may use it. Files themselves go through an upload route
-- (a member-level one is still to be built; /api/upload is editor-only today).
-- thread_id is always set; reply_id is set too when the attachment belongs to a reply.
CREATE TABLE IF NOT EXISTS forum_attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_id   varchar(21) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  reply_id    varchar(21) REFERENCES replies(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('link','image','video')),
  url         text NOT NULL,
  mime_type   text,
  width       integer,
  height      integer,
  seconds     real,
  card        jsonb NOT NULL DEFAULT '{}'::jsonb,   -- link: title, description, imageUrl, siteName
  position    integer NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_forum_attachments_thread ON forum_attachments (thread_id, reply_id, position);
CREATE INDEX IF NOT EXISTS idx_forum_attachments_reply ON forum_attachments (reply_id) WHERE reply_id IS NOT NULL;

ALTER TABLE forum_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON forum_attachments;
CREATE POLICY tenant_isolation ON forum_attachments FOR ALL TO eac_tenant
  USING (org_id::text = app_org_id()) WITH CHECK (org_id::text = app_org_id());
