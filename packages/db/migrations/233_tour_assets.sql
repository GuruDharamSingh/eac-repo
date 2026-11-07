-- ============================================================================
-- 233: tour_assets — the asset registry for elktours tours and stops (2026-11-02).
--
-- Every file or live feature a tour page can show gets a row with its own
-- visibility switch: films, posters, images, Street View stills, documents,
-- and the two live features with no file (`map3d` per tour, `streetview` per
-- stop). Public pages read `visible AND archived_at IS NULL` only.
--
--   * `visible` defaults to false: nothing new appears until an editor turns
--     it on (or a fly-over with auto_publish does).
--   * `threads.metadata.film` stays the site's read path as a cache of the
--     visible hero film; code writes both in one transaction.
--   * Files under `EAC_Network/elktours/Private/...` are never public; making
--     one visible copies it to `Media/` first (lib/assets.ts).
--   * Migration 235 adds `place_id` and makes `thread_id` nullable (catalogue
--     assets); 234 adds the FK on `render_request_id`.
--
-- Backfill (idempotent): the 8 published films (1080 + 720 + poster), one
-- `still` per stop with a still_url, one `map3d` per tour and one `streetview`
-- per stop, all visible, so nothing changes on screen.
--
-- Spec: docs/open/ELKTOURS_EXPERIENCES_SPEC_2026-11-02.md §1.2,
-- docs/open/ELKTOURS_PIPELINE_READINESS_2026-11-02.md Proposal (a).
-- ============================================================================

CREATE TABLE IF NOT EXISTS tour_assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_id     varchar(21) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  -- NULL = the whole tour.
  stop_id       uuid REFERENCES tour_stops(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('film','poster','image','still','map3d','streetview','document')),
  -- 'hero' | 'gallery' | 'card' | 'background' ... (validated in code)
  role          text,
  -- '1080' | '720' | 'poster' ... siblings of one render share render_request_id
  variant       text,
  storage       text NOT NULL DEFAULT 'nextcloud' CHECK (storage IN ('nextcloud','external')),
  -- EAC_Network/elktours/Media/Videos/... for nextcloud files
  storage_key   text,
  -- /api/media/... or an external https URL. NULL only for the live switches.
  url           text,
  mime_type     text,
  bytes         bigint,
  width         integer,
  height        integer,
  seconds       real,
  sha256        text,
  -- 'elktour-unity' | 'upload' | 'streetview-static' | 'import' | 'live' | 'place'
  source        text NOT NULL,
  -- Must render with the asset, e.g. 'Google, Cesium; © OpenStreetMap contributors'.
  attribution   text,
  licence_note  text,
  visible       boolean NOT NULL DEFAULT false,
  position      integer NOT NULL DEFAULT 0,
  caption       text,
  alt_text      text,
  -- style, render checks, camera summary, payload_sha256, fromPlaceAssetId ...
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- FK added in 234.
  render_request_id uuid,
  -- NULL = pipeline / import.
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW(),
  -- Soft delete; history kept.
  archived_at   timestamptz,
  CONSTRAINT tour_assets_url_or_live CHECK (url IS NOT NULL OR kind IN ('map3d','streetview'))
);

CREATE INDEX IF NOT EXISTS idx_tour_assets_thread
  ON tour_assets (thread_id, stop_id, kind, position) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tour_assets_stop ON tour_assets (stop_id) WHERE stop_id IS NOT NULL;

-- At most one visible hero film per tour.
CREATE UNIQUE INDEX IF NOT EXISTS tour_assets_one_hero_film ON tour_assets (thread_id)
  WHERE kind = 'film' AND role = 'hero' AND variant = '1080' AND visible AND archived_at IS NULL;

-- Tenancy (227 pattern): binds eac_tenant only; postgres connections are unaffected.
ALTER TABLE tour_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tour_assets;
CREATE POLICY tenant_isolation ON tour_assets FOR ALL TO eac_tenant
  USING (org_id::text = app_org_id()) WITH CHECK (org_id::text = app_org_id());

