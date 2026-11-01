-- ============================================================================
-- 208: Elkdonis Tour and Experiences (org `elktours`) and the `tour` kind.
--
-- A tour company in Paris, run by Dana McCool, on its own app (apps/elktours,
-- port 3021). A tour is a thread (`kind = 'tour'`, filed in the org's `tours`
-- feed) carrying the price per person (threads.price / currency), the length
-- (duration_minutes) and the meeting point (location). What a thread cannot
-- hold lives here:
--
--   tour_stops       the places a tour visits, in order, with a map position
--                    and a Street View pose (heading/pitch/fov) for the
--                    dynamic presentation of each place
--   tour_departures  dated runs of a tour with a capacity and a guide
--   tour_bookings    one row per card order for a departure: party size and
--                    the buyer; `confirmed` only when the order is paid
--                    (packages/commerce/src/server/tours.ts)
--
-- Seats taken on a departure = SUM(party_size) over confirmed bookings plus
-- unpaid ones still inside Stripe's checkout window; the query lives in code.
--
-- `tour` is added to OFF_FEED_KINDS (tours are listed by the tour pages, not
-- the forum or search) and to PURCHASABLE_THREAD_KINDS in commerce.
-- ============================================================================

INSERT INTO organizations (id, name, slug, description, subdomain_confirmed, confirmed_at)
VALUES ('elktours', 'Elkdonis Tour and Experiences', 'elktours',
        'Guided walks and experiences in Paris.', TRUE, now())
ON CONFLICT (id) DO NOTHING;

-- Dana owns the company; the developer holds owner for setup.
INSERT INTO user_organizations (user_id, org_id, role)
SELECT u.id, 'elktours', 'owner'
FROM users u
WHERE lower(u.email) IN ('danamccoolart@gmail.com', 'justin.gillisb@gmail.com')
ON CONFLICT (user_id, org_id) DO UPDATE SET role = 'owner';

INSERT INTO org_feeds (org_id, slug, name, tagline, is_public, sort_order)
VALUES
  ('elktours', 'tours',   'Tours',   'Guided walks and experiences', TRUE,  1),
  ('elktours', 'journal', 'Journal', 'Notes from the road',          TRUE,  2),
  ('elktours', 'general', 'General', NULL,                           FALSE, 999)
ON CONFLICT (org_id, slug) DO NOTHING;

-- ── stops ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tour_stops (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id        varchar(21) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  org_id           varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  position         integer NOT NULL DEFAULT 0,
  title            text NOT NULL,
  -- Sanitised HTML (sanitizeRichText), like threads.body.
  body             text,
  lat              double precision,
  lng              double precision,
  -- Street View pose at this stop: compass heading 0-360, pitch -90..90, field of view 10..100.
  heading          numeric(5,1),
  pitch            numeric(4,1),
  fov              numeric(4,1),
  image_url        text,
  duration_minutes integer,
  created_at       timestamptz NOT NULL DEFAULT NOW(),
  updated_at       timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT tour_stops_latlng_pair CHECK ((lat IS NULL) = (lng IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_tour_stops_thread ON tour_stops (thread_id, position);

-- ── departures ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tour_departures (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id      varchar(21) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  org_id         varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  starts_at      timestamptz NOT NULL,
  capacity       integer NOT NULL CHECK (capacity > 0),
  -- The guide leading this run. NULL means the tour's author.
  guide_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  status         text NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled', 'cancelled')),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT NOW(),
  updated_at     timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_departures_thread ON tour_departures (thread_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_tour_departures_org_time ON tour_departures (org_id, starts_at);

-- ── bookings ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tour_bookings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL UNIQUE REFERENCES commerce_order(id) ON DELETE CASCADE,
  departure_id   uuid NOT NULL REFERENCES tour_departures(id) ON DELETE RESTRICT,
  thread_id      varchar(21) NOT NULL REFERENCES threads(id),
  org_id         varchar(50) NOT NULL REFERENCES organizations(id),
  buyer_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  buyer_email    text NOT NULL,
  buyer_name     text,
  party_size     integer NOT NULL CHECK (party_size > 0),
  status         text NOT NULL DEFAULT 'awaiting_payment'
                 CHECK (status IN ('awaiting_payment', 'confirmed', 'cancelled')),
  note           text,
  -- The buyer's private link (/bookings/<token>); needs no account.
  buyer_token    text NOT NULL UNIQUE,
  created_at     timestamptz NOT NULL DEFAULT NOW(),
  updated_at     timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_bookings_departure ON tour_bookings (departure_id, status);
CREATE INDEX IF NOT EXISTS idx_tour_bookings_org ON tour_bookings (org_id, created_at DESC);
