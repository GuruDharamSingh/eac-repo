-- ============================================================================
-- Migration 058: Artwork favourites (saved pieces / wishlist)
-- ============================================================================
-- Lets a signed-in user "favourite" / save an artwork. One row per
-- (user, artwork); favouriting again is idempotent. Surfaced as a heart on the
-- artwork detail page and a "Saved" list on the account page.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS artwork_favorite (
  user_id     UUID         NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  artwork_id  UUID         NOT NULL REFERENCES artwork(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, artwork_id)
);

-- "My saved pieces", newest first.
CREATE INDEX IF NOT EXISTS idx_artwork_favorite_user
  ON artwork_favorite(user_id, created_at DESC);

-- "How many people saved this piece" + per-artwork lookups.
CREATE INDEX IF NOT EXISTS idx_artwork_favorite_artwork
  ON artwork_favorite(artwork_id);

COMMIT;
