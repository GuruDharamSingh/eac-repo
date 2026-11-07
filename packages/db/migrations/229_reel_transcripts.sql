-- 229: reel_transcripts — speech-to-text of a reel's recording (2026-11-01).
-- The Studio's clip editor queues one per recording; the reel-render worker
-- extracts the audio with ffmpeg, runs whisper.cpp and stores word timings
-- in source seconds. Subtitles in the edit are built from these words.

CREATE TABLE IF NOT EXISTS reel_transcripts (
  id           text PRIMARY KEY,
  project_id   text NOT NULL REFERENCES reel_projects(id) ON DELETE CASCADE,
  org_id       varchar(50) NOT NULL,
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  -- Nextcloud path of the recording (the project's folder or the requester's own storage).
  path         text NOT NULL,
  folder       text NOT NULL,
  status       text NOT NULL DEFAULT 'queued',
  progress     real NOT NULL DEFAULT 0,
  model        text,
  language     text,
  -- [{ "w": "word", "s": 1.23, "e": 1.56 }], seconds in the source file.
  words        jsonb,
  duration_s   real,
  error        text,
  heartbeat_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  started_at   timestamptz,
  finished_at  timestamptz
);

CREATE INDEX IF NOT EXISTS reel_transcripts_project_idx ON reel_transcripts (project_id, path, created_at DESC);
CREATE INDEX IF NOT EXISTS reel_transcripts_queue_idx ON reel_transcripts (created_at) WHERE status = 'queued';
