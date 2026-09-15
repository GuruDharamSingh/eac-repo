-- The wiki gets a discussion board on the forum.
--
-- A wiki page is deliberately NOT a forum topic — it is collectively edited
-- and has no post #1, so it is excluded from listTopics and searchForum by
-- kind (see visibleTo in packages/services/src/forum.ts). But discussion
-- ABOUT a page is an ordinary topic, and belongs in the stream like any
-- other. That topic is a normal thread carrying
-- `metadata.wikiTalkFor = <wiki thread id>`, which is what pairs the two
-- without a join table.
--
-- Those topics need somewhere public to live. WIKI_ORG ('elkdonis') had only
-- a `general` feed with is_public = false, so a Talk topic posted there would
-- have been invisible to exactly the network-wide audience the wiki serves.
-- Feeds are data (migration 073 replaced the hardcoded section CHECK with
-- this table), so the section is added the same way any other is.

INSERT INTO org_feeds (org_id, slug, name, tagline, description, is_public, sort_order)
VALUES (
  'elkdonis',
  'wiki-talk',
  'Wiki discussion',
  'Talking about what the pages say',
  'One topic per wiki page. The page itself is edited on the wiki; this is where its wording, scope and disagreements get worked out.',
  TRUE,
  50
)
ON CONFLICT (org_id, slug) DO NOTHING;

-- Finding a page's Talk topic is a lookup by that metadata key on every wiki
-- page view, so it gets an index rather than a scan.
CREATE INDEX IF NOT EXISTS idx_threads_wiki_talk_for
  ON threads ((metadata->>'wikiTalkFor'))
  WHERE metadata->>'wikiTalkFor' IS NOT NULL;
