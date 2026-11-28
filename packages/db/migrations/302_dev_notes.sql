-- 302: Development desk notes (2026-11-27). Not applied.
-- Notes Justin leaves for Claude on any page of apps/development, plus Claude's replies, questions and updates.
--   a note on a page:  path = the page, anchor = its data-dev-anchor (or a short CSS path), anchor_text = a snippet
--   a reply:           parent_id = the note it answers
--   kind 'decision'/'question' from claude carry `options` (the choices) and get `answer` when Justin clicks
--   kind 'update' is "what changed", written by Claude
-- Platform-level (no org_id): only network admins reach it, through apps/development's getNetworkAdmin().
-- Additive only.

CREATE TABLE IF NOT EXISTS dev_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id    uuid REFERENCES dev_notes(id) ON DELETE CASCADE,
  path         text NOT NULL DEFAULT '/' CHECK (char_length(path) <= 300),
  anchor       text CHECK (anchor IS NULL OR char_length(anchor) <= 300),
  anchor_text  text CHECK (anchor_text IS NULL OR char_length(anchor_text) <= 300),
  kind         text NOT NULL DEFAULT 'note' CHECK (kind IN ('note', 'question', 'change', 'bug', 'idea', 'update', 'decision')),
  body         text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  options      jsonb,
  answer       text CHECK (answer IS NULL OR char_length(answer) <= 4000),
  author_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  author_kind  text NOT NULL DEFAULT 'person' CHECK (author_kind IN ('person', 'claude')),
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'seen', 'doing', 'done', 'wontdo')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_dev_notes_status ON dev_notes (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dev_notes_path ON dev_notes (path, created_at);
CREATE INDEX IF NOT EXISTS idx_dev_notes_parent ON dev_notes (parent_id) WHERE parent_id IS NOT NULL;

-- Row-level security as in 281: enabled with no policy for eac_tenant; the app gate is the access rule.
ALTER TABLE dev_notes ENABLE ROW LEVEL SECURITY;
