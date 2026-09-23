-- ============================================================================
-- 151: fix the `writing` feed accent on `sunjay` — it failed contrast.
--
-- Migration 150 seeded `#a8763e` before the site's palette had been measured.
-- A feed accent is not decoration: it is applied as a FILL with a label on it
-- (the feed badge, the section banner, the kind mark on a hub face), so it has
-- to carry text at 4.5:1 or better. `#a8763e` carries white at 3.94:1 and the
-- slate ink at 3.39:1 — it fails BOTH ways, which is the one case that cannot
-- be rescued by picking a different ink.
--
--   #a8763e  white 3.94:1   ink 3.39:1   ← fails both
--   #8a5c28  white 5.77:1                ← same hue family, one step deeper
--
-- The other two accents were measured and kept: gatherings `#7c6a46` (white
-- 5.24:1) and materials `#5f6b5a` (white 5.62:1).
--
-- A separate migration rather than an edit to 150 because 150 is already
-- applied; the runner checksums history and an edited file reads as drift.
--
-- Scoped to the exact superseded value, so a hand-picked colour set since is
-- left alone rather than stomped by a migration re-run.
-- ============================================================================

UPDATE org_feeds
SET accent = '#8a5c28', updated_at = now()
WHERE org_id = 'sunjay' AND slug = 'writing' AND accent = '#a8763e';
