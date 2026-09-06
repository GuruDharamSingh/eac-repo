-- ============================================================================
-- Migration 092: entity_type — let a `users` row represent a business, not
-- just a person
-- ============================================================================
-- Every users row today is implicitly a person: profiles.ts's own module
-- comment calls it "the person. Global identity: bio, photo, links, slug."
-- This adds the other case the sentinel-profile pattern (migration 077/084)
-- already supports without any change: an external business the network has
-- a relationship with — a gallery, a curator collective, an auction house —
-- represented the same way an unclaimed artist is: a `users` row nobody logs
-- into, published on one org's org_profiles, listed on ArtDirect alongside
-- every person because listPublicProfiles' one rule is "has a slug."
--
-- Deliberately NOT a CHECK-constrained enum, for the same reason as migration
-- 073 (threads.section) and 091 (profile_layout): whether a third value is
-- ever needed (a collective, a publication, a venue) is a product question,
-- not a schema one, and this column needs to stay this cheap to extend for
-- the next org — this is explicitly not an IFAC-only feature. Validated in
-- app code (profiles.ts) against the two known values instead.
--
-- Default 'person' is not a guess — every existing row this column now
-- applies to IS a person. 'organization' is opt-in, set only by
-- createUnclaimedProfile when arts-collective's admin console opens a new
-- business listing.
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS entity_type VARCHAR(20) NOT NULL DEFAULT 'person';

COMMENT ON COLUMN users.entity_type IS
  '''person'' (default) or ''organization'' — an external business (gallery, dealer collective, auction house) represented as a users row so it reuses the same profile/org_profiles machinery as a person. Validated in app code, not a CHECK — see migration 073/091 for why.';
