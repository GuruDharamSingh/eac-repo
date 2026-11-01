-- 222: publish_jobs — the ledger of everything sent to an outside platform (2026-11-01).
--
-- One row per attempt to post a piece or a social post to a Facebook Page,
-- Instagram account or Threads profile: who asked, for which org, which
-- target, what came back. Sending still runs inline in the request; the row
-- is written before the call and finished after it. `scheduled_at` and
-- `attempts` are here for the executor that will drain queued rows later.
-- This is also the activity log a person can read on their connection card.

CREATE TABLE IF NOT EXISTS publish_jobs (
  id            bigserial PRIMARY KEY,
  requested_by  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id        varchar(50) REFERENCES organizations(id) ON DELETE SET NULL,
  source_kind   text NOT NULL,
  source_id     varchar(21) NOT NULL,
  provider      text NOT NULL,
  target_id     text NOT NULL,
  target_label  text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'queued',
  scheduled_at  timestamptz,
  attempts      integer NOT NULL DEFAULT 0,
  external_id   text,
  external_url  text,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

CREATE INDEX IF NOT EXISTS publish_jobs_requester_idx ON publish_jobs (requested_by, created_at DESC);
CREATE INDEX IF NOT EXISTS publish_jobs_queue_idx ON publish_jobs (scheduled_at) WHERE status = 'queued';
