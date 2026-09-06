-- ============================================================================
-- Migration 088: questionnaires + responses — a home for wizard answers
-- ============================================================================
-- `artist_profiles` is not a profile. Of its 72 columns, 55 are wizard answers
-- (37 business/co-op, 18 artist intake) and the remaining identity columns were
-- superseded by users/org_profiles in migration 084. It is a questionnaire
-- wearing a profile's name, and that mismatch is what blocks inner-gathering
-- and arts-collective from migrating: their reads and writes touch 16 fields
-- that have nowhere to go.
--
-- Columns are the wrong shape for what these wizards are actually for:
--
--   * Answers change. Goals in 2026 differ from 2027; a column holds one
--     answer forever and silently overwrites the last one.
--   * Answers get reviewed. Elkdonis vetting needs to know who reviewed what,
--     when, and whether it passed — none of which a profile column expresses.
--   * There will be more wizards. One business wizard cost 37 columns. The
--     next costs 30 more, each a migration and a schema read nobody performs.
--
-- So: a definition table and a response table, answers as JSONB.
--
-- JSONB rather than typed columns is a deliberate trade. Validation lives in
-- the wizard's Zod schemas (apps/arts-collective/src/lib/schema.ts), which is
-- already the only place it was ever enforced — artist_profiles had CHECK
-- constraints on exactly two of its 55 answer columns. What is gained is that
-- adding a wizard becomes a row instead of a migration.
--
-- Scope: 'user' questionnaires belong to a person across the whole network
-- (the Elkdonis-hub workbooks — goals, needs, pathways). 'org' questionnaires
-- belong to a person AS THEY ACT FOR one org (the collective-hub business and
-- governance wizards). org_id is therefore nullable and meaningful.
-- ============================================================================

CREATE TABLE IF NOT EXISTS questionnaires (
  key         TEXT PRIMARY KEY,
  title       TEXT        NOT NULL,
  description TEXT,
  version     INTEGER     NOT NULL DEFAULT 1,
  scope       TEXT        NOT NULL CHECK (scope IN ('user', 'org')),

  -- When a response to this is reviewed and passed, the answerer may be
  -- promoted to this users.network_tier. NULL = informational only, gates
  -- nothing. The promotion is an application decision; this records intent.
  gates_tier  VARCHAR(20) CHECK (gates_tier IN ('member', 'host', 'partner')),

  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE questionnaires IS
  'Wizard/workbook definitions. Adding a wizard is a row here, not a migration.';

CREATE TABLE IF NOT EXISTS questionnaire_responses (
  id                VARCHAR(21) PRIMARY KEY,
  questionnaire_key TEXT        NOT NULL REFERENCES questionnaires(key) ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- NULL for scope='user'. Set for scope='org' — the same person can answer
  -- the business wizard differently for two different collectives.
  org_id            VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,

  answers           JSONB       NOT NULL DEFAULT '{}'::jsonb,

  --   draft      being filled in; only the answerer sees it
  --   submitted  handed to Elkdonis; awaiting review
  --   reviewed   an admin has passed it
  --   returned   an admin sent it back — review_note says why
  status            VARCHAR(20) NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'submitted', 'reviewed', 'returned')),

  submitted_at      TIMESTAMPTZ,
  reviewed_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  review_note       TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One response in flight per questionnaire per subject. Reviewed and returned
-- rows accumulate as history, which is the point — you can see what someone
-- said last year. NULLS NOT DISTINCT so two user-scoped responses (org_id
-- NULL) actually collide instead of both being allowed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_one_open
  ON questionnaire_responses (questionnaire_key, user_id, org_id) NULLS NOT DISTINCT
  WHERE status IN ('draft', 'submitted');

CREATE INDEX IF NOT EXISTS idx_qr_user    ON questionnaire_responses (user_id);
CREATE INDEX IF NOT EXISTS idx_qr_org     ON questionnaire_responses (org_id) WHERE org_id IS NOT NULL;
-- The review queue: everything waiting on an Elkdonis admin, oldest first.
CREATE INDEX IF NOT EXISTS idx_qr_pending ON questionnaire_responses (submitted_at)
  WHERE status = 'submitted';

-- ---------------------------------------------------------------------------
-- The two questionnaires that exist today
-- ---------------------------------------------------------------------------
INSERT INTO questionnaires (key, title, description, scope, gates_tier, sort_order) VALUES
  ('artist-intake',
   'Artist intake',
   'Your practice, audience, goals, and what you need from the collective.',
   'user', 'host', 1),
  ('collective-business',
   'Collective business & governance',
   'How your collective earns, decides, shares, and sustains itself.',
   'org', 'partner', 2)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Backfill from artist_profiles
-- ---------------------------------------------------------------------------
-- Only non-stub rows: signup drafts an is_stub profile for everyone, so
-- migrating those would fill the review queue with empty submissions.
-- Status 'submitted' rather than 'reviewed' — these were answered but never
-- looked at by anyone, which is exactly what "awaiting review" means.
-- Identity fields (display_name/bio/city/photo_url) are deliberately NOT
-- copied: migration 084 already moved those to users.

