-- A wiki page must never be visibility='PUBLIC'.
--
-- The wiki gates reads itself (the route requires an authenticated user), so
-- `visibility` does not decide who may read a wiki page — it only decides
-- which OTHER surfaces pick the row up. Every feed predicate in the codebase
-- whitelists PUBLIC, none of them filtering on kind: getOrgFeed,
-- getOfferingThread and getPublicThread in apps/arts-collective/src/lib/org.ts
-- plus the cross-org feed in lib/community-feed.ts. A PUBLIC wiki page
-- therefore lands on the hosting org's public marketing site, becomes the
-- thread its /offering slot promotes (that query is
-- "most recent published PUBLIC thread, LIMIT 1", and the wiki's host org has
-- no other PUBLIC threads), and shows to anonymous visitors network-wide.
--
-- That is exactly the regression this constraint exists to prevent: it was
-- introduced and shipped as a one-word change, and nothing failed — the
-- damage would only have appeared the next time somebody created a page.
-- A comment is not enough for a mistake whose blast radius is a public
-- website, so the invariant lives in the schema. ORGANIZATION stays legal:
-- every authenticated user may read the wiki anyway, so an org-visible wiki
-- page is a relevance question (handled by kind exclusions in the forum
-- queries), not a disclosure one.
--
-- If a genuinely public wiki surface is ever wanted, drop this deliberately
-- and give the feed queries kind filters in the same change.

ALTER TABLE threads
  DROP CONSTRAINT IF EXISTS threads_wiki_never_public;

ALTER TABLE threads
  ADD CONSTRAINT threads_wiki_never_public
  CHECK (kind <> 'wiki_page' OR visibility <> 'PUBLIC');
