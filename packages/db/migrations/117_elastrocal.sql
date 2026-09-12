-- ============================================================================
-- 117: Elastrocal — natal charts (apps/elastrocal, port 3016)
--
-- Ported from the standalone astrologychart2 prototype (Express + Prisma, its
-- own users table and JWT auth). What came across and what didn't:
--
--   (a) Identity is the shared `users` table and GoTrue. The prototype's own
--       users/passwordHash are not migrated.
--   (b) One table, not the prototype's 17. A chart is fully determined by its
--       birth data and settings, so that is what is stored; the computed
--       positions are a CACHE (`computed`, tagged with the engine version that
--       produced it) and can be regenerated at any time. The prototype's
--       planet_positions / house_cusps rows and the dignitary / Rosicrucian
--       analysis tables backed features that were mocked or unbuilt; they come
--       back only with working code behind them.
--   (c) Prefixed astro_*, in public, like pigeon_* (077). No separate schema:
--       nothing else in the monorepo uses one and the migration runner, the
--       db client and CLAUDE.md all assume public.
--   (d) Charts are private to their owner. Publishing a chart or reading is a
--       later step (likely a thread kind referencing astro_charts.id), not a
--       flag here.
-- ============================================================================

BEGIN;

INSERT INTO organizations (id, name, slug, description, tier) VALUES
  ('elastrocal', 'Elastrocal', 'elastrocal',
   'Natal charts calculated with the Swiss Ephemeris.',
   'free')
ON CONFLICT (id) DO NOTHING;

-- Owners, by email, the 080 way: a no-op if either account doesn't exist yet.
INSERT INTO user_organizations (user_id, org_id, role)
SELECT u.id, 'elastrocal', 'owner'
FROM users u
WHERE lower(u.email) IN ('justin.gillisb@gmail.com', 'gurudharamsingh@gmail.com')
ON CONFLICT (user_id, org_id) DO UPDATE SET role = 'owner';

CREATE TABLE IF NOT EXISTS astro_charts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           VARCHAR(50) NOT NULL DEFAULT 'elastrocal'
                     REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name             VARCHAR(200) NOT NULL,

  -- Birth data as entered: LOCAL civil date/time at the birthplace plus the
  -- zone, never a pre-converted UTC instant, so a tz-database correction or a
  -- fixed conversion bug is picked up by recomputing.
  birth_date       DATE NOT NULL,
  birth_time       TIME NOT NULL,
  timezone         VARCHAR(64) NOT NULL,
  location_name    VARCHAR(300),
  latitude         DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude        DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  house_system     CHAR(1) NOT NULL DEFAULT 'P'
                     CHECK (house_system IN ('P','K','O','R','C','E','W','M','T','B')),

  is_favorite      BOOLEAN NOT NULL DEFAULT false,
  notes            TEXT,

  -- Cache of @elkdonis/astro's ChartResult. Recomputed when computed_version
  -- differs from the engine's ENGINE_VERSION.
  computed         JSONB,
  computed_version VARCHAR(20),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_astro_charts_owner
  ON astro_charts (owner_id, is_favorite DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_astro_charts_org ON astro_charts (org_id);

COMMENT ON TABLE astro_charts IS
  'Elastrocal natal charts. Birth data is the source of truth; computed is a regenerable cache.';

COMMIT;
