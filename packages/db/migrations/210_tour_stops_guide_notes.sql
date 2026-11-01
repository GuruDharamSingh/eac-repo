-- 210: tour_stops.guide_notes — the guide's own crib notes per stop (2026-10-18).
--
-- Dana's tour guides arrive as documents with, per stop, a public-facing
-- introduction and then "documented history", "talking points" and "your
-- notes" for the person leading the walk. The public page shows `body`;
-- `guide_notes` is sanitised HTML shown only in the manage console and its
-- printable notes page (apps/elktours /manage/tours/<id>/notes). Never
-- selected by the public tour read.

ALTER TABLE tour_stops ADD COLUMN IF NOT EXISTS guide_notes text;
