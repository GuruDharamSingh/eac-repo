-- ============================================================================
-- 152: the `sunjay` org is called **Para Theater**.
--
-- Named "Sunjay's Teaching Circle" when the org row was created (before this
-- site existed) and again by migration 150. The owner's call, 2026-09-19.
--
-- The ORG ID stays `sunjay`. It is a primary key with foreign keys from
-- threads, org_feeds, org_profiles, user_organizations, site_config and
-- org_site_sections, it appears in Nextcloud storage paths
-- (`EAC_Network/sunjay/...`) that hold real files, and it is not user-visible
-- anywhere. Renaming a display name is a copy edit; renaming the id would be a
-- data migration across a dozen tables to change nothing a visitor can see.
--
-- Display copy lives in three places and all three have to agree, or the site
-- says two different names on one page:
--   organizations.name        the network-wide label (admin, forum, feeds)
--   org_site_sections.hero    the <h1> on the landing page
--   org_site_sections.footer  the footer wordmark
-- (The fourth, siteConfig.orgName, is code — changed alongside this.)
--
-- Each UPDATE is scoped to the exact superseded string, so re-running cannot
-- overwrite a name the owner has since edited through /manage/pages.
-- ============================================================================

UPDATE organizations
SET name = 'Para Theater'
WHERE id = 'sunjay' AND name = 'Sunjay''s Teaching Circle';

UPDATE org_site_sections
SET content = jsonb_set(content, '{title}', '"Para Theater"'::jsonb),
    updated_at = now()
WHERE org_id = 'sunjay'
  AND section_key = 'hero'
  AND content->>'title' = 'Sunjay''s Teaching Circle';

UPDATE org_site_sections
SET content = jsonb_set(content, '{body}', '"Para Theater"'::jsonb),
    updated_at = now()
WHERE org_id = 'sunjay'
  AND section_key = 'footer'
  AND content->>'body' = 'Sunjay''s Teaching Circle';
