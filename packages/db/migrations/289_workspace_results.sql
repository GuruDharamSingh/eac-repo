-- 289_workspace_results.sql
-- Workspace experiment preset: compiling results from SHARED entries, each only with its writer's agreement, then publishing them.
-- ADDITIVE ONLY: two new tables. Nothing else changes.
--
--   workspace_results        a results write-up for a workspace: title, introduction, conclusion; status draft -> published -> taken_down.
--                            Nothing is a thread, and nothing is visible anywhere, until it is published; publishing creates the thread
--                            through the existing createThread and records its id here. Taking it down archives that thread.
--   workspace_result_items   one entry proposed for a result. state: requested (the guide asked), agreed / declined (the WRITER decided),
--                            withdrawn (the writer, or their consent to take part, was withdrawn). Only agreed items are ever published.
--
-- Hosts are keyed (host_type, host_id) as in 285-288. The code treats results as absent until these exist (fails soft).
--
-- NOT APPLIED by the worker who wrote it: the PM applies migrations.

CREATE TABLE IF NOT EXISTS workspace_results (
  id            TEXT         PRIMARY KEY,
  host_type     VARCHAR(16)  NOT NULL CHECK (host_type IN ('lms_run', 'thread')),
  host_id       TEXT         NOT NULL,
  title         VARCHAR(200) NOT NULL DEFAULT '',
  intro         TEXT         NOT NULL DEFAULT '',
  conclusion    TEXT         NOT NULL DEFAULT '',
  status        VARCHAR(12)  NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'taken_down')),
  -- Who may read it once published: the whole network, or only the organisation's members.
  audience      VARCHAR(12)  NOT NULL DEFAULT 'members' CHECK (audience IN ('everyone', 'members')),
  thread_id     VARCHAR(21),
  created_by    UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  published_at  TIMESTAMPTZ,
  taken_down_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_workspace_results_host ON workspace_results (host_type, host_id);

CREATE TABLE IF NOT EXISTS workspace_result_items (
  id            TEXT         PRIMARY KEY,
  result_id     TEXT         NOT NULL REFERENCES workspace_results(id) ON DELETE CASCADE,
  response_id   TEXT         NOT NULL REFERENCES lms_responses(id) ON DELETE CASCADE,
  state         VARCHAR(10)  NOT NULL DEFAULT 'requested' CHECK (state IN ('requested', 'agreed', 'declined', 'withdrawn')),
  -- How the writer wants to be shown, chosen when they agree.
  credit        VARCHAR(10)  CHECK (credit IN ('named', 'anonymous')),
  requested_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  requested_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  decided_at    TIMESTAMPTZ,
  UNIQUE (result_id, response_id)
);
CREATE INDEX IF NOT EXISTS idx_workspace_result_items_response ON workspace_result_items (response_id);
