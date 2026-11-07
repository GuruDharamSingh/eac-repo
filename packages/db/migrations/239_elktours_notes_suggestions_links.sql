-- ============================================================================
-- 239: elktours stop notes, visitor suggestions, place links (2026-11-02).
--
--   tour_stops.excerpt     one or two public lines for the tour popup. Written by
--                          lib/stop-note-actions.ts (only this column); saveTourStops
--                          leaves it alone (its UPDATE lists columns explicitly).
--   tour_stop_notes        private editor notes on a stop "from the event": author,
--                          time, optionally the departure (run) or a date they came
--                          from. Never public. A note can be promoted into the excerpt.
--   visitor_suggestions    signed-in followers suggest a spot (pin/photo + title + why)
--                          or a route (ordered catalogue places and/or spots + title +
--                          note + walking preview). Pending until an editor accepts
--                          (spot -> place, route -> draft tour) or rejects.
--   places.suggested_by    credit for an accepted spot (tours carry
--                          metadata.suggestedBy).
--   place_links            outbound links per place with their source (wikidata | osm):
--                          Wikipedia en/fr, official website, Wikidata, OSM. Only
--                          confident = true rows are shown; the rest wait for review.
-- ============================================================================

ALTER TABLE tour_stops ADD COLUMN IF NOT EXISTS excerpt text;

CREATE TABLE IF NOT EXISTS tour_stop_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stop_id       uuid NOT NULL REFERENCES tour_stops(id) ON DELETE CASCADE,
  thread_id     varchar(21) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  departure_id  uuid REFERENCES tour_departures(id) ON DELETE SET NULL,
  run_date      date,
  body          text NOT NULL CHECK (length(trim(body)) > 0),
  author_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  promoted_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tour_stop_notes_stop ON tour_stop_notes (stop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tour_stop_notes_thread ON tour_stop_notes (thread_id);

CREATE TABLE IF NOT EXISTS visitor_suggestions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind             text NOT NULL CHECK (kind IN ('spot','route')),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            text NOT NULL,
  -- "why" for a spot, the note for a route. Plain text.
  note             text,
  -- spot
  lat              double precision,
  lng              double precision,
  address          text,
  photo_asset_id   uuid REFERENCES tour_assets(id) ON DELETE SET NULL,
  -- route: {items: [{placeId} | {spotId} | {lat,lng,title}], preview: {legs, source, km}}
  payload          jsonb NOT NULL DEFAULT '{}'::jsonb,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','withdrawn')),
  result_place_id  uuid REFERENCES places(id) ON DELETE SET NULL,
  result_thread_id varchar(21) REFERENCES threads(id) ON DELETE SET NULL,
  reviewed_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  reject_reason    text,
  created_at       timestamptz NOT NULL DEFAULT NOW(),
  updated_at       timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT visitor_suggestions_spot_point CHECK (kind <> 'spot' OR (lat IS NOT NULL AND lng IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_visitor_suggestions_queue ON visitor_suggestions (org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_suggestions_user_day ON visitor_suggestions (user_id, created_at DESC);

ALTER TABLE places ADD COLUMN IF NOT EXISTS suggested_by uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS place_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id    uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('wikipedia_en','wikipedia_fr','website','wikidata','osm')),
  url         text NOT NULL CHECK (url ~ '^https://'),
  source      text NOT NULL CHECK (source IN ('wikidata','osm','manual')),
  -- e.g. 'wikidata:Q12345', 'osm:way/123'
  source_ref  text,
  confident   boolean NOT NULL DEFAULT true,
  -- match evidence: name similarity, distance in metres, label
  evidence    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT place_links_one UNIQUE (place_id, kind, source)
);
CREATE INDEX IF NOT EXISTS idx_place_links_place ON place_links (place_id) WHERE confident;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tour_stop_notes','visitor_suggestions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I FOR ALL TO eac_tenant
      USING (org_id::text = app_org_id()) WITH CHECK (org_id::text = app_org_id())', t);
  END LOOP;
END $$;
