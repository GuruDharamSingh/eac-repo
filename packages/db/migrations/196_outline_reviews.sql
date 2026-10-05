-- 196 — book outlines reviewed by the owner (Jerusalem app, Outline mode). 2026-10-04.
--
-- astro_book_outlines.sections is the AI's first look (headings + snippets) and
-- is replaced on every outline re-import. The owner's corrected outline lives
-- beside it and is never touched by an import:
--   reviewed_sections  the outline as he confirmed it: [{from, to, title, chapter, role, subject_type, subjects, note?, voice?}]
--                      role: description | introduction | examples | logic | combinations | reference | front_back | other
--   reviewed_shape     "how this book goes", in his words
--   review_status      draft (saved, not finished) | confirmed
-- Each save is also logged in astro_reviews (action 'outline-review') so the
-- history is kept. The re-chunk and re-embed on the PC read confirmed outlines.

BEGIN;

ALTER TABLE astro_book_outlines ADD COLUMN IF NOT EXISTS reviewed_sections JSONB;
ALTER TABLE astro_book_outlines ADD COLUMN IF NOT EXISTS reviewed_shape TEXT;
ALTER TABLE astro_book_outlines ADD COLUMN IF NOT EXISTS review_status TEXT;
ALTER TABLE astro_book_outlines ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE astro_book_outlines ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

COMMIT;
