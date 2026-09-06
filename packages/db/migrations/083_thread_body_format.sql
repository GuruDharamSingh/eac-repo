-- ============================================================================
-- Migration 083: authored source vs. rendered body on threads
-- ============================================================================
-- Today `threads.body` holds TipTap's HTML output and the format is implicit —
-- every reader assumes HTML and calls sanitizeRichText on it. That assumption
-- is fine until a second authoring format exists, at which point there is no
-- way to tell a TipTap post from a markdown one.
--
-- Two columns fix that without disturbing anything:
--
--   body_format  what `body_source` was authored in. 'html' means the legacy
--                TipTap path, where body IS the source and body_source is NULL.
--
--   body_source  the author's original text. Compilation is one-way, so
--                without this an author cannot reopen and edit their own post.
--
-- The important property: **`body` keeps its current meaning** — the rendered
-- HTML that every consumer already reads. blog-sunjay, blog-guru-dharam,
-- blog-tester and amrit-canada need no changes at all. A post authored in
-- markdown compiles to `body` at publish time and reads back exactly like a
-- TipTap post, except that it may contain <eac-embed> markers that
-- renderSilexHtmlWithEmbeds swaps for live components.
--
-- On the CHECK values: 'md' and 'mdx' are both listed so the format decision
-- doesn't cost a second migration, but only 'html' is produced today. They
-- differ in what compiles the source, not in what lands in `body`:
--   md   markdown + a fixed allowlist of component tags. No code execution;
--        safe for any member to author.
--   mdx  full MDX. Compiles by evaluating JavaScript, so it is a
--        trusted-author format and must never be exposed to open signup.
-- ============================================================================

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS body_format VARCHAR(10) NOT NULL DEFAULT 'html',
  ADD COLUMN IF NOT EXISTS body_source TEXT;

ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_body_format_check;
ALTER TABLE threads
  ADD CONSTRAINT threads_body_format_check
  CHECK (body_format IN ('html', 'md', 'mdx'));

COMMENT ON COLUMN threads.body_format IS
  'Authoring format of body_source. html = legacy TipTap (body is the source).';
COMMENT ON COLUMN threads.body_source IS
  'Author''s original text. NULL for html-format posts, where body is the source.';
COMMENT ON COLUMN threads.body IS
  'Rendered HTML. Always the thing readers consume, whatever body_format says.';

-- Only useful for finding posts to recompile after a component-map change.
CREATE INDEX IF NOT EXISTS idx_threads_body_format
  ON threads (body_format)
  WHERE body_format <> 'html';
