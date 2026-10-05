-- 173: threads.body_doc — the essay canvas's document (2026-09-27)
--
-- The Studio's block editor edits a TipTap/ProseMirror JSON document and the
-- server renders it to the sanitised HTML in `body` at save
-- (docs/open/BLOCK_CANVAS_BRIEF_2026-09-27.md §3.2). `body` stays what every
-- site renders; `body_doc` is the editing source. A piece without one loads
-- through the schema's HTML parser and gains a doc on its first save.
--
-- body_format 'doc' marks a body rendered from body_doc. Nothing reads it to
-- render — sites keep rendering `body` — but the Studio uses it to decide
-- which editor to open.

ALTER TABLE threads ADD COLUMN IF NOT EXISTS body_doc JSONB;

ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_body_format_check;
ALTER TABLE threads
  ADD CONSTRAINT threads_body_format_check
  CHECK (body_format IN ('html', 'md', 'mdx', 'doc'));

COMMENT ON COLUMN threads.body_doc IS
  'Essay canvas document (TipTap JSON); body is rendered from it when body_format = doc';
