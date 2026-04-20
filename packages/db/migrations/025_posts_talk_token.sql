-- Migration 025 (renumbered from server's 014): talk token + document_url on posts
-- Originally targeted `posts`. Post-030 these columns live on `threads`.
-- IF NOT EXISTS makes this safe regardless of run order.

ALTER TABLE threads ADD COLUMN IF NOT EXISTS nextcloud_talk_token VARCHAR(255);
ALTER TABLE threads ADD COLUMN IF NOT EXISTS document_url TEXT;