INSERT INTO questionnaire_responses (id, questionnaire_key, user_id, org_id, answers, status, submitted_at, created_at, updated_at)
SELECT
  substr(md5(ap.user_id::text || 'artist-intake'), 1, 21),
  'artist-intake',
  ap.user_id,
  NULL,
  jsonb_strip_nulls(jsonb_build_object(
    'disciplines',         to_jsonb(ap.disciplines),
    'disciplinesOther',    ap.disciplines_other,
    'experienceLevel',     ap.experience_level,
    'portfolioUrl',        ap.portfolio_url,
    'audienceTypes',       to_jsonb(ap.audience_types),
    'clientBase',          to_jsonb(ap.client_base),
    'audienceDescription', ap.audience_description,
    'audienceValue',       ap.audience_value,
    'goalsOptions',        to_jsonb(ap.goals_options),
    'goalsSeeking',        ap.goals_seeking,
    'goalsOffering',       ap.goals_offering,
    'mutualAidMedia',      ap.mutual_aid_media,
    'mutualAidAuthoring',  ap.mutual_aid_authoring,
    'personalPhilosophy',  ap.personal_philosophy,
    'aestheticKeywords',   to_jsonb(ap.aesthetic_keywords),
    'aestheticNotes',      ap.aesthetic_notes,
    'needs',               to_jsonb(ap.needs),
    'featuresRequested',   to_jsonb(ap.features_requested),
    'featuresOther',       ap.features_other,
    'templatePreference',  ap.template_preference,
    'palettePreference',   ap.palette_preference
  )),
  'submitted',
  ap.updated_at,
  ap.created_at,
  ap.updated_at
FROM artist_profiles ap
WHERE ap.is_stub = FALSE
  AND (array_length(ap.disciplines, 1) > 0 OR ap.personal_philosophy IS NOT NULL)
ON CONFLICT DO NOTHING;

INSERT INTO questionnaire_responses (id, questionnaire_key, user_id, org_id, answers, status, submitted_at, created_at, updated_at)
SELECT
  substr(md5(ap.user_id::text || ap.org_id || 'collective-business'), 1, 21),
  'collective-business',
  ap.user_id,
  ap.org_id,
  jsonb_strip_nulls(jsonb_build_object(
    'entityType',              ap.biz_entity_type,
    'entityName',              ap.biz_entity_name,
    'mission',                 ap.biz_mission,
    'legalStatus',             ap.biz_legal_status,
    'primaryRevenue',          to_jsonb(ap.biz_primary_revenue),
    'capacity',                ap.biz_capacity,
    'pricingPhilosophy',       ap.biz_pricing_philosophy,
    'tools',                   ap.biz_tools,
    'fulfillment',             ap.biz_fulfillment,
    'inventoryManagement',     ap.biz_inventory_management,
    'desiredResources',        to_jsonb(ap.biz_desired_resources),
    'revenueSharing',          ap.biz_revenue_sharing,
    'skillShare',              ap.biz_skill_share,
    'mainBarrier',             ap.biz_main_barrier,
    'revenueGoal',             ap.biz_revenue_goal,
    'revenueSharingModel',     ap.revenue_sharing_model,
    'overheadCommission',      ap.overhead_commission,
    'memberDuesFrequency',     ap.member_dues_frequency,
    'financialTransparency',   ap.financial_transparency_access,
    'primaryDecisionMethod',   ap.primary_decision_method,
    'membershipRoles',         to_jsonb(ap.membership_roles),
    'disputeResolution',       ap.dispute_resolution_process,
    'membershipAdmission',     ap.membership_admission,
    'inventoryTracking',       ap.inventory_tracking_system,
    'fulfillmentResponsibility', ap.fulfillment_responsibility,
    'digitalPresenceType',     to_jsonb(ap.digital_presence_type),
    'adminLoadRotation',       ap.admin_load_rotation,
    'minimalViableIncome',     ap.minimal_viable_income,
    'emergencyFundTarget',     ap.emergency_fund_target,
    'growthReinvestment',      ap.growth_reinvestment,
    'sustainabilityBenchmarks', to_jsonb(ap.sustainability_benchmarks),
    'sharedResourceCategories', to_jsonb(ap.shared_resource_categories),
    'bulkBuyingAgreements',    ap.bulk_buying_agreements,
    'mutualAidFunds',          ap.mutual_aid_funds,
    'skillShareFrequency',     ap.skill_share_frequency,
    'workTradeAvailability',   ap.work_trade_availability
  )),
  'submitted',
  ap.updated_at,
  ap.created_at,
  ap.updated_at
FROM artist_profiles ap
WHERE ap.is_stub = FALSE
  AND (ap.biz_entity_type IS NOT NULL OR ap.biz_mission IS NOT NULL)
ON CONFLICT DO NOTHING;

-- artist_profiles is intentionally NOT dropped here. inner-gathering and
-- arts-collective still read and write it; this migration gives their data a
-- destination so those call sites can move. Drop it once they have.
