-- 201: per-week session fields for recurring meeting series (2026-10-08).
-- Adds a title, summary, materials list, cover image and the per-week topic
-- thread (RSVP + discussion, same pattern as reading circles) to
-- meeting_occurrence_notes, which is already keyed (thread_id, occurrence_at).
-- Materials: jsonb array of { id, name, url, kind: image|video|audio|document, external? }.

ALTER TABLE meeting_occurrence_notes
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS materials JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS topic_thread_id VARCHAR(21) REFERENCES threads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_occurrence_notes_topic
  ON meeting_occurrence_notes (topic_thread_id) WHERE topic_thread_id IS NOT NULL;

-- Series sessions are found from the topic side too (feed/search exclusion,
-- "which week is this topic for"): metadata.seriesSession = {seriesId, occurrenceAt, number}.
CREATE INDEX IF NOT EXISTS idx_threads_series_session
  ON threads ((metadata -> 'seriesSession' ->> 'seriesId'))
  WHERE metadata -> 'seriesSession' IS NOT NULL;
