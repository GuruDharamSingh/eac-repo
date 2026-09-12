-- The wiki became network-wide: one shared knowledge base rather than a
-- per-org one. Two consequences need enforcing rather than assuming.
--
-- 1. Reads now look a wiki page up by slug alone (no org_id), so slug
--    uniqueness across wiki pages has to be a fact, not a convention.
--    threads_org_id_slug_key only makes (org_id, slug) unique, which would
--    let a wiki_page row under some other org shadow the real one and make
--    the lookup pick arbitrarily.
--
-- 2. Existing rows were written when the wiki was org-scoped and carry
--    visibility='ORGANIZATION'. Every feed predicate in the codebase admits
--    ORGANIZATION rows for members of that org, so those pages would surface
--    in the hosting org's feeds and on the forum. Wiki pages are reached
--    through the wiki, which gates on authentication itself; INVITE_ONLY is
--    the only visibility value no feed query matches.

CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_wiki_slug_unique
  ON threads (slug)
  WHERE kind = 'wiki_page';

UPDATE threads
SET visibility = 'INVITE_ONLY'
WHERE kind = 'wiki_page'
  AND visibility <> 'INVITE_ONLY';
