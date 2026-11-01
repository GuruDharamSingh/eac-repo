-- 199 — lamrim_reviews.context: where an answer was given (Jerusalem's guided walk, 2026-10-07).
-- {question: need | placement | importance | argument | synthesis | relation | list, mode: walk | explore | deck}
-- so "my own answer" to a walk question keeps which question it answers.
ALTER TABLE lamrim_reviews ADD COLUMN IF NOT EXISTS context jsonb;
