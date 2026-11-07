-- ============================================================================
-- 242: business listings, claims, place ↔ business links (2026-11-04).
--
-- Design: docs/open/ASSOCIATED_BUSINESSES_2026-11-04.md (Senior Code Officer), with
-- Justin's decisions of 2026-11-04 (recorded in ELKTOURS_EXPERIENCES_SPEC):
--   * A business is a users row with entity_type = 'organization' (the "associated org"
--     model). While nobody owns it, it is a SHELL: claim_status = 'unclaimed',
--     auth_user_id = id (never logs in). Shells ARE listed in the directory
--     (directory_listed = true) and always marked "Unclaimed · listed by <steward>".
--   * business_listings  the facts sidecar (address, hours, category, website,
--                        OSM/Wikidata refs, per-field sources, steward, status). A
--                        removed listing stays as a tombstone so imports skip it.
--   * business_claims    non-merging claims with a method, evidence and decision
--                        history. NEVER approved through profiles.approveClaim (that
--                        merges the sentinel into the claimant). Approvers: platform
--                        admins; the steward org's owners too for in_person claims.
--                        A claimed business may stay a light owned listing.
--   * place_businesses   org-owned link (follows places.org_id): many-to-many with
--                        history, at most one current primary per place. Tenant RLS.
--   Removal: immediate before a claim; 30 days after (removal_due_at).
--   No reviews, vouches, sales, bookings or payouts on a shell.
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_listings (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- places.operating_kind vocabulary: bakery | butcher | cheese | wine_shop | shop | restaurant
  -- | cafe | bar | cabaret | museum | gallery | church | synagogue | theatre | bookshop | market ...
  category         text,
  street_address   text,
  postal_code      text,
  city             text,
  country          text,
  lat              double precision,
  lng              double precision,
  website          text CHECK (website IS NULL OR website ~ '^https://'),
  -- 'confirmed' | 'pending_review' (low-confidence match, shown only after review) | 'none'
  website_status   text NOT NULL DEFAULT 'none' CHECK (website_status IN ('confirmed','pending_review','none')),
  phone            text,
  -- OSM opening_hours syntax, as sourced.
  opening_hours    text,
  osm_ref          text,
  wikidata_ref     text,
  -- per field: {source: 'osm'|'wikidata'|'web'|'steward', ref, fetched_at, attribution}
  facts_source     jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Optional street-front photo by the steward (credited).
  photo_url        text,
  photo_credit     text,
  status           text NOT NULL DEFAULT 'shell' CHECK (status IN ('shell','claimed','removed')),
  -- NULL = the platform.
  steward_org_id   varchar(50) REFERENCES organizations(id) ON DELETE SET NULL,
  listed_by_org_id varchar(50) REFERENCES organizations(id) ON DELETE SET NULL,
  listed_by_user   uuid REFERENCES users(id) ON DELETE SET NULL,
  -- Set when a claim is approved. claimed_org_id stays NULL for a light owned listing.
  claimed_by_user  uuid REFERENCES users(id) ON DELETE SET NULL,
  claimed_org_id   varchar(50) REFERENCES organizations(id) ON DELETE SET NULL,
  claimed_at       timestamptz,
  removal_requested_at timestamptz,
  removal_requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  removal_due_at   timestamptz,
  removed_at       timestamptz,
  removed_reason   text,
  created_at       timestamptz NOT NULL DEFAULT NOW(),
  updated_at       timestamptz NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS business_listings_osm ON business_listings (osm_ref) WHERE osm_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS business_listings_wikidata ON business_listings (wikidata_ref) WHERE wikidata_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_business_listings_steward ON business_listings (steward_org_id) WHERE status <> 'removed';

CREATE TABLE IF NOT EXISTS business_claims (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimant_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method           text NOT NULL CHECK (method IN ('domain_email','phone','document','in_person','steward_vouch')),
  -- contact details given, role at the business, Private/ media paths only.
  evidence         jsonb NOT NULL DEFAULT '{}'::jsonb,
  message          text,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn')),
  decided_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_at       timestamptz,
  reason           text,
  created_at       timestamptz NOT NULL DEFAULT NOW(),
  updated_at       timestamptz NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS business_claims_one_open
  ON business_claims (business_user_id, claimant_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_business_claims_queue ON business_claims (status, created_at DESC);

CREATE TABLE IF NOT EXISTS place_businesses (
  place_id         uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  business_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id           varchar(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  relation         text NOT NULL DEFAULT 'operates' CHECK (relation IN ('operates','hosts','former')),
  is_primary       boolean NOT NULL DEFAULT false,
  created_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (place_id, business_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS place_businesses_one_primary
  ON place_businesses (place_id) WHERE is_primary AND relation <> 'former';
CREATE INDEX IF NOT EXISTS idx_place_businesses_business ON place_businesses (business_user_id);

ALTER TABLE place_businesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON place_businesses;
CREATE POLICY tenant_isolation ON place_businesses FOR ALL TO eac_tenant
  USING (org_id::text = app_org_id()) WITH CHECK (org_id::text = app_org_id());
