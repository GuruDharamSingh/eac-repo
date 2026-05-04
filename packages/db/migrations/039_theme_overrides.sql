-- Add theme_overrides JSONB column to workshop_pages.
-- Stores CSS custom property overrides keyed by var name, e.g.:
--   { "--eac-ws-hero-bg": "#1a0f40", "--eac-ws-hero-accent-rgb": "180, 60, 80" }
-- Applied as a <style> tag injected by the server on workshop page render.

ALTER TABLE workshop_pages
  ADD COLUMN IF NOT EXISTS theme_overrides JSONB NOT NULL DEFAULT '{}';
