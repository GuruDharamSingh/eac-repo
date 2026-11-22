-- DRAFT (not applied, not numbered): visitor_suggestions kinds for "Suggest an artist or place" (screen 14).
-- Adds kinds 'artist' and 'place_lead' (a place named by web address or reason, no map point), plus url and email.
-- A 'spot' still requires lat/lng; other kinds do not. Reuses /manage/suggestions and the daily limit.
ALTER TABLE visitor_suggestions DROP CONSTRAINT IF EXISTS visitor_suggestions_kind_check;
ALTER TABLE visitor_suggestions ADD CONSTRAINT visitor_suggestions_kind_check
  CHECK (kind IN ('spot','route','artist','place_lead'));
-- visitor_suggestions_spot_point is already (kind <> 'spot' OR lat/lng present): unchanged.

ALTER TABLE visitor_suggestions ADD COLUMN IF NOT EXISTS url text
  CHECK (url IS NULL OR url ~ '^https?://');
ALTER TABLE visitor_suggestions ADD COLUMN IF NOT EXISTS contact_email text;

-- Screen rule: a name (title), and a web address or a reason (note).
ALTER TABLE visitor_suggestions DROP CONSTRAINT IF EXISTS visitor_suggestions_lead_has_substance;
ALTER TABLE visitor_suggestions ADD CONSTRAINT visitor_suggestions_lead_has_substance
  CHECK (kind NOT IN ('artist','place_lead') OR url IS NOT NULL OR (note IS NOT NULL AND length(trim(note)) > 0));
