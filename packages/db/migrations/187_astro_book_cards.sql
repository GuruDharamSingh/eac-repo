-- 187: book cards on the outlines. 2026-10-02.
-- ============================================================================
-- A short description of each outlined book for the Library's Books pages
-- ($CORPUS_DIR/foundations/cards/<file>.json, imported by
-- packages/astro-corpus/scripts/import-foundations.ts, matched by outline slug):
--   card  {title, author, tradition, type, shape, kinds{}, basics{glossary,
--          keyword_lists, fact_sheets, elements, modes, signs, planets, houses,
--          aspects, planet_in_sign, planet_in_house, planet_aspects,
--          ascendant_signs: [{from, to, what}]}, alsoHas[], textQuality,
--          quality, priority, duplicateOf, passages, sections}
-- The outline import leaves this column alone.
-- ============================================================================

BEGIN;

ALTER TABLE astro_book_outlines ADD COLUMN IF NOT EXISTS card JSONB;

COMMIT;
