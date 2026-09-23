-- ============================================================================
-- 153: lift the `sunjay` feed accents for the dark site.
--
-- The site went dark (2026-09-19). `org_feeds.accent` is applied INLINE as
-- `--feed` on a feed page's wrapper and used as ink on the section banner, so
-- these values are the one part of the palette that lives in the database and
-- therefore did not move when the stylesheet did.
--
-- Measured on the banner band (#2B3134), which is the ground they land on:
--
--   gatherings  #7c6a46 → #c9ae79    2.52:1 → 6.17:1   (was failing 3:1)
--   writing     #8a5c28 → #ce9a62    ~2.1:1 → 5.29:1
--   materials   #5f6b5a → #8da882    ~2.3:1 → 5.06:1
--
-- The old values are the LIGHT-mode ones migrations 150/151 seeded, and they
-- were correct then: 151 exists precisely because `writing` failed contrast on
-- the light ground. Inverting a palette inverts this requirement — an accent
-- dark enough to carry white on paper is too dark to BE ink on a dark ground.
--
-- These match the `--feed-*` fallbacks in the app's globals.css, so a feed
-- with no accent row and a feed with one now look the same.
--
-- Scoped to the exact superseded values, so a colour hand-picked since is left
-- alone rather than stomped by a re-run.
-- ============================================================================

UPDATE org_feeds SET accent = '#c9ae79', updated_at = now()
WHERE org_id = 'sunjay' AND slug = 'gatherings' AND accent = '#7c6a46';

UPDATE org_feeds SET accent = '#ce9a62', updated_at = now()
WHERE org_id = 'sunjay' AND slug = 'writing' AND accent = '#8a5c28';

UPDATE org_feeds SET accent = '#8da882', updated_at = now()
WHERE org_id = 'sunjay' AND slug = 'materials' AND accent = '#5f6b5a';
