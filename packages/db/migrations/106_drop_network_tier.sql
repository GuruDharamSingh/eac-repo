-- Remove `users.network_tier` and `questionnaires.gates_tier`.
--
-- The network tier gated NOTHING. Every reference to it in the repo was one of
-- three things: the single writer (`reviewResponse` promoted a user when they
-- passed a review on a questionnaire declaring a `gates_tier`), the vetting
-- queue displaying the current value, or a type declaration. No route, feed,
-- media check, store check or authorization path ever read it to decide
-- anything.
--
-- Nor did it ever move. All 50 users sat at 'member', because both live
-- responses were still 'submitted' and the promotion arm had never once fired.
-- A ladder nobody climbs, leading somewhere nothing checks.
--
-- What it did cost was a name collision across three vocabularies:
--
--   user_organizations.role   owner | guide | member | viewer   ← gates everything
--   organizations.tier        free | supported | partner        ← what an org pays for
--   users.network_tier        member | host | partner           ← this, inert
--
-- so `member` and `partner` each meant two different things depending on which
-- column you were looking at. Dropping the inert one resolves the ambiguity
-- outright rather than renaming around it.
--
-- Standing in the network, if it is wanted later, should be reintroduced only
-- alongside something that reads it. Per-org role is what actually governs
-- what a person may do, and it already works.

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_network_tier_check;

ALTER TABLE users
  DROP COLUMN IF EXISTS network_tier;

-- `gates_tier` named the tier a passed review promoted to. With no tier to
-- promote to, it is a pointer to nothing. Both existing questionnaires carry a
-- value ('host' and 'partner') that has never been acted on.
ALTER TABLE questionnaires
  DROP CONSTRAINT IF EXISTS questionnaires_gates_tier_check;

ALTER TABLE questionnaires
  DROP COLUMN IF EXISTS gates_tier;
