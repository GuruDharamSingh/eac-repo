-- ============================================================================
-- Migration 213: Installations — a collection hung in the 3D hallway
-- ============================================================================
-- A store curates an installation by dragging its works onto the hallway
-- walls (art-auction /studio/installations). Each hung work records which
-- wall face it is on, where along it, its height and its frame style; the
-- route through the hall turns those into a walking order, saved as
-- `sequence`, which is the collection's established order.
--
-- `hallway` names the corridor design the coordinates belong to
-- (@elkdonis/three/hallway). Placements only mean something in that design,
-- so a future route gets a new name rather than reinterpreting old rows.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS art_installation (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID         NOT NULL REFERENCES store(id) ON DELETE CASCADE,
  title         TEXT         NOT NULL CHECK (char_length(title) BETWEEN 1 AND 140),
  hallway       TEXT         NOT NULL DEFAULT 'northwest',
  status        TEXT         NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_by    UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  published_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_art_installation_store
  ON art_installation(store_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS art_installation_piece (
  installation_id  UUID     NOT NULL REFERENCES art_installation(id) ON DELETE CASCADE,
  artwork_id       UUID     NOT NULL REFERENCES artwork(id) ON DELETE CASCADE,
  -- Wall face id from the hallway design: L1…L6, R1…R6, start, end.
  wall_id          TEXT     NOT NULL,
  -- Metres along the face from its centre, and world height of the centre.
  offset_x         REAL     NOT NULL,
  centre_y         REAL     NOT NULL,
  -- Frame style id; NULL is the default frame.
  frame_style      TEXT,
  -- 1-based walking order, derived from position on every save.
  sequence         INTEGER  NOT NULL,
  PRIMARY KEY (installation_id, artwork_id)
);

CREATE INDEX IF NOT EXISTS idx_art_installation_piece_order
  ON art_installation_piece(installation_id, sequence);

COMMIT;
