-- ============================================================================
-- 158: Dana McCool joins IFAC's roster as a real member, and gets a premade,
--      published store panel there — the first one on the network.
--
-- Three things, in order:
--
-- (a) `user_organizations` — she already had a public `org_profiles` row on
--     IFAC (an "Artist" roster entry, sort_order 3) with NO membership row
--     behind it; the roster and the account were disconnected. One row, role
--     'member', connects them. The `org_profiles_show_new_members` trigger
--     fires on this insert and re-confirms her roster entry public, which is
--     a no-op here (it already was) and harmless either way.
--
-- (b) `organizations.member_store_panels` for IFAC → TRUE. Migration 157
--     defaulted this off deliberately (a panel is a section of the org's OWN
--     layout, opt-in); Eric Brummel — IFAC's owner — is the one who would
--     flip this from the new toggle at /manage/submissions, so this row does
--     what that click would do.
--
-- (c) Her store panel's CONTENT: one `user_galleries` row per piece of hers
--     with more than one photograph (real data — 11 of her 36 available
--     pieces), holding every shot of that piece, plus ONE main gallery
--     listing all 36 with `opens` set on the 11 that have a nested gallery
--     behind them. A `user_pages` row (org_id='ifac', key='store:1') points
--     one gallery-grid block at the main gallery and is inserted PUBLISHED —
--     an explicit exception to "every submission is reviewed" (user-pages.ts):
--     this one did not arrive through the editor, it is being placed
--     directly by the person setting the two toggles above in the same
--     breath, which is what a moderator publishing on someone's behalf
--     already means elsewhere in this schema.
--
-- captions default to "hover" — gallery-grid's own default, stated explicitly
-- here anyway since it is the whole point: "IFAC's cards" read as a caption
-- that rises over the tile on hover, never sitting under it.
-- ============================================================================

-- (a) Membership, connected to the existing roster entry.
INSERT INTO user_organizations (user_id, org_id, role, joined_at)
VALUES ('4eebc495-1db6-4b1e-a5b3-399326c78fe6', 'ifac', 'member', now())
ON CONFLICT (user_id, org_id) DO UPDATE SET role = EXCLUDED.role;

-- (b) IFAC hosts designed panels.
UPDATE organizations SET member_store_panels = TRUE WHERE id = 'ifac';

-- (c) The panel itself.
DO $$
DECLARE
  dana_id  UUID := '4eebc495-1db6-4b1e-a5b3-399326c78fe6';
  art      RECORD;
  shots    RECORD;
  nested_id   TEXT;
  main_id     TEXT;
  main_items  JSONB := '[]'::jsonb;
  nested_items JSONB;
  shot_count  INT;
BEGIN
  -- One id for the main gallery, reused if this migration is ever re-run.
  SELECT id INTO main_id FROM user_galleries
    WHERE user_id = dana_id AND slug = 'ifac-store';
  IF main_id IS NULL THEN
    main_id := 'g' || substr(md5(random()::text || clock_timestamp()::text), 1, 20);
  END IF;

  FOR art IN
    SELECT a.id, a.slug, a.title, pm.url AS hero_url
    FROM artwork a
    LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
    WHERE a.artist_user_id = dana_id AND a.status = 'available' AND pm.url IS NOT NULL
    ORDER BY a.year_created DESC NULLS LAST, a.title
  LOOP
    SELECT count(*) INTO shot_count FROM artwork_media WHERE artwork_id = art.id;

    nested_id := NULL;
    IF shot_count > 1 THEN
      -- Reuse this piece's nested gallery id if the migration re-runs.
      SELECT id INTO nested_id FROM user_galleries
        WHERE user_id = dana_id AND slug = 'ifac-store-' || art.slug;
      IF nested_id IS NULL THEN
        nested_id := 'g' || substr(md5(random()::text || clock_timestamp()::text || art.id::text), 1, 20);
      END IF;

      -- Every shot of this one piece, in stored position order, all bound to
      -- the same artwork id so a live retitle updates every shot's caption.
      SELECT jsonb_agg(jsonb_build_object(
               'id', m.id::text,
               'url', m.url,
               'title', art.title,
               'artworkId', art.id::text
             ) ORDER BY m.position)
        INTO nested_items
        FROM artwork_media m WHERE m.artwork_id = art.id;

      -- is_public FALSE: this exists only to be OPENED from a tile in the
      -- main gallery-grid (loadNestedGalleries reads it by id regardless of
      -- is_public). Public, it would also appear as its own card in every
      -- general gallery listing — "Tangerine" sitting beside "Available
      -- Work" as if it were a second collection.
      INSERT INTO user_galleries (id, user_id, slug, title, items, origin, is_public, hidden_on, created_at, updated_at)
      VALUES (nested_id, dana_id, 'ifac-store-' || art.slug, art.title, nested_items, 'ifac', FALSE, '{}', now(), now())
      ON CONFLICT (id) DO UPDATE SET items = EXCLUDED.items, updated_at = now();
    END IF;

    main_items := main_items || jsonb_build_array(
      jsonb_build_object(
        'id', art.id::text,
        'url', art.hero_url,
        'title', art.title,
        'artworkId', art.id::text
      ) || CASE WHEN nested_id IS NOT NULL THEN jsonb_build_object('opens', nested_id) ELSE '{}'::jsonb END
    );
  END LOOP;

  -- Also FALSE, for the same reason: gallery-grid (and loadGalleryGridData
  -- behind it) reads a gallery by ID and never checks is_public — "a page
  -- that shows a gallery IS the public surface" — so the store panel renders
  -- this gallery regardless. Public here would additionally list "Available
  -- Work" as its own card in GalleriesSection, next to the panel showing the
  -- same 36 pieces already.
  INSERT INTO user_galleries (id, user_id, slug, title, items, origin, is_public, hidden_on, created_at, updated_at)
  VALUES (main_id, dana_id, 'ifac-store', 'Available Work', main_items, 'ifac', FALSE, '{}', now(), now())
  ON CONFLICT (id) DO UPDATE SET items = EXCLUDED.items, updated_at = now();

  INSERT INTO user_pages (user_id, org_id, key, data, status, reviewed_by, reviewed_at, created_at, updated_at)
  VALUES (
    dana_id, 'ifac', 'store:1',
    jsonb_build_object(
      'root', jsonb_build_object('props', jsonb_build_object('title', 'Store')),
      'content', jsonb_build_array(
        jsonb_build_object(
          'type', 'gallery-grid',
          'props', jsonb_build_object(
            'id', 'dana-ifac-store-grid',
            'gallery', main_id,
            'heading', '',
            'perRow', '4',
            'gap', '6',
            'captions', 'hover'
          )
        )
      )
    ),
    -- reviewed_by/reviewed_at stay NULL: this did not pass through the
    -- normal review flow, it was placed directly.
    'published', NULL, NULL, now(), now()
  )
  ON CONFLICT (user_id, org_id, key) DO UPDATE
    SET data = EXCLUDED.data, status = 'published', updated_at = now();
END $$;
