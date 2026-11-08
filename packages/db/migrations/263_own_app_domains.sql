-- ============================================================================
-- 263: org_domains rows for the two own-app sites that had none
--      (owner-approved, 2026-11-08; NETWORK_SERVING_ARCHITECTURE §4.3)
--
-- elktours → elkdonisexperiences.com (+ www). The owner-confirmed public
--   domain. Nginx Proxy Manager host 35 serves BOTH names to the elktours app
--   on :3021 (`server_name elkdonisexperiences.com www.elkdonisexperiences.com`),
--   and .env sets ELKTOURS_URL=https://elkdonisexperiences.com, so both rows
--   go in; the apex is primary.
--
-- katie-the-potter → pottery.arts-collective.com. TEMPORARY: her live host
--   until her own public domain is bought. NPM host 37 sends it to the katie
--   app on :3023, and docker-compose's KATIE_THE_POTTER_URL defaults to it.
--   org_domains has no "temporary" flag; when the real domain lands, insert it
--   as primary and set this row's is_primary = FALSE (one primary per org).
--   (NPM host 36 also answers the misspelt pottery.art-collective.com; that is
--   not the network's domain and gets no row.)
--
-- These are the org_domains rows OWN_APP_SITES (apps/arts-collective
-- src/lib/channel/load.ts) stood in for; that list is retired with this
-- migration. Like 154, a row here does NOT route traffic: NPM sends these
-- hostnames straight to the apps, so arts-collective's middleware never sees
-- them. The rows are the network's record of where each org lives (Channel,
-- org links, /sites/<slug> → home redirects).
--
-- verified_at is set because each proxy host and its certificate already
-- exist, i.e. the domain demonstrably resolves here (154's rule).
--
-- No other gaps: OWN_APP_SITES listed only katie. fourthway is path-based and
-- needs a base_path (site record, Lane B phase 3), not a domain row.
-- ============================================================================

INSERT INTO org_domains (domain, org_id, is_primary, verified_at) VALUES
  ('elkdonisexperiences.com',     'elktours',         TRUE,  now()),
  ('www.elkdonisexperiences.com', 'elktours',         FALSE, now()),
  -- TEMPORARY until Katie's own domain (see header).
  ('pottery.arts-collective.com', 'katie-the-potter', TRUE,  now())
ON CONFLICT DO NOTHING;
