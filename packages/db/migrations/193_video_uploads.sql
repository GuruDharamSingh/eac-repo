-- 193 — video_uploads: recordings sent (or waiting to be sent) to a person's
-- YouTube channel through a user_connections row (192). 2026-10-03.
--
-- One row per recording file. The video worker finds files under a thread's
-- recording folder when the thread has threads.metadata.publish.youtube set
-- (packages/services/src/youtube-uploads.ts), and uploads queued rows
-- (youtube-uploader.ts).
--
-- status: awaiting   found; waits for someone to approve it (mode 'review',
--                    or a file older than the publish setting)
--         queued     approved or automatic; the worker will upload it
--         uploading  in progress (heartbeat_at); upload_url is YouTube's
--                    resumable session, uploaded_bytes how far it got
--         published  youtube_video_id set
--         failed     error says why; Retry puts it back to queued
--         skipped    someone chose not to publish it
-- source_path is relative to the org's storage root, as everywhere else.

CREATE TABLE IF NOT EXISTS video_uploads (
  id                varchar(21) PRIMARY KEY,
  org_id            varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_id         varchar(21),
  connection_id     varchar(21) REFERENCES user_connections(id) ON DELETE SET NULL,
  source_path       text NOT NULL,
  source_bytes      bigint NOT NULL DEFAULT 0,
  source_modified   timestamptz,
  title             text NOT NULL,
  description       text NOT NULL DEFAULT '',
  privacy           text NOT NULL DEFAULT 'private',
  status            text NOT NULL DEFAULT 'awaiting',
  youtube_video_id  text,
  upload_url        text,
  uploaded_bytes    bigint NOT NULL DEFAULT 0,
  error             text,
  attempts          integer NOT NULL DEFAULT 0,
  approved_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at       timestamptz,
  heartbeat_at      timestamptz,
  published_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, source_path)
);

CREATE INDEX IF NOT EXISTS video_uploads_thread ON video_uploads (org_id, thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS video_uploads_queue ON video_uploads (created_at) WHERE status = 'queued';
