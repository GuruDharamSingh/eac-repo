-- 296: a store's own cover picture and look (2026-11-26).
-- The store's name, line, city and photo (store.display_name, headline, city, photo_url) become the store's own
-- again, with the owner's network profile only as the fallback (read order flipped in packages/commerce
-- queries; migration 092 had made the network profile the only identity). These two are new:
--   cover_url  the wide picture behind the store front's hero
--   theme      the store front's colours, e.g. {"accent":"#2f4a63"}; empty means the market's own
ALTER TABLE store ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE store ADD COLUMN IF NOT EXISTS theme jsonb NOT NULL DEFAULT '{}'::jsonb;
