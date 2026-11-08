-- 259 · Who a Nextcloud sync request is about.
-- 2026-11-08. docs/open/hub-cards-handoff/PLAN.md §6 D.
--
-- Requests are org-wide (migration 139); the hub Members card shows "Syncing"
-- per person, so a role change, welcome or removal records its subject. NULL =
-- an org-wide sync (as today).

ALTER TABLE nextcloud_sync_requests
  ADD COLUMN IF NOT EXISTS subject_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS nextcloud_sync_requests_subject
  ON nextcloud_sync_requests (org_id, subject_user_id, requested_at DESC);
