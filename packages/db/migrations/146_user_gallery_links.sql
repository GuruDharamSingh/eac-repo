-- ============================================================================
-- 146: a person's gallery can be a COLLECTION — tied to a site page, told
-- where it may appear, and given its own storage folder.
--
-- user_galleries (124) began as a picture wall on an IFAC profile. Dana
-- McCool's own site now uses the same rows as its collections (Figurative,
-- Botanical Resin, Medicine Buddha…), whose items may be artworks, and the
-- same person's rows are read by more than one site. `settings` cannot carry
-- any of this — it is sanitised down to CSS custom properties — so:
--
--   page_path   the page on the gallery's home site that shows it
--               (e.g. 'figurative', 'mixed-media/art-objects'). NULL = none.
--   origin      which site made the gallery ('danamccool', 'ifac', …).
--               Lets a site show "galleries made elsewhere" in their own
--               section rather than mixed in with its own.
--   hidden_on   sites that must NOT show it. Empty = everywhere it is read,
--               which is what every existing row already means, so nothing
--               changes for IFAC's galleries. A gallery made on Dana's site
--               starts with '{ifac}' — appearing on IFAC is her choice.
--   folder      its storage folder, relative to the owner's user root
--               (EAC_Network/users/<slug>/), e.g. 'Galleries/figurative'.
--               Uploads into the gallery land there.
--
-- Items gain an optional `artworkId` inside the existing JSONB — no column.
-- ============================================================================

ALTER TABLE user_galleries
  ADD COLUMN IF NOT EXISTS page_path TEXT,
  ADD COLUMN IF NOT EXISTS origin    VARCHAR(50),
  ADD COLUMN IF NOT EXISTS hidden_on TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS folder    TEXT;

-- One gallery per page per person: a page shows "its" gallery unambiguously.
CREATE UNIQUE INDEX IF NOT EXISTS user_galleries_user_page_key
  ON user_galleries (user_id, page_path) WHERE page_path IS NOT NULL;
