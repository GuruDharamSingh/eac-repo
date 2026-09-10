-- ============================================================================
-- Migration 115: fold workshop_details into workshop_pages, then drop it
-- ============================================================================
-- Two sidecar tables grew up beside threads.kind='workshop':
--
--   workshop_details  the first one (inner-gathering, mid-2026): pricing as
--                     a JSON blob, capacity, materials/prerequisites text.
--   workshop_pages    the one everything reads now: @elkdonis/services'
--                     workshop-offerings, the Silex workshop template's
--                     bindings, innergathering's WorkshopView, arts-collective.
--
-- inner-gathering itself stopped writing workshop_details ("legacy duplicate
-- table, no longer written" — its api/content/route.ts) but never moved the
-- rows over, so the org's only PUBLISHED workshop, "Creative Writing:
-- Exquisite Corpse", had its price on the dead table and rendered on the new
-- app with nothing but two chips. Verified before writing this.
--
-- What moves: every workshop thread without a workshop_pages row gets one,
-- carrying subtitle, cover image, the price out of the pricing blob (into
-- BOTH threads.price and workshop_pages.price_member, the same double-write
-- upsertWorkshopOffering does so every reader agrees), capacity into
-- threads.attendee_limit, and the free-text logistics (materials, what to
-- bring, prerequisites) into author_note where the page shows them.
-- ============================================================================

BEGIN;

-- 1. A workshop_pages row for every workshop thread that lacks one.
INSERT INTO workshop_pages (thread_id, subtitle, cover_image_url, price_member, author_note)
SELECT
  t.id,
  NULLIF(wd.subtitle, ''),
  NULLIF(wd.cover_image_url, ''),
  CASE
    WHEN jsonb_typeof(wd.pricing -> 'amount') = 'number' THEN (wd.pricing ->> 'amount')::numeric
    ELSE NULL
  END,
  NULLIF(
    concat_ws(E'\n\n',
      CASE WHEN NULLIF(wd.materials, '')     IS NOT NULL THEN 'Materials: '     || wd.materials     END,
      CASE WHEN NULLIF(wd.what_to_bring, '') IS NOT NULL THEN 'What to bring: ' || wd.what_to_bring END,
      CASE WHEN NULLIF(wd.prerequisites, '') IS NOT NULL THEN 'Prerequisites: ' || wd.prerequisites END
    ),
    ''
  )
FROM threads t
LEFT JOIN workshop_details wd ON wd.thread_id = t.id
LEFT JOIN workshop_pages   wp ON wp.thread_id = t.id
WHERE t.kind = 'workshop'
  AND wp.thread_id IS NULL;

-- 2. Price and capacity live on threads for every other reader.
UPDATE threads t
SET
  price = COALESCE(t.price,
    CASE WHEN jsonb_typeof(wd.pricing -> 'amount') = 'number'
         THEN (wd.pricing ->> 'amount')::numeric END),
  currency = COALESCE(NULLIF(wd.pricing ->> 'currency', ''), t.currency),
  attendee_limit = COALESCE(t.attendee_limit, wd.capacity),
  updated_at = NOW()
FROM workshop_details wd
WHERE wd.thread_id = t.id
  AND t.kind = 'workshop';

-- 3. Nothing reads it any more.
DROP TABLE workshop_details;

COMMIT;
