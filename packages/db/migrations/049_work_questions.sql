-- Work Questions: admin-settable prompts shown on the inner-gathering feed.
-- Members respond via free text; admin can view all responses and update the question.

CREATE TABLE IF NOT EXISTS work_questions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     TEXT        NOT NULL DEFAULT 'inner_group',
  question   TEXT        NOT NULL,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_question_responses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID        NOT NULL REFERENCES work_questions(id) ON DELETE CASCADE,
  user_id     TEXT,
  display_name TEXT,
  response    TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_questions_org_active
  ON work_questions (org_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_question_responses_question
  ON work_question_responses (question_id, created_at DESC);

-- Seed the first question
INSERT INTO work_questions (org_id, question, is_active)
VALUES ('inner_group', 'What is Art For?', TRUE);
