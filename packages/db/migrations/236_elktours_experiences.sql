-- ============================================================================
-- 236: elktours experiences + service commissions (2026-11-02).
--
--   An experience is a thread: kind = 'experience', org elktours, filed in
--   the new public `experiences` feed. Event-shaped thread columns hold the
--   facts (title, body, excerpt, location, is_online, duration_minutes,
--   price/currency for display only); metadata.experience = {format,
--   serviceThreadId?, highlights?, lat?, lng?}; metadata.page = optional Puck
--   Data. `experience` is in OFF_FEED_KINDS (packages/services), so it stays
--   off the forum, feeds and search. Phase A is inquiry-only (no checkout).
--
--   experience_people    artists and hosts linked to an experience (linked,
--                        not copied: name/avatar come from users).
--   service_commissions  an org books an artist's public service listing at
--                        the listed price. NO MONEY PATH: payment_status is
--                        pinned to 'stub' by a CHECK until the payment model
--                        is decided (spec Q1); payment_ref is reserved.
--
-- Spec: docs/open/ELKTOURS_EXPERIENCES_SPEC_2026-11-02.md §1.4, §1.5.
-- ============================================================================

INSERT INTO org_feeds (org_id, slug, name, tagline, is_public, sort_order)
VALUES ('elktours', 'experiences', 'Experiences', 'Artists and makers to meet in Paris', TRUE, 2)
ON CONFLICT (org_id, slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS experience_people (
  thread_id   varchar(21) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('artist','host')),
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_experience_people_user ON experience_people (user_id);

CREATE TABLE IF NOT EXISTS service_commissions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_thread_id    varchar(21) NOT NULL REFERENCES threads(id) ON DELETE RESTRICT,
  seller_user_id       uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  buyer_org_id         varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  experience_thread_id varchar(21) REFERENCES threads(id) ON DELETE SET NULL,
  tour_thread_id       varchar(21) REFERENCES threads(id) ON DELETE SET NULL,
  departure_id         uuid REFERENCES tour_departures(id) ON DELETE SET NULL,
  unit                 text NOT NULL CHECK (unit IN ('per_run','per_guest','flat')),
  quantity             integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  -- Snapshot of the listed price at proposal.
  price_cents          integer,
  currency             text,
  terms_snapshot       text,
  status               text NOT NULL DEFAULT 'proposed'
                       CHECK (status IN ('proposed','accepted','declined','cancelled','completed')),
  -- NO MONEY PATH in Phase A (spec Q1).
  payment_status       text NOT NULL DEFAULT 'stub' CHECK (payment_status = 'stub'),
  payment_ref          text,
  created_at           timestamptz NOT NULL DEFAULT NOW(),
  updated_at           timestamptz NOT NULL DEFAULT NOW(),
  responded_at         timestamptz
);
CREATE INDEX IF NOT EXISTS idx_service_commissions_buyer ON service_commissions (buyer_org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_commissions_seller ON service_commissions (seller_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_commissions_experience ON service_commissions (experience_thread_id)
  WHERE experience_thread_id IS NOT NULL;
