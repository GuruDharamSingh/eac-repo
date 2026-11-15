-- ============================================================================
-- 264: per-site placement (2026-11-11).
--
-- A person's files live in their own library (EAC_Network/users/<folder>/);
-- each site keeps its own list of what it shows, chosen there, never derived
-- from where the file is stored or from another site's list. Decisions 2-4 of
-- docs/open/MEDIA_OWNERSHIP_AND_PLACEMENT_2026-11-11.md (developer, 2026-11-11).
--
--   org_profiles.portfolio   the portfolio this org's site shows for this
--                            person. NULL or [] = nothing. users.portfolio stays
--                            the person's home list (ArtDirect /<slug>,
--                            arts-collective /artists/<slug>). Seeded from
--                            users.portfolio for every existing row, so every
--                            site shows at cutover exactly what it showed before.
--
--   user_galleries.shown_on  opt-in: the sites, besides the gallery's origin,
--                            that show it. Replaces hidden_on (opt-out: empty
--                            meant every site that reads it). Seeded with the
--                            sites where the gallery shows today: every org the
--                            person has an org_profiles or user_organizations
--                            row in, minus hidden_on, minus the origin (implied).
--                            hidden_on is kept, unread by new code, so builds
--                            made before this change keep working until rebuilt.
-- ============================================================================

ALTER TABLE org_profiles
  ADD COLUMN IF NOT EXISTS portfolio JSONB;

COMMENT ON COLUMN org_profiles.portfolio IS
  'The portfolio this org''s site shows for this person (migration 264). NULL or [] = nothing; it does not fall back to users.portfolio, which is the person''s home list.';

UPDATE org_profiles op
   SET portfolio = u.portfolio
  FROM users u
 WHERE u.id = op.user_id
   AND op.portfolio IS NULL
   AND jsonb_typeof(u.portfolio) = 'array'
   AND jsonb_array_length(u.portfolio) > 0;

ALTER TABLE user_galleries
  ADD COLUMN IF NOT EXISTS shown_on TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN user_galleries.shown_on IS
  'Sites besides origin that show this gallery (migration 264, opt-in). Supersedes hidden_on.';

UPDATE user_galleries g
   SET shown_on = s.sites
  FROM (
    SELECT g2.id,
           COALESCE(ARRAY(
             SELECT DISTINCT o.org_id::text
               FROM (
                 SELECT op.org_id FROM org_profiles op WHERE op.user_id = g2.user_id
                 UNION
                 SELECT uo.org_id FROM user_organizations uo WHERE uo.user_id = g2.user_id
               ) o
              WHERE NOT (o.org_id::text = ANY (g2.hidden_on))
                AND o.org_id::text IS DISTINCT FROM g2.origin
              ORDER BY 1
           ), '{}') AS sites
      FROM user_galleries g2
  ) s
 WHERE s.id = g.id
   AND g.shown_on = '{}';
