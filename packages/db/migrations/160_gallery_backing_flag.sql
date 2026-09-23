-- ============================================================================
-- 159: user_galleries.is_backing — a gallery that exists ONLY to be opened
--      from a block, never to be listed, browsed or managed on its own.
--
-- Migration 158 made 12 such rows for Dana's IFAC store panel — 1 holding
-- the panel's 36-tile listing, 11 holding "other shots of this piece" for
-- gallery-grid's nesting — and set them `is_public = FALSE` on the theory
-- that `is_public` governs visibility. It does not govern MANAGEABILITY:
-- `onlyPublic` is only applied when the viewer is NOT the gallery's editor
-- (`listUserGalleries(userId, { onlyPublic: !editable })`), so on the
-- owner's OWN page, editing their OWN site, all 12 appeared as ordinary
-- galleries in the general "Galleries" section, with "add new gallery" and
-- full drag/reorder editing — because to that screen they WERE ordinary
-- galleries. One was even auto-saved through that path within hours (a
-- normal open-and-close in the gallery HUD, harmless, but proof the surface
-- was reachable). `is_public` was the wrong tool for "does not exist as its
-- own object" — this column says that directly, and `listUserGalleries`
-- (services/galleries.ts) excludes it UNCONDITIONALLY, public or not.
--
-- Direct id lookups are unaffected: gallery-grid's own resolvers
-- (loadGalleryGridData, loadNestedGalleries) never call listUserGalleries —
-- they read a specific gallery by id, which is the only way a backing
-- gallery should ever be reached.
-- ============================================================================

ALTER TABLE user_galleries
  ADD COLUMN IF NOT EXISTS is_backing BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN user_galleries.is_backing IS
  'True for a gallery that exists only to be opened from a block (gallery-grid nesting, a store panel) — excluded from every listUserGalleries call regardless of is_public.';

UPDATE user_galleries
  SET is_backing = TRUE
  WHERE user_id = '4eebc495-1db6-4b1e-a5b3-399326c78fe6'
    AND origin = 'ifac'
    AND slug LIKE 'ifac-store%';

-- Backfill any cover still missing (some rows already picked one up from a
-- normal open in the gallery editor before this migration existed — COALESCE
-- keeps those, rather than overwriting a value that is already correct).
UPDATE user_galleries
  SET cover_url = COALESCE(cover_url, items->0->>'url')
  WHERE user_id = '4eebc495-1db6-4b1e-a5b3-399326c78fe6'
    AND origin = 'ifac'
    AND slug LIKE 'ifac-store%'
    AND cover_url IS NULL
    AND jsonb_array_length(items) > 0;
