-- ============================================================================
-- Migration 214: Installation pieces carry a size scale (2026-10-29)
-- ============================================================================
-- The hallway editor gains corner handles to resize a hung work. `scale` is
-- a multiplier on the piece's base size (its recorded cm, or the nominal
-- 1.1 m when none is recorded); 1 is the size every piece had before this
-- migration. Bounded so a typo cannot make a wall-sized frame.
-- docs/open/LOFT_SCENE_EDITOR_BRIEF_2026-10-29.md, phase 1.
-- ============================================================================

ALTER TABLE art_installation_piece
  ADD COLUMN IF NOT EXISTS scale REAL NOT NULL DEFAULT 1
  CHECK (scale > 0 AND scale <= 5);
