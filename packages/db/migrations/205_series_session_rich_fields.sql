-- 205: a series week's subtitle, rich write-up and cover framing. 2026-10-13.
--
-- meeting_occurrence_notes holds a series week's own fields (title, summary,
-- cover_image_url, materials). The planner and the week page now offer:
--   subtitle     an optional line under the title (cards, week page);
--   body_html    the write-up as rich text, sanitised on write
--                (sanitizeRichText). summary keeps a plain-text copy of it,
--                which mail, the .ics feed and page descriptions read;
--   cover_frame  how the cover sits in its box: {"fx": 0-100, "fy": 0-100,
--                "zoom": 1-4}, read as CSS object-position plus a scale.
--                Null = centred, no zoom.
-- Rows written before this keep body_html null; pages show summary as text.

ALTER TABLE meeting_occurrence_notes ADD COLUMN IF NOT EXISTS subtitle text;
ALTER TABLE meeting_occurrence_notes ADD COLUMN IF NOT EXISTS body_html text;
ALTER TABLE meeting_occurrence_notes ADD COLUMN IF NOT EXISTS cover_frame jsonb;
