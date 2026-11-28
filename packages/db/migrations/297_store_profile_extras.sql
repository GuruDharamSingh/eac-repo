-- 297: an artist's profile on the market, beyond name and bio (2026-11-26).
-- store.profile holds what the artist profile popup shows besides the store's own name, line, photo, note and links:
--   { "timeline": [{ "year": "2025", "text": "Small Works, Lunenburg Art Gallery" }, ...],
--     "files":    [{ "name": "CV, 2026", "url": "/api/media/...", "size": 123456 }, ...] }
-- Written by commerce updateStoreProfile; empty means nothing to show.
ALTER TABLE store ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}'::jsonb;
