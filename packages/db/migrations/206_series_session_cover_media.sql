-- 206: a series week's cover can be a video or a YouTube/Vimeo player. 2026-10-18.
--
-- meeting_occurrence_notes.cover_image_url keeps the cover's address. The new
-- cover_media says what it is when it is not a picture:
--   {"kind": "video" | "embed", "posterUrl": "/api/media/… or https://…"}
-- Null = a picture (every row written before this). cover_frame applies to
-- pictures only. The still (posterUrl) is what cards, mail and share
-- previews show for a video.

ALTER TABLE meeting_occurrence_notes ADD COLUMN IF NOT EXISTS cover_media jsonb;
