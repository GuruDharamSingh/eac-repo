-- ============================================================================
-- 147: video_pipelines — drop a recording into a Nextcloud folder, get back
-- an edited video.
--
-- A pipeline is ONE folder tree in an org's storage (EAC_Network/<org>/...).
-- An org may have several (meeting recordings, workshop sessions, talks), each
-- with its own intro/outro and settings. The folder is the interface for the
-- people who use it: they drop a file into "1 Drop recordings here", and
-- replace the intro by replacing a file in "Intro and outro". This table holds
-- only what a folder cannot: which folders are pipelines, their settings, and
-- the job history.
--
-- The worker (packages/services/scripts/video-worker.mts, container
-- eac-video-worker) is the only writer of job progress. Apps read jobs and
-- write the review decisions (trim override, title, approve, retry).
--
-- Publishing (YouTube) is not built. `publish_target` and the youtube_*
-- columns exist so a rendered job has somewhere to wait and the review screen
-- has something to say; nothing reads them yet.
-- ============================================================================

CREATE TABLE IF NOT EXISTS video_pipelines (
  id              VARCHAR(21)  PRIMARY KEY,
  org_id          VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug            TEXT         NOT NULL,
  name            TEXT         NOT NULL,
  -- Relative to the org's storage root, e.g. 'Video/Meeting recordings'.
  folder          TEXT         NOT NULL,
  -- { trimSilence, silenceDb, minSilenceSec, loudnorm, maxHeight, crf,
  --   imageIntroSec } — see DEFAULT_PIPELINE_SETTINGS in video-pipeline.ts.
  settings        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  publish_target  TEXT         NOT NULL DEFAULT 'none' CHECK (publish_target IN ('none', 'youtube')),
  youtube_playlist_id TEXT,
  enabled         BOOLEAN      NOT NULL DEFAULT TRUE,
  last_scanned_at TIMESTAMPTZ,
  created_by      UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, slug),
  UNIQUE (org_id, folder)
);

CREATE TABLE IF NOT EXISTS video_jobs (
  id              VARCHAR(21)  PRIMARY KEY,
  pipeline_id     VARCHAR(21)  NOT NULL REFERENCES video_pipelines(id) ON DELETE CASCADE,
  org_id          VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- The name it was dropped under, and where the original is NOW (it moves:
  -- drop folder -> Processing -> Originals, or -> Failed).
  source_name     TEXT         NOT NULL,
  source_path     TEXT         NOT NULL,
  source_bytes    BIGINT       NOT NULL DEFAULT 0,
  -- queued: waiting for the worker. processing: rendering. ready: rendered,
  -- waiting for a person. approved: a person said publish (waits for YouTube).
  -- published: on YouTube. failed: see error.
  status          TEXT         NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'processing', 'ready', 'approved', 'published', 'failed')),
  progress        REAL         NOT NULL DEFAULT 0,
  -- ffprobe summary of the original: { durationSec, width, height, fps, hasAudio, hasVideo }.
  probe           JSONB,
  -- What the automatic edit decided: { trimStart, trimEnd, reason[], intro, outro, outDurationSec }.
  auto_edit       JSONB,
  -- What a person overrode: { trimStart?, trimEnd?, skipIntro?, skipOutro? }.
  -- Wins over auto_edit on the next render.
  edit_override   JSONB        NOT NULL DEFAULT '{}'::jsonb,
  title           TEXT,
  description     TEXT,
  -- Optional: the gathering this recording belongs to.
  thread_id       VARCHAR(21)  REFERENCES threads(id) ON DELETE SET NULL,
  output_path     TEXT,
  thumbnail_path  TEXT,
  output_bytes    BIGINT,
  youtube_video_id TEXT,
  error           TEXT,
  attempts        INTEGER      NOT NULL DEFAULT 0,
  -- Worker liveness: a 'processing' job whose heartbeat went stale is reset
  -- to 'queued' on the next worker start.
  heartbeat_at    TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  approved_by     UUID         REFERENCES users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS video_jobs_pipeline ON video_jobs (pipeline_id, created_at DESC);
CREATE INDEX IF NOT EXISTS video_jobs_queue ON video_jobs (created_at) WHERE status = 'queued';

-- InnerGathering's first pipeline. The worker creates the folders on its
-- first scan; nothing here touches Nextcloud.
INSERT INTO video_pipelines (id, org_id, slug, name, folder)
SELECT 'vp-inner-group-mtgs', 'inner_group', 'meeting-recordings', 'Meeting recordings', 'Video/Meeting recordings'
WHERE EXISTS (SELECT 1 FROM organizations WHERE id = 'inner_group')
ON CONFLICT DO NOTHING;
