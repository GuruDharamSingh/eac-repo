-- 284_workspace_journal_comments.sql
-- Comments from group members on a shared journal entry (workspace slice 5, plan section 3.5 / 6 row 5).
-- ADDITIVE ONLY: one new table. No existing table is changed.
--
-- A comment is readable by exactly the people who can read the entry it is on (the engine checks
-- lms_responses.visibility on every read; this table adds no extra reach). A guide's answer stays in
-- lms_acknowledgements as before. Deleting an entry (or its enrolment/run) deletes its comments.
-- Until this migration is applied the workspace shows guide answers only (the code tests for the table).
--
-- NOT APPLIED by the worker who wrote it: the PM applies migrations.

CREATE TABLE IF NOT EXISTS lms_response_comments (
  id          TEXT         PRIMARY KEY,
  response_id TEXT         NOT NULL REFERENCES lms_responses(id) ON DELETE CASCADE,
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id      VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  body        TEXT         NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  edited_at   TIMESTAMPTZ,
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_lms_response_comments_response ON lms_response_comments (response_id, created_at);
