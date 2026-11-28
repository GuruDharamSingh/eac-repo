-- ============================================================================
-- 298: content_index gains the identity stores `person` and `org`
--      (CONTENT_CORNERSTONE CONTRACT v1.3, EXTENDING.md; 2026-11-26)
--
-- `person` rows are ArtDirect's directory: one row per public identity
-- (users with a slug and directory_listed, either entity_type), keyed by that
-- identity's own id. A pseudonym is its own row; nothing links it to an account
-- (owner columns stay NULL, identity_control is never read). `org` is allowed
-- by the CHECK now so a later org indexer needs no second CHECK change; no org
-- rows are written by this migration or its indexer yet.
--
-- Columns added are nullable and used by identity rows only:
--   place_city, place_region, place_country   directory place filters and facets
--   entity_type                               person | organization
--   verified                                  users.verified
--   rank_key                                  the directory order as one text key
--                                             (verified first, then vouches, then name)
-- Row contents are written by packages/services/src/content-index.ts
-- (indexPerson); the triggers below only enqueue keys, like 294.
-- No backfill here: content-reindex.mts --stores=person does it.
-- ============================================================================

ALTER TABLE content_index DROP CONSTRAINT IF EXISTS content_index_store_check;
ALTER TABLE content_index ADD CONSTRAINT content_index_store_check
  CHECK (store IN ('thread', 'artwork', 'file', 'person', 'org'));

ALTER TABLE content_index
  ADD COLUMN IF NOT EXISTS place_city    TEXT,
  ADD COLUMN IF NOT EXISTS place_region  TEXT,
  ADD COLUMN IF NOT EXISTS place_country TEXT,
  ADD COLUMN IF NOT EXISTS entity_type   TEXT,
  ADD COLUMN IF NOT EXISTS verified      BOOLEAN,
  ADD COLUMN IF NOT EXISTS rank_key      TEXT;

CREATE INDEX IF NOT EXISTS idx_content_index_identity_rank
  ON content_index (store, (rank_key COLLATE "C"), (key COLLATE "C"))
  WHERE store IN ('person', 'org');

CREATE OR REPLACE FUNCTION content_index_enqueue_person() RETURNS trigger AS $$
BEGIN
  INSERT INTO content_index_queue (key, queued_at)
  VALUES ('person:' || COALESCE(NEW.id, OLD.id)::text, clock_timestamp())
  ON CONFLICT (key) DO UPDATE SET queued_at = EXCLUDED.queued_at;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION content_index_enqueue_vouch() RETURNS trigger AS $$
BEGIN
  INSERT INTO content_index_queue (key, queued_at)
  VALUES ('person:' || COALESCE(NEW.subject_id, OLD.subject_id)::text, clock_timestamp())
  ON CONFLICT (key) DO UPDATE SET queued_at = EXCLUDED.queued_at;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

-- Users: insert, delete, and updates of the directory columns only (not logins or last-seen).
DROP TRIGGER IF EXISTS trg_content_index_users_iud ON users;
CREATE TRIGGER trg_content_index_users_iud AFTER INSERT OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION content_index_enqueue_person();
DROP TRIGGER IF EXISTS trg_content_index_users_u ON users;
CREATE TRIGGER trg_content_index_users_u
  AFTER UPDATE OF slug, directory_listed, display_name, headline, bio, avatar_url, city, region, country, entity_type, verified, claim_status, oad_dossier
  ON users FOR EACH ROW EXECUTE FUNCTION content_index_enqueue_person();

-- Vouches move a person in the directory order.
DROP TRIGGER IF EXISTS trg_content_index_vouches_iud ON profile_vouches;
CREATE TRIGGER trg_content_index_vouches_iud AFTER INSERT OR DELETE ON profile_vouches
  FOR EACH ROW EXECUTE FUNCTION content_index_enqueue_vouch();
