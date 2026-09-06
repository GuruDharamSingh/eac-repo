-- ============================================================================
-- Migration 081: org_domains — serve an org on a full domain, not just a
--                *.artscollective.com subdomain
-- ============================================================================
-- Until now the host → org mapping was *derived*: arts-collective's middleware
-- parsed "acme" out of "acme.artscollective.com" and used it as the org slug.
-- That works exactly as long as every site lives under one apex we control,
-- which is fine for a network directory and useless for a real business that
-- owns amritcanada.com.
--
-- This makes the mapping data instead of string surgery. A row here means
-- "requests arriving on this Host are this org's site". The middleware stops
-- parsing and starts looking up, which is what lets a client keep their own
-- domain while still being served by the shared multi-tenant app.
--
-- Design notes:
--
-- (a) `domain` is the primary key, not (org_id, domain). A hostname can only
--     ever belong to one org — making that a PK constraint means the database
--     refuses domain hijacking rather than relying on application checks.
--
-- (b) Aliases are just extra rows. "www.amritcanada.com" and "amritcanada.com"
--     are two rows pointing at the same org; both serve the site. Canonical
--     redirects (www → apex) are a later concern and deliberately NOT done
--     here — serving both is correct and shipping a redirect loop is not.
--
-- (c) `is_primary` marks the one domain to use when the app has to *generate*
--     an absolute URL for an org (emails, share links, canonical tags). The
--     partial unique index enforces at most one per org.
--
-- (d) `verified_at` is recorded but NOT enforced by the lookup. There is no
--     DNS-verification flow yet, and gating on a column nothing can currently
--     set would mean no custom domain ever resolves. Rows are admin-inserted
--     today, so the trust boundary is "who can write this table", which is the
--     same boundary as the rest of the schema. When a verification flow lands,
--     tighten the read query — the column is here so that change is additive.
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_domains (
  domain      TEXT PRIMARY KEY,
  org_id      VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  is_primary  BOOLEAN      NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Stored normalised: lowercase, no scheme, no port, no trailing dot, no
  -- path. The application normalises before insert and before lookup; this
  -- keeps a malformed row from silently never matching.
  CONSTRAINT org_domains_domain_normalised CHECK (
    domain = lower(domain)
    AND domain NOT LIKE '%/%'
    AND domain NOT LIKE '%:%'
    AND domain NOT LIKE '%.'
    AND domain LIKE '%.%'
  )
);

CREATE INDEX IF NOT EXISTS idx_org_domains_org ON org_domains (org_id);

-- At most one primary domain per org.
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_domains_one_primary
  ON org_domains (org_id)
  WHERE is_primary;

COMMENT ON TABLE org_domains IS
  'Host header → organization. One row per domain or alias serving an org site.';
COMMENT ON COLUMN org_domains.is_primary IS
  'The canonical domain for generating absolute URLs for this org.';
COMMENT ON COLUMN org_domains.verified_at IS
  'Set when DNS ownership was proven. Recorded but not yet enforced at lookup.';
