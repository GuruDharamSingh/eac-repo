-- Guestbook entries: short member notes shown on the inner-gathering feed.
-- Replaces the Black Hole dropzone as the primary quick-note widget.

CREATE TABLE IF NOT EXISTS guestbook_entries (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       TEXT        NOT NULL DEFAULT 'inner_group',
  user_id      TEXT,
  display_name TEXT,
  message      TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guestbook_entries_org
  ON guestbook_entries (org_id, created_at DESC);
