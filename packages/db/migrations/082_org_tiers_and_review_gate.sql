-- ============================================================================
-- Migration 082: Make `tier` mean the actual product, and turn
--                `subdomain_confirmed` into the review gate it was named for
-- ============================================================================
-- Both columns already existed and neither was ever used:
--
--   tier                 CHECK ('free','standard','patron') — all 14 orgs sit
--                        on the 'free' default. Nothing in the repo reads or
--                        writes it. The values were placeholders from before
--                        the product had tiers.
--
--   subdomain_confirmed  written once as TRUE by /api/org/create and never
--                        read again. The name describes a review step that was
--                        never built.
--
-- (a) tier is renamed to the three tiers the collective actually offers:
--
--       free       subdomain, the three-page site, org hub + community hub
--       supported  paid tier; site-building support from Guru Dharam's studio
--       partner    established-business partnership, deeper codebase collaboration
--
--     Existing rows are all 'free', so no data migration is needed — but the
--     UPDATE below is written defensively anyway in case a 'standard'/'patron'
--     row appears between writing and applying this.
--
-- (b) subdomain_confirmed becomes the interview gate. Every tier requires a
--     conversation with the collective before the site serves publicly, so new
--     orgs now default to FALSE and an admin flips it after the interview.
--
--     The default flips, but existing rows are left TRUE on purpose: those 14
--     orgs predate the gate and several are live. Retroactively unpublishing
--     them to satisfy a new process would be the migration breaking real sites
--     to enforce a rule they were never subject to.
-- ============================================================================

-- (a) ------------------------------------------------------------------------

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_tier_check;

UPDATE organizations SET tier = 'supported' WHERE tier = 'standard';
UPDATE organizations SET tier = 'partner'   WHERE tier = 'patron';

ALTER TABLE organizations
  ALTER COLUMN tier SET DEFAULT 'free';

ALTER TABLE organizations
  ADD CONSTRAINT organizations_tier_check
  CHECK (tier IN ('free', 'supported', 'partner'));

COMMENT ON COLUMN organizations.tier IS
  'Product tier: free (subdomain), supported (paid, build support), partner (partnership).';

-- (b) ------------------------------------------------------------------------

ALTER TABLE organizations
  ALTER COLUMN subdomain_confirmed SET DEFAULT FALSE;

COMMENT ON COLUMN organizations.subdomain_confirmed IS
  'FALSE until the collective has done the intake interview. Unconfirmed sites '
  'render a pending notice to the public; owners and editors still see the site.';

-- Who approved, and when. Nullable: the 14 pre-gate orgs have no reviewer.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_pending
  ON organizations (created_at DESC)
  WHERE NOT subdomain_confirmed;
