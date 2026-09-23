-- ============================================================================
-- 162: give store:2 (the gallery page split out in 161) its own heading.
--
-- Data only — the render side (IFAC's artist route, wired in this same
-- session) stays generic and shows whatever heading each block carries
-- rather than hardcoding "Gallery" for a key that happens to be named
-- store:2. A future second or third page names itself the same way.
-- ============================================================================

UPDATE user_pages
SET data = jsonb_set(data, '{content,0,props,heading}', '"More Work"'::jsonb)
WHERE user_id = '4eebc495-1db6-4b1e-a5b3-399326c78fe6' AND org_id = 'ifac' AND key = 'store:2';
