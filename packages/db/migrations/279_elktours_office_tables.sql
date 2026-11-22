-- 279: elktours office (2026-11-19). Not applied.
-- Tables behind the hub Office cards (docs/open/ELKTOURS_OFFICE_HUB_2026-11-19.md):
--   guide_availability  a guide's (or host's) free days ahead, for the office
--   place_notes         private notes on a place, one row per author; every owner and guide reads them, credited
--   tour_guide_takes    a guide's own notes on a tour or one of its stops, shown with the runs that guide leads
-- and the Street View spot a place or stop opens at (the panorama the editor walked to), beside the existing
-- heading/pitch/fov.
-- Additive only. Apply alone (263 is pending and must stay so): see the skill new-migration and ops notes.

CREATE TABLE IF NOT EXISTS guide_availability (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day         date NOT NULL,
  -- Parts of the day free; empty array = the whole day.
  parts       text[] NOT NULL DEFAULT '{}',
  -- What the person offers that day: 'guide' and/or 'experience'.
  offers      text[] NOT NULL DEFAULT '{guide}',
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id, day)
);
CREATE INDEX IF NOT EXISTS idx_guide_availability_org_day ON guide_availability (org_id, day);

CREATE TABLE IF NOT EXISTS place_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  place_id    uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  -- Sanitised HTML. Never public.
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_place_notes_place ON place_notes (place_id, created_at);

CREATE TABLE IF NOT EXISTS tour_guide_takes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_id      varchar(21) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  -- NULL = a take on the tour as a whole.
  stop_id        uuid REFERENCES tour_stops(id) ON DELETE CASCADE,
  guide_user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Sanitised HTML, public with that guide's runs.
  body           text,
  media_url      text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (thread_id, stop_id, guide_user_id)
);
CREATE INDEX IF NOT EXISTS idx_tour_guide_takes_thread ON tour_guide_takes (thread_id);

ALTER TABLE places     ADD COLUMN IF NOT EXISTS view_lat double precision;
ALTER TABLE places     ADD COLUMN IF NOT EXISTS view_lng double precision;
ALTER TABLE tour_stops ADD COLUMN IF NOT EXISTS view_lat double precision;
ALTER TABLE tour_stops ADD COLUMN IF NOT EXISTS view_lng double precision;
