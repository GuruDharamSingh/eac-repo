-- 301: wordart_jobs, the queue for generated word art (2026-11-27).
--
-- A signed-in person asks for a word-art picture (their own, or for an org they
-- own or guide). The request is resolved into a full design (text, font
-- candidates, colours, frame) and stored in `input`; the reel-render worker
-- renders it to a PNG under
--   personal: EAC_Network/users/<storage slug>/Private/Media/Images/WordArt/
--   org:      EAC_Network/<org_id>/Private/Media/Images/WordArt/
-- ('oad' is "Just me"). The pictures are media assets, not threads. For an org
-- piece the app adds the `media` library row once, on the first status read
-- after the render (media_id, registered_at).
-- Design: docs/open/WORDART_GENERATE_2026-11-27.md.

CREATE TABLE IF NOT EXISTS wordart_jobs (
  id            text PRIMARY KEY,
  org_id        varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- queued | running | done | failed
  status        text NOT NULL DEFAULT 'queued',
  input         jsonb NOT NULL,
  folder        text NOT NULL,
  output_path   text,
  output_bytes  integer,
  media_id      varchar(21),
  registered_at timestamptz,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

CREATE INDEX IF NOT EXISTS wordart_jobs_queue_idx
  ON wordart_jobs (created_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS wordart_jobs_person_idx
  ON wordart_jobs (requested_by, created_at DESC);
