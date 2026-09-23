-- ============================================================================
-- 148: video pipelines live under the org's Private/ folder.
--
-- 147 seeded InnerGathering's pipeline at `Video/Meeting recordings`. Media
-- authorization (services media-authz.ts) treats any org path WITHOUT a
-- `Private` segment as public, so every app's /api/media proxy would have
-- served unpublished meeting recordings to anyone holding the URL. Under
-- `Private/` the existing rule gates them to the org's affiliates, with no
-- new authorization code. createVideoPipeline now uses the same root.
-- ============================================================================

UPDATE video_pipelines
SET folder = 'Private/' || folder
WHERE folder NOT ILIKE 'private/%';

UPDATE video_jobs
SET source_path    = regexp_replace(source_path,    '^(EAC_Network/[^/]+)/Video/', '\1/Private/Video/'),
    output_path    = regexp_replace(output_path,    '^(EAC_Network/[^/]+)/Video/', '\1/Private/Video/'),
    thumbnail_path = regexp_replace(thumbnail_path, '^(EAC_Network/[^/]+)/Video/', '\1/Private/Video/');
