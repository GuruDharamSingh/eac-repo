-- ============================================================================
-- Migration 070: Workshop hero text + page background color
-- ============================================================================
-- Two small additions to workshop_pages, folded in as the "Edit page" drawer
-- (workshop-owner-editor.tsx) is merged into the main workshop creation form:
--
--   hero_text        — headline overlaid on the hero media slot (added
--                       alongside banner/hero/cover in migration 068).
--   background_color — the workshop detail page's own page-background color.
--                       workshop-page.tsx previously read a CSS var
--                       (--eac-bg) that was never defined anywhere, so every
--                       workshop silently fell back to the same hardcoded
--                       beige. This makes it a real, author-editable field.
-- ============================================================================

ALTER TABLE workshop_pages
  ADD COLUMN IF NOT EXISTS hero_text        TEXT,
  ADD COLUMN IF NOT EXISTS background_color VARCHAR(7);
