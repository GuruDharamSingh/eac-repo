-- 216: data deletion requests (2026-10-29).
-- One row per request to delete a person's data, whether it came from the
-- site's own form (/data/delete) or from Meta's data deletion callback.
-- The confirmation code is what the requester (or Meta) uses to check status.

CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id                text PRIMARY KEY,
  -- NULL for the network itself (arts-collective.com), as in analytics_events.
  org_id            text REFERENCES organizations(id) ON DELETE CASCADE,
  -- 'site' (the form on /data/delete) or 'meta' (Facebook's callback).
  source            text NOT NULL,
  email             text,
  -- The app-scoped Facebook user id from the signed request, for 'meta' rows.
  external_user_id  text,
  message           text,
  confirmation_code text NOT NULL UNIQUE,
  -- 'received' | 'completed' | 'nothing_to_delete' | 'declined'
  status            text NOT NULL DEFAULT 'received',
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_org_status
  ON data_deletion_requests (org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_email
  ON data_deletion_requests (lower(email)) WHERE email IS NOT NULL;
