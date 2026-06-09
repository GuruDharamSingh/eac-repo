-- Add an opt-in flag so a member can be notified by email when someone
-- replies in the conversation tied to their work-question response.
ALTER TABLE work_question_responses
  ADD COLUMN IF NOT EXISTS notify_email BOOLEAN NOT NULL DEFAULT FALSE;
