-- 227: eac_tenant role + row-level security on org-owned tables (2026-11-01).
--
-- The tenancy floor, step one. Until now every app connects as `postgres`
-- (a superuser) and the only thing keeping one org's rows from another org's
-- pages is a hand-written `WHERE org_id = …` in each query.
--
-- This migration adds a second line of defence that code opts into:
--
--   * eac_tenant: a NOLOGIN role with ordinary table privileges and NO
--     superuser / BYPASSRLS. Apps do not log in as it; `withOrg(orgId, fn)` in
--     @elkdonis/db runs a transaction that does
--       SELECT set_config('app.org_id', <org>, true); SET LOCAL ROLE eac_tenant;
--     so every query inside sees only that org's rows.
--   * app_org_id(): the org of the current transaction, NULL when unset.
--   * RLS on the org-owned tables below, with policies that apply TO eac_tenant
--     only. `postgres` is a superuser and bypasses RLS, so every existing query
--     behaves exactly as before. Nothing changes until code calls withOrg().
--   * Fail closed: under eac_tenant with no app.org_id, these tables return
--     nothing and refuse writes.
--
-- Left out of this batch on purpose: tables holding network-wide rows with a
-- NULL org_id (publish_jobs, quotes, questionnaires, questionnaire_responses),
-- the astro corpus tables, and anything scoped by something other than org_id
-- (commerce by store_id, bids by lot_id). They stay readable by eac_tenant.
--
-- users, availability_slots and availability_responses already had RLS enabled
-- with no policy (a leftover); eac_tenant gets an allow-all policy on them so
-- tenant-scoped pages can still join users.
--
-- Rollback: DROP POLICY … ; ALTER TABLE … DISABLE ROW LEVEL SECURITY;
-- DROP OWNED BY eac_tenant; DROP ROLE eac_tenant. Policies are additive and
-- only bind eac_tenant, so dropping them cannot break the postgres connections.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eac_tenant') THEN
    CREATE ROLE eac_tenant NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO eac_tenant;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO eac_tenant;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO eac_tenant;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO eac_tenant;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO eac_tenant;

CREATE OR REPLACE FUNCTION app_org_id() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.org_id', true), '') $$;

-- Org-owned tables: a row belongs to exactly the org in its org_id column.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'site_config', 'org_site_sections', 'site_themes', 'org_domains',
    'org_feeds', 'org_channels', 'org_profiles', 'org_intake', 'org_grants',
    'org_agreements', 'user_pages', 'events', 'series_sessions', 'contacts',
    'social_posts', 'email_sends', 'email_inbox', 'email_events',
    'email_template_settings', 'thread_orgs'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL TO eac_tenant
         USING (org_id::text = app_org_id())
         WITH CHECK (org_id::text = app_org_id())', t);
  END LOOP;
END $$;

-- threads: owned by one org, carried by others through thread_orgs (read only).
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_read ON threads;
CREATE POLICY tenant_read ON threads FOR SELECT TO eac_tenant
  USING (
    org_id::text = app_org_id()
    OR EXISTS (
      SELECT 1 FROM thread_orgs t
      WHERE t.thread_id = threads.id::text AND t.org_id = app_org_id()
    )
  );
DROP POLICY IF EXISTS tenant_write ON threads;
CREATE POLICY tenant_write ON threads FOR ALL TO eac_tenant
  USING (org_id::text = app_org_id())
  WITH CHECK (org_id::text = app_org_id());

-- Tables that already had RLS on with no policy: keep them open to eac_tenant.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users', 'availability_slots', 'availability_responses'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_open ON %I', t);
    EXECUTE format('CREATE POLICY tenant_open ON %I FOR ALL TO eac_tenant USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
