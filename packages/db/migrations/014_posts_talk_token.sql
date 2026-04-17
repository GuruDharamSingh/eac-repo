-- Add nextcloud_talk_token and document_url columns to posts table
-- These are needed for Talk room integration and document attachments on posts

ALTER TABLE posts ADD COLUMN IF NOT EXISTS nextcloud_talk_token VARCHAR(255);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS document_url TEXT;
