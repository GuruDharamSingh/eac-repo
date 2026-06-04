-- Allow optional signed-name override and reply-notification email on
-- work_question_responses so anonymous and signed-in members can leave a name
-- and opt into being notified when others reply on the same question.

ALTER TABLE work_question_responses
  ADD COLUMN IF NOT EXISTS signed_name  TEXT,
  ADD COLUMN IF NOT EXISTS notify_email TEXT;
