-- 189: reels — Studio video projects and their render queue (2026-10-03).
--
-- A reel project is one person's fill of a template (packages/reels). Its
-- edit description lives in `edit` (Nextcloud paths, card text, trims); the
-- files themselves live in Nextcloud under `folder`:
--   personal: EAC_Network/users/<storage slug>/Private/Video/Reels/<id>
--   org:      EAC_Network/<org_id>/Private/Video/Reels/<id>
-- reel_renders is the queue the reel-render container polls
-- (packages/reels/render/render.mjs --worker). Each row snapshots the edit,
-- so a render is reproducible after the project changes.

CREATE TABLE IF NOT EXISTS reel_projects (
  id          text PRIMARY KEY,
  org_id      varchar(50) NOT NULL REFERENCES organizations(id),
  owner_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'Untitled reel',
  template    text NOT NULL,
  edit        jsonb NOT NULL DEFAULT '{}'::jsonb,
  folder      text NOT NULL,
  archived_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reel_projects_owner_idx
  ON reel_projects (owner_id, updated_at DESC) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS reel_projects_org_idx
  ON reel_projects (org_id, updated_at DESC) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS reel_renders (
  id           text PRIMARY KEY,
  project_id   text NOT NULL REFERENCES reel_projects(id) ON DELETE CASCADE,
  org_id       varchar(50) NOT NULL,
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  -- queued | running | done | failed
  status       text NOT NULL DEFAULT 'queued',
  edit         jsonb NOT NULL,
  folder       text NOT NULL,
  progress     real NOT NULL DEFAULT 0,
  output_path  text,
  thumb_path   text,
  duration_s   real,
  error        text,
  heartbeat_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  started_at   timestamptz,
  finished_at  timestamptz
);

CREATE INDEX IF NOT EXISTS reel_renders_queue_idx
  ON reel_renders (created_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS reel_renders_project_idx
  ON reel_renders (project_id, created_at DESC);
