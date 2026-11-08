-- 261 · Cross-site listings wait for the other org's yes.
-- 2026-11-08. Owner-approved moderation fix (PM board, gap 2).
--
-- thread_orgs (migration 031) is "also show on": a row puts a post on another
-- org's site. Until now any member of that org could list their own post there
-- and it appeared at once. The rule from here on (services/thread-listing.ts):
--
--   * listing onto an org where the author is an editor (owner/guide) is
--     immediate — status 'approved';
--   * listing onto an org where the author is only a member is 'pending'
--     until an owner/guide of THAT org approves or declines it;
--   * only 'approved' rows render (listedOnClause, isListedOn, center.ts,
--     getThreadOrgs, and the tenant RLS read policy below).
--
-- BACKFILL: the column's DEFAULT is 'approved', so ADD COLUMN gives every
-- existing row status = 'approved' — nothing visible today disappears. Code
-- that inserts without naming a status (the legacy inner-gathering content
-- route) also lands approved; setThreadListing names it explicitly.
--
-- 'declined' is kept rather than deleted, so a declined request does not come
-- back as fresh on the author's next save; the author can re-request (back to
-- pending) by ticking the site again, or remove the row.

ALTER TABLE thread_orgs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'thread_orgs_status_check'
  ) THEN
    ALTER TABLE thread_orgs
      ADD CONSTRAINT thread_orgs_status_check
      CHECK (status IN ('pending', 'approved', 'declined'));
  END IF;
END $$;

-- The editors' queue: "what is waiting for this org".
CREATE INDEX IF NOT EXISTS idx_thread_orgs_pending
  ON thread_orgs (org_id) WHERE status = 'pending';

COMMENT ON COLUMN thread_orgs.status IS
  'pending | approved | declined. Only approved rows show the thread on org_id. Listing onto an org where the author is owner/guide is approved at once; a member''s listing waits for that org''s owner/guide (services/thread-listing.ts).';

-- threads.tenant_read (migration 227): a tenant reads threads it owns or
-- carries. A pending or declined listing is not carrying.
DROP POLICY IF EXISTS tenant_read ON threads;
CREATE POLICY tenant_read ON threads FOR SELECT TO eac_tenant
  USING (
    org_id::text = app_org_id()
    OR EXISTS (
      SELECT 1 FROM thread_orgs t
      WHERE t.thread_id = threads.id::text
        AND t.org_id = app_org_id()
        AND t.status = 'approved'
    )
  );
