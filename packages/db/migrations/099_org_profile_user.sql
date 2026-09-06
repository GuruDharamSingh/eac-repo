-- ============================================================================
-- Migration 099: an organisation gets its own identity row in `users`
-- ============================================================================
-- Until now arts-collective had no place to put an ORG's own identity — its
-- photo, bio, location, field. `getOrgBySlug` filled the gap by reading
--
--     SELECT * FROM artist_profiles WHERE org_id = <org> LIMIT 1
--
-- but artist_profiles' PRIMARY KEY is (user_id): it is one row per PERSON,
-- merely tagged with an org. That query therefore returns an arbitrary
-- member's personal profile, which the org's subdomain then renders as the
-- organisation itself — on `elkdonis` (10 such rows, no ORDER BY) it picks a
-- different member's name and bio at the database's discretion. This is not a
-- legacy-table-still-in-use problem; it is wrong data on a public page.
--
-- The fix reuses the machinery that already represents an organisation as a
-- users row: migration 093's entity_type='organization', the sentinel pattern
-- from 077/084 (self-referential auth_user_id, nobody logs in as it), and
-- createUnclaimedProfile, which arts-collective's admin console already calls
-- for associated organisations. An org's identity becomes a profile like any
-- other, which also means it is listed on ArtDirect — the network's directory
-- rule is only "has a slug" — so orgs appear in the yellow pages alongside
-- people, which is what the directory was for.
--
-- Two kinds of org, distinguished by claim_status, exactly as for people:
--   claimed   — someone holds `owner` in user_organizations; they edit it.
--   unclaimed — no owner. Staff-edited, updated by suggestion after review.
--
-- Seeded from organizations.name/description ONLY. Deliberately NOT from the
-- artist_profiles row described above: that bio belongs to a member, and
-- copying it into the org's identity would launder a person's words into an
-- organisation's voice. Orgs start with their real description and fill in the
-- rest themselves.
-- ============================================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS profile_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN organizations.profile_user_id IS
  'The users row carrying this organisation''s own identity (entity_type=''organization''). Its bio/avatar/location/slug are the org''s, not any member''s — see migration 099 for why artist_profiles could not serve this.';

-- One org per profile row and vice versa. Partial: most rows are NULL until
-- the backfill below runs, and a future org is created before it is linked.
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_profile_user
  ON organizations (profile_user_id)
  WHERE profile_user_id IS NOT NULL;

-- ─── Backfill ───────────────────────────────────────────────────────────────
-- `source_note = 'org:<id>'` is the join key between the two statements and
-- makes the row's origin self-describing; it is also what makes this
-- re-runnable, since the second run finds the row already present.
--
-- Slug: the org's own slug when it is free, else suffixed. The reserved words
-- are inlined rather than imported from packages/utils/reserved-slugs.ts on
-- purpose — a migration is a point-in-time artefact and must reproduce the
-- same result on a fresh database years from now, regardless of how that list
-- has since grown.

WITH candidate AS (
  SELECT
    o.id   AS org_id,
    o.name AS org_name,
    NULLIF(btrim(coalesce(o.description, '')), '') AS org_bio,
    o.slug AS base_slug,
    gen_random_uuid() AS new_id,
    (
      SELECT uo.user_id
      FROM user_organizations uo
      WHERE uo.org_id = o.id AND uo.role = 'owner'
      ORDER BY uo.joined_at
      LIMIT 1
    ) AS owner_id
  FROM organizations o
  WHERE o.profile_user_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM users u WHERE u.source_note = 'org:' || o.id
    )
),
resolved AS (
  SELECT
    c.*,
    CASE
      WHEN c.base_slug IN (
             'www','api','admin','app','auth','cloud','edit','meetings',
             'artdirect','market','auction','shop','hub','sites','artists',
             'directory','account','login','signup','wizard','complete',
             'preview','commitments','inner-temple','new','offering',
             'profile','community'
           )
        OR EXISTS (SELECT 1 FROM users u WHERE u.slug = c.base_slug)
      THEN
        CASE
          WHEN EXISTS (SELECT 1 FROM users u WHERE u.slug = c.base_slug || '-org')
          THEN c.base_slug || '-org-' || substr(md5(c.org_id), 1, 4)
          ELSE c.base_slug || '-org'
        END
      ELSE c.base_slug
    END AS final_slug
  FROM candidate c
)
INSERT INTO users (
  id, auth_user_id, display_name, bio, slug,
  claim_status, claimed_by, created_by,
  entity_type, profile_layout, source_note
)
SELECT
  r.new_id, r.new_id, r.org_name, r.org_bio, r.final_slug,
  CASE WHEN r.owner_id IS NULL THEN 'unclaimed' ELSE 'claimed' END,
  r.owner_id, r.owner_id,
  'organization', 'standard', 'org:' || r.org_id
FROM resolved r;

UPDATE organizations o
SET profile_user_id = u.id
FROM users u
WHERE u.source_note = 'org:' || o.id
  AND u.entity_type = 'organization'
  AND o.profile_user_id IS NULL;
