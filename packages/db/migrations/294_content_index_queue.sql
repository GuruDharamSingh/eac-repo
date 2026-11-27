-- ============================================================================
-- 294: content_index_queue + triggers (CONTENT_CORNERSTONE CONTRACT §12)
--
-- Triggers on threads, artwork and auction_lot only enqueue the affected key.
-- There is no indexing logic in SQL: the one mapping stays in
-- packages/services/src/content-index.ts, which drains the queue (searchContent
-- drains <= 25 keys before it queries; content-reindex.mts drains all) and
-- deletes a key only after its re-index succeeded.
--
-- Re-enqueueing an already queued key refreshes queued_at (clock_timestamp), so
-- a change that lands while that key is being re-indexed is never lost: the
-- drain deletes a key only if queued_at is still the value it read.
-- Updates are limited to the columns the index reads (not view or reply counts).
-- ============================================================================

CREATE TABLE IF NOT EXISTS content_index_queue (
  key       TEXT        PRIMARY KEY,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_content_index_queue_at ON content_index_queue (queued_at);

CREATE OR REPLACE FUNCTION content_index_enqueue_thread() RETURNS trigger AS $$
BEGIN
  INSERT INTO content_index_queue (key, queued_at)
  VALUES ('thread:' || COALESCE(NEW.id, OLD.id), clock_timestamp())
  ON CONFLICT (key) DO UPDATE SET queued_at = EXCLUDED.queued_at;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION content_index_enqueue_artwork() RETURNS trigger AS $$
BEGIN
  INSERT INTO content_index_queue (key, queued_at)
  VALUES ('artwork:' || COALESCE(NEW.id, OLD.id)::text, clock_timestamp())
  ON CONFLICT (key) DO UPDATE SET queued_at = EXCLUDED.queued_at;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION content_index_enqueue_lot() RETURNS trigger AS $$
DECLARE
  art uuid;
BEGIN
  SELECT v.artwork_id INTO art FROM artwork_variant v WHERE v.id = COALESCE(NEW.artwork_variant_id, OLD.artwork_variant_id);
  IF art IS NOT NULL THEN
    INSERT INTO content_index_queue (key, queued_at) VALUES ('artwork:' || art::text, clock_timestamp())
    ON CONFLICT (key) DO UPDATE SET queued_at = EXCLUDED.queued_at;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_content_index_threads_iud ON threads;
CREATE TRIGGER trg_content_index_threads_iud AFTER INSERT OR DELETE ON threads
  FOR EACH ROW EXECUTE FUNCTION content_index_enqueue_thread();
DROP TRIGGER IF EXISTS trg_content_index_threads_u ON threads;
CREATE TRIGGER trg_content_index_threads_u
  AFTER UPDATE OF kind, org_id, author_id, title, body, excerpt, status, visibility, min_role, scheduled_at, published_at, updated_at, video_url, section, metadata
  ON threads FOR EACH ROW EXECUTE FUNCTION content_index_enqueue_thread();

DROP TRIGGER IF EXISTS trg_content_index_artwork_iud ON artwork;
CREATE TRIGGER trg_content_index_artwork_iud AFTER INSERT OR DELETE ON artwork
  FOR EACH ROW EXECUTE FUNCTION content_index_enqueue_artwork();
DROP TRIGGER IF EXISTS trg_content_index_artwork_u ON artwork;
CREATE TRIGGER trg_content_index_artwork_u
  AFTER UPDATE OF store_id, artist_user_id, credited_artist_user_id, credit_status, kind, status, title, description_html, medium, style, subject, primary_image_id, metadata, updated_at
  ON artwork FOR EACH ROW EXECUTE FUNCTION content_index_enqueue_artwork();

DROP TRIGGER IF EXISTS trg_content_index_lot_iud ON auction_lot;
CREATE TRIGGER trg_content_index_lot_iud AFTER INSERT OR DELETE ON auction_lot
  FOR EACH ROW EXECUTE FUNCTION content_index_enqueue_lot();
DROP TRIGGER IF EXISTS trg_content_index_lot_u ON auction_lot;
CREATE TRIGGER trg_content_index_lot_u AFTER UPDATE OF status, series_id, artwork_variant_id ON auction_lot
  FOR EACH ROW EXECUTE FUNCTION content_index_enqueue_lot();
