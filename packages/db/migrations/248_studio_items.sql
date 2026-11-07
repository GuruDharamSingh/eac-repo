-- 248: studio_items + studio_item_links — lineage of a person's Studio material (2026-11-06).
--
-- Phase 1 of docs/open/STUDIO_PIPELINE_DESIGN_2026-11-06.md. One row per thing
-- in a person's pipeline, linked to what it was made from:
--   recording / file (stage In)  → reel (stage Make) → piece (stage Channel)
-- Existing tables keep their roles; these rows only point at them. Renders are
-- not items: reel_renders already hangs off reel_projects.
--
-- Written best-effort by packages/services/src/studio-items.ts (reel save and
-- publish, recording upload/rename/delete); callers tolerate the table being
-- absent, so source can ship before this is applied.
--
-- Rollback: DROP TABLE studio_item_links; DROP TABLE studio_items;

CREATE TABLE IF NOT EXISTS studio_items (
  id          varchar(21) PRIMARY KEY,
  owner_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id      varchar(50) NOT NULL REFERENCES organizations(id),
  -- recording: a file in Private/Video/{Recordings,Camera,Broadcasts}
  -- file:      any other Nextcloud file used as a source (artwork, a clip)
  -- reel:      a reel_projects row
  -- piece:     a published or draft thread in the person's channel
  kind        text NOT NULL CHECK (kind IN ('recording', 'file', 'reel', 'piece')),
  path        text,
  reel_id     text REFERENCES reel_projects(id) ON DELETE CASCADE,
  thread_id   varchar(21) REFERENCES threads(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CHECK (
    (kind IN ('recording', 'file') AND path IS NOT NULL) OR
    (kind = 'reel' AND reel_id IS NOT NULL) OR
    (kind = 'piece' AND thread_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS studio_items_path_uq
  ON studio_items (owner_id, path) WHERE path IS NOT NULL AND archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS studio_items_reel_uq
  ON studio_items (reel_id) WHERE kind = 'reel';
CREATE UNIQUE INDEX IF NOT EXISTS studio_items_thread_uq
  ON studio_items (thread_id) WHERE kind = 'piece';
CREATE INDEX IF NOT EXISTS studio_items_owner_idx
  ON studio_items (owner_id, updated_at DESC) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS studio_item_links (
  source_id  varchar(21) NOT NULL REFERENCES studio_items(id) ON DELETE CASCADE,
  target_id  varchar(21) NOT NULL REFERENCES studio_items(id) ON DELETE CASCADE,
  -- the slot the source fills in the target (clip, clip2, extra, artwork),
  -- or 'published' for reel → piece
  role       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, target_id, role),
  CHECK (source_id <> target_id)
);
CREATE INDEX IF NOT EXISTS studio_item_links_target_idx ON studio_item_links (target_id);

-- Tenancy floor (migration 227 pattern).
ALTER TABLE studio_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON studio_items;
CREATE POLICY tenant_isolation ON studio_items FOR ALL TO eac_tenant
  USING (org_id::text = app_org_id())
  WITH CHECK (org_id::text = app_org_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON studio_items, studio_item_links TO eac_tenant;

-- Backfill: every live reel project, the files its source slots name, and the
-- thread it was published as (metadata.video.reelId).
INSERT INTO studio_items (id, owner_id, org_id, kind, reel_id, title, created_at, updated_at)
SELECT 'r_' || p.id, p.owner_id, p.org_id, 'reel', p.id, p.title, p.created_at, p.updated_at
FROM reel_projects p
WHERE p.archived_at IS NULL AND length(p.id) <= 19
ON CONFLICT DO NOTHING;

-- Two statements: rows written in a data-modifying CTE are not visible to the
-- rest of the same statement, so the links would find no files.
CREATE TEMP TABLE studio_backfill_slots ON COMMIT DROP AS
SELECT p.id AS reel_id, p.owner_id, s.role, p.edit -> s.role ->> 'path' AS path
FROM reel_projects p
CROSS JOIN (VALUES ('clip'), ('clip2'), ('extra'), ('artwork')) AS s(role)
WHERE p.archived_at IS NULL AND length(p.id) <= 19
  AND coalesce(p.edit -> s.role ->> 'path', '') <> '';

INSERT INTO studio_items (id, owner_id, org_id, kind, path, title)
SELECT DISTINCT ON (owner_id, path)
       'f_' || substr(md5(owner_id::text || path), 1, 19), owner_id, 'oad',
       CASE WHEN path ~ '/Private/Video/(Recordings|Camera|Broadcasts)/' THEN 'recording' ELSE 'file' END,
       path, regexp_replace(path, '^.*/', '')
FROM studio_backfill_slots
ON CONFLICT DO NOTHING;

INSERT INTO studio_item_links (source_id, target_id, role)
SELECT f.id, r.id, s.role
FROM studio_backfill_slots s
JOIN studio_items f ON f.owner_id = s.owner_id AND f.path = s.path AND f.archived_at IS NULL
JOIN studio_items r ON r.kind = 'reel' AND r.reel_id = s.reel_id
ON CONFLICT DO NOTHING;

-- Published reels: the writing thread that carries metadata.video.reelId.
INSERT INTO studio_items (id, owner_id, org_id, kind, thread_id, title)
SELECT 'p_' || substr(t.id, 1, 19), t.author_id, t.org_id, 'piece', t.id, coalesce(t.title, '')
FROM threads t
JOIN studio_items r ON r.kind = 'reel' AND r.reel_id = t.metadata -> 'video' ->> 'reelId'
WHERE t.kind = 'writing' AND t.status IN ('draft', 'published')
ON CONFLICT DO NOTHING;

INSERT INTO studio_item_links (source_id, target_id, role)
SELECT r.id, p.id, 'published'
FROM studio_items p
JOIN threads t ON t.id = p.thread_id
JOIN studio_items r ON r.kind = 'reel' AND r.reel_id = t.metadata -> 'video' ->> 'reelId'
WHERE p.kind = 'piece'
ON CONFLICT DO NOTHING;
