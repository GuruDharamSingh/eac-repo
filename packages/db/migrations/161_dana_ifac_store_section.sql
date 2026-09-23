-- ============================================================================
-- 161: Dana's IFAC panel gets an actual STORE section — separate from the
--      gallery.
--
-- Migration 158 put the resizable gallery-grid (all 36 pieces, 11 nested
-- "other shots" mini-galleries) at key `store:1` — the page IFAC's artist
-- route renders. That is a GALLERY: a wall of work, not what a visitor
-- reads as "here is what you can buy". Feedback after seeing it live: a
-- store panel needs to look like a store — a handful of pieces with prices,
-- product cards — and the full gallery is a second, larger thing, not the
-- front door.
--
-- So the two keys swap roles:
--
--   store:1   the STORE — `profile-store`, six pieces with prices, exactly
--             the ProductCard/ProductGrid StoreShowcase already renders
--             everywhere else on the network (Eric Brummel's own dealer
--             page, art-auction itself). This is what IFAC's artist route
--             shows by default, because it only reads store:1.
--   store:2   the GALLERY — the gallery-grid document store:1 used to hold,
--             moved here verbatim. Still published, still reachable through
--             the editor's own Pages tab (?page=2) and by anyone who knows
--             to look — IFAC's artist route does not yet render a second
--             page automatically, which is a real gap, not a design choice;
--             see the session notes.
--
-- `limit: 6` on profile-store, matching what was asked for: "just list six,
-- any six of her listed items" — no curation logic, the six
-- loadProfileStore would already choose (newest-first, per
-- getStoreShowcaseForUser's own ordering).
-- ============================================================================

DO $$
DECLARE
  dana_id UUID := '4eebc495-1db6-4b1e-a5b3-399326c78fe6';
  gallery_page JSONB;
BEGIN
  SELECT data INTO gallery_page FROM user_pages
    WHERE user_id = dana_id AND org_id = 'ifac' AND key = 'store:1';

  IF gallery_page IS NOT NULL THEN
    INSERT INTO user_pages (user_id, org_id, key, data, status, created_at, updated_at)
    VALUES (dana_id, 'ifac', 'store:2', gallery_page, 'published', now(), now())
    ON CONFLICT (user_id, org_id, key) DO UPDATE
      SET data = EXCLUDED.data, status = 'published', updated_at = now();
  END IF;

  INSERT INTO user_pages (user_id, org_id, key, data, status, reviewed_by, reviewed_at, created_at, updated_at)
  VALUES (
    dana_id, 'ifac', 'store:1',
    jsonb_build_object(
      'root', jsonb_build_object('props', jsonb_build_object('title', 'Store')),
      'content', jsonb_build_array(
        jsonb_build_object(
          'type', 'profile-store',
          'props', jsonb_build_object(
            'id', 'dana-ifac-store-cards',
            'heading', 'Store',
            'blurb', '',
            'density', 'normal',
            'limit', 6
          )
        )
      )
    ),
    'published', NULL, NULL, now(), now()
  )
  ON CONFLICT (user_id, org_id, key) DO UPDATE
    SET data = EXCLUDED.data, status = 'published', updated_at = now();
END $$;