-- ── backfill ────────────────────────────────────────────────────────────────

-- Films: 1080 (hero), 720 (hero sibling) and the poster, from metadata.film.
INSERT INTO tour_assets (org_id, thread_id, kind, role, variant, storage, storage_key, url, mime_type, seconds,
                         source, attribution, licence_note, visible, meta)
SELECT t.org_id, t.id, v.kind, 'hero', v.variant, 'nextcloud',
       CASE WHEN v.url LIKE '/api/media/%' THEN substr(v.url, length('/api/media/') + 1) END,
       v.url, v.mime, CASE WHEN v.kind = 'film' THEN COALESCE((t.metadata->'film'->>'seconds')::real, 30) END,
       'import', 'Google, Cesium',
       'Google Maps Platform 3D Tiles: promotional use only, <=30 s, uncropped, credit kept',
       TRUE, jsonb_build_object('backfill', '233', 'filmSource', t.metadata->'film'->>'source')
FROM threads t
CROSS JOIN LATERAL (VALUES
  ('film',   '1080',   t.metadata->'film'->>'url',    'video/mp4'),
  ('film',   '720',    t.metadata->'film'->>'url720', 'video/mp4'),
  ('poster', 'poster', t.metadata->'film'->>'poster', 'image/jpeg')
) AS v(kind, variant, url, mime)
WHERE t.kind = 'tour' AND t.org_id = 'elktours'
  AND v.url IS NOT NULL AND v.url <> ''
  AND NOT EXISTS (SELECT 1 FROM tour_assets a WHERE a.thread_id = t.id AND a.url = v.url);

-- Write the asset id back into the metadata.film cache (only when missing).
UPDATE threads t SET metadata = jsonb_set(t.metadata, '{film,assetId}', to_jsonb(a.id::text))
FROM tour_assets a
WHERE a.thread_id = t.id AND a.kind = 'film' AND a.variant = '1080' AND a.role = 'hero' AND a.visible
  AND a.archived_at IS NULL AND t.metadata ? 'film' AND NOT (t.metadata->'film' ? 'assetId');

-- Street View stills, one per stop.
INSERT INTO tour_assets (org_id, thread_id, stop_id, kind, role, storage, storage_key, url, mime_type,
                         source, attribution, licence_note, visible, meta)
SELECT s.org_id, s.thread_id, s.id, 'still', 'card', 'nextcloud',
       CASE WHEN s.still_url LIKE '/api/media/%' THEN substr(s.still_url, length('/api/media/') + 1) END,
       s.still_url, 'image/jpeg', 'streetview-static', 'Google Street View',
       'Street View Static API still; storage beyond caching is outside Google''s usual terms (under review)',
       TRUE, jsonb_build_object('backfill', '233')
FROM tour_stops s
WHERE s.still_url IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM tour_assets a WHERE a.stop_id = s.id AND a.kind = 'still' AND a.url = s.still_url);

-- Live switches: map3d per tour, streetview per stop.
INSERT INTO tour_assets (org_id, thread_id, kind, storage, source, visible, meta)
SELECT t.org_id, t.id, 'map3d', 'external', 'live', TRUE, jsonb_build_object('backfill', '233')
FROM threads t
WHERE t.kind = 'tour' AND t.org_id = 'elktours'
  AND NOT EXISTS (SELECT 1 FROM tour_assets a WHERE a.thread_id = t.id AND a.kind = 'map3d' AND a.stop_id IS NULL);

INSERT INTO tour_assets (org_id, thread_id, stop_id, kind, storage, source, attribution, visible, meta)
SELECT s.org_id, s.thread_id, s.id, 'streetview', 'external', 'live', 'Google Street View', TRUE,
       jsonb_build_object('backfill', '233')
FROM tour_stops s
WHERE NOT EXISTS (SELECT 1 FROM tour_assets a WHERE a.stop_id = s.id AND a.kind = 'streetview');
