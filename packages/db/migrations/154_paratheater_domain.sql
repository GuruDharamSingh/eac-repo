-- ============================================================================
-- 154: `sunjay` gets its public address — paratheater.arts-collective.com
--
-- The org had no `org_domains` row at all, so nothing in the network knew
-- where Para Theater lives: `/sites/sunjay` had no home to point at and every
-- cross-site link fell back to the network host.
--
-- WHAT THIS ROW DOES NOT DO: it does not route traffic. Nginx Proxy Manager
-- sends this hostname straight to the app on :3001, so arts-collective's
-- middleware never sees the request and never consults this table. The same is
-- true of the ifacgroup.com / amritcanada.ca / hiddenenneagram.com rows — two
-- mechanisms claim those hostnames and only the proxy one is real (see
-- DOMAIN_AND_STORAGE_AUDIT_2026-09-15.md). This row is for the network's own
-- domain-awareness: "where is this org's home", used for linking out.
--
-- `verified_at` is set because the proxy host and its certificate were created
-- in the same change, i.e. the domain demonstrably resolves here. The column
-- has no enforcement at lookup — it is a record, not a gate.
--
-- No `www.` variant: a wildcard covers one label, so `www.paratheater...` is
-- two levels deep and does not resolve.
-- ============================================================================

INSERT INTO org_domains (domain, org_id, is_primary, verified_at)
VALUES ('paratheater.arts-collective.com', 'sunjay', TRUE, now())
ON CONFLICT (domain) DO UPDATE
  SET org_id = EXCLUDED.org_id,
      is_primary = EXCLUDED.is_primary,
      verified_at = COALESCE(org_domains.verified_at, EXCLUDED.verified_at);
