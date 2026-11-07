-- ============================================================================
-- 241: places — operating classification; place_links — web-search source (2026-11-04).
--
--   places.operating        true = an operating business or venue (shop, bakery,
--                           restaurant, café, cabaret, museum, gallery, church with
--                           its own life, theatre ...); false = landmark, street,
--                           square, monument; NULL = not classified yet.
--   places.operating_kind   e.g. bakery | butcher | cheese | wine_shop | shop |
--                           restaurant | cafe | bar | cabaret | museum | gallery |
--                           church | synagogue | theatre | library | market | hotel;
--                           for landmarks: street | square | monument | bridge |
--                           landmark. Written by scripts/classify-places.mts.
--   places.classification   evidence: OSM tags matched, Wikidata instance-of, keywords.
-- Reusable seed for business links later (docs/open/ASSOCIATED_BUSINESSES_2026-11-04.md);
-- no business schema here.
--   place_links.source      + web (a website found by a confirmed web search).
-- ============================================================================

ALTER TABLE places ADD COLUMN IF NOT EXISTS operating boolean;
ALTER TABLE places ADD COLUMN IF NOT EXISTS operating_kind text;
ALTER TABLE places ADD COLUMN IF NOT EXISTS classification jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_places_operating ON places (org_id) WHERE operating;

ALTER TABLE place_links DROP CONSTRAINT IF EXISTS place_links_source_check;
ALTER TABLE place_links ADD CONSTRAINT place_links_source_check CHECK (source IN ('wikidata','osm','manual','web'));
