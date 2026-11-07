-- 225: thread_external_comments — comments made on the outside copy of a thread (2026-11-01).
--
-- When a piece or a social post has been sent to a Facebook Page (and later
-- Instagram), comments people leave there arrive by webhook and are kept
-- here against the network thread, with the commenter's platform name. The
-- commenters are not network users, so this is a side table, not a reply row
-- (users rows are real accounts; .claude/rules/areas/db.md). Rendered under
-- the piece as "From Facebook". `external_id` is the platform's comment id,
-- unique per platform; `parent_external_id` keeps replies to comments.

CREATE TABLE IF NOT EXISTS thread_external_comments (
  id                 bigserial PRIMARY KEY,
  thread_id          varchar(21) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  platform           text NOT NULL,
  external_id        text NOT NULL,
  external_post_id   text NOT NULL,
  parent_external_id text,
  author_name        text NOT NULL DEFAULT '',
  author_external_id text,
  message            text NOT NULL DEFAULT '',
  url                text,
  commented_at       timestamptz NOT NULL DEFAULT now(),
  received_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, external_id)
);

CREATE INDEX IF NOT EXISTS thread_external_comments_thread_idx ON thread_external_comments (thread_id, commented_at);
