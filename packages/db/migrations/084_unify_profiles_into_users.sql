-- ============================================================================
-- Migration 084: One person, one profile — merge artist_profiles +
-- directory_profiles into users + org_profiles
-- ============================================================================
-- Three profile systems existed with no spine between them:
--   - artist_profiles: PRIMARY KEY (user_id) — one row per user, GLOBALLY,
--     yet also carrying an org_id. A user could only ever have one org's
--     guide/teacher page. ~50 of its columns (the arts-collective intake
--     wizard) hold data in 0-1 of 13 rows — it was never really "the artist
--     profile", it was the wizard table wearing a profile's clothes.
--   - directory_profiles: an org-curated roster (IFAC, ArtDirect/OAD) for
--     people who need not have an account. Its `user_id` "graduation link"
--     (migration 060) was never written by any code path.
--   - users: the actual account.
--
-- New shape:
--   users          — the person. Global identity, bio, photo, links. One row
--                     whether or not the person has ever logged in — an
--                     unclaimed directory entry is a `users` row with
--                     claim_status='unclaimed' and a self-referential
--                     auth_user_id (the sentinel-user pattern from
--                     migration 077/pigeonshoot), not a second table.
--   org_profiles   — how one org presents that person: role_title,
--                     sort_order, is_public. A person can have one row per
--                     org they're published on, replacing artist_profiles'
--                     one-org-only ceiling.
--   org_intake     — the arts-collective wizard's real content (governance,
--                     revenue-sharing, etc.), evicted from the profile table
--                     it never belonged in.
--
-- artist_profiles and directory_profiles are NOT dropped here. Four apps
-- (hidden-enneagram, inner-gathering, arts-collective, ifac) still read them
-- directly; each needs to move onto the new tables before the old ones go.
-- This migration is additive + backfills, per the repo's own convention
-- (see 061, 073) — drop lands in a later migration once call sites move.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- (a) users: absorb identity fields, add claim lifecycle for account-less
--     directory entries
-- ---------------------------------------------------------------------------

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS slug          VARCHAR(80),
  ADD COLUMN IF NOT EXISTS pronouns      VARCHAR(40),
  ADD COLUMN IF NOT EXISTS city          VARCHAR(120),
  ADD COLUMN IF NOT EXISTS region        VARCHAR(120),
  ADD COLUMN IF NOT EXISTS country       VARCHAR(120),
  ADD COLUMN IF NOT EXISTS social_links  JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS portfolio_url TEXT,
  ADD COLUMN IF NOT EXISTS portfolio     JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{url,title}] highlight reel; full media lives in `media`
  -- Claim lifecycle, moved verbatim off directory_profiles (061/062). Real
  -- signups are born 'claimed'; a community-submitted, account-less entry is
  -- born 'unclaimed' and can be claimed by a real user without any row
  -- ever changing id/author attribution.
  ADD COLUMN IF NOT EXISTS claim_status  VARCHAR(20) NOT NULL DEFAULT 'claimed'
    CHECK (claim_status IN ('unclaimed', 'pending', 'claimed')),
  ADD COLUMN IF NOT EXISTS claimed_by    UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS created_by    UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS verified      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_note   TEXT,
  -- ArtDirect's "Classified Artist Dossier" template flavor fields
  -- (current_targets, operations, financial_channels, ...). One JSONB
  -- instead of six top-level columns: it's one template's presentation of
  -- generic profile data, not core identity every org needs.
  ADD COLUMN IF NOT EXISTS oad_dossier   JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_slug ON users(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_geo ON users(country, region) WHERE claim_status != 'unclaimed' OR country IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_claim_status ON users(claim_status) WHERE claim_status != 'claimed';

COMMENT ON COLUMN users.claim_status IS
  'claimed = real account. unclaimed/pending = a directory entry someone else opened; see [[claimed_by]]. Sentinel rows use auth_user_id = id, same convention as the pigeonshoot anonymous-author user (migration 077).';
COMMENT ON COLUMN users.slug IS
  'Global public-profile URL segment (ArtDirect /[slug], and reused as the org-page slug wherever this person is published via org_profiles).';

-- ---------------------------------------------------------------------------
-- (b) org_profiles: org-scoped presentation, many-per-user
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS org_profiles (
  org_id         VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_title     VARCHAR(120),
  bio_override   TEXT,     -- optional org-specific bio; falls back to users.bio
  photo_override TEXT,     -- optional org-specific photo; falls back to users.avatar_url
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  is_public      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_profiles_public ON org_profiles(org_id, sort_order) WHERE is_public;
CREATE INDEX IF NOT EXISTS idx_org_profiles_user ON org_profiles(user_id);

COMMENT ON TABLE org_profiles IS
  'How one org presents a person: role_title + is_public + sort_order. Membership/access role stays on user_organizations — this is presentation, not permission. A user gets one row per org they are published on (replaces artist_profiles'' one-org ceiling).';
COMMENT ON COLUMN org_profiles.is_public IS
  'Opt-in, defaults FALSE. Publishing is an explicit act by an org owner or the member themself; unpublished rows are drafts.';

CREATE OR REPLACE FUNCTION org_profiles_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_org_profiles_updated_at ON org_profiles;
CREATE TRIGGER trg_org_profiles_updated_at
  BEFORE UPDATE ON org_profiles
  FOR EACH ROW EXECUTE FUNCTION org_profiles_touch_updated_at();

-- ---------------------------------------------------------------------------
-- (c) org_intake: the arts-collective wizard's actual content, evicted from
--     the profile table. Same PK shape as org_profiles (one intake per
--     person per org), one JSONB blob instead of ~50 columns — the wizard's
--     question set changes far more often than a migration should.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS org_intake (
  org_id     VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

COMMENT ON TABLE org_intake IS
  'Arts-collective wizard answers (governance, revenue-sharing, business setup), keyed like org_profiles. Evicted off the profile table (migration 084) — this is intake data, not a public profile.';

CREATE OR REPLACE FUNCTION org_intake_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_org_intake_updated_at ON org_intake;
CREATE TRIGGER trg_org_intake_updated_at
  BEFORE UPDATE ON org_intake
  FOR EACH ROW EXECUTE FUNCTION org_intake_touch_updated_at();

-- ---------------------------------------------------------------------------
-- (d) Backfill from artist_profiles → users + org_profiles + org_intake
-- ---------------------------------------------------------------------------

UPDATE users u SET
  bio            = COALESCE(u.bio, ap.bio),
  avatar_url     = COALESCE(u.avatar_url, ap.photo_url),
  city           = COALESCE(u.city, ap.city),
  pronouns       = COALESCE(u.pronouns, ap.pronouns),
  slug           = COALESCE(u.slug, ap.slug),
  social_links   = CASE WHEN u.social_links = '[]'::jsonb THEN ap.social_links ELSE u.social_links END,
  portfolio_url  = COALESCE(u.portfolio_url, ap.portfolio_url)
FROM artist_profiles ap
WHERE ap.user_id = u.id;

INSERT INTO org_profiles (org_id, user_id, role_title, sort_order, is_public)
SELECT ap.org_id, ap.user_id, ap.role_title, ap.sort_order, ap.is_public
FROM artist_profiles ap
JOIN users u ON u.id = ap.user_id
ON CONFLICT (org_id, user_id) DO NOTHING;

-- Only rows that actually carried wizard answers — no point creating 12
-- empty intake rows for people who only ever got the auto-created stub.
INSERT INTO org_intake (org_id, user_id, answers)
SELECT
  ap.org_id, ap.user_id,
  -- jsonb_build_object caps at 100 arguments; this survey has ~56 fields
  -- (112 args), so it's built as three chunks merged with ||.
  jsonb_strip_nulls(
    jsonb_build_object(
      'disciplines', to_jsonb(ap.disciplines), 'disciplines_other', ap.disciplines_other,
      'experience_level', ap.experience_level, 'audience_description', ap.audience_description,
      'audience_value', ap.audience_value, 'goals_seeking', ap.goals_seeking,
      'goals_offering', ap.goals_offering, 'aesthetic_notes', ap.aesthetic_notes,
      'features_requested', to_jsonb(ap.features_requested), 'template_preference', ap.template_preference,
      'palette_preference', ap.palette_preference, 'needs', to_jsonb(ap.needs),
      'personal_philosophy', ap.personal_philosophy, 'aesthetic_keywords', to_jsonb(ap.aesthetic_keywords),
      'audience_types', to_jsonb(ap.audience_types), 'client_base', to_jsonb(ap.client_base),
      'goals_options', to_jsonb(ap.goals_options), 'mutual_aid_media', ap.mutual_aid_media
    )
    || jsonb_build_object(
      'mutual_aid_authoring', ap.mutual_aid_authoring, 'features_other', ap.features_other,
      'revenue_sharing_model', ap.revenue_sharing_model, 'overhead_commission', ap.overhead_commission,
      'member_dues_frequency', ap.member_dues_frequency,
      'financial_transparency_access', ap.financial_transparency_access,
      'primary_decision_method', ap.primary_decision_method, 'membership_roles', to_jsonb(ap.membership_roles),
      'dispute_resolution_process', ap.dispute_resolution_process, 'membership_admission', ap.membership_admission,
      'inventory_tracking_system', ap.inventory_tracking_system,
      'fulfillment_responsibility', ap.fulfillment_responsibility,
      'digital_presence_type', to_jsonb(ap.digital_presence_type), 'admin_load_rotation', ap.admin_load_rotation,
      'minimal_viable_income', ap.minimal_viable_income, 'emergency_fund_target', ap.emergency_fund_target,
      'growth_reinvestment', ap.growth_reinvestment, 'sustainability_benchmarks', to_jsonb(ap.sustainability_benchmarks)
    )
    || jsonb_build_object(
      'shared_resource_categories', to_jsonb(ap.shared_resource_categories),
      'bulk_buying_agreements', ap.bulk_buying_agreements, 'mutual_aid_funds', ap.mutual_aid_funds,
      'skill_share_frequency', ap.skill_share_frequency, 'work_trade_availability', ap.work_trade_availability,
      'biz_entity_type', ap.biz_entity_type, 'biz_entity_name', ap.biz_entity_name,
      'biz_mission', ap.biz_mission, 'biz_legal_status', ap.biz_legal_status,
      'biz_primary_revenue', to_jsonb(ap.biz_primary_revenue), 'biz_capacity', ap.biz_capacity,
      'biz_pricing_philosophy', ap.biz_pricing_philosophy, 'biz_tools', ap.biz_tools,
      'biz_fulfillment', ap.biz_fulfillment, 'biz_inventory_management', ap.biz_inventory_management,
      'biz_desired_resources', to_jsonb(ap.biz_desired_resources), 'biz_revenue_sharing', ap.biz_revenue_sharing,
      'biz_skill_share', ap.biz_skill_share, 'biz_main_barrier', ap.biz_main_barrier,
      'biz_revenue_goal', ap.biz_revenue_goal
    )
  )
FROM artist_profiles ap
WHERE ap.biz_entity_type IS NOT NULL OR ap.experience_level IS NOT NULL
   OR ap.personal_philosophy IS NOT NULL OR array_length(ap.disciplines, 1) > 0
ON CONFLICT (org_id, user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- (e) Backfill from directory_profiles → sentinel users + org_profiles
--     Each directory row becomes its own person: a real future account, not
--     a shared anonymous author. Self-referential auth_user_id (no login
--     possible until claimed), NULL email (we don't have one to assert).
--
--     Uses an explicit id-mapping temp table rather than re-matching rows
--     by slug/name after insert — a slug collision or duplicate name would
--     silently drop the org_profiles row under a re-match approach.
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE _dp_migrate ON COMMIT DROP AS
SELECT dp.*, gen_random_uuid() AS new_user_id,
  -- slug is per-org today; only carry it forward when it won't collide
  -- with another directory row's slug (global uniqueness is new).
  CASE WHEN count(*) OVER (PARTITION BY dp.slug) = 1 THEN dp.slug ELSE NULL END AS new_slug
FROM directory_profiles dp
WHERE dp.user_id IS NULL;  -- no prior graduation link recorded

INSERT INTO users (
  id, auth_user_id, display_name, bio, avatar_url, city, region, country,
  social_links, portfolio, claim_status, claimed_by, created_by, verified,
  verified_at, source_note, oad_dossier, slug
)
SELECT
  new_user_id, new_user_id, name,
  CASE
    WHEN jsonb_typeof(bio) = 'array'
      THEN NULLIF((SELECT string_agg(elem, E'\n\n') FROM jsonb_array_elements_text(bio) elem), '')
    ELSE NULL
  END,
  portrait_url, city, region, country,
  COALESCE(links, '[]'::jsonb), COALESCE(artworks, '[]'::jsonb),
  claim_status,
  (SELECT u2.id FROM users u2 WHERE u2.id::text = _dp_migrate.claimed_by LIMIT 1),
  (SELECT u3.id FROM users u3 WHERE u3.id::text = _dp_migrate.created_by LIMIT 1),
  verified, verified_at, source_note,
  jsonb_strip_nulls(jsonb_build_object(
    'dossier_status', dossier_status, 'current_targets', to_jsonb(current_targets),
    'projected_movements', to_jsonb(projected_movements),
    'verified_contacts', to_jsonb(verified_contacts),
    'wanted_accomplices', to_jsonb(wanted_accomplices),
    'operations', operations, 'financial_channels', financial_channels
  )),
  new_slug
FROM _dp_migrate;

INSERT INTO org_profiles (org_id, user_id, role_title, sort_order, is_public)
SELECT org_id, new_user_id, role, sort_order, (status = 'published')
FROM _dp_migrate
ON CONFLICT (org_id, user_id) DO NOTHING;

COMMIT;
