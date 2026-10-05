-- ============================================================================
-- 177: Education Hub — Inner/Outer, guides, and the traditions they teach from.
--
-- lms_realms          Which side of the hub an item belongs to: 'inner'
--                     (spiritual teachings) or 'outer' (art and other
--                     classes). One row per sorted item; an item with no row
--                     shows on both sides. item_kind 'course' is lms_courses;
--                     'thread' is a network thread (a workshop or an offering).
--                     Polymorphic on purpose, so no FK: a deleted item leaves
--                     a harmless row that nothing reads.
-- lms_traditions      The traditions guides teach from. Organisers add them.
-- lms_guides          The curated list of guides: an account, plus what the
--                     hub shows about them (bio and photo override the
--                     account's own; realm null = both sides).
-- lms_guide_traditions  Which traditions each guide teaches from.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS lms_realms (
  item_kind  VARCHAR(10) NOT NULL CHECK (item_kind IN ('course', 'thread')),
  item_id    VARCHAR(40) NOT NULL,
  realm      VARCHAR(10) NOT NULL CHECK (realm IN ('inner', 'outer')),
  updated_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (item_kind, item_id)
);

CREATE TABLE IF NOT EXISTS lms_traditions (
  id          VARCHAR(21)  PRIMARY KEY,
  slug        VARCHAR(80)  NOT NULL UNIQUE,
  name        TEXT         NOT NULL,
  description TEXT,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  updated_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lms_guides (
  user_id    UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio        TEXT,
  photo_url  TEXT,
  realm      VARCHAR(10) CHECK (realm IS NULL OR realm IN ('inner', 'outer')),
  is_listed  BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  updated_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lms_guide_traditions (
  user_id      UUID        NOT NULL REFERENCES lms_guides(user_id) ON DELETE CASCADE,
  tradition_id VARCHAR(21) NOT NULL REFERENCES lms_traditions(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, tradition_id)
);

CREATE INDEX IF NOT EXISTS idx_lms_guide_traditions_tradition ON lms_guide_traditions(tradition_id);

COMMIT;
