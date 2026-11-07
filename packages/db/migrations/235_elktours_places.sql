-- ============================================================================
-- 235: places — the elktours catalogue of places (2026-11-02).
--
--   places              one row per place the company knows: public copy,
--                       private notes (never public), default Street View
--                       pose, tags, provenance (stop_backfill | manual |
--                       photon | overpass, with source_ref 'osm:node/123').
--   tour_stops          + place_id (where the stop came from) and
--                       + experience_id (an experience used as a stop).
--                       COPY ON PICK: a stop keeps its own title/body/pose/
--                       still; nothing propagates. The live read path is
--                       unchanged.
--   tour_assets         + place_id (catalogue media); thread_id nullable.
--   place_stats         view, computed on read: tours, published tours,
--                       runs (past non-cancelled departures), guests
--                       (confirmed party sizes on those runs), last visit,
--                       experiences.
--   geo_suggest_cache   7-day cache for Overpass/Photon suggestion lookups
--                       (keyed by rounded bbox / query). Kept in Postgres
--                       because elktours has no redis client dependency.
--
-- Backfill (idempotent): one place per (org_id, lower(trim(title))) group of
-- existing stops, copied from the group's most recently updated stop, then
-- tour_stops.place_id linked. Re-running adds nothing.
--
-- Spec: docs/open/ELKTOURS_EXPERIENCES_SPEC_2026-11-02.md §1.1, §1.2, §2.
-- ============================================================================

CREATE TABLE IF NOT EXISTS places (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug          text NOT NULL,
  title         text NOT NULL,
  -- Sanitised HTML, public copy.
  body          text,
  -- Company knowledge. Never rendered publicly.
  private_notes text,
  lat           double precision,
  lng           double precision,
  heading       numeric(5,1),
  pitch         numeric(4,1),
  fov           numeric(4,1),
  address       text,
  tags          text[] NOT NULL DEFAULT '{}',
  source        text NOT NULL DEFAULT 'manual' CHECK (source IN ('stop_backfill','manual','photon','overpass')),
  source_ref    text,
  archived_at   timestamptz,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT places_org_slug UNIQUE (org_id, slug),
  CONSTRAINT places_latlng_pair CHECK ((lat IS NULL) = (lng IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_places_org_geo ON places (org_id, lat, lng);
CREATE INDEX IF NOT EXISTS idx_places_org_title ON places (org_id, lower(title));
CREATE INDEX IF NOT EXISTS idx_places_source_ref ON places (org_id, source_ref) WHERE source_ref IS NOT NULL;

ALTER TABLE places ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON places;
CREATE POLICY tenant_isolation ON places FOR ALL TO eac_tenant
  USING (org_id::text = app_org_id()) WITH CHECK (org_id::text = app_org_id());

-- ── stops link to places and experiences ────────────────────────────────────

ALTER TABLE tour_stops ADD COLUMN IF NOT EXISTS place_id uuid REFERENCES places(id) ON DELETE SET NULL;
ALTER TABLE tour_stops ADD COLUMN IF NOT EXISTS experience_id varchar(21) REFERENCES threads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tour_stops_place ON tour_stops (place_id) WHERE place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tour_stops_experience ON tour_stops (experience_id) WHERE experience_id IS NOT NULL;

-- ── catalogue assets ────────────────────────────────────────────────────────

ALTER TABLE tour_assets ADD COLUMN IF NOT EXISTS place_id uuid REFERENCES places(id) ON DELETE CASCADE;
ALTER TABLE tour_assets ALTER COLUMN thread_id DROP NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tour_assets_owner') THEN
    ALTER TABLE tour_assets ADD CONSTRAINT tour_assets_owner CHECK (thread_id IS NOT NULL OR place_id IS NOT NULL);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_tour_assets_place ON tour_assets (place_id) WHERE place_id IS NOT NULL;

-- ── suggestion cache ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS geo_suggest_cache (
  key         text PRIMARY KEY,
  payload     jsonb NOT NULL,
  fetched_at  timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_geo_suggest_cache_age ON geo_suggest_cache (fetched_at);

-- ── stats view ──────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW place_stats AS
WITH place_tours AS (
  SELECT DISTINCT s.place_id, s.thread_id FROM tour_stops s WHERE s.place_id IS NOT NULL
),
runs AS (
  SELECT pt.place_id, d.id AS departure_id, d.starts_at
  FROM place_tours pt
  JOIN tour_departures d ON d.thread_id = pt.thread_id
  WHERE d.status <> 'cancelled' AND d.starts_at < NOW()
)
SELECT
  p.id AS place_id,
  p.org_id,
  (SELECT COUNT(*) FROM place_tours pt WHERE pt.place_id = p.id)::int AS tours_count,
  (SELECT COUNT(*) FROM place_tours pt JOIN threads t ON t.id = pt.thread_id
    WHERE pt.place_id = p.id AND t.status = 'published')::int AS published_tours_count,
  (SELECT COUNT(*) FROM runs r WHERE r.place_id = p.id)::int AS runs_count,
  (SELECT COALESCE(SUM(b.party_size), 0) FROM runs r
     JOIN tour_bookings b ON b.departure_id = r.departure_id AND b.status = 'confirmed'
    WHERE r.place_id = p.id)::int AS guests_count,
  (SELECT MAX(r.starts_at) FROM runs r WHERE r.place_id = p.id) AS last_visited_at,
  (SELECT COUNT(DISTINCT s.experience_id) FROM tour_stops s
    WHERE s.place_id = p.id AND s.experience_id IS NOT NULL)::int AS experiences_count
FROM places p;

-- ── backfill: one place per distinct stop title ─────────────────────────────

DO $$
DECLARE
  g record;
  base text;
  candidate text;
  n int;
BEGIN
  FOR g IN
    SELECT DISTINCT ON (s.org_id, lower(trim(s.title)))
           s.org_id, lower(trim(s.title)) AS norm, trim(s.title) AS title, s.body,
           s.lat, s.lng, s.heading, s.pitch, s.fov
    FROM tour_stops s
    WHERE s.place_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM places p WHERE p.org_id = s.org_id AND lower(trim(p.title)) = lower(trim(s.title)))
    ORDER BY s.org_id, lower(trim(s.title)), s.updated_at DESC, s.created_at DESC
  LOOP
    base := trim(both '-' from regexp_replace(
              lower(translate(g.title,
                'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖòóôõöÙÚÛÜùúûüÝýÿŒœÆæ’''',
                'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOoooooUUUUuuuuYyyOoAa  ')),
              '[^a-z0-9]+', '-', 'g'));
    IF base IS NULL OR base = '' THEN base := 'place'; END IF;
    base := left(base, 80);
    candidate := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM places p WHERE p.org_id = g.org_id AND p.slug = candidate) LOOP
      n := n + 1;
      candidate := base || '-' || n;
    END LOOP;
    INSERT INTO places (org_id, slug, title, body, lat, lng, heading, pitch, fov, source)
    VALUES (g.org_id, candidate, g.title, g.body, g.lat, g.lng, g.heading, g.pitch, g.fov, 'stop_backfill');
  END LOOP;
END $$;

UPDATE tour_stops s SET place_id = p.id
FROM (
  SELECT DISTINCT ON (org_id, lower(trim(title))) id, org_id, lower(trim(title)) AS norm
  FROM places WHERE archived_at IS NULL
  ORDER BY org_id, lower(trim(title)), created_at
) p
WHERE s.place_id IS NULL AND p.org_id = s.org_id AND p.norm = lower(trim(s.title));
