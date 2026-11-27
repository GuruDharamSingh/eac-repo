-- 292: Channel comments (2026-11-24).
-- Comments on outside posts are kept per outside post (publish_jobs row),
-- not only per network thread: a Channel post about a piece has no thread of
-- its own. thread_id stays when the post maps to a thread (ArtDirect shows
-- those). from_self marks replies sent from Channel as the Page or account.
-- publish_jobs.comments_synced_at throttles fetching comments from Graph.

ALTER TABLE thread_external_comments ALTER COLUMN thread_id DROP NOT NULL;
ALTER TABLE thread_external_comments ADD COLUMN IF NOT EXISTS publish_job_id bigint REFERENCES publish_jobs(id) ON DELETE CASCADE;
ALTER TABLE thread_external_comments ADD COLUMN IF NOT EXISTS from_self boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS thread_external_comments_job_idx ON thread_external_comments (publish_job_id, commented_at);

ALTER TABLE thread_external_comments DROP CONSTRAINT IF EXISTS thread_external_comments_has_owner;
ALTER TABLE thread_external_comments ADD CONSTRAINT thread_external_comments_has_owner
  CHECK (thread_id IS NOT NULL OR publish_job_id IS NOT NULL);

ALTER TABLE publish_jobs ADD COLUMN IF NOT EXISTS comments_synced_at timestamptz;
